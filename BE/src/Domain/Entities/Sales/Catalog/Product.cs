using Domain.Base;
using Domain.Common;
using Domain.Enums.Sales.Catalog;

namespace Domain.Entities.Sales.Catalog;

/// <summary>
/// Sản phẩm (bảng <c>Sales_Products</c>). Mọi biến thể dùng chung giá bán; màu và size suy ra từ biến thể theo
/// <see cref="ProductVariant.SortOrder"/>. Xóa mềm, chặn khi đã có trong đơn (BR-23).
/// </summary>
public class Product : BaseEntity, ICreationTracked, IModificationTracked, ISoftDelete
{
    public const int CodeMaxLength = 10;
    public const int NameMaxLength = 200;
    public const int SlugMaxLength = 220;
    public const int NameSearchMaxLength = 1000;

    private Product()
    {
    }

    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string Slug { get; private set; } = string.Empty;

    /// <summary>Tên + mã + mọi SKU đã bỏ dấu, chữ thường (tìm không dấu theo tên hoặc SKU, FR-06).</summary>
    public string NameSearch { get; private set; } = string.Empty;

    public Guid CategoryId { get; private set; }
    public decimal Price { get; private set; }
    public decimal? ListPrice { get; private set; }
    public string? Description { get; private set; }
    public string? SizeChartJson { get; private set; }
    public bool IsFeatured { get; private set; }
    public bool IsHidden { get; private set; }
    public int SoldCount { get; private set; }
    public int SortOrder { get; private set; }
    public bool IsDeleted { get; set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public List<ProductImage> Images { get; private set; } = [];
    public List<ProductVariant> Variants { get; private set; } = [];

    public ProductStatus Status => IsHidden ? ProductStatus.An : ProductStatus.DangBan;

    public static Product Create(
        string code, string name, string slug, Guid categoryId, decimal price, decimal? listPrice, string? description,
        string? sizeChartJson, bool isFeatured, bool isHidden, int sortOrder)
    {
        var product = new Product { SortOrder = sortOrder };
        product.Update(code, name, slug, categoryId, price, listPrice, description, sizeChartJson, isFeatured, isHidden);
        return product;
    }

    public void Update(
        string code, string name, string slug, Guid categoryId, decimal price, decimal? listPrice, string? description,
        string? sizeChartJson, bool isFeatured, bool isHidden)
    {
        if (price <= 0)
            throw new DomainException("Giá bán phải lớn hơn 0");

        Code = code.Trim().ToUpperInvariant();
        Name = name.Trim();
        Slug = slug;
        CategoryId = categoryId;
        Price = price;
        ListPrice = listPrice;
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        SizeChartJson = sizeChartJson;
        IsFeatured = isFeatured;
        IsHidden = isHidden;
    }

    public void SetHidden(bool isHidden) => IsHidden = isHidden;

    public void SetSoldCount(int soldCount) => SoldCount = soldCount;

    /// <summary>Đổi giá bán (dùng cho test đổi giá, TC-06).</summary>
    public void SetPrice(decimal price) => Price = price;

    /// <summary>Tính lại chuỗi tìm từ tên, mã và SKU của <paramref name="skus"/>.</summary>
    public void RefreshSearch(IEnumerable<string> skus)
    {
        var text = Sales.SalesCodes.SearchText($"{Name} {Code} {string.Join(' ', skus)}");
        NameSearch = text.Length > NameSearchMaxLength ? text[..NameSearchMaxLength] : text;
    }
}

/// <summary>Ảnh sản phẩm (bảng <c>Sales_ProductImages</c>), tối đa 8; ảnh gắn màu tùy chọn (UC-02 bước 2).</summary>
public class ProductImage : BaseEntity, IAuditLogExempt
{
    public const int UrlMaxLength = 500;

    private ProductImage()
    {
    }

    public Guid ProductId { get; private set; }
    public string Url { get; private set; } = string.Empty;
    public Guid? ColorId { get; private set; }
    public int SortOrder { get; private set; }
    public bool IsCover { get; private set; }

    public static ProductImage Create(Guid productId, string url, Guid? colorId, int sortOrder, bool isCover) =>
        new() { ProductId = productId, Url = url.Trim(), ColorId = colorId, SortOrder = sortOrder, IsCover = isCover };
}

/// <summary>
/// Biến thể màu × size (bảng <c>Sales_ProductVariants</c>). <see cref="Stock"/> là tồn còn bán được (đã trừ đơn chưa hủy),
/// luôn ≥ 0: trừ bằng câu cập nhật có điều kiện trong service (BR-13).
/// </summary>
public class ProductVariant : BaseEntity, ICreationTracked, IModificationTracked
{
    public const int SizeMaxLength = 10;
    public const int SkuMaxLength = 30;

    private ProductVariant()
    {
    }

    public Guid ProductId { get; private set; }
    public Guid ColorId { get; private set; }
    public string? Size { get; private set; }
    public string Sku { get; private set; } = string.Empty;
    public int Stock { get; private set; }
    public bool IsActive { get; private set; } = true;

    /// <summary>Chỉ số màu × 100 + chỉ số size.</summary>
    public int SortOrder { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public static ProductVariant Create(Guid productId, Guid colorId, string? size, string sku, int stock, bool isActive, int sortOrder)
    {
        if (stock < 0)
            throw new DomainException("Tồn mới là số nguyên từ 0");
        return new ProductVariant
        {
            ProductId = productId,
            ColorId = colorId,
            Size = string.IsNullOrWhiteSpace(size) ? null : size.Trim(),
            Sku = sku,
            Stock = stock,
            IsActive = isActive,
            SortOrder = sortOrder
        };
    }

    public void SetActive(bool isActive) => IsActive = isActive;

    public void SetSortOrder(int sortOrder) => SortOrder = sortOrder;

    public void SetSku(string sku) => Sku = sku;

    /// <summary>Đặt tồn mới (điều chỉnh tồn BR-27, dữ liệu mẫu).</summary>
    public void SetStock(int stock)
    {
        if (stock < 0)
            throw new DomainException("Tồn mới là số nguyên từ 0");
        Stock = stock;
    }
}

/// <summary>Lịch sử điều chỉnh tồn thủ công (bảng <c>Sales_StockAdjustments</c>, BR-27). Không xóa.</summary>
public class StockAdjustment : BaseEntity, IAuditLogExempt
{
    public const int NoteMaxLength = 500;
    public const int ByNameMaxLength = 150;

    private StockAdjustment()
    {
    }

    public Guid VariantId { get; private set; }
    public Guid ProductId { get; private set; }
    public int Before { get; private set; }
    public int After { get; private set; }
    public StockAdjustReason Reason { get; private set; }
    public string? Note { get; private set; }
    public Guid? ById { get; private set; }
    public string ByName { get; private set; } = string.Empty;
    public DateTime At { get; private set; }

    public static StockAdjustment Create(
        Guid variantId, Guid productId, int before, int after, StockAdjustReason reason, string? note, Guid? byId, string byName, DateTime at) =>
        new()
        {
            VariantId = variantId,
            ProductId = productId,
            Before = before,
            After = after,
            Reason = reason,
            Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim(),
            ById = byId,
            ByName = byName,
            At = at
        };
}
