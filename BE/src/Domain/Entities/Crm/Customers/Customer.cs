using Domain.Base;
using Domain.Entities.Sales;
using Domain.Enums.Crm.Customers;

namespace Domain.Entities.Crm.Customers;

/// <summary>
/// Hồ sơ khách theo số điện thoại (bảng <c>Crm_Customers</c>, FR-34). Tên, email, địa chỉ lấy theo đơn mới nhất; thống kê
/// tính lại từ đơn sau mỗi thao tác (<see cref="ApplyStats"/>). Không xóa, không ghi nhật ký thao tác.
/// </summary>
public class Customer : BaseEntity, ICreationTracked, IModificationTracked, IAuditLogExempt
{
    public const int PhoneMaxLength = 15;
    public const int NameMaxLength = 100;
    public const int EmailMaxLength = 200;
    public const int CodeMaxLength = 10;
    public const int AddressMaxLength = 200;
    public const int NoteMaxLength = 1000;

    private Customer()
    {
    }

    public string Phone { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string? Email { get; private set; }
    public string ProvinceCode { get; private set; } = string.Empty;
    public string WardCode { get; private set; } = string.Empty;
    public string AddressLine { get; private set; } = string.Empty;
    public string? Note { get; private set; }
    public int OrderCount { get; private set; }
    public int DeliveredCount { get; private set; }
    public int ReturnCount { get; private set; }
    public int CancelledCount { get; private set; }
    public decimal TotalSpent { get; private set; }
    public DateTime FirstOrderAt { get; private set; }
    public DateTime LastOrderAt { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public static Customer Create(string phone, string name, string? email, string provinceCode, string wardCode, string addressLine, DateTime placedAt)
    {
        var customer = new Customer { Phone = phone, FirstOrderAt = placedAt, LastOrderAt = placedAt };
        customer.UpdateFromOrder(name, email, provinceCode, wardCode, addressLine);
        return customer;
    }

    /// <summary>Đơn mới nhất: cập nhật tên, địa chỉ; email chỉ khi đơn có nhập (FR-34, TC-42).</summary>
    public void UpdateFromOrder(string name, string? email, string provinceCode, string wardCode, string addressLine)
    {
        Name = name.Trim();
        if (!string.IsNullOrWhiteSpace(email))
            Email = email.Trim();
        ProvinceCode = provinceCode;
        WardCode = wardCode;
        AddressLine = addressLine.Trim();
    }

    public void SetNote(string? note) => Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();

    public void ApplyStats(int orderCount, int deliveredCount, int returnCount, int cancelledCount, decimal totalSpent, DateTime? firstOrderAt, DateTime? lastOrderAt)
    {
        OrderCount = orderCount;
        DeliveredCount = deliveredCount;
        ReturnCount = returnCount;
        CancelledCount = cancelledCount;
        TotalSpent = totalSpent;
        if (firstOrderAt is { } first)
            FirstOrderAt = first;
        if (lastOrderAt is { } last)
            LastOrderAt = last;
    }

    public IReadOnlyList<CustomerTag> Tags => TagsOf(TotalSpent, ReturnCount);

    /// <summary>BR-21: VIP khi tổng chi tiêu ≥ 5.000.000 ₫, cần lưu ý khi có từ 2 đơn hoàn.</summary>
    public static IReadOnlyList<CustomerTag> TagsOf(decimal totalSpent, int returnCount)
    {
        var tags = new List<CustomerTag>(2);
        if (totalSpent >= SalesRules.VipSpent)
            tags.Add(CustomerTag.KhachVip);
        if (returnCount >= SalesRules.AttentionReturns)
            tags.Add(CustomerTag.CanLuuY);
        return tags;
    }
}
