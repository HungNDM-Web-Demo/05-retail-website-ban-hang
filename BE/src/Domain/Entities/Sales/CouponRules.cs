using Domain.Entities.Sales.Coupons;
using Domain.Enums.Sales.Coupons;

namespace Domain.Entities.Sales;

/// <summary>Kết quả kiểm mã (07 §2.2 <c>CouponCheck</c>): hợp lệ hoặc mã lỗi kèm câu hiển thị nguyên văn.</summary>
public sealed record CouponCheckResult(bool Ok, string? ErrorCode, string? Message)
{
    public static readonly CouponCheckResult Valid = new(true, null, null);

    public static CouponCheckResult Fail(string code, string message) => new(false, code, message);
}

/// <summary>
/// Kiểm mã giảm giá theo thứ tự 07 §3.2 bước 1–8 (BR-08, BR-09), gặp lỗi đầu tiên thì dừng. Bước 9 (lượt theo số điện thoại)
/// cần đọc DB nên làm ở service lúc đặt hàng, sửa đơn.
/// </summary>
public static class CouponRules
{
    public const string NotFoundMessage = "Mã giảm giá không tồn tại";
    public const string ExpiredMessage = "Mã đã hết hạn";
    public const string PausedMessage = "Mã đang tạm dừng";
    public const string NotStartedMessage = "Mã chưa đến thời gian áp dụng";
    public const string ExhaustedMessage = "Mã đã hết lượt sử dụng";
    public const string AlreadyFreeShipMessage = "Đơn đã được miễn phí vận chuyển";

    /// <summary>Chuẩn hóa mã khách nhập: bỏ khoảng trắng, chữ hoa.</summary>
    public static string Normalize(string? code) => (code ?? string.Empty).Trim().ToUpperInvariant();

    /// <param name="coupon">Mã chưa xóa tìm theo <c>Code</c>; null → <c>MaKhongTonTai</c>.</param>
    /// <param name="categoryName">Tên danh mục của mã theo danh mục (cho câu lỗi).</param>
    public static CouponCheckResult Check(Coupon? coupon, IReadOnlyCollection<PricingLine> lines, DateTime now, string? categoryName)
    {
        if (coupon is null)
            return CouponCheckResult.Fail(SalesErrors.MaKhongTonTai, NotFoundMessage);
        if (now > coupon.EndAt)
            return CouponCheckResult.Fail(SalesErrors.MaHetHan, ExpiredMessage);
        if (coupon.IsPaused)
            return CouponCheckResult.Fail(SalesErrors.MaTamDung, PausedMessage);
        if (now < coupon.StartAt)
            return CouponCheckResult.Fail(SalesErrors.MaChuaApDung, NotStartedMessage);
        if (coupon.TotalLimit is { } limit && coupon.UsedCount >= limit)
            return CouponCheckResult.Fail(SalesErrors.MaHetLuot, ExhaustedMessage);

        var eligible = OrderPricing.Eligible(lines, coupon.CategoryId);
        if (coupon.CategoryId is not null && eligible == 0)
            return CouponCheckResult.Fail(SalesErrors.MaKhongApDungDanhMuc, $"Mã chỉ áp dụng cho sản phẩm thuộc danh mục {categoryName}");
        if (eligible < coupon.MinOrder)
        {
            var message = coupon.CategoryId is null
                ? $"Đơn tối thiểu {SalesText.Money(coupon.MinOrder)}"
                : $"Đơn tối thiểu {SalesText.Money(coupon.MinOrder)} cho sản phẩm danh mục {categoryName}";
            return CouponCheckResult.Fail(SalesErrors.ChuaDatToiThieu, message);
        }

        // Quyết định 7: mã miễn phí vận chuyển không giảm tiền hàng nên so thẳng tạm tính.
        if (coupon.Type == CouponType.MienPhiVanChuyen && OrderPricing.Subtotal(lines) >= SalesRules.FreeShipThreshold)
            return CouponCheckResult.Fail(SalesErrors.DaMienPhiVanChuyen, AlreadyFreeShipMessage);

        return CouponCheckResult.Valid;
    }

    /// <summary>Câu lỗi bước 9: "Số điện thoại này đã dùng mã {MÃ}".</summary>
    public static string PhoneUsedMessage(string code) => $"Số điện thoại này đã dùng mã {code}";

    public static CouponSpec SpecOf(Coupon coupon) =>
        new(coupon.Code, coupon.Type, coupon.Value, coupon.MaxDiscount, coupon.CategoryId);
}
