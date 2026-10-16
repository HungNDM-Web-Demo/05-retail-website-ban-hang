using System.Globalization;
using API.Middlewares;
using Application.Common.Exceptions;
using Application.Interfaces.Services.Storefront;
using Domain.Entities.Sales;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace API.Filters;

/// <summary>
/// Lỗi có <c>code</c> mà ExceptionMiddleware của nền không biết (07 §2.12): 404 <see cref="CodedNotFoundException"/>,
/// 429 <see cref="TooManyRequestsException"/> (kèm header <c>Retry-After</c>, trường <c>retryAfterSeconds</c>).
/// Lỗi khác để ExceptionMiddleware xử lý.
/// </summary>
public sealed class SalesProblemFilter : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        ProblemDetails problem;
        switch (context.Exception)
        {
            case CodedNotFoundException notFound:
                problem = ApiProblemDetails.Create(context.HttpContext, StatusCodes.Status404NotFound, notFound.Message);
                problem.Extensions["code"] = notFound.Code;
                break;
            case TooManyRequestsException tooMany:
                context.HttpContext.Response.Headers.RetryAfter = tooMany.RetryAfterSeconds.ToString(CultureInfo.InvariantCulture);
                problem = ApiProblemDetails.Create(context.HttpContext, StatusCodes.Status429TooManyRequests, tooMany.Message);
                problem.Extensions["code"] = tooMany.Code;
                problem.Extensions["retryAfterSeconds"] = tooMany.RetryAfterSeconds;
                break;
            default:
                return;
        }

        context.Result = new ObjectResult(problem) { StatusCode = problem.Status, ContentTypes = { ApiProblemDetails.ContentType } };
        context.ExceptionHandled = true;
    }
}

/// <summary>
/// Giới hạn tần suất API công khai (07 §2.2): khóa theo IP, cửa sổ cố định 1 phút. Vượt → 429 <c>QuaNhieuYeuCau</c> kèm header
/// <c>Retry-After</c>. Chạy trước khi đọc body. Chép từ demo Menu QR.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class PublicRateLimitAttribute(string policy) : Attribute, IAsyncResourceFilter
{
    public string Policy { get; } = policy;

    public async Task OnResourceExecutionAsync(ResourceExecutingContext context, ResourceExecutionDelegate next)
    {
        var http = context.HttpContext;
        var limiter = http.RequestServices.GetRequiredService<IPublicRateLimiter>();
        var ip = http.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        if (!limiter.TryAcquire(Policy, ip, out var retryAfter))
        {
            http.Response.Headers.RetryAfter = retryAfter.ToString(CultureInfo.InvariantCulture);
            var problem = ApiProblemDetails.Create(http, StatusCodes.Status429TooManyRequests, SalesErrors.TooManyRequestsMessage);
            problem.Extensions["code"] = SalesErrors.QuaNhieuYeuCau;
            context.Result = new ObjectResult(problem)
            {
                StatusCode = StatusCodes.Status429TooManyRequests,
                ContentTypes = { ApiProblemDetails.ContentType }
            };
            return;
        }

        await next();
    }
}
