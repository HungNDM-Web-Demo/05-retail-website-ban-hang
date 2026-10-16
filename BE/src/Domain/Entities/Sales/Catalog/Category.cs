using Domain.Base;

namespace Domain.Entities.Sales.Catalog;

/// <summary>Danh mục trên menu cửa hàng (bảng <c>Sales_Categories</c>). Xóa mềm, chặn khi còn sản phẩm.</summary>
public class Category : BaseEntity, ICreationTracked, IModificationTracked, ISoftDelete
{
    public const int CodeMaxLength = 10;
    public const int NameMaxLength = 100;
    public const int SlugMaxLength = 120;
    public const int ImageUrlMaxLength = 500;
    public const int ColorMaxLength = 7;

    private Category()
    {
    }

    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string Slug { get; private set; } = string.Empty;
    public string? ImageUrl { get; private set; }
    public string Color { get; private set; } = "#64748B";
    public int SortOrder { get; private set; }
    public bool IsVisible { get; private set; } = true;
    public bool IsDeleted { get; set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public static Category Create(string code, string name, string slug, string? imageUrl, string color, bool isVisible, int sortOrder) =>
        new()
        {
            Code = code.Trim().ToUpperInvariant(),
            Name = name.Trim(),
            Slug = slug,
            ImageUrl = string.IsNullOrWhiteSpace(imageUrl) ? null : imageUrl.Trim(),
            Color = color.Trim().ToUpperInvariant(),
            IsVisible = isVisible,
            SortOrder = sortOrder
        };

    public void Update(string code, string name, string slug, string? imageUrl, string color, bool isVisible)
    {
        Code = code.Trim().ToUpperInvariant();
        Name = name.Trim();
        Slug = slug;
        ImageUrl = string.IsNullOrWhiteSpace(imageUrl) ? null : imageUrl.Trim();
        Color = color.Trim().ToUpperInvariant();
        IsVisible = isVisible;
    }

    public void SetVisible(bool isVisible) => IsVisible = isVisible;

    public void SetSortOrder(int sortOrder) => SortOrder = sortOrder;
}
