using Domain.Base;
using Domain.Enums.Sales.Coupons;

namespace Domain.Entities.Sales.Coupons;

/// <summary>
/// Mã giảm giá (bảng <c>Sales_Coupons</c>, BR-08, BR-09, BR-26). <see cref="UsedCount"/> = số đơn chưa hủy có mã: cộng khi
/// tạo đơn bằng câu cập nhật có điều kiện, trừ khi đơn Đã hủy, không trừ khi hoàn hàng. Xóa mềm, chặn khi đã có lượt dùng.
/// </summary>
public class Coupon : BaseEntity, ICreationTracked, IModificationTracked, ISoftDelete
{
    public const int CodeMaxLength = 20;
    public const int NameMaxLength = 200;

    private Coupon()
    {
    }

    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public CouponType Type { get; private set; }
    public decimal Value { get; private set; }
    public decimal? MaxDiscount { get; private set; }
    public decimal MinOrder { get; private set; }
    public Guid? CategoryId { get; private set; }
    public int? TotalLimit { get; private set; }
    public int PerCustomerLimit { get; private set; } = 1;
    public int UsedCount { get; private set; }
    public DateTime StartAt { get; private set; }
    public DateTime EndAt { get; private set; }
    public bool IsPaused { get; private set; }
    public bool IsDeleted { get; set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public static Coupon Create(
        string code, string name, CouponType type, decimal value, decimal? maxDiscount, decimal minOrder, Guid? categoryId,
        int? totalLimit, int perCustomerLimit, DateTime startAt, DateTime endAt)
    {
        var coupon = new Coupon();
        coupon.Update(code, name, type, value, maxDiscount, minOrder, categoryId, totalLimit, perCustomerLimit, startAt, endAt);
        return coupon;
    }

    public void Update(
        string code, string name, CouponType type, decimal value, decimal? maxDiscount, decimal minOrder, Guid? categoryId,
        int? totalLimit, int perCustomerLimit, DateTime startAt, DateTime endAt)
    {
        Code = code.Trim().ToUpperInvariant();
        Name = name.Trim();
        Type = type;
        Value = type == CouponType.MienPhiVanChuyen ? 0 : value;
        MaxDiscount = type == CouponType.PhanTram ? maxDiscount : null;
        MinOrder = minOrder;
        CategoryId = categoryId;
        TotalLimit = totalLimit;
        PerCustomerLimit = Math.Max(1, perCustomerLimit);
        StartAt = startAt;
        EndAt = endAt;
    }

    public void SetPaused(bool paused) => IsPaused = paused;

    public void SetUsedCount(int usedCount) => UsedCount = Math.Max(0, usedCount);

    /// <summary>Trạng thái theo thứ tự ưu tiên: hết hạn → tạm dừng → sắp chạy → hết lượt → đang chạy.</summary>
    public CouponStatus StatusAt(DateTime now) => StatusOf(StartAt, EndAt, IsPaused, UsedCount, TotalLimit, now);

    public static CouponStatus StatusOf(DateTime startAt, DateTime endAt, bool isPaused, int usedCount, int? totalLimit, DateTime now)
    {
        if (now > endAt)
            return CouponStatus.HetHan;
        if (isPaused)
            return CouponStatus.TamDung;
        if (now < startAt)
            return CouponStatus.SapChay;
        if (totalLimit is { } limit && usedCount >= limit)
            return CouponStatus.HetLuot;
        return CouponStatus.DangChay;
    }
}
