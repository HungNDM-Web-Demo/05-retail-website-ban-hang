using Application.Common.Exceptions;
using Application.DTOs.Storefront;
using Domain.Entities.Sales;
using Domain.Entities.Sales.Orders;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Infrastructure.Implementations.Services.Sales;

// Tra cứu đơn, khách tự hủy (FR-14, FR-15, BR-28, 07 §2.2).
public sealed partial class SalesOperations
{
    public async Task<PublicOrderView> LookupAsync(OrderLookupRequest request, CancellationToken ct = default)
    {
        var guardKey = GuardKey(request.DeviceId, request.IpAddress);
        EnsureNotBlocked(guardKey);
        await EnsureSweptAsync(ct);

        var order = await FindForCustomerAsync(request.Code, request.Phone, ct);
        if (order is null)
        {
            RegisterFailure(guardKey);
            throw SalesProblems.OrderNotFound();
        }

        return await BuildPublicViewAsync(order, ct);
    }

    public async Task<PublicOrderView> CancelAsync(
        string code, PublicCancelRequest request, string? deviceId, string? ipAddress, CancellationToken ct = default)
    {
        var guardKey = GuardKey(deviceId, ipAddress);
        EnsureNotBlocked(guardKey);
        await EnsureSweptAsync(ct);

        var found = await FindForCustomerAsync(code, request.Phone, ct);
        if (found is null)
        {
            RegisterFailure(guardKey);
            throw SalesProblems.OrderNotFound();
        }

        if (!OrderWorkflow.CanSelfCancel(found.Status))
        {
            var store = await StoreSettings.ReadAsync(settings, ct);
            throw SalesErrors.Business(SalesErrors.KhongTheTuHuy, SalesErrors.CannotSelfCancelMessage(store.Hotline));
        }

        try
        {
            await unitOfWork.ExecuteInTransactionAsync(async c =>
            {
                var order = await LoadTrackedAsync(found.Id, c) ?? throw SalesProblems.OrderNotFound();
                if (!OrderWorkflow.CanSelfCancel(order.Status))
                {
                    var store = await StoreSettings.ReadAsync(settings, c);
                    throw SalesErrors.Business(SalesErrors.KhongTheTuHuy, SalesErrors.CannotSelfCancelMessage(store.Hotline));
                }

                order.Cancel(OrderActor.Customer, Now, request.Reason!.Value, request.Note);
                await ReleaseOnCancelAsync(order, c);
                await unitOfWork.SaveChangesAsync(c);
                await RecalculateCustomerAsync(order.CustomerId, c);
            }, ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Nhân viên vừa xử lý đơn cùng lúc: báo như đơn đã được shop xử lý.
            var store = await InFreshScopeAsync(s => s.ReadStoreAsync(ct));
            throw SalesErrors.Business(SalesErrors.KhongTheTuHuy, SalesErrors.CannotSelfCancelMessage(store.Hotline));
        }

        var fresh = await ReadFullAsync(found.Id, ct) ?? throw SalesProblems.OrderNotFound();
        return await BuildPublicViewAsync(fresh, ct);
    }

    private Task<StoreSettings> ReadStoreAsync(CancellationToken ct) => StoreSettings.ReadAsync(settings, ct);

    private async Task<Order?> FindForCustomerAsync(string code, string phone, CancellationToken ct)
    {
        var normalizedCode = (code ?? string.Empty).Trim().ToUpperInvariant();
        var normalizedPhone = SalesCodes.NormalizePhone(phone);
        if (normalizedCode.Length == 0 || normalizedPhone.Length == 0)
            return null;
        var order = await ReadFullByCodeAsync(normalizedCode, ct);
        return order is not null && order.Phone == normalizedPhone ? order : null;
    }

    // ---------------------------------------------------------------- Chặn tra cứu sai (BR-28)

    private sealed class LookupGuard
    {
        public List<DateTime> Failures { get; } = [];
        public DateTime? BlockedUntil { get; set; }
    }

    private static string GuardKey(string? deviceId, string? ipAddress) =>
        "lookup-guard:" + (string.IsNullOrWhiteSpace(deviceId) ? "ip:" + (ipAddress ?? "unknown") : "dev:" + deviceId.Trim());

    private LookupGuard Guard(string key) =>
        cache.GetOrCreate(key, entry =>
        {
            entry.SlidingExpiration = TimeSpan.FromMinutes(SalesRules.LookupWindowMinutes + SalesRules.LookupBlockMinutes);
            return new LookupGuard();
        })!;

    /// <summary>Đang bị chặn → 429 <c>TraCuuTamKhoa</c> kèm <c>retryAfterSeconds</c>.</summary>
    private void EnsureNotBlocked(string key)
    {
        var guard = Guard(key);
        var now = Now;
        lock (guard)
        {
            if (guard.BlockedUntil is not { } until || until <= now)
                return;
            var seconds = (int)Math.Ceiling((until - now).TotalSeconds);
            var minutes = (int)Math.Ceiling(seconds / 60d);
            throw new TooManyRequestsException(SalesErrors.LookupLockedMessage(minutes), SalesErrors.TraCuuTamKhoa, seconds);
        }
    }

    /// <summary>Sai 5 lần trong 10 phút từ cùng trình duyệt (thiếu mã thiết bị thì theo IP) → chặn 10 phút.</summary>
    private void RegisterFailure(string key)
    {
        var guard = Guard(key);
        var now = Now;
        lock (guard)
        {
            guard.Failures.RemoveAll(t => now - t > TimeSpan.FromMinutes(SalesRules.LookupWindowMinutes));
            guard.Failures.Add(now);
            if (guard.Failures.Count >= SalesRules.LookupMaxFails)
            {
                // Lần sai thứ 5 trả 429 ngay (khớp FE mock).
                guard.BlockedUntil = now.AddMinutes(SalesRules.LookupBlockMinutes);
                guard.Failures.Clear();
                var seconds = SalesRules.LookupBlockMinutes * 60;
                throw new TooManyRequestsException(SalesErrors.LookupLockedMessage(SalesRules.LookupBlockMinutes), SalesErrors.TraCuuTamKhoa, seconds);
            }
        }
    }
}
