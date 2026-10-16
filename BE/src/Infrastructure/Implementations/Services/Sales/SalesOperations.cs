using Application.Common.Exceptions;
using Application.Common.Time;
using Application.DTOs.Orders;
using Application.DTOs.Storefront;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Common;
using Application.Interfaces.Services.Orders;
using Application.Interfaces.Services.Sales;
using Application.Interfaces.Services.Storefront;
using Application.Mappings.Sales;
using Domain.Entities.Crm.Customers;
using Domain.Entities.Sales;
using Domain.Entities.Sales.Catalog;
using Domain.Entities.Sales.Coupons;
using Domain.Entities.Sales.Locations;
using Domain.Entities.Sales.Orders;
using Domain.Entities.System.Settings;
using Domain.Entities.System.Users;
using Domain.Enums.Sales.Orders;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure.Implementations.Services.Sales;

/// <summary>
/// Nghiệp vụ đơn hàng: đặt hàng công khai (07 §2.2), tra cứu và khách tự hủy, đơn quản trị (§2.5), quét quá hạn thanh toán
/// (§3.5), giả lập khách đặt đơn (§2.9). Một lớp chia nhiều file vì dùng chung phần trừ/cộng tồn, lượt mã, thống kê khách,
/// mã chứng từ và dựng DTO. Mọi ghi chạy trong transaction; tranh chấp ghi (trùng mã chứng từ, trùng <c>clientRequestId</c>)
/// thì chạy lại một lần trong scope mới để đọc dữ liệu mới nhất (cách làm của demo Menu QR).
/// </summary>
public sealed partial class SalesOperations(
    IGenericRepository<Order> orders,
    IGenericRepository<Shipment> shipments,
    IGenericRepository<Customer> customers,
    IGenericRepository<Coupon> coupons,
    IGenericRepository<Product> products,
    IGenericRepository<ProductVariant> variants,
    IGenericRepository<Color> colors,
    IGenericRepository<Category> categories,
    IGenericRepository<Province> provinces,
    IGenericRepository<Ward> wards,
    IGenericRepository<Setting> settings,
    IGenericRepository<User> users,
    IUnitOfWork unitOfWork,
    ICurrentUserService currentUser,
    IMemoryCache cache,
    IServiceScopeFactory scopeFactory,
    TimeProvider time) : ICheckoutService, IOrderLookupService, IOrderService, IOrderWorkflow, ISalesDemoService
{
    private bool _isRetry;

    private DateTime Now => time.GetUtcNow().UtcDateTime;

    // ---------------------------------------------------------------- Chạy lại, quét quá hạn

    /// <summary>Chạy lại một lần trong scope mới khi gặp tranh chấp ghi (DbUpdateException).</summary>
    private async Task<T> WithRetryAsync<T>(Func<SalesOperations, Task<T>> action)
    {
        try
        {
            return await action(this);
        }
        catch (DbUpdateException ex) when (!_isRetry && ex is not DbUpdateConcurrencyException)
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var fresh = (SalesOperations)scope.ServiceProvider.GetRequiredService<IOrderService>();
            fresh._isRetry = true;
            return await action(fresh);
        }
    }

    private async Task<T> InFreshScopeAsync<T>(Func<SalesOperations, Task<T>> action)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        return await action((SalesOperations)scope.ServiceProvider.GetRequiredService<IOrderService>());
    }

    /// <summary>Quét lười (07 §3.5): có đơn quá hạn thì quét trong scope riêng để không làm bẩn DbContext của request.</summary>
    public async Task EnsureSweptAsync(CancellationToken ct = default)
    {
        var now = Now;
        var any = await orders.QueryNoTracking()
            .AnyAsync(o => o.Status == OrderStatus.ChoThanhToan && o.PaymentDueAt != null && o.PaymentDueAt <= now, ct);
        if (any)
            await InFreshScopeAsync(s => s.SweepOverdueAsync(ct));
    }

    public async Task<int> SweepOverdueAsync(CancellationToken ct = default)
    {
        var now = Now;
        var due = await orders.QueryNoTracking()
            .Where(o => o.Status == OrderStatus.ChoThanhToan && o.PaymentDueAt != null && o.PaymentDueAt <= now)
            .OrderBy(o => o.PaymentDueAt)
            .Select(o => o.Id)
            .ToListAsync(ct);

        var count = 0;
        foreach (var id in due)
        {
            try
            {
                await unitOfWork.ExecuteInTransactionAsync(async c =>
                {
                    var order = await LoadTrackedAsync(id, c);
                    if (order is null || order.Status != OrderStatus.ChoThanhToan || order.PaymentDueAt > now)
                        return;

                    // cancelledAt = paymentDueAt để dòng thời gian đúng giờ hết hạn dù quét trễ (quyết định 14).
                    order.Cancel(OrderActor.System, order.PaymentDueAt!.Value, CancelReason.QuaHanThanhToan, null);
                    await ReleaseOnCancelAsync(order, c);
                    await unitOfWork.SaveChangesAsync(c);
                    await RecalculateCustomerAsync(order.CustomerId, c);
                    count++;
                }, ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                // Đơn vừa được xử lý ở nơi khác; lần quét sau xem lại.
                break;
            }
        }

        return count;
    }

    // ---------------------------------------------------------------- Đọc dữ liệu dùng chung

    /// <summary>Biến thể kèm sản phẩm (cả đã xóa mềm), màu, ảnh theo màu.</summary>
    /// <summary><see cref="IsDiscontinued"/>: sản phẩm ẩn, đã xóa hoặc thuộc danh mục đang ẩn (ngừng kinh doanh).</summary>
    private sealed record VariantInfo(ProductVariant Variant, Product Product, Color Color, string? ImageUrl, bool CategoryVisible)
    {
        public bool IsDiscontinued => Product.IsHidden || !CategoryVisible;

        public bool IsSellable => Variant.IsActive && !Product.IsDeleted && !IsDiscontinued;
    }

    private async Task<Dictionary<Guid, VariantInfo>> LoadVariantsAsync(IEnumerable<Guid> ids, CancellationToken ct)
    {
        var idList = ids.Distinct().ToList();
        var found = await variants.QueryNoTracking().Where(v => idList.Contains(v.Id)).ToListAsync(ct);
        var productIds = found.Select(v => v.ProductId).Distinct().ToList();
        var productMap = await products.QueryNoTracking().IgnoreQueryFilters().Include(p => p.Images)
            .Where(p => productIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct);
        var colorMap = await colors.QueryNoTracking().ToDictionaryAsync(c => c.Id, ct);
        var visibleCategories = (await categories.QueryNoTracking().Where(c => c.IsVisible).Select(c => c.Id).ToListAsync(ct)).ToHashSet();

        var result = new Dictionary<Guid, VariantInfo>();
        foreach (var v in found)
        {
            if (!productMap.TryGetValue(v.ProductId, out var product) || !colorMap.TryGetValue(v.ColorId, out var color))
                continue;
            var image = product.Images.Where(i => i.ColorId == color.Id).MinBy(i => i.SortOrder)
                ?? product.Images.FirstOrDefault(i => i.IsCover) ?? product.Images.MinBy(i => i.SortOrder);
            result[v.Id] = new VariantInfo(v, product, color, image?.Url, visibleCategories.Contains(product.CategoryId));
        }

        return result;
    }

    private async Task<(Coupon? Coupon, string? CategoryName)> FindCouponAsync(string code, CancellationToken ct)
    {
        var normalized = CouponRules.Normalize(code);
        var coupon = await coupons.QueryNoTracking().FirstOrDefaultAsync(c => c.Code == normalized, ct);
        string? categoryName = null;
        if (coupon?.CategoryId is { } categoryId)
            categoryName = await categories.QueryNoTracking().IgnoreQueryFilters()
                .Where(c => c.Id == categoryId).Select(c => c.Name).FirstOrDefaultAsync(ct);
        return (coupon, categoryName);
    }

    /// <summary>Bước 9 (07 §3.2): số đơn chưa hủy của số điện thoại có mã này (trừ đơn đang sửa).</summary>
    private Task<int> CountPhoneUsageAsync(string phone, Guid couponId, Guid? exceptOrderId, CancellationToken ct) =>
        orders.QueryNoTracking().CountAsync(o => o.Phone == phone && o.CouponId == couponId && o.Status != OrderStatus.DaHuy
            && (exceptOrderId == null || o.Id != exceptOrderId), ct);

    private async Task<(Province Province, Ward Ward)> ResolveAddressAsync(string provinceCode, string wardCode, string prefix, CancellationToken ct)
    {
        var province = await provinces.QueryNoTracking().FirstOrDefaultAsync(p => p.Code == provinceCode, ct)
            ?? throw OrderListing.Invalid($"{prefix}provinceCode", "Vui lòng chọn tỉnh/thành");
        var ward = await wards.QueryNoTracking().FirstOrDefaultAsync(w => w.Code == wardCode && w.ProvinceId == province.Id, ct)
            ?? throw OrderListing.Invalid($"{prefix}wardCode", "Vui lòng chọn phường/xã");
        return (province, ward);
    }

    private Task<Order?> LoadTrackedAsync(Guid id, CancellationToken ct) =>
        orders.Query().Include(o => o.Lines).Include(o => o.Shipment).FirstOrDefaultAsync(o => o.Id == id, ct);

    private Task<Order?> ReadFullAsync(Guid id, CancellationToken ct) =>
        orders.QueryNoTracking().Include(o => o.Lines).Include(o => o.Events).Include(o => o.Shipment)
            .AsSplitQuery().FirstOrDefaultAsync(o => o.Id == id, ct);

    private Task<Order?> ReadFullByCodeAsync(string code, CancellationToken ct) =>
        orders.QueryNoTracking().Include(o => o.Lines).Include(o => o.Events).Include(o => o.Shipment)
            .AsSplitQuery().FirstOrDefaultAsync(o => o.Code == code, ct);

    private async Task<Dictionary<Guid, string>> SlugsAsync(IEnumerable<Guid> productIds, CancellationToken ct)
    {
        var ids = productIds.Distinct().ToList();
        return await products.QueryNoTracking().IgnoreQueryFilters().Where(p => ids.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => p.Slug, ct);
    }

    private async Task<OrderActor> StaffActorAsync(CancellationToken ct)
    {
        var id = currentUser.UserId;
        var name = id is null
            ? null
            : await users.QueryNoTracking().IgnoreQueryFilters().Where(u => u.Id == id).Select(u => u.FullName).FirstOrDefaultAsync(ct);
        return OrderActor.Staff(id, name ?? currentUser.Username ?? "Nhân viên");
    }

    // ---------------------------------------------------------------- Tồn, lượt mã, số đã bán, thống kê khách

    /// <summary>Trừ tồn bằng một câu cập nhật có điều kiện <c>Stock ≥ số lượng</c> (BR-13); false khi không đủ.</summary>
    private async Task<bool> TryTakeStockAsync(Guid variantId, int quantity, CancellationToken ct) =>
        await variants.Query().Where(v => v.Id == variantId && v.Stock >= quantity)
            .ExecuteUpdateAsync(s => s.SetProperty(v => v.Stock, v => v.Stock - quantity), ct) == 1;

    private Task ReturnStockAsync(Guid variantId, int quantity, CancellationToken ct) =>
        variants.Query().Where(v => v.Id == variantId)
            .ExecuteUpdateAsync(s => s.SetProperty(v => v.Stock, v => v.Stock + quantity), ct);

    /// <summary>Cộng lượt mã bằng câu cập nhật có điều kiện <c>TotalLimit IS NULL OR UsedCount &lt; TotalLimit</c> (BR-09).</summary>
    private async Task<bool> TryUseCouponAsync(Guid couponId, CancellationToken ct) =>
        await coupons.Query().Where(c => c.Id == couponId && (c.TotalLimit == null || c.UsedCount < c.TotalLimit))
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.UsedCount, c => c.UsedCount + 1), ct) == 1;

    private Task ReleaseCouponAsync(Guid couponId, CancellationToken ct) =>
        coupons.Query().IgnoreQueryFilters().Where(c => c.Id == couponId && c.UsedCount > 0)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.UsedCount, c => c.UsedCount - 1), ct);

    /// <summary>Hủy: cộng lại tồn mọi dòng, trả lượt mã (07 §3.5).</summary>
    private async Task ReleaseOnCancelAsync(Order order, CancellationToken ct)
    {
        foreach (var line in order.Lines)
            await ReturnStockAsync(line.VariantId, line.Quantity, ct);
        if (order.CouponId is { } couponId)
            await ReleaseCouponAsync(couponId, ct);
    }

    private async Task AddSoldAsync(Order order, CancellationToken ct)
    {
        foreach (var group in order.Lines.GroupBy(l => l.ProductId))
        {
            var quantity = group.Sum(l => l.Quantity);
            await products.Query().IgnoreQueryFilters().Where(p => p.Id == group.Key)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.SoldCount, p => p.SoldCount + quantity), ct);
        }
    }

    /// <summary><c>CustomerStats.Recalculate</c> (06 §4 Crm_Customers): đếm lại từ đơn, trong cùng transaction.</summary>
    private async Task RecalculateCustomerAsync(Guid customerId, CancellationToken ct)
    {
        var rows = await orders.QueryNoTracking().Where(o => o.CustomerId == customerId)
            .Select(o => new { o.Status, o.Total, o.PlacedAt }).ToListAsync(ct);
        var customer = await customers.Query().FirstOrDefaultAsync(c => c.Id == customerId, ct);
        if (customer is null)
            return;

        customer.ApplyStats(
            rows.Count,
            rows.Count(r => r.Status == OrderStatus.DaGiao),
            rows.Count(r => r.Status is OrderStatus.DangHoan or OrderStatus.DaHoan),
            rows.Count(r => r.Status == OrderStatus.DaHuy),
            rows.Where(r => r.Status == OrderStatus.DaGiao).Sum(r => r.Total),
            rows.Count > 0 ? rows.Min(r => r.PlacedAt) : null,
            rows.Count > 0 ? rows.Max(r => r.PlacedAt) : null);
        await unitOfWork.SaveChangesAsync(ct);
    }

    // ---------------------------------------------------------------- Mã chứng từ

    /// <summary>BR-10: số lớn nhất đã có trong ngày + 1.</summary>
    private async Task<string> NextOrderCodeAsync(DateTime placedAt, CancellationToken ct)
    {
        var date = VietnamDates.DateOf(placedAt);
        var prefix = SalesCodes.OrderPrefix(date);
        var last = await orders.QueryNoTracking().Where(o => o.Code.StartsWith(prefix))
            .OrderByDescending(o => o.Code).Select(o => o.Code).FirstOrDefaultAsync(ct);
        return SalesCodes.OrderCode(date, (last is null ? 0 : SalesCodes.SequenceOf(last)) + 1);
    }

    /// <summary>BR-17: tiền tố đơn vị + ngày bàn giao + số thứ tự trong ngày của đơn vị.</summary>
    private async Task<string> NextTrackingCodeAsync(Carrier carrier, DateTime at, CancellationToken ct)
    {
        var date = VietnamDates.DateOf(at);
        var prefix = SalesCodes.TrackingPrefix(carrier, date);
        var last = await shipments.QueryNoTracking().Where(s => s.TrackingCode.StartsWith(prefix))
            .OrderByDescending(s => s.TrackingCode).Select(s => s.TrackingCode).FirstOrDefaultAsync(ct);
        return SalesCodes.TrackingCode(carrier, date, (last is null ? 0 : SalesCodes.SequenceOf(last)) + 1);
    }

    // ---------------------------------------------------------------- Dựng DTO

    private static TransferInfo TransferOf(Order order, StoreSettings store) => new()
    {
        BankBin = store.BankBin,
        BankName = SalesCodes.BankName(store.BankBin),
        BankAccount = store.BankAccount,
        BankAccountName = store.BankAccountName,
        Amount = order.Total,
        Content = order.Code,
        DueAt = order.PaymentDueAt ?? order.PlacedAt.AddHours(SalesRules.PaymentHours),
        QrPayload = SalesCodes.QrPayload(store.BankBin, store.BankAccount, order.Total, order.Code)
    };

    private async Task<PlacedOrderSummary> BuildPlacedSummaryAsync(Order order, CancellationToken ct)
    {
        var slugs = await SlugsAsync(order.Lines.Select(l => l.ProductId), ct);
        var store = order.PaymentMethod == PaymentMethod.ChuyenKhoan ? await StoreSettings.ReadAsync(settings, ct) : null;
        return new PlacedOrderSummary
        {
            Code = order.Code,
            PlacedAt = order.PlacedAt,
            Status = order.Status,
            PaymentMethod = order.PaymentMethod,
            PaymentStatus = order.PaymentStatus,
            PaymentDueAt = order.PaymentDueAt,
            RecipientName = order.RecipientName,
            Phone = order.Phone,
            Email = order.Email,
            ProvinceName = order.ProvinceName,
            WardName = order.WardName,
            AddressLine = order.AddressLine,
            CustomerNote = order.CustomerNote,
            Lines = order.Lines.OrderBy(l => l.SortOrder).Select(l => l.ToView(slugs.GetValueOrDefault(l.ProductId))).ToList(),
            Summary = order.ToSummary(),
            Transfer = store is null ? null : TransferOf(order, store)
        };
    }

    private async Task<PublicOrderView> BuildPublicViewAsync(Order order, CancellationToken ct)
    {
        var slugs = await SlugsAsync(order.Lines.Select(l => l.ProductId), ct);
        var store = order.Status == OrderStatus.ChoThanhToan ? await StoreSettings.ReadAsync(settings, ct) : null;
        return new PublicOrderView
        {
            Code = order.Code,
            PlacedAt = order.PlacedAt,
            Status = order.Status,
            PaymentMethod = order.PaymentMethod,
            PaymentStatus = order.PaymentStatus,
            PaymentDueAt = order.PaymentDueAt,
            RecipientName = order.RecipientName,
            MaskedPhone = SalesCodes.MaskPhone(order.Phone),
            WardName = order.WardName,
            ProvinceName = order.ProvinceName,
            Lines = order.Lines.OrderBy(l => l.SortOrder).Select(l => l.ToView(slugs.GetValueOrDefault(l.ProductId))).ToList(),
            Summary = order.ToSummary(),
            Shipment = order.Shipment is { } s
                ? new PublicShipmentView { Carrier = s.Carrier, TrackingCode = s.TrackingCode, HandedOverAt = s.HandedOverAt, DeliveredAt = s.DeliveredAt }
                : null,
            Timeline = OrderWorkflow.PublicTimeline(order)
                .Select(t => new PublicTimelineItem { At = t.At, Status = t.Status, Text = t.Text }).ToList(),
            CancelReason = order.CancelReason,
            CanCancel = OrderWorkflow.CanSelfCancel(order.Status),
            Transfer = store is null ? null : TransferOf(order, store)
        };
    }

    private async Task<OrderDetailDto> BuildDetailAsync(Order order, CancellationToken ct)
    {
        var customer = await customers.QueryNoTracking().FirstOrDefaultAsync(c => c.Id == order.CustomerId, ct);
        var duplicates = order.IsPendingStatus
            ? (await OrderListing.LoadDuplicatesAsync(orders.QueryNoTracking().Where(o => o.Phone == order.Phone), ct))
                .GetValueOrDefault(order.Id) ?? []
            : [];
        var slugs = await SlugsAsync(order.Lines.Select(l => l.ProductId), ct);
        var returnCount = customer?.ReturnCount ?? 0;
        return new OrderDetailDto
        {
            Id = order.Id,
            Code = order.Code,
            Version = order.Version,
            PlacedAt = order.PlacedAt,
            Status = order.Status,
            PaymentMethod = order.PaymentMethod,
            PaymentStatus = order.PaymentStatus,
            PaymentDueAt = order.PaymentDueAt,
            TransactionRef = order.TransactionRef,
            PaidAt = order.PaidAt,
            RefundAmount = order.RefundAmount,
            RefundRef = order.RefundRef,
            RefundedAt = order.RefundedAt,
            Customer = new OrderCustomerBrief
            {
                Id = order.CustomerId,
                Name = customer?.Name ?? order.RecipientName,
                Phone = customer?.Phone ?? order.Phone,
                ReturnCount = returnCount,
                OrderCount = customer?.OrderCount ?? 0,
                Tags = customer?.Tags ?? [],
                Note = customer?.Note
            },
            RecipientName = order.RecipientName,
            Phone = order.Phone,
            Email = order.Email,
            ProvinceCode = order.ProvinceCode,
            ProvinceName = order.ProvinceName,
            WardCode = order.WardCode,
            WardName = order.WardName,
            AddressLine = order.AddressLine,
            CustomerNote = order.CustomerNote,
            Lines = order.Lines.OrderBy(l => l.SortOrder).Select(l => l.ToDto(slugs.GetValueOrDefault(l.ProductId))).ToList(),
            Subtotal = order.Subtotal,
            Discount = order.Discount,
            ShippingFee = order.ShippingFee,
            ShippingDiscount = order.ShippingDiscount,
            Total = order.Total,
            CodAmount = order.CodAmount,
            CouponId = order.CouponId,
            CouponCode = order.CouponCode,
            CancelReason = order.CancelReason,
            CancelNote = order.CancelNote,
            CancelledAt = order.CancelledAt,
            CancelledByName = order.CancelledByName,
            Labels = OrderWorkflow.Labels(order.Status, order.Shipment?.HandedOverAt, duplicates.Count > 0, returnCount, Now),
            DuplicateOrders = duplicates,
            Shipment = order.Shipment?.ToDto(),
            Events = order.Events.OrderBy(e => e.At).ThenBy(e => e.Seq).Select(e => e.ToDto()).ToList(),
            AllowedActions = OrderWorkflow.AllowedActions(order.Status, order.PaymentStatus)
        };
    }

    private async Task<OrderDetailDto> ReadDetailAsync(Guid id, CancellationToken ct)
    {
        var order = await ReadFullAsync(id, ct) ?? throw SalesProblems.OrderNotFound();
        return await BuildDetailAsync(order, ct);
    }
}
