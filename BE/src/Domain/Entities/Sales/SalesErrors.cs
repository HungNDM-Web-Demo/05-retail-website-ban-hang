using Domain.Common;
using Domain.Enums.Sales.Orders;

namespace Domain.Entities.Sales;

/// <summary>
/// Mã lỗi nghiệp vụ (07 §2.12): ProblemDetails có trường <c>code</c> để FE rẽ nhánh không cần so chuỗi; <c>detail</c> đúng câu
/// trong bảng. Lỗi 400 ném <see cref="DomainException"/> qua <see cref="Business"/>; 404, 409, 429 ném ở Application
/// (<c>SalesProblems</c>).
/// </summary>
public static class SalesErrors
{
    public const string KhongTimThaySanPham = "KhongTimThaySanPham";
    public const string KhongTimThayDanhMuc = "KhongTimThayDanhMuc";
    public const string GioHangTrong = "GioHangTrong";
    public const string GioQuaNhieuDong = "GioQuaNhieuDong";
    public const string SanPhamNgungBan = "SanPhamNgungBan";
    public const string GiaDaThayDoi = "GiaDaThayDoi";
    public const string KhongDuTon = "KhongDuTon";
    public const string MaKhongTonTai = "MaKhongTonTai";
    public const string MaHetHan = "MaHetHan";
    public const string MaTamDung = "MaTamDung";
    public const string MaChuaApDung = "MaChuaApDung";
    public const string MaHetLuot = "MaHetLuot";
    public const string MaKhongApDungDanhMuc = "MaKhongApDungDanhMuc";
    public const string ChuaDatToiThieu = "ChuaDatToiThieu";
    public const string DaMienPhiVanChuyen = "DaMienPhiVanChuyen";
    public const string SdtDaDungMa = "SdtDaDungMa";
    public const string KhongTimThayDon = "KhongTimThayDon";
    public const string TraCuuTamKhoa = "TraCuuTamKhoa";
    public const string KhongTheTuHuy = "KhongTheTuHuy";
    public const string QuaNhieuYeuCau = "QuaNhieuYeuCau";
    public const string DonDaThayDoi = "DonDaThayDoi";
    public const string DonDaBiHuy = "DonDaBiHuy";
    public const string TrangThaiKhongHopLe = "TrangThaiKhongHopLe";
    public const string KhongHuyDonDaBanGiao = "KhongHuyDonDaBanGiao";
    public const string ChiSuaDonCod = "ChiSuaDonCod";
    public const string KhongCanHoanTien = "KhongCanHoanTien";
    public const string CanItNhatMotBienThe = "CanItNhatMotBienThe";
    public const string SanPhamDaCoTrongDon = "SanPhamDaCoTrongDon";
    public const string BienTheDaCoTrongDon = "BienTheDaCoTrongDon";
    public const string DanhMucConSanPham = "DanhMucConSanPham";
    public const string MaDaCoLuotDung = "MaDaCoLuotDung";

    public const string ProductNotFoundMessage = "Không tìm thấy sản phẩm";
    public const string CategoryNotFoundMessage = "Danh mục không tồn tại";
    public const string EmptyCartMessage = "Giỏ hàng trống";
    public const string TooManyLinesMessage = "Giỏ hàng tối đa 20 sản phẩm";
    public const string PriceChangedMessage = "Giá sản phẩm đã thay đổi, vui lòng kiểm tra lại rồi đặt hàng";
    public const string OrderNotFoundMessage = "Không tìm thấy đơn hàng";
    public const string TooManyRequestsMessage = "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút";
    public const string ShippedCancelMessage = "Không thể hủy đơn đã bàn giao vận chuyển";
    public const string OnlyCodEditMessage = "Chỉ sửa được đơn COD đang Chờ xác nhận";
    public const string NoRefundMessage = "Đơn không ở trạng thái Cần hoàn tiền";
    public const string NeedVariantMessage = "Sản phẩm cần ít nhất một biến thể";
    public const string ProductOrderedMessage = "Sản phẩm đã có trong đơn hàng, không xóa được. Hãy dùng Ẩn";
    public const string CouponUsedMessage = "Mã đã có lượt dùng, không xóa được. Hãy tạm dừng";

    public static string DiscontinuedMessage(string productName) => $"{productName} đã ngừng kinh doanh, vui lòng xóa khỏi giỏ";

    public static string NotEnoughStockMessage(string productName, string colorName, string? size, int stock) =>
        $"{SalesText.VariantFullName(productName, colorName, size)} chỉ còn {stock} sản phẩm";

    public static string LookupLockedMessage(int minutes) => $"Bạn đã tra cứu sai quá 5 lần, vui lòng thử lại sau {minutes} phút";

    public static string CannotSelfCancelMessage(string hotline) =>
        $"Đơn đã được shop xử lý, không tự hủy được. Vui lòng gọi hotline {hotline}";

    public static string ChangedMessage(string name, string hhmm) => $"Đơn vừa được {name} cập nhật lúc {hhmm}, vui lòng xem lại";

    public static string CancelledMessage(string hhmm) => $"Đơn đã bị hủy lúc {hhmm}";

    public static string InvalidStateMessage(OrderStatus status) => $"Thao tác không áp dụng cho đơn {SalesText.Status(status)}";

    public static string VariantOrderedMessage(string sku) =>
        $"Biến thể {sku} đã có trong đơn hàng, không xóa được. Hãy tắt biến thể";

    public static string CategoryHasProductsMessage(int count) =>
        $"Danh mục đang có {count} sản phẩm, chuyển sản phẩm sang danh mục khác trước";

    public static DomainException Business(string code, string message, IReadOnlyDictionary<string, object?>? extra = null)
    {
        var extensions = new Dictionary<string, object?> { ["code"] = code };
        if (extra is not null)
        {
            foreach (var (key, value) in extra)
                extensions[key] = value;
        }

        return new DomainException(message, extensions);
    }

    /// <summary>Lỗi 400 vừa có <c>code</c> vừa gắn <c>errors</c> theo trường.</summary>
    public static DomainException WithErrors(
        string code, string message, IDictionary<string, string[]> errors, IReadOnlyDictionary<string, object?>? extra = null)
    {
        var all = new Dictionary<string, object?>(extra ?? new Dictionary<string, object?>()) { ["errors"] = errors };
        return Business(code, message, all);
    }

    public static DomainException InvalidState(OrderStatus status) =>
        Business(TrangThaiKhongHopLe, InvalidStateMessage(status),
            new Dictionary<string, object?> { ["currentStatus"] = status.ToString() });

    public static DomainException EmptyCart() =>
        WithErrors(GioHangTrong, EmptyCartMessage, new Dictionary<string, string[]> { ["lines"] = [EmptyCartMessage] });

    public static DomainException TooManyLines() =>
        WithErrors(GioQuaNhieuDong, TooManyLinesMessage, new Dictionary<string, string[]> { ["lines"] = [TooManyLinesMessage] });
}
