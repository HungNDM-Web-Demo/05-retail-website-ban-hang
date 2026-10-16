using Application.DTOs.Storefront;

namespace Application.Interfaces.Services.Storefront;

/// <summary>Kết quả ghi có thể trùng (NFR-05): <see cref="Created"/> = false khi trả lại kết quả cũ.</summary>
public sealed record WriteOutcome<T>(T Value, bool Created);

/// <summary>Cửa hàng công khai, phần đọc (07 §2.2, FR-04…FR-07): chỉ trả sản phẩm, danh mục đang hiển thị.</summary>
public interface IStorefrontService
{
    Task<PublicStoreInfo> GetStoreAsync(CancellationToken ct = default);

    Task<PublicHome> GetHomeAsync(CancellationToken ct = default);

    Task<IReadOnlyList<PublicCategory>> GetCategoriesAsync(CancellationToken ct = default);

    /// <summary><c>category</c> không tồn tại hoặc đang ẩn → 404 <c>KhongTimThayDanhMuc</c>.</summary>
    Task<PublicProductListResult> GetProductsAsync(PublicProductQuery query, CancellationToken ct = default);

    /// <summary>Gợi ý từ 2 ký tự, tối đa 5.</summary>
    Task<IReadOnlyList<PublicSuggestion>> SuggestAsync(string? search, CancellationToken ct = default);

    /// <summary>Sản phẩm ẩn → <c>discontinued</c>; slug chưa từng có → 404 <c>KhongTimThaySanPham</c>.</summary>
    Task<PublicProductLookup> GetProductAsync(string slug, CancellationToken ct = default);
}

/// <summary>Giỏ, thanh toán, đặt hàng công khai (07 §2.2, §3.1–3.4, §3.7; FR-09…FR-13).</summary>
public interface ICheckoutService
{
    Task<CartCheckResult> CheckCartAsync(CartCheckRequest request, CancellationToken ct = default);

    /// <summary>Mã không dùng được vẫn trả 200, lý do ở <c>coupon</c>; không kiểm lượt theo số điện thoại (TC-14).</summary>
    Task<CheckoutQuote> QuoteAsync(CheckoutQuoteRequest request, CancellationToken ct = default);

    /// <summary>Đặt hàng (§2.2 bước 1–7); cùng <c>clientRequestId</c> → kết quả cũ, <c>Created = false</c>.</summary>
    Task<WriteOutcome<PlaceOrderResult>> PlaceOrderAsync(PlaceOrderRequest request, CancellationToken ct = default);
}

/// <summary>Tra cứu đơn và khách tự hủy (FR-14, FR-15, BR-28).</summary>
public interface IOrderLookupService
{
    /// <summary>Sai mã hoặc số → 404 <c>KhongTimThayDon</c>; sai 5 lần trong 10 phút → 429 <c>TraCuuTamKhoa</c>.</summary>
    Task<PublicOrderView> LookupAsync(OrderLookupRequest request, CancellationToken ct = default);

    Task<PublicOrderView> CancelAsync(string code, PublicCancelRequest request, string? deviceId, string? ipAddress, CancellationToken ct = default);
}
