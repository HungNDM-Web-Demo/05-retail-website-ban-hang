using Application.Common.Models;
using Application.DTOs.Coupons;
using Application.DTOs.Customers;
using Application.DTOs.Demo;
using Application.DTOs.Orders;
using Application.DTOs.Reports;

namespace Application.Interfaces.Services.Sales;

/// <summary>Mã giảm giá (07 §2.6, FR-32, FR-33, BR-26).</summary>
public interface ICouponService
{
    Task<PaginatedResult<CouponDto>> GetPagedAsync(CouponQuery query, CancellationToken ct = default);

    Task<CouponDto> GetByIdAsync(Guid id, CancellationToken ct = default);

    /// <summary>Đơn đã dùng mã (cả đơn hủy), mới trước.</summary>
    Task<PaginatedResult<OrderListItem>> GetOrdersAsync(Guid id, OrderQuery query, CancellationToken ct = default);

    Task<CouponDto> CreateAsync(SaveCouponRequest request, CancellationToken ct = default);

    Task<CouponDto> UpdateAsync(Guid id, SaveCouponRequest request, CancellationToken ct = default);

    Task SetPausedAsync(Guid id, bool paused, CancellationToken ct = default);

    /// <summary>Đã có lượt dùng (kể cả đơn đã hủy) → 400 <c>MaDaCoLuotDung</c>.</summary>
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

/// <summary>Khách hàng (07 §2.7, FR-34…FR-36).</summary>
public interface ICustomerService
{
    Task<PaginatedResult<CustomerListItem>> GetPagedAsync(CustomerQuery query, CancellationToken ct = default);

    Task<CustomerDetail> GetByIdAsync(Guid id, CancellationToken ct = default);

    Task<PaginatedResult<OrderListItem>> GetOrdersAsync(Guid id, OrderQuery query, CancellationToken ct = default);

    Task<CustomerDetail> UpdateNoteAsync(Guid id, UpdateCustomerNoteRequest request, CancellationToken ct = default);
}

/// <summary>Tổng quan, báo cáo (07 §2.8, §3.13, FR-01…FR-03, FR-37…FR-39).</summary>
public interface IReportService
{
    Task<DashboardTodo> GetTodoAsync(CancellationToken ct = default);

    Task<DashboardSales> GetSalesAsync(CancellationToken ct = default);

    Task<RevenueReport> GetRevenueAsync(DateRangeQuery query, CancellationToken ct = default);

    Task<TopProductsReport> GetTopProductsAsync(TopProductsQuery query, CancellationToken ct = default);

    Task<OrderStatusReport> GetOrderStatusAsync(OrderStatusReportQuery query, CancellationToken ct = default);

    Task<IReadOnlyList<ProvinceReportRow>> GetProvincesAsync(DateRangeQuery query, CancellationToken ct = default);

    Task<IReadOnlyList<CouponReportRow>> GetCouponsAsync(CouponReportQuery query, CancellationToken ct = default);
}

/// <summary>Bổ sung cho <c>/api/demo</c> (07 §2.9).</summary>
public interface ISalesDemoService
{
    /// <summary>Giả lập một khách đặt đơn qua đúng luồng đặt hàng công khai.</summary>
    Task<SimulateOrderResult> SimulateOrderAsync(CancellationToken ct = default);
}
