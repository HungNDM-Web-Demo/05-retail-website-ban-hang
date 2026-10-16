namespace Application.DTOs.Demo;

/// <summary>Kết quả giả lập khách đặt đơn (07 §2.9).</summary>
public sealed class SimulateOrderResult
{
    public string Code { get; init; } = string.Empty;
    public decimal Total { get; init; }
}
