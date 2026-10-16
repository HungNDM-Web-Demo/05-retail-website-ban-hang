using API.Base;
using API.Filters;
using Application.DTOs.Storefront;
using Application.Interfaces.Services.Storefront;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Storefront;

/// <summary>
/// Cửa hàng công khai (07 §2.2): khách không đăng nhập, header <c>X-Device-Id</c> là mã trình duyệt ẩn danh. Đọc 120 yêu cầu/phút,
/// ghi (đặt hàng, tra cứu, tự hủy) 10 yêu cầu/phút theo IP → 429 <c>QuaNhieuYeuCau</c>.
/// </summary>
[Route("api/public")]
[AllowAnonymous]
public sealed class PublicStoreController(
    IStorefrontService storefront,
    ICheckoutService checkout,
    IOrderLookupService lookup) : BaseApiController
{
    private const string DeviceHeader = "X-Device-Id";

    [HttpGet("store")]
    [PublicRateLimit(PublicRatePolicies.Read)]
    public async Task<ActionResult<PublicStoreInfo>> Store(CancellationToken ct) => Ok(await storefront.GetStoreAsync(ct));

    [HttpGet("home")]
    [PublicRateLimit(PublicRatePolicies.Read)]
    public async Task<ActionResult<PublicHome>> Home(CancellationToken ct) => Ok(await storefront.GetHomeAsync(ct));

    [HttpGet("categories")]
    [PublicRateLimit(PublicRatePolicies.Read)]
    public async Task<ActionResult<IReadOnlyList<PublicCategory>>> Categories(CancellationToken ct) => Ok(await storefront.GetCategoriesAsync(ct));

    /// <summary>Danh sách, lọc, sắp xếp (FR-05, FR-06); danh mục không tồn tại hoặc ẩn → 404 <c>KhongTimThayDanhMuc</c>.</summary>
    [HttpGet("products")]
    [PublicRateLimit(PublicRatePolicies.Read)]
    public async Task<ActionResult<PublicProductListResult>> Products([FromQuery] PublicProductQuery query, CancellationToken ct) =>
        Ok(await storefront.GetProductsAsync(query, ct));

    [HttpGet("products/suggest")]
    [PublicRateLimit(PublicRatePolicies.Read)]
    public async Task<ActionResult<IReadOnlyList<PublicSuggestion>>> Suggest([FromQuery] string? search, CancellationToken ct) =>
        Ok(await storefront.SuggestAsync(search, ct));

    /// <summary>Chi tiết (FR-07); sản phẩm ẩn → <c>discontinued</c>; slug chưa từng có → 404 <c>KhongTimThaySanPham</c>.</summary>
    [HttpGet("products/{slug}")]
    [PublicRateLimit(PublicRatePolicies.Read)]
    public async Task<ActionResult<PublicProductLookup>> Product(string slug, CancellationToken ct) =>
        Ok(await storefront.GetProductAsync(slug, ct));

    [HttpPost("cart/check")]
    [PublicRateLimit(PublicRatePolicies.Read)]
    public async Task<ActionResult<CartCheckResult>> CheckCart(CartCheckRequest request, CancellationToken ct) =>
        Ok(await checkout.CheckCartAsync(request, ct));

    [HttpPost("checkout/quote")]
    [PublicRateLimit(PublicRatePolicies.Read)]
    public async Task<ActionResult<CheckoutQuote>> Quote(CheckoutQuoteRequest request, CancellationToken ct) =>
        Ok(await checkout.QuoteAsync(request, ct));

    /// <summary>Đặt hàng: 201; cùng <c>clientRequestId</c> → 200, <c>duplicate = true</c> (NFR-05).</summary>
    [HttpPost("orders")]
    [PublicRateLimit(PublicRatePolicies.Write)]
    [ProducesResponseType<PlaceOrderResult>(StatusCodes.Status201Created)]
    [ProducesResponseType<PlaceOrderResult>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PlaceOrderResult>> PlaceOrder(PlaceOrderRequest request, CancellationToken ct)
    {
        request.DeviceId = DeviceId();
        var outcome = await checkout.PlaceOrderAsync(request, ct);
        return outcome.Created ? StatusCode(StatusCodes.Status201Created, outcome.Value) : Ok(outcome.Value);
    }

    /// <summary>Tra cứu (FR-14); sai mã hoặc số → 404 <c>KhongTimThayDon</c>; sai 5 lần/10 phút → 429 <c>TraCuuTamKhoa</c>.</summary>
    [HttpPost("orders/lookup")]
    [PublicRateLimit(PublicRatePolicies.Write)]
    public async Task<ActionResult<PublicOrderView>> Lookup(OrderLookupRequest request, CancellationToken ct)
    {
        request.DeviceId = DeviceId();
        request.IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        return Ok(await lookup.LookupAsync(request, ct));
    }

    /// <summary>Khách tự hủy (FR-15): chỉ khi Chờ thanh toán, Chờ xác nhận; khác → 400 <c>KhongTheTuHuy</c>.</summary>
    [HttpPost("orders/{code}/cancel")]
    [PublicRateLimit(PublicRatePolicies.Write)]
    public async Task<ActionResult<PublicOrderView>> Cancel(string code, PublicCancelRequest request, CancellationToken ct) =>
        Ok(await lookup.CancelAsync(code, request, DeviceId(), HttpContext.Connection.RemoteIpAddress?.ToString(), ct));

    private string? DeviceId()
    {
        var value = Request.Headers[DeviceHeader].ToString().Trim();
        return value.Length == 0 ? null : value.Length > 64 ? value[..64] : value;
    }
}
