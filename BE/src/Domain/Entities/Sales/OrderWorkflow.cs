using Domain.Entities.Sales.Orders;
using Domain.Enums.Sales.Orders;

namespace Domain.Entities.Sales;

/// <summary>Một mục dòng thời gian cho khách ở trang tra cứu (07 §3.10 cột cuối).</summary>
public sealed record PublicTimelineEntry(DateTime At, OrderStatus? Status, string Text);

/// <summary>
/// Quy tắc vòng đời đơn dùng lúc đọc (07 §3.5, §3.8, §3.10): thao tác được phép, nhãn đơn, dòng thời gian cho khách.
/// Chuyển trạng thái nằm trong các method của <see cref="Order"/>.
/// </summary>
public static class OrderWorkflow
{
    /// <summary>Thao tác được phép theo trạng thái (không xét quyền).</summary>
    public static IReadOnlyList<OrderAction> AllowedActions(OrderStatus status, PaymentStatus paymentStatus) => status switch
    {
        OrderStatus.ChoThanhToan => [OrderAction.ConfirmPayment, OrderAction.Cancel],
        OrderStatus.ChoXacNhan => [OrderAction.Confirm, OrderAction.Edit, OrderAction.Cancel],
        OrderStatus.DaXacNhan => [OrderAction.Ship, OrderAction.Cancel, OrderAction.PrintLabel],
        OrderStatus.DangGiao => [OrderAction.Deliver, OrderAction.DeliveryFailed, OrderAction.PrintLabel],
        OrderStatus.DangHoan => [OrderAction.ReceiveReturn, OrderAction.PrintLabel],
        OrderStatus.DaGiao or OrderStatus.DaHoan => [OrderAction.PrintLabel],
        OrderStatus.DaHuy when paymentStatus == PaymentStatus.CanHoanTien => [OrderAction.Refund],
        _ => []
    };

    /// <summary>Khách tự hủy được khi đơn Chờ thanh toán hoặc Chờ xác nhận (BR-16).</summary>
    public static bool CanSelfCancel(OrderStatus status) => status is OrderStatus.ChoThanhToan or OrderStatus.ChoXacNhan;

    /// <summary>Giao chậm (BR-18): Đang giao và đã bàn giao quá 5 ngày.</summary>
    public static bool IsSlow(OrderStatus status, DateTime? handedOverAt, DateTime now) =>
        status == OrderStatus.DangGiao && handedOverAt is { } at && now - at > TimeSpan.FromDays(SalesRules.SlowDeliveryDays);

    /// <summary>Đơn đang được xử lý để gắn nhãn Khách cần lưu ý (BR-21).</summary>
    public static bool IsInProgress(OrderStatus status) =>
        status is OrderStatus.ChoThanhToan or OrderStatus.ChoXacNhan or OrderStatus.DaXacNhan;

    /// <summary>Nhãn đơn (07 §3.8): Trùng SĐT (đã tính sẵn), Giao chậm, Khách cần lưu ý.</summary>
    public static IReadOnlyList<OrderLabel> Labels(OrderStatus status, DateTime? handedOverAt, bool hasDuplicate, int customerReturnCount, DateTime now)
    {
        var labels = new List<OrderLabel>(3);
        if (hasDuplicate && status is OrderStatus.ChoThanhToan or OrderStatus.ChoXacNhan)
            labels.Add(OrderLabel.TrungSdt);
        if (IsSlow(status, handedOverAt, now))
            labels.Add(OrderLabel.GiaoCham);
        if (customerReturnCount >= SalesRules.AttentionReturns && IsInProgress(status))
            labels.Add(OrderLabel.KhachCanLuuY);
        return labels;
    }

    /// <summary>Hai đơn chờ cùng số điện thoại đặt cách nhau ≤ 24 giờ (BR-20).</summary>
    public static bool IsDuplicatePair(DateTime a, DateTime b) =>
        Math.Abs((a - b).TotalHours) <= SalesRules.DuplicatePhoneHours;

    /// <summary>Dòng thời gian cho khách, cũ trước; không có ghi chú nội bộ, tin gửi khách, tên nhân viên.</summary>
    public static IReadOnlyList<PublicTimelineEntry> PublicTimeline(Order order)
    {
        var items = new List<PublicTimelineEntry>();
        foreach (var e in order.Events.OrderBy(e => e.At).ThenBy(e => e.Seq))
        {
            var text = e.Type switch
            {
                OrderEventType.DoiTrangThai => StatusText(order, e),
                OrderEventType.SuaDon => "Shop đã cập nhật đơn theo yêu cầu của bạn",
                OrderEventType.HoanTien => $"Shop đã hoàn tiền {SalesText.Money(order.RefundAmount ?? order.Total)}",
                _ => null
            };
            if (text is not null)
                items.Add(new PublicTimelineEntry(e.At, e.Type == OrderEventType.DoiTrangThai ? e.ToStatus : null, text));
        }

        return items;
    }

    private static string StatusText(Order order, OrderEvent e) => e.ToStatus switch
    {
        OrderStatus.ChoXacNhan => "Đặt hàng thành công, chờ shop xác nhận",
        OrderStatus.ChoThanhToan => "Đặt hàng thành công, chờ chuyển khoản",
        OrderStatus.DaXacNhan when e.FromStatus == OrderStatus.ChoThanhToan => "Shop đã nhận tiền và xác nhận đơn",
        OrderStatus.DaXacNhan => "Shop đã xác nhận đơn",
        OrderStatus.DangGiao when order.Shipment is { } s =>
            $"Đã giao cho {SalesText.CarrierName(s.Carrier)}, mã vận đơn {s.TrackingCode}",
        OrderStatus.DangGiao => "Đã giao cho đơn vị vận chuyển",
        OrderStatus.DaGiao => "Giao hàng thành công",
        OrderStatus.DangHoan => "Giao hàng không thành công, đơn đang hoàn về shop",
        OrderStatus.DaHoan => "Đơn đã hoàn về shop",
        OrderStatus.DaHuy => $"Đơn đã hủy: {SalesText.CancelReasonName(order.CancelReason ?? CancelReason.Khac)}",
        _ => SalesText.Status(e.ToStatus ?? order.Status)
    };
}
