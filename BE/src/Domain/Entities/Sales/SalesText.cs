using System.Globalization;
using Domain.Enums.Sales.Catalog;
using Domain.Enums.Sales.Orders;

namespace Domain.Entities.Sales;

/// <summary>
/// Chữ hiển thị dùng trong câu lỗi và dòng thời gian (07 §2.12, §3.10), khớp <c>FE/src/config/shop-labels.ts</c>.
/// </summary>
public static class SalesText
{
    private static readonly CultureInfo Invariant = CultureInfo.InvariantCulture;

    /// <summary>Số tiền dạng <c>500.000 ₫</c>.</summary>
    public static string Money(decimal amount) => Number(amount) + " ₫";

    /// <summary>Số nguyên có dấu chấm ngăn nghìn, vd <c>30.000</c>.</summary>
    public static string Number(decimal value) =>
        decimal.Round(value, 0).ToString("#,##0", Invariant).Replace(',', '.');

    public static string Status(OrderStatus status) => status switch
    {
        OrderStatus.ChoThanhToan => "Chờ thanh toán",
        OrderStatus.ChoXacNhan => "Chờ xác nhận",
        OrderStatus.DaXacNhan => "Đã xác nhận",
        OrderStatus.DangGiao => "Đang giao",
        OrderStatus.DaGiao => "Đã giao",
        OrderStatus.DangHoan => "Đang hoàn",
        OrderStatus.DaHoan => "Đã hoàn",
        _ => "Đã hủy"
    };

    public static string CancelReasonName(CancelReason reason) => reason switch
    {
        CancelReason.KhachDoiY => "Khách đổi ý",
        CancelReason.KhongLienLacDuoc => "Không liên lạc được",
        CancelReason.HetHang => "Hết hàng",
        CancelReason.DatTrung => "Đặt trùng",
        CancelReason.QuaHanThanhToan => "Quá hạn thanh toán",
        _ => "Khác"
    };

    public static string FailReasonName(DeliveryFailReason reason) => reason switch
    {
        DeliveryFailReason.KhachKhongNgheMay => "Khách không nghe máy",
        DeliveryFailReason.KhachTuChoiNhan => "Khách từ chối nhận",
        DeliveryFailReason.SaiDiaChi => "Sai địa chỉ",
        _ => "Khác"
    };

    public static string CarrierName(Carrier carrier) => carrier switch
    {
        Carrier.Ghn => "GHN",
        Carrier.Ghtk => "GHTK",
        Carrier.Vtp => "Viettel Post",
        _ => "J&T Express"
    };

    /// <summary>Tiền tố mã vận đơn (BR-17).</summary>
    public static string CarrierPrefix(Carrier carrier) => carrier switch
    {
        Carrier.Ghn => "GHN",
        Carrier.Ghtk => "GHTK",
        Carrier.Vtp => "VTP",
        _ => "JT"
    };

    public static string StockReasonName(StockAdjustReason reason) => reason switch
    {
        StockAdjustReason.NhapHang => "Nhập hàng",
        StockAdjustReason.KiemKe => "Kiểm kê",
        StockAdjustReason.HangLoi => "Hàng lỗi",
        _ => "Khác"
    };

    /// <summary>Nhãn biến thể "{màu}/{size}" hoặc "{màu}" (07 §3.10).</summary>
    public static string VariantLabel(string colorName, string? size) =>
        string.IsNullOrEmpty(size) ? colorName : $"{colorName}/{size}";

    /// <summary>"{tên} – {màu} / {size}" hoặc "{tên} – {màu}" (câu <c>KhongDuTon</c>, 07 §2.12).</summary>
    public static string VariantFullName(string productName, string colorName, string? size) =>
        string.IsNullOrEmpty(size) ? $"{productName} – {colorName}" : $"{productName} – {colorName} / {size}";
}
