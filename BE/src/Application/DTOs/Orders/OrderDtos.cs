using Application.Common.Models;
using Application.DTOs.Storefront;
using Domain.Enums.Crm.Customers;
using Domain.Enums.Sales.Orders;

namespace Application.DTOs.Orders;

// Đơn hàng quản trị (07 §2.5).

public sealed class OrderListItem
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public DateTime PlacedAt { get; init; }
    public Guid CustomerId { get; init; }
    public string CustomerName { get; init; } = string.Empty;
    public string Phone { get; init; } = string.Empty;
    public string ProvinceName { get; init; } = string.Empty;

    /// <summary>Σ số lượng.</summary>
    public int ItemCount { get; init; }

    public decimal Total { get; init; }
    public PaymentMethod PaymentMethod { get; init; }
    public PaymentStatus PaymentStatus { get; init; }
    public OrderStatus Status { get; init; }
    public IReadOnlyList<OrderLabel> Labels { get; init; } = [];
    public string? CouponCode { get; init; }
    public int Version { get; init; }
}

public sealed class OrderQuery : PaginationQuery
{
    public OrderStatus? Status { get; set; }
    public PaymentStatus? PaymentStatus { get; set; }

    /// <summary><c>yyyy-MM-dd</c> giờ Việt Nam, theo ngày đặt.</summary>
    public string? FromDate { get; set; }

    public string? ToDate { get; set; }
    public PaymentMethod? PaymentMethod { get; set; }
    public string? ProvinceCode { get; set; }
    public OrderLabel? Label { get; set; }
    public Guid? CustomerId { get; set; }
    public Guid? CouponId { get; set; }
}

public sealed class OrderLineDto : OrderLineView
{
    public Guid Id { get; init; }
    public Guid VariantId { get; init; }
    public Guid ProductId { get; init; }
}

public sealed class OrderEventDto
{
    public Guid Id { get; init; }
    public OrderEventType Type { get; init; }
    public DateTime At { get; init; }
    public ActorType ActorType { get; init; }
    public string ActorName { get; init; } = string.Empty;
    public OrderStatus? FromStatus { get; init; }
    public OrderStatus? ToStatus { get; init; }
    public string Content { get; init; } = string.Empty;
}

public sealed class ShipmentDto
{
    public Carrier Carrier { get; init; }
    public string TrackingCode { get; init; } = string.Empty;
    public int WeightGrams { get; init; }
    public decimal CodAmount { get; init; }
    public string? ShipperNote { get; init; }
    public DateTime HandedOverAt { get; init; }
    public string HandedOverByName { get; init; } = string.Empty;
    public DateTime? DeliveredAt { get; init; }
    public DateTime? FailedAt { get; init; }
    public DeliveryFailReason? FailReason { get; init; }
    public string? FailNote { get; init; }
    public DateTime? ReturnedAt { get; init; }
    public int LabelPrintCount { get; init; }
}

public sealed class OrderCustomerBrief
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Phone { get; init; } = string.Empty;
    public int ReturnCount { get; init; }
    public int OrderCount { get; init; }
    public IReadOnlyList<CustomerTag> Tags { get; init; } = [];
    public string? Note { get; init; }
}

public sealed class DuplicateOrderRef
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public OrderStatus Status { get; init; }
    public DateTime PlacedAt { get; init; }
}

public sealed class OrderDetailDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public int Version { get; init; }
    public DateTime PlacedAt { get; init; }
    public OrderStatus Status { get; init; }
    public PaymentMethod PaymentMethod { get; init; }
    public PaymentStatus PaymentStatus { get; init; }
    public DateTime? PaymentDueAt { get; init; }
    public string? TransactionRef { get; init; }
    public DateTime? PaidAt { get; init; }
    public decimal? RefundAmount { get; init; }
    public string? RefundRef { get; init; }
    public DateTime? RefundedAt { get; init; }
    public OrderCustomerBrief Customer { get; init; } = new();
    public string RecipientName { get; init; } = string.Empty;
    public string Phone { get; init; } = string.Empty;
    public string? Email { get; init; }
    public string ProvinceCode { get; init; } = string.Empty;
    public string ProvinceName { get; init; } = string.Empty;
    public string WardCode { get; init; } = string.Empty;
    public string WardName { get; init; } = string.Empty;
    public string AddressLine { get; init; } = string.Empty;
    public string? CustomerNote { get; init; }
    public IReadOnlyList<OrderLineDto> Lines { get; init; } = [];
    public decimal Subtotal { get; init; }
    public decimal Discount { get; init; }
    public decimal ShippingFee { get; init; }
    public decimal ShippingDiscount { get; init; }
    public decimal Total { get; init; }
    public decimal CodAmount { get; init; }
    public Guid? CouponId { get; init; }
    public string? CouponCode { get; init; }
    public CancelReason? CancelReason { get; init; }
    public string? CancelNote { get; init; }
    public DateTime? CancelledAt { get; init; }
    public string? CancelledByName { get; init; }
    public IReadOnlyList<OrderLabel> Labels { get; init; } = [];
    public IReadOnlyList<DuplicateOrderRef> DuplicateOrders { get; init; } = [];
    public ShipmentDto? Shipment { get; init; }
    public IReadOnlyList<OrderEventDto> Events { get; init; } = [];
    public IReadOnlyList<OrderAction> AllowedActions { get; init; } = [];
}

/// <summary>Vắng <see cref="Version"/> = không kiểm (07 §3.6).</summary>
public class VersionedRequest
{
    public int? Version { get; set; }
}

public sealed class ConfirmOrderRequest : VersionedRequest
{
    public string? Note { get; set; }
}

public sealed class ConfirmPaymentRequest : VersionedRequest
{
    public string? TransactionRef { get; set; }
}

public sealed class CancelOrderRequest : VersionedRequest
{
    public CancelReason? Reason { get; set; }
    public string? Note { get; set; }
}

public sealed class ShipOrderRequest : VersionedRequest
{
    public Carrier? Carrier { get; set; }
    public int? WeightGrams { get; set; }
    public string? ShipperNote { get; set; }
}

public sealed class DeliveryFailedRequest : VersionedRequest
{
    public DeliveryFailReason? Reason { get; set; }
    public string? Note { get; set; }
}

public sealed class RefundRequest : VersionedRequest
{
    public string? RefundRef { get; set; }
}

public sealed class AddOrderNoteRequest
{
    public string Content { get; set; } = string.Empty;
}

public sealed class EditOrderLineInput
{
    public Guid VariantId { get; set; }
    public int Quantity { get; set; }
}

public sealed class EditOrderRequest : VersionedRequest
{
    public List<EditOrderLineInput> Lines { get; set; } = [];
    public string RecipientName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string ProvinceCode { get; set; } = string.Empty;
    public string WardCode { get; set; } = string.Empty;
    public string AddressLine { get; set; } = string.Empty;
}

public sealed class EditOrderPreview
{
    public IReadOnlyList<OrderLineView> Lines { get; init; } = [];
    public PricingSummary Summary { get; init; } = new();
    public bool CouponRemoved { get; init; }
    public string? CouponMessage { get; init; }
    public IReadOnlyList<string> Changes { get; init; } = [];
}

public sealed class BulkItem
{
    public Guid Id { get; set; }
    public int? Version { get; set; }
}

public sealed class BulkConfirmRequest
{
    public List<BulkItem> Items { get; set; } = [];
}

public sealed class BulkShipRequest
{
    public List<BulkItem> Items { get; set; } = [];
    public Carrier? Carrier { get; set; }
}

public sealed class BulkFailure
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
}

public sealed class BulkResult
{
    public IReadOnlyList<Guid> Succeeded { get; init; } = [];
    public IReadOnlyList<BulkFailure> Failed { get; init; } = [];
}

public sealed class LabelPrintedResult
{
    public int LabelPrintCount { get; init; }
}
