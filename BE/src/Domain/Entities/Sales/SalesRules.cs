using Domain.Enums.Sales.Locations;

namespace Domain.Entities.Sales;

/// <summary>
/// Các con số cố định của SRS (06 §3, 07 §3), BE và FE (<c>features/sales/lib/rules.ts</c>) cùng giá trị.
/// </summary>
public static class SalesRules
{
    /// <summary>Phí vận chuyển TP.HCM (BR-06).</summary>
    public const decimal FeeTpHcm = 20_000m;

    /// <summary>Phí vận chuyển tỉnh/thành khác (BR-06).</summary>
    public const decimal FeeOther = 35_000m;

    /// <summary>Miễn phí vận chuyển khi tạm tính − giảm giá đạt mức này (BR-06).</summary>
    public const decimal FreeShipThreshold = 499_000m;

    /// <summary>Hạn thanh toán đơn chuyển khoản (BR-11).</summary>
    public const int PaymentHours = 24;

    /// <summary>Tồn sắp hết 1–5 (BR-02).</summary>
    public const int LowStockMax = 5;

    /// <summary>Số lượng tối đa mỗi dòng giỏ (BR-03).</summary>
    public const int MaxLineQuantity = 10;

    /// <summary>Số dòng tối đa của giỏ (BR-03).</summary>
    public const int MaxCartLines = 20;

    /// <summary>Giao chậm sau số ngày này kể từ lúc bàn giao (BR-18).</summary>
    public const int SlowDeliveryDays = 5;

    /// <summary>Khách VIP từ tổng chi tiêu này (BR-21).</summary>
    public const decimal VipSpent = 5_000_000m;

    /// <summary>Khách cần lưu ý từ số đơn hoàn này (BR-21).</summary>
    public const int AttentionReturns = 2;

    /// <summary>Khối lượng bàn giao 50–30.000 g (BR-17).</summary>
    public const int MinWeightGrams = 50;

    public const int MaxWeightGrams = 30_000;

    /// <summary>Tra cứu sai 5 lần trong 10 phút thì chặn 10 phút (BR-28).</summary>
    public const int LookupMaxFails = 5;

    public const int LookupWindowMinutes = 10;

    public const int LookupBlockMinutes = 10;

    /// <summary>Hai đơn chờ cùng số điện thoại đặt cách nhau tối đa số giờ này thì gắn Trùng SĐT (BR-20).</summary>
    public const int DuplicatePhoneHours = 24;

    /// <summary>Ảnh tối đa của một sản phẩm (FR-17).</summary>
    public const int MaxProductImages = 8;

    public static decimal FeeOf(ShippingZone zone) => zone == ShippingZone.TpHcm ? FeeTpHcm : FeeOther;
}
