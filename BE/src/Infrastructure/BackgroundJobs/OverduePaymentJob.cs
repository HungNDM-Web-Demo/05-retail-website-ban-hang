using Application.Interfaces.Services.Orders;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.BackgroundJobs;

/// <summary>
/// Tự hủy đơn chuyển khoản quá hạn thanh toán 24 giờ (BR-11, 07 §3.5, quyết định 14): quét mỗi 5 phút. API đơn còn quét lười
/// (<see cref="IOrderWorkflow.EnsureSweptAsync"/>) nên số liệu đúng ngay cả khi job chưa tới lượt.
/// </summary>
public sealed class OverduePaymentJob(IServiceScopeFactory scopeFactory, TimeProvider timeProvider, ILogger<OverduePaymentJob> logger)
    : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(5);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                await Task.Delay(Interval, timeProvider, stoppingToken);
                try
                {
                    await using var scope = scopeFactory.CreateAsyncScope();
                    var count = await scope.ServiceProvider.GetRequiredService<IOrderWorkflow>().SweepOverdueAsync(stoppingToken);
                    if (count > 0)
                        logger.LogInformation("Đã tự hủy {Count} đơn chuyển khoản quá hạn thanh toán.", count);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    logger.LogError(ex, "Quét đơn quá hạn thanh toán thất bại.");
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Ứng dụng đang dừng.
        }
    }
}
