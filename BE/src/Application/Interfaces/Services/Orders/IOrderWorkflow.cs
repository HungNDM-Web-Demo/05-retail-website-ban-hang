namespace Application.Interfaces.Services.Orders;

/// <summary>
/// Quét đơn chuyển khoản quá hạn thanh toán (BR-11, 07 §3.5, §5 quyết định 14): đơn Chờ thanh toán có
/// <c>PaymentDueAt ≤ now</c> chuyển Đã hủy lý do Quá hạn thanh toán, người làm "Hệ thống", <c>cancelledAt = paymentDueAt</c>,
/// tồn và lượt mã trả lại. Chạy định kỳ (<c>OverduePaymentJob</c>), ở đầu mọi API đọc, ghi đơn và ngay sau khi nạp dữ liệu mẫu.
/// </summary>
public interface IOrderWorkflow
{
    /// <summary>Trả số đơn vừa tự hủy.</summary>
    Task<int> SweepOverdueAsync(CancellationToken ct = default);

    /// <summary>Quét lười ở đầu API đọc, ghi đơn: có đơn quá hạn thì quét trong scope riêng (rẻ khi không có).</summary>
    Task EnsureSweptAsync(CancellationToken ct = default);
}
