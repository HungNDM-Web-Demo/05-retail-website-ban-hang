using API.Base;
using API.Filters;
using Application.Common.Models;
using Application.Constants;
using Application.DTOs.Orders;
using Application.Interfaces.Services.Orders;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Orders;

/// <summary>
/// Đơn hàng quản trị (07 §2.5). Thao tác đổi đơn trả 200 kèm <see cref="OrderDetailDto"/> mới; lệch <c>version</c> → 409
/// <c>DonDaThayDoi</c> / <c>DonDaBiHuy</c> kèm <c>order</c> (07 §3.6).
/// </summary>
[Route("api/orders")]
public sealed class OrdersController(IOrderService service) : BaseApiController
{
    [HttpGet]
    [AuthorizePermission(ProjectPermissions.Orders.View)]
    public async Task<ActionResult<PaginatedResult<OrderListItem>>> GetPaged([FromQuery] OrderQuery query, CancellationToken ct) =>
        Ok(await service.GetPagedAsync(query, ct));

    /// <summary>Số trên tab trạng thái, cùng bộ lọc trừ <c>status</c>; khóa <c>TatCa</c> là tổng.</summary>
    [HttpGet("status-counts")]
    [AuthorizePermission(ProjectPermissions.Orders.View)]
    public async Task<ActionResult<IReadOnlyDictionary<string, int>>> StatusCounts([FromQuery] OrderQuery query, CancellationToken ct) =>
        Ok(await service.GetStatusCountsAsync(query, ct));

    [HttpGet("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Orders.View)]
    public async Task<ActionResult<OrderDetailDto>> Get(Guid id, CancellationToken ct) => Ok(await service.GetByIdAsync(id, ct));

    [HttpPost("{id:guid}/notes")]
    [AuthorizePermission(ProjectPermissions.Orders.Update)]
    public async Task<ActionResult<OrderDetailDto>> AddNote(Guid id, AddOrderNoteRequest request, CancellationToken ct) =>
        Ok(await service.AddNoteAsync(id, request, ct));

    [HttpPost("{id:guid}/confirm")]
    [AuthorizePermission(ProjectPermissions.Orders.Confirm)]
    public async Task<ActionResult<OrderDetailDto>> Confirm(Guid id, ConfirmOrderRequest request, CancellationToken ct) =>
        Ok(await service.ConfirmAsync(id, request, ct));

    [HttpPost("{id:guid}/confirm-payment")]
    [AuthorizePermission(ProjectPermissions.Orders.ConfirmPayment)]
    public async Task<ActionResult<OrderDetailDto>> ConfirmPayment(Guid id, ConfirmPaymentRequest request, CancellationToken ct) =>
        Ok(await service.ConfirmPaymentAsync(id, request, ct));

    [HttpPost("{id:guid}/edit-preview")]
    [AuthorizePermission(ProjectPermissions.Orders.Update)]
    public async Task<ActionResult<EditOrderPreview>> EditPreview(Guid id, EditOrderRequest request, CancellationToken ct) =>
        Ok(await service.PreviewEditAsync(id, request, ct));

    [HttpPut("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Orders.Update)]
    public async Task<ActionResult<OrderDetailDto>> Edit(Guid id, EditOrderRequest request, CancellationToken ct) =>
        Ok(await service.EditAsync(id, request, ct));

    [HttpPost("{id:guid}/cancel")]
    [AuthorizePermission(ProjectPermissions.Orders.Cancel)]
    public async Task<ActionResult<OrderDetailDto>> Cancel(Guid id, CancelOrderRequest request, CancellationToken ct) =>
        Ok(await service.CancelAsync(id, request, ct));

    [HttpPost("{id:guid}/ship")]
    [AuthorizePermission(ProjectPermissions.Orders.Ship)]
    public async Task<ActionResult<OrderDetailDto>> Ship(Guid id, ShipOrderRequest request, CancellationToken ct) =>
        Ok(await service.ShipAsync(id, request, ct));

    [HttpPost("{id:guid}/deliver")]
    [AuthorizePermission(ProjectPermissions.Orders.Ship)]
    public async Task<ActionResult<OrderDetailDto>> Deliver(Guid id, [FromBody] VersionedRequest? request, CancellationToken ct) =>
        Ok(await service.DeliverAsync(id, request ?? new VersionedRequest(), ct));

    [HttpPost("{id:guid}/delivery-failed")]
    [AuthorizePermission(ProjectPermissions.Orders.Ship)]
    public async Task<ActionResult<OrderDetailDto>> DeliveryFailed(Guid id, DeliveryFailedRequest request, CancellationToken ct) =>
        Ok(await service.DeliveryFailedAsync(id, request, ct));

    [HttpPost("{id:guid}/receive-return")]
    [AuthorizePermission(ProjectPermissions.Orders.Ship)]
    public async Task<ActionResult<OrderDetailDto>> ReceiveReturn(Guid id, [FromBody] VersionedRequest? request, CancellationToken ct) =>
        Ok(await service.ReceiveReturnAsync(id, request ?? new VersionedRequest(), ct));

    [HttpPost("{id:guid}/refund")]
    [AuthorizePermission(ProjectPermissions.Orders.Refund)]
    public async Task<ActionResult<OrderDetailDto>> Refund(Guid id, RefundRequest request, CancellationToken ct) =>
        Ok(await service.RefundAsync(id, request, ct));

    [HttpPost("{id:guid}/label-printed")]
    [AuthorizePermission(ProjectPermissions.Orders.Ship)]
    public async Task<ActionResult<LabelPrintedResult>> LabelPrinted(Guid id, CancellationToken ct) =>
        Ok(await service.MarkLabelPrintedAsync(id, ct));

    [HttpPost("bulk/confirm")]
    [AuthorizePermission(ProjectPermissions.Orders.Confirm)]
    public async Task<ActionResult<BulkResult>> BulkConfirm(BulkConfirmRequest request, CancellationToken ct) =>
        Ok(await service.BulkConfirmAsync(request, ct));

    [HttpPost("bulk/ship")]
    [AuthorizePermission(ProjectPermissions.Orders.Ship)]
    public async Task<ActionResult<BulkResult>> BulkShip(BulkShipRequest request, CancellationToken ct) =>
        Ok(await service.BulkShipAsync(request, ct));
}
