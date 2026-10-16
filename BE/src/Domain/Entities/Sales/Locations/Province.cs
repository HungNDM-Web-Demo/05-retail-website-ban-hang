using Domain.Base;
using Domain.Enums.Sales.Locations;

namespace Domain.Entities.Sales.Locations;

/// <summary>Tỉnh/thành theo sắp xếp 2025 kèm vùng phí vận chuyển (bảng <c>Sales_Provinces</c>, BR-06). Không xóa.</summary>
public class Province : BaseEntity, IAuditLogExempt
{
    public const int CodeMaxLength = 10;
    public const int NameMaxLength = 100;

    private Province()
    {
    }

    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public ShippingZone Zone { get; private set; }
    public int SortOrder { get; private set; }

    public List<Ward> Wards { get; private set; } = [];

    public static Province Create(string code, string name, ShippingZone zone, int sortOrder) =>
        new() { Code = code, Name = name, Zone = zone, SortOrder = sortOrder };
}

/// <summary>Phường/xã (bảng <c>Sales_Wards</c>), mã nội bộ <c>{mã tỉnh}-{2 số}</c> (06 §5.5).</summary>
public class Ward : BaseEntity, IAuditLogExempt
{
    public const int CodeMaxLength = 10;
    public const int NameMaxLength = 100;

    private Ward()
    {
    }

    public Guid ProvinceId { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;

    public static Ward Create(Guid provinceId, string code, string name) =>
        new() { ProvinceId = provinceId, Code = code, Name = name };
}
