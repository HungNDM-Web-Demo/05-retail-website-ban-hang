using System.Text.Json;
using Domain.Enums.Sales.Catalog;
using Domain.Enums.Sales.Coupons;
using Domain.Enums.Sales.Locations;

namespace Infrastructure.Persistence.Seeders;

// Hình dạng của FE/src/mock/seed/demo-data.json (06 §5.2, FE src/types/shop.ts DemoDataSeed). Mảng khóa gọn
// (dòng đơn, sự kiện, điều chỉnh tồn, phường) đọc dạng JsonElement rồi tách trong DemoDataSeeder.

internal sealed class SalesSeed
{
    public List<SeedColor> Colors { get; init; } = [];
    public Dictionary<string, SeedSizeChart> SizeCharts { get; init; } = [];
    public List<SeedCategory> Categories { get; init; } = [];
    public List<SeedProduct> Products { get; init; } = [];
    public List<SeedCoupon> Coupons { get; init; } = [];
    public List<SeedProvince> Provinces { get; init; } = [];
    public List<List<JsonElement>> StockAdjustments { get; init; } = [];
    public List<SeedCustomer> Customers { get; init; } = [];
    public List<SeedOrder> Orders { get; init; } = [];
}

internal sealed class SeedColor
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Hex { get; init; } = string.Empty;
    public int SortOrder { get; init; }
}

internal sealed class SeedSizeChart
{
    public string Title { get; init; } = string.Empty;
    public List<string> Columns { get; init; } = [];
    public List<List<string>> Rows { get; init; } = [];
}

internal sealed class SeedCategory
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Slug { get; init; } = string.Empty;
    public string Color { get; init; } = string.Empty;
    public string? Image { get; init; }
    public int SortOrder { get; init; }
}

internal sealed class SeedProduct
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Category { get; init; } = string.Empty;
    public decimal Price { get; init; }
    public decimal? ListPrice { get; init; }
    public List<string> Colors { get; init; } = [];
    public List<string> Sizes { get; init; } = [];
    public string? SizeChart { get; init; }
    public Dictionary<string, int> Stock { get; init; } = [];
    public List<string>? Off { get; init; }
    public List<List<string>> Images { get; init; } = [];
    public bool Featured { get; init; }
    public bool Hidden { get; init; }
    public int CreatedDaysAgo { get; init; }
    public int SortOrder { get; init; }
    public string? Description { get; init; }
}

internal sealed class SeedCoupon
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public CouponType Type { get; init; }
    public decimal Value { get; init; }
    public decimal? MaxDiscount { get; init; }
    public decimal MinOrder { get; init; }
    public string? Scope { get; init; }
    public int? TotalLimit { get; init; }
    public int? PerCustomer { get; init; }
    public string Start { get; init; } = string.Empty;
    public string End { get; init; } = string.Empty;
}

internal sealed class SeedProvince
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public ShippingZone? Zone { get; init; }
    public List<List<string>> Wards { get; init; } = [];
}

internal sealed class SeedCustomer
{
    public string Phone { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? Email { get; init; }
    public string Province { get; init; } = string.Empty;
    public string Ward { get; init; } = string.Empty;
    public string Address { get; init; } = string.Empty;
    public string? Note { get; init; }
}

/// <summary>Khóa gọn của đơn (06 §5.4).</summary>
internal sealed class SeedOrder
{
    public int? D { get; init; }
    public JsonElement T { get; init; }
    public string C { get; init; } = string.Empty;
    public string Pm { get; init; } = "C";
    public List<List<JsonElement>> It { get; init; } = [];
    public string? Cp { get; init; }
    public string? N { get; init; }
    public List<List<JsonElement>>? Ev { get; init; }
}

/// <summary>Một dòng điều chỉnh tồn đã tách: SKU, thời điểm, trước, sau, lý do, tên đăng nhập, ghi chú.</summary>
internal sealed record SeedStockAdjustment(string Sku, string At, int Before, int After, StockAdjustReason Reason, string By, string? Note);
