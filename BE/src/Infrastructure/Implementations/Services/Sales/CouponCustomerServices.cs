using Application.Common.Exceptions;
using Application.Common.Models;
using Application.Common.Time;
using Application.DTOs.Coupons;
using Application.DTOs.Customers;
using Application.DTOs.Orders;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Orders;
using Application.Interfaces.Services.Sales;
using Domain.Entities.Crm.Customers;
using Domain.Entities.Sales;
using Domain.Entities.Sales.Catalog;
using Domain.Entities.Sales.Coupons;
using Domain.Entities.Sales.Locations;
using Domain.Entities.Sales.Orders;
using Domain.Enums.Crm.Customers;
using Domain.Enums.Sales.Coupons;
using Domain.Enums.Sales.Orders;
using FluentValidation;
using FluentValidation.Results;
using Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Sales;

/// <summary>Mã giảm giá (07 §2.6, FR-32, FR-33, BR-26). Trạng thái suy ra lúc đọc; số liệu tính từ đơn.</summary>
public sealed class CouponService(
    IGenericRepository<Coupon> coupons,
    IGenericRepository<Category> categories,
    IGenericRepository<Order> orders,
    IGenericRepository<Customer> customers,
    IOrderWorkflow workflow,
    IUnitOfWork unitOfWork,
    TimeProvider time) : ICouponService
{
    private const string UsedLockedMessage = "Mã đã có lượt dùng, không đổi được";

    private DateTime Now => time.GetUtcNow().UtcDateTime;

    public async Task<PaginatedResult<CouponDto>> GetPagedAsync(CouponQuery query, CancellationToken ct = default)
    {
        await workflow.EnsureSweptAsync(ct);
        var list = await coupons.QueryNoTracking().ToListAsync(ct);
        var dtos = await ToDtosAsync(list, ct);
        IEnumerable<CouponDto> items = dtos;
        if (query.Status is { } status)
            items = items.Where(c => c.Status == status);
        if (query.GetSearchTerm() is { } term)
        {
            var t = SalesCodes.SearchText(term);
            items = items.Where(c => SalesCodes.SearchText($"{c.Code} {c.Name}").Contains(t, StringComparison.Ordinal));
        }

        var desc = query.IsDescending();
        items = (query.SortBy?.Trim().ToLowerInvariant()) switch
        {
            "code" => desc ? items.OrderByDescending(c => c.Code) : items.OrderBy(c => c.Code),
            "endat" => desc ? items.OrderByDescending(c => c.EndAt) : items.OrderBy(c => c.EndAt),
            "usedcount" => desc ? items.OrderByDescending(c => c.UsedCount) : items.OrderBy(c => c.UsedCount),
            _ => desc ? items.OrderByDescending(c => c.StartAt) : items.OrderBy(c => c.StartAt)
        };

        var all = items.ToList();
        var page = query.GetPage();
        var size = query.GetPageSize();
        return new PaginatedResult<CouponDto> { Items = all.Skip((page - 1) * size).Take(size).ToList(), Page = page, PageSize = size, TotalCount = all.Count };
    }

    public async Task<CouponDto> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        await workflow.EnsureSweptAsync(ct);
        var coupon = await coupons.QueryNoTracking().FirstOrDefaultAsync(c => c.Id == id, ct) ?? throw NotFound();
        return (await ToDtosAsync([coupon], ct))[0];
    }

    public async Task<PaginatedResult<OrderListItem>> GetOrdersAsync(Guid id, OrderQuery query, CancellationToken ct = default)
    {
        if (!await coupons.AnyAsync(c => c.Id == id, ct))
            throw NotFound();
        await workflow.EnsureSweptAsync(ct);
        query.CouponId = id;
        query.SortDir ??= "desc";
        var now = Now;
        var duplicates = await OrderListing.LoadDuplicatesAsync(orders.QueryNoTracking(), ct);
        var filtered = OrderListing.Filter(orders.QueryNoTracking(), query, customers.QueryNoTracking(), duplicates.Keys, now, true);
        return await OrderListing.PageAsync(filtered, query, customers.QueryNoTracking(), duplicates, now, ct);
    }

    public async Task<CouponDto> CreateAsync(SaveCouponRequest request, CancellationToken ct = default)
    {
        var code = request.Code.Trim().ToUpperInvariant();
        if (await coupons.AnyAsync(c => c.Code == code, ct))
            throw new ConflictException("Mã giảm giá đã tồn tại", "code");
        await EnsureCategoryAsync(request.CategoryId, ct);
        var coupon = Coupon.Create(code, request.Name, request.Type!.Value, request.Value, request.MaxDiscount, request.MinOrder,
            request.CategoryId, request.TotalLimit, request.PerCustomerLimit, VietnamTime.ToUtc(request.StartAt!.Value),
            VietnamTime.ToUtc(request.EndAt!.Value));
        await coupons.AddAsync(coupon, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return await GetByIdAsync(coupon.Id, ct);
    }

    public async Task<CouponDto> UpdateAsync(Guid id, SaveCouponRequest request, CancellationToken ct = default)
    {
        var coupon = await coupons.Query().FirstOrDefaultAsync(c => c.Id == id, ct) ?? throw NotFound();
        var code = request.Code.Trim().ToUpperInvariant();
        if (await coupons.AnyAsync(c => c.Code == code && c.Id != id, ct))
            throw new ConflictException("Mã giảm giá đã tồn tại", "code");
        await EnsureCategoryAsync(request.CategoryId, ct);
        if (await orders.AnyAsync(o => o.CouponId == id, ct))
        {
            var failures = new List<ValidationFailure>();
            if (code != coupon.Code)
                failures.Add(new ValidationFailure("code", UsedLockedMessage));
            if (request.Type != coupon.Type)
                failures.Add(new ValidationFailure("type", UsedLockedMessage));
            if (request.CategoryId != coupon.CategoryId)
                failures.Add(new ValidationFailure("categoryId", UsedLockedMessage));
            if (failures.Count > 0)
                throw new ValidationException(failures);
        }

        coupon.Update(code, request.Name, request.Type!.Value, request.Value, request.MaxDiscount, request.MinOrder, request.CategoryId,
            request.TotalLimit, request.PerCustomerLimit, VietnamTime.ToUtc(request.StartAt!.Value), VietnamTime.ToUtc(request.EndAt!.Value));
        await unitOfWork.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task SetPausedAsync(Guid id, bool paused, CancellationToken ct = default)
    {
        var coupon = await coupons.Query().FirstOrDefaultAsync(c => c.Id == id, ct) ?? throw NotFound();
        coupon.SetPaused(paused);
        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var coupon = await coupons.Query().FirstOrDefaultAsync(c => c.Id == id, ct) ?? throw NotFound();
        if (await orders.AnyAsync(o => o.CouponId == id, ct))
            throw SalesErrors.Business(SalesErrors.MaDaCoLuotDung, SalesErrors.CouponUsedMessage);
        coupons.Delete(coupon);
        await unitOfWork.SaveChangesAsync(ct);
    }

    private async Task EnsureCategoryAsync(Guid? categoryId, CancellationToken ct)
    {
        if (categoryId is { } id && !await categories.AnyAsync(c => c.Id == id, ct))
            throw new ValidationException([new ValidationFailure("categoryId", "Danh mục không tồn tại")]);
    }

    private async Task<List<CouponDto>> ToDtosAsync(IReadOnlyList<Coupon> list, CancellationToken ct)
    {
        var ids = list.Select(c => c.Id).ToList();
        var stats = await orders.QueryNoTracking().Where(o => o.CouponId != null && ids.Contains(o.CouponId.Value))
            .Select(o => new { CouponId = o.CouponId!.Value, o.Status, o.Discount, o.ShippingDiscount, o.Total })
            .ToListAsync(ct);
        var categoryNames = await categories.QueryNoTracking().IgnoreQueryFilters().ToDictionaryAsync(c => c.Id, c => c.Name, ct);
        var now = Now;
        return list.Select(c =>
        {
            var mine = stats.Where(s => s.CouponId == c.Id).ToList();
            var live = mine.Where(s => s.Status != OrderStatus.DaHuy).ToList();
            return new CouponDto
            {
                Id = c.Id,
                Code = c.Code,
                Name = c.Name,
                Type = c.Type,
                Value = c.Value,
                MaxDiscount = c.MaxDiscount,
                MinOrder = c.MinOrder,
                CategoryId = c.CategoryId,
                CategoryName = c.CategoryId is { } cid ? categoryNames.GetValueOrDefault(cid) : null,
                TotalLimit = c.TotalLimit,
                PerCustomerLimit = c.PerCustomerLimit,
                UsedCount = c.UsedCount,
                DiscountTotal = live.Sum(s => s.Discount + s.ShippingDiscount),
                OrderValueTotal = live.Sum(s => s.Total),
                StartAt = c.StartAt,
                EndAt = c.EndAt,
                IsPaused = c.IsPaused,
                Status = c.StatusAt(now),
                CanDelete = mine.Count == 0
            };
        }).ToList();
    }

    private static NotFoundException NotFound() => new("Không tìm thấy mã giảm giá");
}

/// <summary>Khách hàng (07 §2.7, FR-34…FR-36). Thống kê lưu sẵn, nhãn suy ra lúc đọc (BR-21).</summary>
public sealed class CustomerService(
    IGenericRepository<Customer> customers,
    IGenericRepository<Order> orders,
    IGenericRepository<Province> provinces,
    IGenericRepository<Ward> wards,
    IOrderWorkflow workflow,
    IUnitOfWork unitOfWork,
    TimeProvider time) : ICustomerService
{
    public async Task<PaginatedResult<CustomerListItem>> GetPagedAsync(CustomerQuery query, CancellationToken ct = default)
    {
        await workflow.EnsureSweptAsync(ct);
        var q = customers.QueryNoTracking();
        if (query.GetSearchTerm() is { } term)
        {
            var pattern = LikePattern.Contains(term);
            var phonePattern = LikePattern.Contains(term.Replace(" ", string.Empty, StringComparison.Ordinal));
            q = q.Where(c => AppDbFunctions.Matches(c.Name, pattern) || AppDbFunctions.Matches(c.Phone, phonePattern));
        }

        if (query.Tag == CustomerTag.KhachVip)
            q = q.Where(c => c.TotalSpent >= SalesRules.VipSpent);
        else if (query.Tag == CustomerTag.CanLuuY)
            q = q.Where(c => c.ReturnCount >= SalesRules.AttentionReturns);
        if (!string.IsNullOrWhiteSpace(query.ProvinceCode))
            q = q.Where(c => c.ProvinceCode == query.ProvinceCode);

        var desc = string.IsNullOrWhiteSpace(query.SortDir) || query.IsDescending();
        IOrderedQueryable<Customer> ordered = (query.SortBy?.Trim().ToLowerInvariant()) switch
        {
            "totalspent" => desc ? q.OrderByDescending(c => c.TotalSpent) : q.OrderBy(c => c.TotalSpent),
            "ordercount" => desc ? q.OrderByDescending(c => c.OrderCount) : q.OrderBy(c => c.OrderCount),
            "name" => desc ? q.OrderByDescending(c => c.Name) : q.OrderBy(c => c.Name),
            "deliveredcount" => desc ? q.OrderByDescending(c => c.DeliveredCount) : q.OrderBy(c => c.DeliveredCount),
            "returncount" => desc ? q.OrderByDescending(c => c.ReturnCount) : q.OrderBy(c => c.ReturnCount),
            _ => desc ? q.OrderByDescending(c => c.LastOrderAt) : q.OrderBy(c => c.LastOrderAt)
        };

        var page = await ordered.ThenBy(c => c.Phone).ToPaginatedResultAsync(query, ct);
        var names = await ProvinceNamesAsync(ct);
        return page.Map(items => items.Select(c => ToListItem(c, names)).ToList());
    }

    public async Task<CustomerDetail> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        await workflow.EnsureSweptAsync(ct);
        var c = await customers.QueryNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw NotFound();
        var names = await ProvinceNamesAsync(ct);
        var wardName = await wards.QueryNoTracking().Where(w => w.Code == c.WardCode).Select(w => w.Name).FirstOrDefaultAsync(ct);
        var item = ToListItem(c, names);
        return new CustomerDetail
        {
            Id = item.Id,
            Phone = item.Phone,
            Name = item.Name,
            ProvinceCode = item.ProvinceCode,
            ProvinceName = item.ProvinceName,
            OrderCount = item.OrderCount,
            DeliveredCount = item.DeliveredCount,
            ReturnCount = item.ReturnCount,
            TotalSpent = item.TotalSpent,
            LastOrderAt = item.LastOrderAt,
            Tags = item.Tags,
            Email = c.Email,
            WardCode = c.WardCode,
            WardName = wardName ?? string.Empty,
            AddressLine = c.AddressLine,
            Note = c.Note,
            CancelledCount = c.CancelledCount,
            FirstOrderAt = c.FirstOrderAt,
            CreatedAt = c.CreatedAt
        };
    }

    public async Task<PaginatedResult<OrderListItem>> GetOrdersAsync(Guid id, OrderQuery query, CancellationToken ct = default)
    {
        if (!await customers.AnyAsync(c => c.Id == id, ct))
            throw NotFound();
        await workflow.EnsureSweptAsync(ct);
        query.CustomerId = id;
        query.SortDir ??= "desc";
        var now = time.GetUtcNow().UtcDateTime;
        var duplicates = await OrderListing.LoadDuplicatesAsync(orders.QueryNoTracking(), ct);
        var filtered = OrderListing.Filter(orders.QueryNoTracking(), query, customers.QueryNoTracking(), duplicates.Keys, now, true);
        return await OrderListing.PageAsync(filtered, query, customers.QueryNoTracking(), duplicates, now, ct);
    }

    public async Task<CustomerDetail> UpdateNoteAsync(Guid id, UpdateCustomerNoteRequest request, CancellationToken ct = default)
    {
        var customer = await customers.Query().FirstOrDefaultAsync(c => c.Id == id, ct) ?? throw NotFound();
        customer.SetNote(request.Note);
        await unitOfWork.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    private Task<Dictionary<string, string>> ProvinceNamesAsync(CancellationToken ct) =>
        provinces.QueryNoTracking().ToDictionaryAsync(p => p.Code, p => p.Name, ct);

    private static CustomerListItem ToListItem(Customer c, IReadOnlyDictionary<string, string> provinceNames) => new()
    {
        Id = c.Id,
        Phone = c.Phone,
        Name = c.Name,
        ProvinceCode = c.ProvinceCode,
        ProvinceName = provinceNames.GetValueOrDefault(c.ProvinceCode, string.Empty),
        OrderCount = c.OrderCount,
        DeliveredCount = c.DeliveredCount,
        ReturnCount = c.ReturnCount,
        TotalSpent = c.TotalSpent,
        LastOrderAt = c.LastOrderAt,
        Tags = c.Tags
    };

    private static NotFoundException NotFound() => new("Không tìm thấy khách hàng");
}
