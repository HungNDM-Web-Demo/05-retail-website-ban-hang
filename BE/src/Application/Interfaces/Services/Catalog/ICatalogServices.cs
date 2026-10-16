using Application.Common.Models;
using Application.DTOs.Catalog;
using Application.DTOs.Uploads;

namespace Application.Interfaces.Services.Catalog;

/// <summary>Danh mục hành chính 34 tỉnh/thành kèm phường/xã (07 §2.1), công khai.</summary>
public interface IProvinceService
{
    Task<IReadOnlyList<ProvinceDto>> GetAllAsync(CancellationToken ct = default);
}

/// <summary>Danh mục sản phẩm (07 §2.3, FR-16).</summary>
public interface ICategoryService
{
    Task<IReadOnlyList<CategoryDto>> GetAllAsync(CancellationToken ct = default);

    Task<CategoryDto> CreateAsync(SaveCategoryRequest request, CancellationToken ct = default);

    Task<CategoryDto> UpdateAsync(Guid id, SaveCategoryRequest request, CancellationToken ct = default);

    Task SetVisibilityAsync(Guid id, bool isVisible, CancellationToken ct = default);

    Task ReorderAsync(IReadOnlyList<Guid> ids, CancellationToken ct = default);

    /// <summary>Còn sản phẩm chưa xóa → 400 <c>DanhMucConSanPham</c>.</summary>
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

/// <summary>Màu dùng chung (07 §2.3); không đổi mã, không xóa.</summary>
public interface IColorService
{
    Task<IReadOnlyList<ColorDto>> GetAllAsync(CancellationToken ct = default);

    Task<ColorDto> CreateAsync(SaveColorRequest request, CancellationToken ct = default);

    Task<ColorDto> UpdateAsync(Guid id, SaveColorRequest request, CancellationToken ct = default);
}

/// <summary>Sản phẩm, biến thể, ảnh, điều chỉnh tồn (07 §2.4, FR-17…FR-20, BR-23, BR-24, BR-27).</summary>
public interface IProductService
{
    Task<PaginatedResult<ProductListItem>> GetPagedAsync(ProductQuery query, CancellationToken ct = default);

    Task<ProductDto> GetByIdAsync(Guid id, CancellationToken ct = default);

    Task<ProductDto> CreateAsync(SaveProductRequest request, CancellationToken ct = default);

    Task<ProductDto> UpdateAsync(Guid id, SaveProductRequest request, CancellationToken ct = default);

    Task SetHiddenAsync(Guid id, bool isHidden, CancellationToken ct = default);

    /// <summary>Đã có trong đơn → 400 <c>SanPhamDaCoTrongDon</c> (TC-23).</summary>
    Task DeleteAsync(Guid id, CancellationToken ct = default);

    /// <summary>Tải ảnh sản phẩm (JPG, PNG, WebP ≤ 2 MB), lưu <c>/uploads/products/{yyyy}/{MM}/{guid}.{ext}</c> qua <c>IFileStorage</c>.</summary>
    Task<UploadedImage> UploadImageAsync(Stream content, long sizeBytes, CancellationToken ct = default);

    Task<ProductVariantDto> AdjustStockAsync(Guid productId, Guid variantId, StockAdjustmentRequest request, CancellationToken ct = default);

    Task<IReadOnlyList<StockAdjustmentDto>> GetStockAdjustmentsAsync(Guid productId, CancellationToken ct = default);
}
