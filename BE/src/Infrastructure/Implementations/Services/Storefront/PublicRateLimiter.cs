using Application.Interfaces.Services.Storefront;
using Microsoft.Extensions.Caching.Memory;

namespace Infrastructure.Implementations.Services.Storefront;

/// <summary>
/// Giới hạn tần suất API công khai (07 §2.2): cửa sổ cố định 1 phút theo đồng hồ <see cref="TimeProvider"/>, đếm trong
/// <see cref="IMemoryCache"/> (dùng chung cả tiến trình), khóa = chính sách + IP. Chép từ demo Menu QR.
/// </summary>
public sealed class PublicRateLimiter(IMemoryCache cache, TimeProvider time) : IPublicRateLimiter
{
    private static readonly TimeSpan Window = TimeSpan.FromMinutes(1);

    public bool TryAcquire(string policy, string key, out int retryAfterSeconds)
    {
        var limit = policy == PublicRatePolicies.Write ? PublicRatePolicies.WritePerMinute : PublicRatePolicies.ReadPerMinute;
        var now = time.GetUtcNow();
        var windowIndex = now.UtcTicks / Window.Ticks;
        var windowEnd = new DateTimeOffset((windowIndex + 1) * Window.Ticks, TimeSpan.Zero);

        var counter = cache.GetOrCreate($"rate:{policy}:{key}:{windowIndex}", entry =>
        {
            // Hạn theo đồng hồ của cache (đồng hồ hệ thống), đủ dài hơn một cửa sổ; khóa đã gồm số thứ tự cửa sổ.
            entry.AbsoluteExpirationRelativeToNow = Window * 2;
            return new Counter();
        })!;

        var count = Interlocked.Increment(ref counter.Value);
        retryAfterSeconds = Math.Max(1, (int)Math.Ceiling((windowEnd - now).TotalSeconds));
        return count <= limit;
    }

    private sealed class Counter
    {
        public int Value;
    }
}
