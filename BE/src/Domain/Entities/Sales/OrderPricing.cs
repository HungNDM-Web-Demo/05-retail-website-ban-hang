using Domain.Enums.Sales.Coupons;
using Domain.Enums.Sales.Locations;

namespace Domain.Entities.Sales;

/// <summary>Một dòng để tính tiền: danh mục (phạm vi mã), đơn giá, số lượng.</summary>
public sealed record PricingLine(Guid CategoryId, decimal UnitPrice, int Quantity)
{
    public decimal LineTotal => UnitPrice * Quantity;
}

/// <summary>Phần tính tiền của mã giảm giá (không gồm điều kiện hiệu lực).</summary>
public sealed record CouponSpec(string Code, CouponType Type, decimal Value, decimal? MaxDiscount, Guid? CategoryId);

/// <summary>Kết quả tính tiền (07 §2.2 <c>PricingSummary</c>).</summary>
public sealed record PricingResult(
    decimal Subtotal, decimal Discount, decimal ShippingFee, decimal ShippingDiscount, decimal Total, string? CouponCode)
{
    /// <summary>max(0, 499.000 − (tạm tính − giảm giá)).</summary>
    public decimal FreeShipRemaining => Math.Max(0, SalesRules.FreeShipThreshold - (Subtotal - Discount));

    /// <summary>Doanh thu thuần của đơn = tạm tính − giảm giá (BR-22).</summary>
    public decimal NetRevenue => Subtotal - Discount;
}

/// <summary>
/// Công thức tiền (07 §3.1–3.3, BR-05, BR-06, BR-08), nguồn sự thật chung với FE <c>features/sales/lib/pricing.ts</c>.
/// Mọi số tiền là số nguyên đồng.
/// </summary>
public static class OrderPricing
{
    public static decimal Subtotal(IEnumerable<PricingLine> lines) => lines.Sum(l => l.LineTotal);

    /// <summary>Phần tạm tính thuộc phạm vi mã: mọi dòng nếu mã toàn shop, dòng thuộc danh mục nếu mã theo danh mục.</summary>
    public static decimal Eligible(IEnumerable<PricingLine> lines, Guid? scopeCategoryId) =>
        lines.Where(l => scopeCategoryId is null || l.CategoryId == scopeCategoryId).Sum(l => l.LineTotal);

    /// <summary>
    /// Tiền giảm trên tiền hàng: phần trăm làm tròn xuống tới 1.000 ₫, không vượt mức tối đa; số tiền không vượt phần thuộc phạm vi;
    /// miễn phí vận chuyển = 0; luôn ≤ tạm tính.
    /// </summary>
    public static decimal DiscountOf(IReadOnlyCollection<PricingLine> lines, CouponSpec coupon)
    {
        var eligible = Eligible(lines, coupon.CategoryId);
        var discount = coupon.Type switch
        {
            CouponType.PhanTram => Math.Min(
                Math.Floor(eligible * coupon.Value / 100m / 1000m) * 1000m,
                coupon.MaxDiscount ?? decimal.MaxValue),
            CouponType.SoTien => Math.Min(coupon.Value, eligible),
            _ => 0m
        };
        return Math.Min(discount, Subtotal(lines));
    }

    /// <summary>
    /// Tính tạm tính, giảm giá, phí vận chuyển, tổng. <paramref name="zone"/> null (chưa chọn tỉnh) → phí 0.
    /// <paramref name="coupon"/> là mã đã kiểm hợp lệ (null = không mã).
    /// </summary>
    public static PricingResult Calculate(IReadOnlyCollection<PricingLine> lines, ShippingZone? zone, CouponSpec? coupon)
    {
        var subtotal = Subtotal(lines);
        var discount = coupon is null ? 0m : DiscountOf(lines, coupon);
        var fee = zone is { } z ? SalesRules.FeeOf(z) : 0m;
        var shippingFee = subtotal - discount >= SalesRules.FreeShipThreshold ? 0m : fee;
        var shippingDiscount = 0m;
        if (coupon?.Type == CouponType.MienPhiVanChuyen)
        {
            shippingDiscount = shippingFee;
            shippingFee = 0m;
        }

        return new PricingResult(subtotal, discount, shippingFee, shippingDiscount, subtotal - discount + shippingFee, coupon?.Code);
    }

    /// <summary>
    /// Phân bổ <paramref name="discount"/> cho các dòng thuộc phạm vi theo tỉ lệ thành tiền, làm tròn xuống tới đồng, dòng thuộc
    /// phạm vi cuối cùng nhận phần dư (07 §3.13, §5 quyết định 19). Trả phần giảm của từng dòng theo thứ tự.
    /// </summary>
    public static decimal[] AllocateDiscount(IReadOnlyList<PricingLine> lines, decimal discount, Guid? scopeCategoryId)
    {
        var result = new decimal[lines.Count];
        if (discount <= 0)
            return result;

        var inScope = Enumerable.Range(0, lines.Count)
            .Where(i => scopeCategoryId is null || lines[i].CategoryId == scopeCategoryId)
            .ToList();
        var eligible = inScope.Sum(i => lines[i].LineTotal);
        if (inScope.Count == 0 || eligible <= 0)
            return result;

        var allocated = 0m;
        for (var k = 0; k < inScope.Count; k++)
        {
            var i = inScope[k];
            result[i] = k == inScope.Count - 1
                ? discount - allocated
                : Math.Floor(discount * lines[i].LineTotal / eligible);
            allocated += result[i];
        }

        return result;
    }
}
