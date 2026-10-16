using Domain.Base;
using Domain.Enums.Sales.Orders;

namespace Domain.Entities.Sales.Orders;

/// <summary>Người thao tác được chụp vào sự kiện, vận đơn: nhân viên (Id + họ tên), "Khách" hoặc "Hệ thống".</summary>
public sealed record OrderActor(ActorType Type, Guid? Id, string Name)
{
    public const string CustomerName = "Khách";
    public const string SystemName = "Hệ thống";

    public static readonly OrderActor Customer = new(ActorType.Khach, null, CustomerName);

    public static readonly OrderActor System = new(ActorType.HeThong, null, SystemName);

    public static OrderActor Staff(Guid? id, string name) => new(ActorType.NhanVien, id, name);
}

/// <summary>Người nhận, địa chỉ chụp vào đơn (BR-07).</summary>
public sealed record OrderRecipient(
    string Name, string Phone, string? Email, string ProvinceCode, string ProvinceName, string WardCode, string WardName, string AddressLine);

/// <summary>Dòng đơn (bảng <c>Sales_OrderLines</c>): chụp tên, màu, size, SKU, ảnh, đơn giá lúc đặt (BR-25).</summary>
public class OrderLine : BaseEntity, IAuditLogExempt
{
    public const int ProductNameMaxLength = 200;
    public const int SkuMaxLength = 30;
    public const int ColorNameMaxLength = 50;
    public const int SizeMaxLength = 10;
    public const int ImageUrlMaxLength = 500;

    private OrderLine()
    {
    }

    public Guid OrderId { get; private set; }
    public Guid VariantId { get; private set; }
    public Guid ProductId { get; private set; }
    public string ProductName { get; private set; } = string.Empty;
    public string Sku { get; private set; } = string.Empty;
    public string ColorName { get; private set; } = string.Empty;
    public string? Size { get; private set; }
    public string? ImageUrl { get; private set; }
    public decimal UnitPrice { get; private set; }
    public int Quantity { get; private set; }
    public int SortOrder { get; private set; }

    public decimal LineTotal => UnitPrice * Quantity;

    public static OrderLine Create(
        Guid variantId, Guid productId, string productName, string sku, string colorName, string? size, string? imageUrl,
        decimal unitPrice, int quantity, int sortOrder) =>
        new()
        {
            VariantId = variantId,
            ProductId = productId,
            ProductName = productName,
            Sku = sku,
            ColorName = colorName,
            Size = string.IsNullOrEmpty(size) ? null : size,
            ImageUrl = imageUrl,
            UnitPrice = unitPrice,
            Quantity = quantity,
            SortOrder = sortOrder
        };

    internal void AttachTo(Guid orderId) => OrderId = orderId;

    internal void SetQuantity(int quantity) => Quantity = quantity;
}

/// <summary>Dòng thời gian của đơn (bảng <c>Sales_OrderEvents</c>, BR-14, 07 §3.10).</summary>
public class OrderEvent : BaseEntity, IAuditLogExempt
{
    public const int ActorNameMaxLength = 150;
    public const int ContentMaxLength = 1000;

    private OrderEvent()
    {
    }

    public Guid OrderId { get; private set; }
    public OrderEventType Type { get; private set; }
    public DateTime At { get; private set; }
    public ActorType ActorType { get; private set; }
    public Guid? ActorId { get; private set; }
    public string ActorName { get; private set; } = string.Empty;
    public OrderStatus? FromStatus { get; private set; }
    public OrderStatus? ToStatus { get; private set; }
    public string Content { get; private set; } = string.Empty;

    /// <summary>Thứ tự trong cùng thời điểm (đổi trạng thái trước, tin gửi khách sau).</summary>
    public int Seq { get; private set; }

    internal static OrderEvent Create(
        Guid orderId, OrderEventType type, DateTime at, OrderActor actor, OrderStatus? from, OrderStatus? to, string content, int seq)
    {
        var trimmed = content.Length > ContentMaxLength ? content[..ContentMaxLength] : content;
        return new OrderEvent
        {
            OrderId = orderId,
            Type = type,
            At = at,
            ActorType = actor.Type,
            ActorId = actor.Id,
            ActorName = actor.Name,
            FromStatus = from,
            ToStatus = to,
            Content = trimmed,
            Seq = seq
        };
    }
}

/// <summary>Vận đơn (bảng <c>Sales_Shipments</c>), một đơn tối đa một (BR-17).</summary>
public class Shipment : BaseEntity, IAuditLogExempt
{
    public const int TrackingCodeMaxLength = 20;
    public const int ShipperNoteMaxLength = 200;
    public const int UserNameMaxLength = 150;
    public const int FailNoteMaxLength = 500;

    private Shipment()
    {
    }

    public Guid OrderId { get; private set; }
    public Carrier Carrier { get; private set; }
    public string TrackingCode { get; private set; } = string.Empty;
    public int WeightGrams { get; private set; }
    public decimal CodAmount { get; private set; }
    public string? ShipperNote { get; private set; }
    public DateTime HandedOverAt { get; private set; }
    public Guid? HandedOverById { get; private set; }
    public string HandedOverByName { get; private set; } = string.Empty;
    public DateTime? DeliveredAt { get; private set; }
    public DateTime? FailedAt { get; private set; }
    public DeliveryFailReason? FailReason { get; private set; }
    public string? FailNote { get; private set; }
    public DateTime? ReturnedAt { get; private set; }
    public int LabelPrintCount { get; private set; }

    internal static Shipment Create(
        Guid orderId, Carrier carrier, string trackingCode, int weightGrams, decimal codAmount, string? shipperNote, DateTime at, OrderActor actor) =>
        new()
        {
            OrderId = orderId,
            Carrier = carrier,
            TrackingCode = trackingCode,
            WeightGrams = weightGrams,
            CodAmount = codAmount,
            ShipperNote = string.IsNullOrWhiteSpace(shipperNote) ? null : shipperNote.Trim(),
            HandedOverAt = at,
            HandedOverById = actor.Id,
            HandedOverByName = actor.Name
        };

    internal void MarkDelivered(DateTime at) => DeliveredAt = at;

    internal void MarkFailed(DateTime at, DeliveryFailReason reason, string? note)
    {
        FailedAt = at;
        FailReason = reason;
        FailNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
    }

    internal void MarkReturned(DateTime at) => ReturnedAt = at;

    internal void MarkPrinted() => LabelPrintCount++;

    /// <summary>Dữ liệu mẫu: phiếu đã in một lần (06 §5.4 bước 3).</summary>
    public void SetLabelPrintCount(int count) => LabelPrintCount = Math.Max(0, count);

    /// <summary>Dữ liệu mẫu đổi mã vận đơn theo thứ tự bàn giao trong ngày của đơn vị.</summary>
    public void SetTrackingCode(string trackingCode) => TrackingCode = trackingCode;
}
