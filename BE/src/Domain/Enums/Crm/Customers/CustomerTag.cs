namespace Domain.Enums.Crm.Customers;

/// <summary>Nhãn khách, tính lúc đọc (BR-21): VIP khi tổng chi tiêu ≥ 5.000.000 ₫, cần lưu ý khi có từ 2 đơn hoàn.</summary>
public enum CustomerTag
{
    KhachVip = 0,
    CanLuuY = 1
}
