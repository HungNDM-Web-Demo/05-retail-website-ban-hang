using Application.Common.Models;
using Domain.Enums.Crm.Customers;

namespace Application.DTOs.Customers;

// Khách hàng (07 §2.7).

public class CustomerListItem
{
    public Guid Id { get; init; }
    public string Phone { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string ProvinceCode { get; init; } = string.Empty;
    public string ProvinceName { get; init; } = string.Empty;
    public int OrderCount { get; init; }
    public int DeliveredCount { get; init; }

    /// <summary>Đang hoàn + Đã hoàn.</summary>
    public int ReturnCount { get; init; }

    /// <summary>Σ total đơn Đã giao (BR-21).</summary>
    public decimal TotalSpent { get; init; }

    public DateTime LastOrderAt { get; init; }
    public IReadOnlyList<CustomerTag> Tags { get; init; } = [];
}

public sealed class CustomerQuery : PaginationQuery
{
    public CustomerTag? Tag { get; set; }
    public string? ProvinceCode { get; set; }
}

public sealed class CustomerDetail : CustomerListItem
{
    public string? Email { get; init; }
    public string WardCode { get; init; } = string.Empty;
    public string WardName { get; init; } = string.Empty;
    public string AddressLine { get; init; } = string.Empty;
    public string? Note { get; init; }
    public int CancelledCount { get; init; }
    public DateTime FirstOrderAt { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class UpdateCustomerNoteRequest
{
    public string? Note { get; set; }
}
