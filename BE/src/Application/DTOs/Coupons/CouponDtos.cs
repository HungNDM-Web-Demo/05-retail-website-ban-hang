using Application.Common.Models;
using Domain.Enums.Sales.Coupons;

namespace Application.DTOs.Coupons;

// Mã giảm giá (07 §2.6).

public sealed class CouponDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public CouponType Type { get; init; }
    public decimal Value { get; init; }
    public decimal? MaxDiscount { get; init; }
    public decimal MinOrder { get; init; }
    public Guid? CategoryId { get; init; }
    public string? CategoryName { get; init; }
    public int? TotalLimit { get; init; }
    public int PerCustomerLimit { get; init; }

    /// <summary>Đơn chưa hủy có mã (BR-09).</summary>
    public int UsedCount { get; init; }

    /// <summary>Σ discount + shippingDiscount của đơn chưa hủy.</summary>
    public decimal DiscountTotal { get; init; }

    /// <summary>Σ total của đơn chưa hủy có mã.</summary>
    public decimal OrderValueTotal { get; init; }

    public DateTime StartAt { get; init; }
    public DateTime EndAt { get; init; }
    public bool IsPaused { get; init; }
    public CouponStatus Status { get; init; }

    /// <summary>Chưa có lượt dùng nào, kể cả đơn đã hủy (BR-26).</summary>
    public bool CanDelete { get; init; }
}

public sealed class CouponQuery : PaginationQuery
{
    public CouponStatus? Status { get; set; }
}

public sealed class SaveCouponRequest
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public CouponType? Type { get; set; }
    public decimal Value { get; set; }
    public decimal? MaxDiscount { get; set; }
    public decimal MinOrder { get; set; }
    public Guid? CategoryId { get; set; }
    public int? TotalLimit { get; set; }
    public int PerCustomerLimit { get; set; } = 1;
    public DateTime? StartAt { get; set; }
    public DateTime? EndAt { get; set; }
}

public sealed class PauseCouponRequest
{
    public bool Paused { get; set; }
}
