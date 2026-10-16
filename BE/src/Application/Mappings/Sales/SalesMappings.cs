using System.Text.Json;
using Application.DTOs.Catalog;
using Application.DTOs.Orders;
using Application.DTOs.Storefront;
using Domain.Entities.Sales;
using Domain.Entities.Sales.Catalog;
using Domain.Entities.Sales.Orders;
using Domain.Enums.Sales.Catalog;

namespace Application.Mappings.Sales;

/// <summary>Ánh xạ viết tay entity bán hàng → DTO (07 §2). Phần cần thêm ngữ cảnh (nhãn, khách, đơn trùng) dựng ở service.</summary>
public static class SalesMappings
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    /// <summary>BR-02: 0 hết hàng, 1–5 sắp hết, &gt; 5 còn hàng.</summary>
    public static StockStatus StockStatusOf(int stock) =>
        stock <= 0 ? StockStatus.HetHang : stock <= SalesRules.LowStockMax ? StockStatus.SapHet : StockStatus.ConHang;

    /// <summary>
    /// Tình trạng sản phẩm (07 §3.8): mọi biến thể bật tồn 0 → hết hàng; có biến thể bật tồn ≤ 5 → sắp hết; còn lại còn hàng.
    /// </summary>
    public static StockStatus ProductStockStatusOf(IReadOnlyCollection<int> activeStocks) =>
        activeStocks.Count == 0 || activeStocks.All(s => s <= 0) ? StockStatus.HetHang
        : activeStocks.Any(s => s <= SalesRules.LowStockMax) ? StockStatus.SapHet
        : StockStatus.ConHang;

    /// <summary>BR-01: round((giá gốc − giá bán) / giá gốc × 100).</summary>
    public static int? DiscountPercent(decimal price, decimal? listPrice) =>
        listPrice is { } lp && lp > price
            ? (int)Math.Round((lp - price) / lp * 100m, MidpointRounding.AwayFromZero)
            : null;

    public static SizeChartDto? ParseSizeChart(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return null;
        try
        {
            return JsonSerializer.Deserialize<SizeChartDto>(json, JsonOptions);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public static string? SerializeSizeChart(SizeChartDto? chart) =>
        chart is null || (chart.Columns.Count == 0 && chart.Rows.Count == 0) ? null : JsonSerializer.Serialize(chart, JsonOptions);

    public static ColorDto ToDto(this Color color) => new()
    {
        Id = color.Id,
        Code = color.Code,
        Name = color.Name,
        Hex = color.Hex,
        SortOrder = color.SortOrder
    };

    public static PublicColor ToPublic(this Color color) => new() { Code = color.Code, Name = color.Name, Hex = color.Hex };

    public static CategoryDto ToDto(this Category category, int productCount) => new()
    {
        Id = category.Id,
        Code = category.Code,
        Name = category.Name,
        Slug = category.Slug,
        ImageUrl = category.ImageUrl,
        Color = category.Color,
        SortOrder = category.SortOrder,
        IsVisible = category.IsVisible,
        ProductCount = productCount
    };

    public static PublicCategory ToPublic(this Category category, int productCount) => new()
    {
        Id = category.Id,
        Name = category.Name,
        Slug = category.Slug,
        ImageUrl = category.ImageUrl,
        Color = category.Color,
        ProductCount = productCount
    };

    public static ProductVariantDto ToDto(this ProductVariant variant, Color color, bool everOrdered) => new()
    {
        Id = variant.Id,
        Sku = variant.Sku,
        ColorId = color.Id,
        ColorCode = color.Code,
        ColorName = color.Name,
        ColorHex = color.Hex,
        Size = variant.Size,
        Stock = variant.Stock,
        IsActive = variant.IsActive,
        StockStatus = StockStatusOf(variant.Stock),
        EverOrdered = everOrdered
    };

    public static ProductImageDto ToDto(this ProductImage image) => new()
    {
        Id = image.Id,
        Url = image.Url,
        ColorId = image.ColorId,
        SortOrder = image.SortOrder,
        IsCover = image.IsCover
    };

    public static PricingSummary ToSummary(this PricingResult pricing) => new()
    {
        Subtotal = pricing.Subtotal,
        Discount = pricing.Discount,
        ShippingFee = pricing.ShippingFee,
        ShippingDiscount = pricing.ShippingDiscount,
        Total = pricing.Total,
        CouponCode = pricing.CouponCode,
        FreeShipRemaining = pricing.FreeShipRemaining
    };

    public static PricingSummary ToSummary(this Order order) => new()
    {
        Subtotal = order.Subtotal,
        Discount = order.Discount,
        ShippingFee = order.ShippingFee,
        ShippingDiscount = order.ShippingDiscount,
        Total = order.Total,
        CouponCode = order.CouponCode,
        FreeShipRemaining = Math.Max(0, SalesRules.FreeShipThreshold - (order.Subtotal - order.Discount))
    };

    public static OrderLineView ToView(this OrderLine line, string? slug) => new()
    {
        ProductName = line.ProductName,
        Slug = slug,
        Sku = line.Sku,
        ColorName = line.ColorName,
        Size = line.Size,
        ImageUrl = line.ImageUrl,
        UnitPrice = line.UnitPrice,
        Quantity = line.Quantity,
        LineTotal = line.LineTotal
    };

    public static OrderLineDto ToDto(this OrderLine line, string? slug) => new()
    {
        Id = line.Id,
        VariantId = line.VariantId,
        ProductId = line.ProductId,
        ProductName = line.ProductName,
        Slug = slug,
        Sku = line.Sku,
        ColorName = line.ColorName,
        Size = line.Size,
        ImageUrl = line.ImageUrl,
        UnitPrice = line.UnitPrice,
        Quantity = line.Quantity,
        LineTotal = line.LineTotal
    };

    public static OrderEventDto ToDto(this OrderEvent e) => new()
    {
        Id = e.Id,
        Type = e.Type,
        At = e.At,
        ActorType = e.ActorType,
        ActorName = e.ActorName,
        FromStatus = e.FromStatus,
        ToStatus = e.ToStatus,
        Content = e.Content
    };

    public static ShipmentDto ToDto(this Shipment s) => new()
    {
        Carrier = s.Carrier,
        TrackingCode = s.TrackingCode,
        WeightGrams = s.WeightGrams,
        CodAmount = s.CodAmount,
        ShipperNote = s.ShipperNote,
        HandedOverAt = s.HandedOverAt,
        HandedOverByName = s.HandedOverByName,
        DeliveredAt = s.DeliveredAt,
        FailedAt = s.FailedAt,
        FailReason = s.FailReason,
        FailNote = s.FailNote,
        ReturnedAt = s.ReturnedAt,
        LabelPrintCount = s.LabelPrintCount
    };

    public static StockAdjustmentDto ToDto(this StockAdjustment a, ProductVariant variant, string productName, string colorName) => new()
    {
        Id = a.Id,
        VariantId = a.VariantId,
        Sku = variant.Sku,
        ProductName = productName,
        ColorName = colorName,
        Size = variant.Size,
        Before = a.Before,
        After = a.After,
        Reason = a.Reason,
        Note = a.Note,
        ByName = a.ByName,
        At = a.At
    };
}
