using Application.Common.Models;
using Domain.Enums.Sales.Catalog;
using Domain.Enums.Sales.Locations;

namespace Application.DTOs.Catalog;

// Danh mục hành chính (07 §2.1), danh mục, màu (§2.3), sản phẩm, biến thể, tồn kho (§2.4). Khớp FE src/types/shop.ts.

public sealed class WardDto
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
}

public sealed class ProvinceDto
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public ShippingZone Zone { get; init; }
    public IReadOnlyList<WardDto> Wards { get; init; } = [];
}

public sealed class CategoryDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Slug { get; init; } = string.Empty;
    public string? ImageUrl { get; init; }
    public string Color { get; init; } = string.Empty;
    public int SortOrder { get; init; }
    public bool IsVisible { get; init; }

    /// <summary>Sản phẩm chưa xóa, kể cả ẩn.</summary>
    public int ProductCount { get; init; }
}

public sealed class SaveCategoryRequest
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;

    /// <summary>Trống → sinh từ tên (BR-24).</summary>
    public string? Slug { get; set; }

    public string? ImageUrl { get; set; }
    public string Color { get; set; } = string.Empty;
    public bool IsVisible { get; set; } = true;
}

public sealed class ReorderRequest
{
    public List<Guid> Ids { get; set; } = [];
}

public sealed class VisibilityRequest
{
    public bool IsVisible { get; set; }
}

public sealed class ColorDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Hex { get; init; } = string.Empty;
    public int SortOrder { get; init; }
}

public sealed class SaveColorRequest
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Hex { get; set; } = string.Empty;
}

public sealed class SizeChartDto
{
    public string Title { get; set; } = string.Empty;
    public List<string> Columns { get; set; } = [];
    public List<List<string>> Rows { get; set; } = [];
}

public sealed class ProductImageDto
{
    public Guid Id { get; init; }
    public string Url { get; init; } = string.Empty;
    public Guid? ColorId { get; init; }
    public int SortOrder { get; init; }
    public bool IsCover { get; init; }
}

public sealed class ProductVariantDto
{
    public Guid Id { get; init; }
    public string Sku { get; init; } = string.Empty;
    public Guid ColorId { get; init; }
    public string ColorCode { get; init; } = string.Empty;
    public string ColorName { get; init; } = string.Empty;
    public string ColorHex { get; init; } = string.Empty;
    public string? Size { get; init; }
    public int Stock { get; init; }
    public bool IsActive { get; init; }
    public StockStatus StockStatus { get; init; }

    /// <summary>Đã có trong đơn → không xóa được, chỉ tắt (BR-23).</summary>
    public bool EverOrdered { get; init; }
}

public class ProductListItem
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Slug { get; init; } = string.Empty;
    public Guid CategoryId { get; init; }
    public string CategoryName { get; init; } = string.Empty;
    public decimal Price { get; init; }
    public decimal? ListPrice { get; init; }
    public string? CoverUrl { get; init; }
    public ProductStatus Status { get; init; }
    public bool IsFeatured { get; init; }
    public int TotalStock { get; init; }
    public int VariantCount { get; init; }
    public int OutOfStockCount { get; init; }
    public int LowStockCount { get; init; }
    public StockStatus StockStatus { get; init; }
    public int SoldCount { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class ProductDto : ProductListItem
{
    public string? Description { get; init; }
    public SizeChartDto? SizeChart { get; init; }
    public IReadOnlyList<Guid> ColorIds { get; init; } = [];
    public IReadOnlyList<string> Sizes { get; init; } = [];
    public IReadOnlyList<ProductImageDto> Images { get; init; } = [];
    public IReadOnlyList<ProductVariantDto> Variants { get; init; } = [];
    public bool EverOrdered { get; init; }
    public DateTime? UpdatedAt { get; init; }
}

public sealed class ProductQuery : PaginationQuery
{
    public Guid? CategoryId { get; set; }
    public ProductStatus? Status { get; set; }
    public StockStatus? StockStatus { get; set; }
}

public sealed class SaveProductVariantInput
{
    public Guid ColorId { get; set; }
    public string? Size { get; set; }
    public bool IsActive { get; set; } = true;

    /// <summary>Chỉ dùng cho biến thể mới; biến thể cũ đổi tồn qua điều chỉnh tồn (BR-27).</summary>
    public int? InitialStock { get; set; }
}

public sealed class SaveProductImageInput
{
    public string Url { get; set; } = string.Empty;
    public Guid? ColorId { get; set; }
    public bool IsCover { get; set; }
}

public sealed class SaveProductRequest
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Slug { get; set; }
    public Guid CategoryId { get; set; }
    public decimal Price { get; set; }
    public decimal? ListPrice { get; set; }
    public string? Description { get; set; }
    public SizeChartDto? SizeChart { get; set; }
    public bool IsFeatured { get; set; }
    public bool IsHidden { get; set; }
    public List<SaveProductImageInput> Images { get; set; } = [];
    public List<Guid> ColorIds { get; set; } = [];
    public List<string> Sizes { get; set; } = [];
    public List<SaveProductVariantInput> Variants { get; set; } = [];
}

public sealed class HiddenRequest
{
    public bool IsHidden { get; set; }
}

public sealed class StockAdjustmentRequest
{
    public int? NewStock { get; set; }
    public StockAdjustReason? Reason { get; set; }
    public string? Note { get; set; }
}

public sealed class StockAdjustmentDto
{
    public Guid Id { get; init; }
    public Guid VariantId { get; init; }
    public string Sku { get; init; } = string.Empty;
    public string ProductName { get; init; } = string.Empty;
    public string ColorName { get; init; } = string.Empty;
    public string? Size { get; init; }
    public int Before { get; init; }
    public int After { get; init; }
    public StockAdjustReason Reason { get; init; }
    public string? Note { get; init; }
    public string ByName { get; init; } = string.Empty;
    public DateTime At { get; init; }
}
