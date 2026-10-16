using Application.Common.Models;
using Application.DTOs.Orders;

namespace Application.Interfaces.Services.Orders;

/// <summary>
/// Đơn hàng quản trị (07 §2.5, UC-07…UC-11). Mọi thao tác đổi đơn kiểm <c>version</c> (07 §3.6), trả <see cref="OrderDetailDto"/> mới.
/// </summary>
public interface IOrderService
{
    Task<PaginatedResult<OrderListItem>> GetPagedAsync(OrderQuery query, CancellationToken ct = default);

    /// <summary>Số đơn theo trạng thái với cùng bộ lọc trừ <c>status</c>; khóa <c>TatCa</c> là tổng.</summary>
    Task<IReadOnlyDictionary<string, int>> GetStatusCountsAsync(OrderQuery query, CancellationToken ct = default);

    Task<OrderDetailDto> GetByIdAsync(Guid id, CancellationToken ct = default);

    Task<OrderDetailDto> AddNoteAsync(Guid id, AddOrderNoteRequest request, CancellationToken ct = default);

    Task<OrderDetailDto> ConfirmAsync(Guid id, ConfirmOrderRequest request, CancellationToken ct = default);

    Task<OrderDetailDto> ConfirmPaymentAsync(Guid id, ConfirmPaymentRequest request, CancellationToken ct = default);

    Task<EditOrderPreview> PreviewEditAsync(Guid id, EditOrderRequest request, CancellationToken ct = default);

    Task<OrderDetailDto> EditAsync(Guid id, EditOrderRequest request, CancellationToken ct = default);

    Task<OrderDetailDto> CancelAsync(Guid id, CancelOrderRequest request, CancellationToken ct = default);

    Task<OrderDetailDto> ShipAsync(Guid id, ShipOrderRequest request, CancellationToken ct = default);

    Task<OrderDetailDto> DeliverAsync(Guid id, VersionedRequest request, CancellationToken ct = default);

    Task<OrderDetailDto> DeliveryFailedAsync(Guid id, DeliveryFailedRequest request, CancellationToken ct = default);

    Task<OrderDetailDto> ReceiveReturnAsync(Guid id, VersionedRequest request, CancellationToken ct = default);

    Task<OrderDetailDto> RefundAsync(Guid id, RefundRequest request, CancellationToken ct = default);

    Task<LabelPrintedResult> MarkLabelPrintedAsync(Guid id, CancellationToken ct = default);

    Task<BulkResult> BulkConfirmAsync(BulkConfirmRequest request, CancellationToken ct = default);

    Task<BulkResult> BulkShipAsync(BulkShipRequest request, CancellationToken ct = default);
}
