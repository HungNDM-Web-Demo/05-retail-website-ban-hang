using Domain.Enums.Sales.Orders;

namespace Application.DTOs.Reports;

// Tổng quan, báo cáo (07 §2.8); công thức 07 §3.13. Tỉ lệ là %, 1 chữ số thập phân.

public class DateRangeQuery
{
    /// <summary><c>yyyy-MM-dd</c> giờ Việt Nam.</summary>
    public string? From { get; set; }

    public string? To { get; set; }
}

public sealed class TopProductsQuery : DateRangeQuery
{
    public Guid? CategoryId { get; set; }

    /// <summary><c>product</c> (mặc định) hoặc <c>variant</c>.</summary>
    public string? GroupBy { get; set; }
}

public sealed class OrderStatusReportQuery : DateRangeQuery
{
    public PaymentMethod? PaymentMethod { get; set; }
}

public sealed class CouponReportQuery : DateRangeQuery
{
    public Guid? CouponId { get; set; }
}

public sealed class DashboardTodo
{
    public int ChoXacNhan { get; init; }
    public int ChoThanhToan { get; init; }
    public int ChoBanGiao { get; init; }
    public int DangHoan { get; init; }
    public int GiaoCham { get; init; }
    public int CanHoanTien { get; init; }
    public DateTime AsOf { get; init; }
}

public sealed class SalesFigures
{
    public decimal NetRevenue { get; init; }
    public decimal OrderValue { get; init; }
    public int NewOrders { get; init; }
}

public sealed class LowStockItem
{
    public Guid ProductId { get; init; }
    public Guid VariantId { get; init; }
    public string Sku { get; init; } = string.Empty;
    public string ProductName { get; init; } = string.Empty;
    public string ColorName { get; init; } = string.Empty;
    public string? Size { get; init; }
    public int Stock { get; init; }
}

public sealed class SeriesPoint
{
    public string Date { get; init; } = string.Empty;
    public decimal OrderValue { get; init; }
    public decimal NetRevenue { get; init; }
}

public sealed class DashboardTopProduct
{
    public Guid ProductId { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? CoverUrl { get; init; }
    public int Quantity { get; init; }
    public decimal NetRevenue { get; init; }
}

public sealed class DashboardSales
{
    public SalesFigures Today { get; init; } = new();
    public SalesFigures YesterdaySamePeriod { get; init; } = new();
    public double CancelRate30d { get; init; }
    public double ReturnRate30d { get; init; }
    public IReadOnlyList<SeriesPoint> Series30d { get; init; } = [];
    public IReadOnlyList<DashboardTopProduct> TopProducts30d { get; init; } = [];
    public IReadOnlyList<LowStockItem> LowStock { get; init; } = [];
    public IReadOnlyList<LowStockItem> OutOfStock { get; init; } = [];
    public DateTime AsOf { get; init; }
}

public class RevenueTotals
{
    public decimal OrderValue { get; init; }
    public decimal NetRevenue { get; init; }
    public int OrderCount { get; init; }
    public decimal AvgOrderValue { get; init; }
}

public sealed class RevenueDay : RevenueTotals
{
    public string Date { get; init; } = string.Empty;
}

public sealed class RevenueReport
{
    public IReadOnlyList<RevenueDay> Days { get; init; } = [];
    public RevenueTotals Totals { get; init; } = new();
    public RevenueTotals Previous { get; init; } = new();
    public IReadOnlyList<SeriesPoint> PreviousDays { get; init; } = [];
}

public sealed class TopProductRow
{
    public string Key { get; init; } = string.Empty;
    public Guid ProductId { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? Sku { get; init; }
    public string? ColorName { get; init; }
    public string? Size { get; init; }
    public int Quantity { get; init; }
    public decimal NetRevenue { get; init; }
    public double Share { get; init; }
}

public sealed class TopProductsReport
{
    public string GroupBy { get; init; } = "product";
    public IReadOnlyList<TopProductRow> Rows { get; init; } = [];
    public int TotalQuantity { get; init; }
    public decimal TotalNetRevenue { get; init; }
}

public sealed class ReasonCount<TReason>
    where TReason : struct, Enum
{
    public TReason Reason { get; init; }
    public int Count { get; init; }
}

public sealed class PaymentMethodRate
{
    public PaymentMethod PaymentMethod { get; init; }
    public int OrderCount { get; init; }
    public double CancelRate { get; init; }
    public double ReturnRate { get; init; }
}

public sealed class OrderStatusReport
{
    public int OrderCount { get; init; }
    public int CancelledCount { get; init; }
    public double CancelRate { get; init; }
    public int ReturnCount { get; init; }
    public double ReturnRate { get; init; }
    public IReadOnlyList<ReasonCount<CancelReason>> CancelReasons { get; init; } = [];
    public IReadOnlyList<ReasonCount<DeliveryFailReason>> FailReasons { get; init; } = [];
    public IReadOnlyList<PaymentMethodRate> ByPaymentMethod { get; init; } = [];
}

public sealed class ProvinceReportRow
{
    public string ProvinceCode { get; init; } = string.Empty;
    public string ProvinceName { get; init; } = string.Empty;
    public int OrderCount { get; init; }
    public decimal NetRevenue { get; init; }
    public double ReturnRate { get; init; }
}

public sealed class CouponReportRow
{
    public Guid CouponId { get; init; }
    public string Code { get; init; } = string.Empty;
    public int UsedCount { get; init; }
    public decimal DiscountTotal { get; init; }
    public decimal OrderValue { get; init; }
}
