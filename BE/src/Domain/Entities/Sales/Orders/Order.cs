using System.Globalization;
using Domain.Base;
using Domain.Common;
using Domain.Enums.Sales.Orders;

namespace Domain.Entities.Sales.Orders;

/// <summary>
/// Đơn hàng (bảng <c>Sales_Orders</c>). Trạng thái chỉ đổi qua các method dưới đây theo bảng 07 §3.5; mỗi thao tác ghi sự kiện
/// (chữ 07 §3.10) và tăng <see cref="Version"/> (concurrency token, 07 §3.6). Tồn kho, lượt mã, thống kê khách do service áp.
/// Dữ liệu mẫu phát lại sự kiện qua đúng các method này.
/// </summary>
public class Order : BaseEntity, ICreationTracked, IModificationTracked, IAuditLogExempt
{
    public const int CodeMaxLength = 20;
    public const int RefMaxLength = 30;
    public const int NameMaxLength = 100;
    public const int PhoneMaxLength = 15;
    public const int EmailMaxLength = 200;
    public const int CodeShortMaxLength = 10;
    public const int AddressMaxLength = 200;
    public const int NoteMaxLength = 500;
    public const int UserNameMaxLength = 150;
    public const int KeyMaxLength = 64;
    public const int CouponCodeMaxLength = 20;

    private Order()
    {
    }

    public string Code { get; private set; } = string.Empty;
    public Guid CustomerId { get; private set; }
    public DateTime PlacedAt { get; private set; }
    public OrderStatus Status { get; private set; }
    public PaymentMethod PaymentMethod { get; private set; }
    public PaymentStatus PaymentStatus { get; private set; }
    public DateTime? PaymentDueAt { get; private set; }
    public string? TransactionRef { get; private set; }
    public DateTime? PaidAt { get; private set; }
    public decimal? RefundAmount { get; private set; }
    public string? RefundRef { get; private set; }
    public DateTime? RefundedAt { get; private set; }
    public string RecipientName { get; private set; } = string.Empty;
    public string Phone { get; private set; } = string.Empty;
    public string? Email { get; private set; }
    public string ProvinceCode { get; private set; } = string.Empty;
    public string ProvinceName { get; private set; } = string.Empty;
    public string WardCode { get; private set; } = string.Empty;
    public string WardName { get; private set; } = string.Empty;
    public string AddressLine { get; private set; } = string.Empty;
    public string? CustomerNote { get; private set; }
    public decimal Subtotal { get; private set; }
    public decimal Discount { get; private set; }
    public decimal ShippingFee { get; private set; }
    public decimal ShippingDiscount { get; private set; }
    public decimal Total { get; private set; }
    public Guid? CouponId { get; private set; }
    public string? CouponCode { get; private set; }
    public CancelReason? CancelReason { get; private set; }
    public string? CancelNote { get; private set; }
    public DateTime? CancelledAt { get; private set; }
    public Guid? CancelledById { get; private set; }
    public string? CancelledByName { get; private set; }
    public string? ClientRequestId { get; private set; }
    public string? DeviceId { get; private set; }
    public int Version { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public List<OrderLine> Lines { get; private set; } = [];
    public List<OrderEvent> Events { get; private set; } = [];
    public Shipment? Shipment { get; private set; }

    /// <summary>Tiền thu hộ (BR-17): tổng thanh toán với COD, 0 với chuyển khoản.</summary>
    public decimal CodAmount => PaymentMethod == PaymentMethod.Cod ? Total : 0m;

    public int ItemCount => Lines.Sum(l => l.Quantity);

    public bool IsPendingStatus => Status is OrderStatus.ChoThanhToan or OrderStatus.ChoXacNhan;

    /// <summary>
    /// Tạo đơn (FR-13, BR-11): COD → Chờ xác nhận; chuyển khoản → Chờ thanh toán, hạn 24 giờ. Ghi sự kiện đặt hàng (người "Khách")
    /// và tin gửi khách (SMS, thêm email khi có).
    /// </summary>
    public static Order Place(
        string code, Guid customerId, DateTime placedAt, PaymentMethod paymentMethod, OrderRecipient recipient, string? customerNote,
        IReadOnlyList<OrderLine> lines, PricingResult pricing, Guid? couponId, string? clientRequestId, string? deviceId)
    {
        if (lines.Count == 0)
            throw new DomainException(SalesErrors.EmptyCartMessage);

        var order = new Order
        {
            Code = code,
            CustomerId = customerId,
            PlacedAt = placedAt,
            PaymentMethod = paymentMethod,
            PaymentStatus = PaymentStatus.ChuaThanhToan,
            Status = paymentMethod == PaymentMethod.Cod ? OrderStatus.ChoXacNhan : OrderStatus.ChoThanhToan,
            PaymentDueAt = paymentMethod == PaymentMethod.ChuyenKhoan ? placedAt.AddHours(SalesRules.PaymentHours) : null,
            CustomerNote = Clean(customerNote),
            ClientRequestId = Clean(clientRequestId),
            DeviceId = Clean(deviceId)
        };
        order.SetRecipient(recipient);
        order.SetLines(lines);
        order.SetPricing(pricing, couponId);

        order.Version = 1;
        var placedText = paymentMethod == PaymentMethod.Cod
            ? "Đặt hàng qua website"
            : $"Đặt hàng qua website, hạn thanh toán {FormatVn(order.PaymentDueAt!.Value, "HH:mm dd/MM")}";
        order.AddEvent(OrderEventType.DoiTrangThai, placedAt, OrderActor.Customer, null, order.Status, placedText);
        order.AddMessage(placedAt, paymentMethod == PaymentMethod.Cod
            ? "Đã gửi SMS xác nhận đơn (giả lập)"
            : "Đã gửi SMS hướng dẫn chuyển khoản (giả lập)");
        if (order.Email is { } email)
            order.AddMessage(placedAt, $"Đã gửi email xác nhận đơn tới {email} (giả lập)");
        return order;
    }

    /// <summary>Xác nhận đơn COD: Chờ xác nhận → Đã xác nhận (FR-24).</summary>
    public void Confirm(OrderActor actor, DateTime at, string? note)
    {
        Require(OrderStatus.ChoXacNhan);
        Transition(OrderStatus.DaXacNhan, actor, at, Clean(note) ?? string.Empty);
        AddMessage(at, "Đơn đã được xác nhận (SMS giả lập)");
    }

    /// <summary>Xác nhận đã nhận tiền chuyển khoản: Chờ thanh toán → Đã xác nhận (FR-25, BR-12).</summary>
    public void ConfirmPayment(OrderActor actor, DateTime at, string transactionRef)
    {
        Require(OrderStatus.ChoThanhToan);
        TransactionRef = transactionRef.Trim();
        PaymentStatus = PaymentStatus.DaThanhToan;
        PaidAt = at;
        Transition(OrderStatus.DaXacNhan, actor, at, $"Đã nhận tiền chuyển khoản, mã giao dịch {TransactionRef}");
        AddMessage(at, "Đã nhận tiền, đơn đã được xác nhận (SMS giả lập)");
    }

    /// <summary>
    /// Hủy đơn chưa bàn giao (FR-27, BR-16): đã thanh toán thì chuyển Cần hoàn tiền, số tiền bằng tổng. Service cộng lại tồn,
    /// trừ lượt mã. Từ Đang giao trở đi → <c>KhongHuyDonDaBanGiao</c>.
    /// </summary>
    public void Cancel(OrderActor actor, DateTime at, CancelReason reason, string? note)
    {
        if (Status is OrderStatus.DangGiao or OrderStatus.DaGiao or OrderStatus.DangHoan or OrderStatus.DaHoan)
            throw SalesErrors.Business(SalesErrors.KhongHuyDonDaBanGiao, SalesErrors.ShippedCancelMessage);
        if (Status is not (OrderStatus.ChoThanhToan or OrderStatus.ChoXacNhan or OrderStatus.DaXacNhan))
            throw SalesErrors.InvalidState(Status);

        CancelReason = reason;
        CancelNote = Clean(note);
        CancelledAt = at;
        CancelledById = actor.Id;
        CancelledByName = actor.Name;
        var content = reason == Enums.Sales.Orders.CancelReason.Khac && CancelNote is not null
            ? $"Khác: {CancelNote}"
            : SalesText.CancelReasonName(reason);
        if (PaymentStatus == PaymentStatus.DaThanhToan)
        {
            PaymentStatus = PaymentStatus.CanHoanTien;
            RefundAmount = Total;
            content += $" · Cần hoàn tiền {SalesText.Money(Total)}";
        }

        Transition(OrderStatus.DaHuy, actor, at, content);
        AddMessage(at, "Đơn đã hủy (SMS giả lập)");
    }

    /// <summary>Bàn giao vận chuyển: Đã xác nhận → Đang giao, tạo vận đơn (FR-28, BR-17).</summary>
    public void Ship(OrderActor actor, DateTime at, Carrier carrier, string trackingCode, int weightGrams, string? shipperNote)
    {
        Require(OrderStatus.DaXacNhan);
        Shipment = Shipment.Create(Id, carrier, trackingCode, weightGrams, CodAmount, shipperNote, at, actor);
        var carrierName = SalesText.CarrierName(carrier);
        Transition(OrderStatus.DangGiao, actor, at,
            $"Bàn giao {carrierName}, mã vận đơn {trackingCode}, {SalesText.Number(weightGrams)} g");
        AddMessage(at, $"Đơn đã giao cho {carrierName}, mã vận đơn {trackingCode} (SMS giả lập)");
    }

    /// <summary>Giao thành công: Đang giao → Đã giao; COD chuyển Đã thanh toán (FR-30, BR-19). Service cộng số đã bán.</summary>
    public void Deliver(OrderActor actor, DateTime at)
    {
        Require(OrderStatus.DangGiao);
        Shipment!.MarkDelivered(at);
        if (PaymentMethod == PaymentMethod.Cod)
        {
            PaymentStatus = PaymentStatus.DaThanhToan;
            PaidAt = at;
        }

        Transition(OrderStatus.DaGiao, actor, at, "Giao hàng thành công");
        AddMessage(at, "Giao hàng thành công, cảm ơn quý khách (SMS giả lập)");
    }

    /// <summary>Giao thất bại: Đang giao → Đang hoàn (BR-19). Tồn chưa đổi.</summary>
    public void DeliveryFailed(OrderActor actor, DateTime at, DeliveryFailReason reason, string? note)
    {
        Require(OrderStatus.DangGiao);
        Shipment!.MarkFailed(at, reason, note);
        var content = reason == DeliveryFailReason.Khac && Clean(note) is { } text
            ? $"Giao thất bại: Khác: {text}"
            : $"Giao thất bại: {SalesText.FailReasonName(reason)}";
        Transition(OrderStatus.DangHoan, actor, at, content);
    }

    /// <summary>Đã nhận hàng hoàn: Đang hoàn → Đã hoàn. Service cộng lại tồn; lượt mã không trả (BR-09, BR-13).</summary>
    public void ReceiveReturn(OrderActor actor, DateTime at)
    {
        Require(OrderStatus.DangHoan);
        Shipment!.MarkReturned(at);
        Transition(OrderStatus.DaHoan, actor, at, "Đã nhận hàng hoàn về kho");
    }

    /// <summary>Đã hoàn tiền cho đơn chuyển khoản bị hủy: Cần hoàn tiền → Đã hoàn tiền (BR-16).</summary>
    public void Refund(OrderActor actor, DateTime at, string refundRef)
    {
        if (Status != OrderStatus.DaHuy || PaymentStatus != PaymentStatus.CanHoanTien)
            throw SalesErrors.Business(SalesErrors.KhongCanHoanTien, SalesErrors.NoRefundMessage);

        RefundRef = refundRef.Trim();
        RefundedAt = at;
        PaymentStatus = PaymentStatus.DaHoanTien;
        Touch();
        AddEvent(OrderEventType.HoanTien, at, actor, null, null,
            $"Đã hoàn tiền {SalesText.Money(RefundAmount ?? Total)}, mã giao dịch {RefundRef}");
    }

    /// <summary>Ghi chú nội bộ, được ở mọi trạng thái (FR-23).</summary>
    public void AddNote(OrderActor actor, DateTime at, string content)
    {
        Touch();
        AddEvent(OrderEventType.GhiChuNoiBo, at, actor, null, null, content.Trim());
    }

    /// <summary>Ghi đã in phiếu giao (UC-10 5a). Đơn chưa có vận đơn: chỉ tăng version (phiếu in "Chưa bàn giao").</summary>
    public int MarkLabelPrinted()
    {
        if (!OrderWorkflow.AllowedActions(Status, PaymentStatus).Contains(OrderAction.PrintLabel))
            throw SalesErrors.InvalidState(Status);
        Touch();
        if (Shipment is null)
            return 0;
        Shipment.MarkPrinted();
        return Shipment.LabelPrintCount;
    }

    /// <summary>Kiểm được phép sửa (BR-15): chỉ đơn COD đang Chờ xác nhận.</summary>
    public void EnsureEditable()
    {
        if (PaymentMethod != PaymentMethod.Cod || Status != OrderStatus.ChoXacNhan)
            throw SalesErrors.Business(SalesErrors.ChiSuaDonCod, SalesErrors.OnlyCodEditMessage);
    }

    /// <summary>
    /// Sửa đơn COD Chờ xác nhận (FR-26, BR-15): thay dòng, người nhận, tiền; <paramref name="couponRemoved"/> thì gỡ mã.
    /// Service đã trừ, cộng tồn phần chênh lệch. Ghi "Sửa đơn: {các thay đổi}".
    /// </summary>
    public void Edit(
        OrderActor actor, DateTime at, OrderRecipient recipient, IReadOnlyList<OrderLine> lines, PricingResult pricing, bool couponRemoved,
        IReadOnlyList<string> changes, Guid customerId)
    {
        EnsureEditable();
        CustomerId = customerId;
        SetRecipient(recipient);
        Lines.Clear();
        SetLines(lines);
        SetPricing(pricing, couponRemoved ? null : CouponId);
        if (couponRemoved)
            CouponCode = null;
        Touch();
        AddEvent(OrderEventType.SuaDon, at, actor, null, null,
            changes.Count == 0 ? "Sửa đơn" : $"Sửa đơn: {string.Join("; ", changes)}");
    }

    private void SetRecipient(OrderRecipient recipient)
    {
        RecipientName = recipient.Name.Trim();
        Phone = recipient.Phone;
        Email = Clean(recipient.Email);
        ProvinceCode = recipient.ProvinceCode;
        ProvinceName = recipient.ProvinceName;
        WardCode = recipient.WardCode;
        WardName = recipient.WardName;
        AddressLine = recipient.AddressLine.Trim();
    }

    private void SetLines(IReadOnlyList<OrderLine> lines)
    {
        foreach (var line in lines)
        {
            line.AttachTo(Id);
            Lines.Add(line);
        }
    }

    private void SetPricing(PricingResult pricing, Guid? couponId)
    {
        Subtotal = pricing.Subtotal;
        Discount = pricing.Discount;
        ShippingFee = pricing.ShippingFee;
        ShippingDiscount = pricing.ShippingDiscount;
        Total = pricing.Total;
        CouponId = pricing.CouponCode is null ? null : couponId;
        CouponCode = pricing.CouponCode;
    }

    private void Require(OrderStatus expected)
    {
        if (Status != expected)
            throw SalesErrors.InvalidState(Status);
    }

    private void Transition(OrderStatus to, OrderActor actor, DateTime at, string content)
    {
        var from = Status;
        Status = to;
        Touch();
        AddEvent(OrderEventType.DoiTrangThai, at, actor, from, to, content);
    }

    private void AddMessage(DateTime at, string content) =>
        AddEvent(OrderEventType.TinGuiKhach, at, OrderActor.System, null, null, content);

    private int _seqInVersion;
    private int _seqVersion;

    private void AddEvent(OrderEventType type, DateTime at, OrderActor actor, OrderStatus? from, OrderStatus? to, string content)
    {
        if (_seqVersion != Version)
        {
            _seqVersion = Version;
            _seqInVersion = 0;
        }

        Events.Add(OrderEvent.Create(Id, type, at, actor, from, to, content, Version * 10 + _seqInVersion++));
    }

    private void Touch() => Version++;

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    /// <summary>Giờ Việt Nam (UTC+7, không đổi giờ mùa hè) để ghi vào câu dòng thời gian.</summary>
    public static string FormatVn(DateTime utc, string format) =>
        DateTime.SpecifyKind(utc, DateTimeKind.Utc).AddHours(7).ToString(format, CultureInfo.InvariantCulture);
}
