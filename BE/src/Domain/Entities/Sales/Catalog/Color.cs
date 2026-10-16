using Domain.Base;

namespace Domain.Entities.Sales.Catalog;

/// <summary>Danh mục màu dùng chung (bảng <c>Sales_Colors</c>). Mã màu dùng trong SKU nên không đổi được (07 §5 quyết định 27).</summary>
public class Color : BaseEntity, ICreationTracked, IModificationTracked
{
    public const int CodeMaxLength = 4;
    public const int NameMaxLength = 50;
    public const int HexMaxLength = 7;

    private Color()
    {
    }

    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string Hex { get; private set; } = string.Empty;
    public int SortOrder { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public static Color Create(string code, string name, string hex, int sortOrder) =>
        new() { Code = code.Trim().ToUpperInvariant(), Name = name.Trim(), Hex = hex.Trim().ToUpperInvariant(), SortOrder = sortOrder };

    public void Update(string name, string hex)
    {
        Name = name.Trim();
        Hex = hex.Trim().ToUpperInvariant();
    }
}
