namespace Application.Interfaces.Services.Storefront;

/// <summary>Giới hạn tần suất API công khai (07 §2.2): cửa sổ cố định 1 phút, khóa theo IP.</summary>
public interface IPublicRateLimiter
{
    /// <summary>Trả false khi vượt giới hạn, kèm số giây cần chờ (header <c>Retry-After</c>).</summary>
    bool TryAcquire(string policy, string key, out int retryAfterSeconds);
}

/// <summary>Tên chính sách giới hạn tần suất (07 §2.2).</summary>
public static class PublicRatePolicies
{
    /// <summary>Các <c>GET</c> và <c>cart/check</c>, <c>checkout/quote</c>.</summary>
    public const string Read = "public-read";

    /// <summary>Đặt hàng, tra cứu, tự hủy.</summary>
    public const string Write = "public-write";

    public const int ReadPerMinute = 120;
    public const int WritePerMinute = 10;
}
