using API.Base;
using API.Filters;
using Application.Common.Models;
using Application.Constants;
using Application.DTOs.Coupons;
using Application.DTOs.Customers;
using Application.DTOs.Demo;
using Application.DTOs.Orders;
using Application.DTOs.Reports;
using Application.Interfaces.Services.Sales;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Sales;

/// <summary>Mã giảm giá (07 §2.6).</summary>
[Route("api/coupons")]
public sealed class CouponsController(ICouponService service) : BaseApiController
{
    [HttpGet]
    [AuthorizePermission(ProjectPermissions.Coupons.View)]
    public async Task<ActionResult<PaginatedResult<CouponDto>>> GetPaged([FromQuery] CouponQuery query, CancellationToken ct) =>
        Ok(await service.GetPagedAsync(query, ct));

    [HttpGet("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Coupons.View)]
    public async Task<ActionResult<CouponDto>> Get(Guid id, CancellationToken ct) => Ok(await service.GetByIdAsync(id, ct));

    [HttpGet("{id:guid}/orders")]
    [AuthorizePermission(ProjectPermissions.Coupons.View)]
    public async Task<ActionResult<PaginatedResult<OrderListItem>>> Orders(Guid id, [FromQuery] OrderQuery query, CancellationToken ct) =>
        Ok(await service.GetOrdersAsync(id, query, ct));

    [HttpPost]
    [AuthorizePermission(ProjectPermissions.Coupons.Create)]
    public async Task<ActionResult<CouponDto>> Create(SaveCouponRequest request, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, await service.CreateAsync(request, ct));

    [HttpPut("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Coupons.Update)]
    public async Task<ActionResult<CouponDto>> Update(Guid id, SaveCouponRequest request, CancellationToken ct) =>
        Ok(await service.UpdateAsync(id, request, ct));

    [HttpPatch("{id:guid}/pause")]
    [AuthorizePermission(ProjectPermissions.Coupons.Update)]
    public async Task<IActionResult> Pause(Guid id, PauseCouponRequest request, CancellationToken ct)
    {
        await service.SetPausedAsync(id, request.Paused, ct);
        return NoContent();
    }

    /// <summary>Đã có lượt dùng (kể cả đơn đã hủy) → 400 <c>MaDaCoLuotDung</c>.</summary>
    [HttpDelete("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Coupons.Delete)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return NoContent();
    }
}

/// <summary>Khách hàng (07 §2.7).</summary>
[Route("api/customers")]
public sealed class CustomersController(ICustomerService service) : BaseApiController
{
    [HttpGet]
    [AuthorizePermission(ProjectPermissions.Customers.View)]
    public async Task<ActionResult<PaginatedResult<CustomerListItem>>> GetPaged([FromQuery] CustomerQuery query, CancellationToken ct) =>
        Ok(await service.GetPagedAsync(query, ct));

    [HttpGet("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Customers.View)]
    public async Task<ActionResult<CustomerDetail>> Get(Guid id, CancellationToken ct) => Ok(await service.GetByIdAsync(id, ct));

    [HttpGet("{id:guid}/orders")]
    [AuthorizePermission(ProjectPermissions.Customers.View)]
    public async Task<ActionResult<PaginatedResult<OrderListItem>>> Orders(Guid id, [FromQuery] OrderQuery query, CancellationToken ct) =>
        Ok(await service.GetOrdersAsync(id, query, ct));

    [HttpPut("{id:guid}/note")]
    [AuthorizePermission(ProjectPermissions.Customers.Update)]
    public async Task<ActionResult<CustomerDetail>> UpdateNote(Guid id, UpdateCustomerNoteRequest request, CancellationToken ct) =>
        Ok(await service.UpdateNoteAsync(id, request, ct));
}

/// <summary>Tổng quan, báo cáo (07 §2.8). Thẻ việc cần làm gắn <c>orders.view</c>; số liệu doanh thu gắn <c>reports.view</c>.</summary>
[Route("api/reports")]
public sealed class ReportsController(IReportService service) : BaseApiController
{
    [HttpGet("dashboard/todo")]
    [AuthorizePermission(ProjectPermissions.Orders.View)]
    public async Task<ActionResult<DashboardTodo>> Todo(CancellationToken ct) => Ok(await service.GetTodoAsync(ct));

    [HttpGet("dashboard/sales")]
    [AuthorizePermission(ProjectPermissions.Reports.View)]
    public async Task<ActionResult<DashboardSales>> Sales(CancellationToken ct) => Ok(await service.GetSalesAsync(ct));

    [HttpGet("revenue")]
    [AuthorizePermission(ProjectPermissions.Reports.View)]
    public async Task<ActionResult<RevenueReport>> Revenue([FromQuery] DateRangeQuery query, CancellationToken ct) =>
        Ok(await service.GetRevenueAsync(query, ct));

    [HttpGet("top-products")]
    [AuthorizePermission(ProjectPermissions.Reports.View)]
    public async Task<ActionResult<TopProductsReport>> TopProducts([FromQuery] TopProductsQuery query, CancellationToken ct) =>
        Ok(await service.GetTopProductsAsync(query, ct));

    [HttpGet("order-status")]
    [AuthorizePermission(ProjectPermissions.Reports.View)]
    public async Task<ActionResult<OrderStatusReport>> OrderStatus([FromQuery] OrderStatusReportQuery query, CancellationToken ct) =>
        Ok(await service.GetOrderStatusAsync(query, ct));

    [HttpGet("provinces")]
    [AuthorizePermission(ProjectPermissions.Reports.View)]
    public async Task<ActionResult<IReadOnlyList<ProvinceReportRow>>> Provinces([FromQuery] DateRangeQuery query, CancellationToken ct) =>
        Ok(await service.GetProvincesAsync(query, ct));

    [HttpGet("coupons")]
    [AuthorizePermission(ProjectPermissions.Reports.View)]
    public async Task<ActionResult<IReadOnlyList<CouponReportRow>>> Coupons([FromQuery] CouponReportQuery query, CancellationToken ct) =>
        Ok(await service.GetCouponsAsync(query, ct));
}

/// <summary>Bổ sung cho <c>/api/demo</c> (07 §2.9). Chỉ có khi <c>DEMO_MODE=true</c>.</summary>
[Route("api/demo")]
[DemoOnly]
public sealed class SalesDemoController(ISalesDemoService service) : BaseApiController
{
    /// <summary>Giả lập một khách đặt đơn qua đúng luồng đặt hàng công khai.</summary>
    [HttpPost("simulate-order")]
    public async Task<ActionResult<SimulateOrderResult>> SimulateOrder(CancellationToken ct) => Ok(await service.SimulateOrderAsync(ct));
}
