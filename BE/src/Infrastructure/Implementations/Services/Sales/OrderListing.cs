using Application.Common.Models;
using Application.Common.Time;
using Application.DTOs.Orders;
using Domain.Entities.Crm.Customers;
using Domain.Entities.Sales;
using Domain.Entities.Sales.Orders;
using Domain.Enums.Sales.Orders;
using FluentValidation;
using FluentValidation.Results;
using Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Sales;

/// <summary>
/// Lọc, sắp xếp, phân trang danh sách đơn và tính nhãn lúc đọc (07 §2.5, §3.8). Dùng chung cho danh sách đơn, đơn của khách,
/// đơn đã dùng mã. Trùng SĐT tính trong bộ nhớ trên tập đơn đang chờ (nhỏ) rồi lọc theo Id.
/// </summary>
internal static class OrderListing
{
    private static readonly OrderStatus[] Pending = [OrderStatus.ChoThanhToan, OrderStatus.ChoXacNhan];
    private static readonly OrderStatus[] InProgress = [OrderStatus.ChoThanhToan, OrderStatus.ChoXacNhan, OrderStatus.DaXacNhan];

    /// <summary>Đơn chờ có đơn khác cùng số điện thoại cũng đang chờ, đặt cách nhau ≤ 24 giờ (BR-20) → danh sách đơn trùng.</summary>
    public static async Task<Dictionary<Guid, List<DuplicateOrderRef>>> LoadDuplicatesAsync(IQueryable<Order> orders, CancellationToken ct)
    {
        var pending = await orders
            .Where(o => o.Status == OrderStatus.ChoThanhToan || o.Status == OrderStatus.ChoXacNhan)
            .Select(o => new { o.Id, o.Code, o.Phone, o.Status, o.PlacedAt })
            .ToListAsync(ct);

        var result = new Dictionary<Guid, List<DuplicateOrderRef>>();
        foreach (var group in pending.GroupBy(p => p.Phone).Where(g => g.Count() > 1))
        {
            foreach (var a in group)
            {
                var dups = group
                    .Where(b => b.Id != a.Id && OrderWorkflow.IsDuplicatePair(a.PlacedAt, b.PlacedAt))
                    .OrderBy(b => b.PlacedAt)
                    .Select(b => new DuplicateOrderRef { Id = b.Id, Code = b.Code, Status = b.Status, PlacedAt = b.PlacedAt })
                    .ToList();
                if (dups.Count > 0)
                    result[a.Id] = dups;
            }
        }

        return result;
    }

    /// <summary>Áp mọi bộ lọc của <see cref="OrderQuery"/>; <paramref name="includeStatus"/> = false cho số trên tab.</summary>
    public static IQueryable<Order> Filter(
        IQueryable<Order> source, OrderQuery query, IQueryable<Customer> customers, IReadOnlyCollection<Guid> duplicateIds,
        DateTime now, bool includeStatus)
    {
        var q = source;
        if (includeStatus && query.Status is { } status)
            q = q.Where(o => o.Status == status);
        if (query.PaymentStatus is { } paymentStatus)
            q = q.Where(o => o.PaymentStatus == paymentStatus);
        if (query.PaymentMethod is { } method)
            q = q.Where(o => o.PaymentMethod == method);
        if (!string.IsNullOrWhiteSpace(query.ProvinceCode))
            q = q.Where(o => o.ProvinceCode == query.ProvinceCode);
        if (query.CustomerId is { } customerId)
            q = q.Where(o => o.CustomerId == customerId);
        if (query.CouponId is { } couponId)
            q = q.Where(o => o.CouponId == couponId);

        var (from, to) = ParseRange(query.FromDate, query.ToDate);
        if (from is { } f)
            q = q.Where(o => o.PlacedAt >= f);
        if (to is { } t)
            q = q.Where(o => o.PlacedAt < t);

        if (query.GetSearchTerm() is { } term)
        {
            var pattern = LikePattern.Contains(term);
            var phonePattern = LikePattern.Contains(term.Replace(" ", string.Empty, StringComparison.Ordinal));
            q = q.Where(o => AppDbFunctions.Matches(o.Code, pattern)
                || AppDbFunctions.Matches(o.Phone, phonePattern)
                || AppDbFunctions.Matches(o.RecipientName, pattern));
        }

        switch (query.Label)
        {
            case OrderLabel.TrungSdt:
                var ids = duplicateIds.ToList();
                q = q.Where(o => ids.Contains(o.Id));
                break;
            case OrderLabel.GiaoCham:
                var slowBefore = now.AddDays(-SalesRules.SlowDeliveryDays);
                q = q.Where(o => o.Status == OrderStatus.DangGiao && o.Shipment != null && o.Shipment.HandedOverAt < slowBefore);
                break;
            case OrderLabel.KhachCanLuuY:
                q = q.Where(o => InProgress.Contains(o.Status)
                    && customers.Any(c => c.Id == o.CustomerId && c.ReturnCount >= SalesRules.AttentionReturns));
                break;
        }

        return q;
    }

    /// <summary>
    /// Sắp xếp (07 §3.8): <c>sortBy</c> ∈ placedAt, total, code; vắng thì placedAt tăng dần khi lọc trạng thái chờ xử lý,
    /// còn lại giảm dần. Rồi phân trang, chiếu sang <see cref="OrderListItem"/> kèm nhãn.
    /// </summary>
    public static async Task<PaginatedResult<OrderListItem>> PageAsync(
        IQueryable<Order> filtered, OrderQuery query, IQueryable<Customer> customers,
        IReadOnlyDictionary<Guid, List<DuplicateOrderRef>> duplicates, DateTime now, CancellationToken ct)
    {
        var descending = string.IsNullOrWhiteSpace(query.SortDir)
            ? !(query.Status is { } s && InProgress.Contains(s))
            : query.IsDescending();
        IOrderedQueryable<Order> ordered = (query.SortBy?.Trim().ToLowerInvariant()) switch
        {
            "total" => descending ? filtered.OrderByDescending(o => o.Total) : filtered.OrderBy(o => o.Total),
            "code" => descending ? filtered.OrderByDescending(o => o.Code) : filtered.OrderBy(o => o.Code),
            _ => descending ? filtered.OrderByDescending(o => o.PlacedAt) : filtered.OrderBy(o => o.PlacedAt)
        };
        ordered = descending ? ordered.ThenByDescending(o => o.Code) : ordered.ThenBy(o => o.Code);

        var page = await ordered
            .Select(o => new OrderRow(
                o.Id, o.Code, o.PlacedAt, o.CustomerId, o.RecipientName, o.Phone, o.ProvinceName,
                o.Lines.Sum(l => l.Quantity), o.Total, o.PaymentMethod, o.PaymentStatus, o.Status, o.CouponCode, o.Version,
                o.Shipment != null ? (DateTime?)o.Shipment.HandedOverAt : null))
            .ToPaginatedResultAsync(query, ct);

        var customerIds = page.Items.Select(i => i.CustomerId).Distinct().ToList();
        var customerInfo = await customers
            .Where(c => customerIds.Contains(c.Id))
            .Select(c => new { c.Id, c.Name, c.ReturnCount })
            .ToDictionaryAsync(c => c.Id, ct);

        return page.Map(items => items.Select(i =>
        {
            customerInfo.TryGetValue(i.CustomerId, out var customer);
            return new OrderListItem
            {
                Id = i.Id,
                Code = i.Code,
                PlacedAt = i.PlacedAt,
                CustomerId = i.CustomerId,
                CustomerName = customer?.Name ?? i.RecipientName,
                Phone = i.Phone,
                ProvinceName = i.ProvinceName,
                ItemCount = i.ItemCount,
                Total = i.Total,
                PaymentMethod = i.PaymentMethod,
                PaymentStatus = i.PaymentStatus,
                Status = i.Status,
                Labels = OrderWorkflow.Labels(i.Status, i.HandedOverAt, duplicates.ContainsKey(i.Id), customer?.ReturnCount ?? 0, now),
                CouponCode = i.CouponCode,
                Version = i.Version
            };
        }).ToList());
    }

    /// <summary>
    /// Khoảng ngày <c>yyyy-MM-dd</c> giờ Việt Nam → [00:00 ngày đầu, 00:00 ngày sau ngày cuối) UTC. Sai định dạng, cuối trước đầu,
    /// dài hơn 366 ngày → 400 theo trường.
    /// </summary>
    public static (DateTime? From, DateTime? To) ParseRange(string? fromText, string? toText, string fromField = "fromDate", string toField = "toDate")
    {
        DateOnly? from = null, to = null;
        if (!string.IsNullOrWhiteSpace(fromText))
            from = VietnamDates.TryParse(fromText, out var f) ? f : throw Invalid(fromField, "Ngày không đúng định dạng yyyy-MM-dd");
        if (!string.IsNullOrWhiteSpace(toText))
            to = VietnamDates.TryParse(toText, out var t) ? t : throw Invalid(toField, "Ngày không đúng định dạng yyyy-MM-dd");
        if (from is { } a && to is { } b)
        {
            if (b < a)
                throw Invalid(toField, "Ngày kết thúc phải sau ngày bắt đầu");
            if (b.DayNumber - a.DayNumber + 1 > 366)
                throw Invalid(fromField, "Khoảng ngày tối đa 366 ngày");
        }

        return (from is { } x ? VietnamDates.StartOfDayUtc(x) : null, to is { } y ? VietnamDates.EndOfDayExclusiveUtc(y) : null);
    }

    public static ValidationException Invalid(string field, string message) => new([new ValidationFailure(field, message)]);

    private sealed record OrderRow(
        Guid Id, string Code, DateTime PlacedAt, Guid CustomerId, string RecipientName, string Phone, string ProvinceName,
        int ItemCount, decimal Total, PaymentMethod PaymentMethod, PaymentStatus PaymentStatus, OrderStatus Status,
        string? CouponCode, int Version, DateTime? HandedOverAt);
}
