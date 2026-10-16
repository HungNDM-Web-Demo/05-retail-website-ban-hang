using Domain.Entities.Sales;

namespace Application.Common.Exceptions;

/// <summary>404 kèm <c>code</c> (07 §2.12); bộ lọc <c>SalesProblemFilter</c> của API đưa <c>code</c> vào ProblemDetails.</summary>
public sealed class CodedNotFoundException(string message, string code) : NotFoundException(message)
{
    public string Code { get; } = code;
}

/// <summary>429 kèm <c>code</c>, header <c>Retry-After</c> và các trường mở rộng (vd <c>retryAfterSeconds</c>).</summary>
public sealed class TooManyRequestsException(string message, string code, int retryAfterSeconds) : Exception(message)
{
    public string Code { get; } = code;

    public int RetryAfterSeconds { get; } = retryAfterSeconds;
}

/// <summary>Lỗi 404, 409, 429 có mã <c>code</c> của nghiệp vụ bán hàng (07 §2.12).</summary>
public static class SalesProblems
{
    public static CodedNotFoundException OrderNotFound() => new(SalesErrors.OrderNotFoundMessage, SalesErrors.KhongTimThayDon);

    public static CodedNotFoundException ProductNotFound() => new(SalesErrors.ProductNotFoundMessage, SalesErrors.KhongTimThaySanPham);

    public static CodedNotFoundException CategoryNotFound() => new(SalesErrors.CategoryNotFoundMessage, SalesErrors.KhongTimThayDanhMuc);

    /// <summary>409 kèm <c>code</c> và các trường mở rộng.</summary>
    public static ConflictException Conflict(string code, string message, IReadOnlyDictionary<string, object?>? extra = null)
    {
        var extensions = new Dictionary<string, object?> { ["code"] = code };
        if (extra is not null)
        {
            foreach (var (key, value) in extra)
                extensions[key] = value;
        }

        return new ConflictException(message, null, extensions);
    }

    public static TooManyRequestsException TooManyRequests(int retryAfterSeconds) =>
        new(SalesErrors.TooManyRequestsMessage, SalesErrors.QuaNhieuYeuCau, retryAfterSeconds);
}
