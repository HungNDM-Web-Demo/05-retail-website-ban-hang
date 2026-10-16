using Application.DTOs.Catalog;
using Domain.Enums.Sales.Catalog;
using Domain.Enums.Sales.Orders;

namespace Application.DTOs.Storefront;

// Cửa hàng công khai (07 §2.2): thông tin shop, trang chủ, danh sách, chi tiết, giỏ, thanh toán, đặt hàng, tra cứu.

public sealed class PublicStoreInfo
{
    public string Name { get; init; } = string.Empty;
    public string? Tagline { get; init; }
    public string LogoUrl { get; init; } = string.Empty;
    public string PrimaryColor { get; init; } = string.Empty;
    public string Hotline { get; init; } = string.Empty;
    public string? Email { get; init; }
    public string Address { get; init; } = string.Empty;
    public string WorkingHours { get; init; } = string.Empty;
    public string BankBin { get; init; } = string.Empty;
    public string BankName { get; init; } = string.Empty;
    public string BankAccount { get; init; } = string.Empty;
    public string BankAccountName { get; init; } = string.Empty;
    public decimal FreeShipThreshold { get; init; }
    public IReadOnlyDictionary<string, decimal> ShippingFees { get; init; } = new Dictionary<string, decimal>();
    public int PaymentHours { get; init; }
}

public sealed class PublicColor
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Hex { get; init; } = string.Empty;
}

public sealed class PublicCategory
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Slug { get; init; } = string.Empty;
    public string? ImageUrl { get; init; }
    public string Color { get; init; } = string.Empty;

    /// <summary>Sản phẩm đang bán.</summary>
    public int ProductCount { get; init; }
}

public sealed class BannerDto
{
    public string ImageUrl { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public string? Subtitle { get; init; }
    public string Link { get; init; } = string.Empty;
    public string ButtonText { get; init; } = string.Empty;
}

public class PublicProductCard
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Slug { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string CategorySlug { get; init; } = string.Empty;
    public string CategoryName { get; init; } = string.Empty;
    public decimal Price { get; init; }
    public decimal? ListPrice { get; init; }
    public int? DiscountPercent { get; init; }
    public string? CoverUrl { get; init; }
    public string? HoverUrl { get; init; }
    public IReadOnlyList<PublicColor> Colors { get; init; } = [];
    public bool IsOutOfStock { get; init; }
    public int SoldCount { get; init; }
    public bool IsFeatured { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class PublicHome
{
    /// <summary>FE đọc thẳng từ seed ở cả hai chế độ (07 §5 quyết định 9); BE trả rỗng.</summary>
    public IReadOnlyList<BannerDto> Banners { get; init; } = [];
    public IReadOnlyList<PublicCategory> Categories { get; init; } = [];
    public IReadOnlyList<PublicProductCard> Featured { get; init; } = [];
    public IReadOnlyList<PublicProductCard> Newest { get; init; } = [];
    public IReadOnlyList<PublicProductCard> OnSale { get; init; } = [];
}

public sealed class PublicProductQuery
{
    /// <summary>Slug danh mục.</summary>
    public string? Category { get; set; }

    public string? Search { get; set; }
    public decimal? MinPrice { get; set; }
    public decimal? MaxPrice { get; set; }

    /// <summary>Mã màu ngăn bằng dấu phẩy, vd <c>TR,DE</c>.</summary>
    public string? Colors { get; set; }

    /// <summary>Size ngăn bằng dấu phẩy, vd <c>M,L</c>.</summary>
    public string? Sizes { get; set; }

    public bool? InStock { get; set; }

    /// <summary><c>newest</c> (mặc định), <c>bestselling</c>, <c>priceAsc</c>, <c>priceDesc</c>.</summary>
    public string? Sort { get; set; }

    public int? Page { get; set; }
    public int? PageSize { get; set; }
}

public sealed class PublicProductFacets
{
    public IReadOnlyList<PublicColor> Colors { get; init; } = [];
    public IReadOnlyList<string> Sizes { get; init; } = [];
    public decimal MinPrice { get; init; }
    public decimal MaxPrice { get; init; }
}

public sealed class PublicProductListResult
{
    public IReadOnlyList<PublicProductCard> Items { get; init; } = [];
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages => PageSize > 0 ? (int)Math.Ceiling(TotalCount / (double)PageSize) : 0;
    public bool HasPreviousPage => Page > 1;
    public bool HasNextPage => Page < TotalPages;
    public PublicProductFacets Facets { get; init; } = new();
    public PublicCategory? Category { get; init; }
}

public sealed class PublicSuggestion
{
    public string Slug { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? CoverUrl { get; init; }
    public decimal Price { get; init; }
    public decimal? ListPrice { get; init; }
}

public sealed class PublicVariant
{
    public Guid Id { get; init; }
    public string Sku { get; init; } = string.Empty;
    public string ColorCode { get; init; } = string.Empty;
    public string? Size { get; init; }
    public int Stock { get; init; }
    public StockStatus StockStatus { get; init; }
}

public sealed class PublicProductImage
{
    public string Url { get; init; } = string.Empty;
    public string? ColorCode { get; init; }
    public bool IsCover { get; init; }
}

public sealed class PublicProductDetail : PublicProductCard
{
    public string? Description { get; init; }
    public SizeChartDto? SizeChart { get; init; }
    public IReadOnlyList<PublicProductImage> Images { get; init; } = [];
    public IReadOnlyList<string> Sizes { get; init; } = [];
    public IReadOnlyList<PublicVariant> Variants { get; init; } = [];
    public IReadOnlyList<PublicProductCard> Related { get; init; } = [];
}

public sealed class PublicDiscontinued
{
    public string Name { get; init; } = string.Empty;
    public string Slug { get; init; } = string.Empty;
    public string CategoryName { get; init; } = string.Empty;
    public string CategorySlug { get; init; } = string.Empty;
    public string? CoverUrl { get; init; }
}

public sealed class PublicProductLookup
{
    public PublicProductDetail? Product { get; init; }
    public PublicDiscontinued? Discontinued { get; init; }
    public IReadOnlyList<PublicProductCard> Related { get; init; } = [];
}

// ---------- Giỏ, thanh toán ----------

public sealed class CartLineInput
{
    public Guid VariantId { get; set; }
    public int Quantity { get; set; }

    /// <summary>Giá lúc thêm vào giỏ (BR-04).</summary>
    public decimal? Price { get; set; }
}

public sealed class CartCheckRequest
{
    public List<CartLineInput> Lines { get; set; } = [];
}

public sealed class CartCheckLine
{
    public Guid VariantId { get; init; }
    public Guid? ProductId { get; init; }
    public string ProductName { get; init; } = string.Empty;
    public string? Slug { get; init; }
    public string Sku { get; init; } = string.Empty;
    public string ColorCode { get; init; } = string.Empty;
    public string ColorName { get; init; } = string.Empty;
    public string? Size { get; init; }
    public string? ImageUrl { get; init; }
    public decimal Price { get; init; }
    public decimal? OldPrice { get; init; }
    public int Stock { get; init; }
    public int Quantity { get; init; }
    public int MaxQuantity { get; init; }
    public decimal LineTotal { get; init; }
    public CartLineIssue? Issue { get; init; }
    public string? IssueText { get; init; }
}

public sealed class CartCheckResult
{
    public IReadOnlyList<CartCheckLine> Lines { get; init; } = [];
    public decimal Subtotal { get; init; }
    public decimal FreeShipRemaining { get; init; }
    public bool CanCheckout { get; init; }
}

public sealed class PricingSummary
{
    public decimal Subtotal { get; init; }
    public decimal Discount { get; init; }
    public decimal ShippingFee { get; init; }
    public decimal ShippingDiscount { get; init; }
    public decimal Total { get; init; }
    public string? CouponCode { get; init; }
    public decimal FreeShipRemaining { get; init; }
}

public sealed class CouponCheck
{
    public string Code { get; init; } = string.Empty;
    public bool Ok { get; init; }
    public string? ErrorCode { get; init; }
    public string? Message { get; init; }
    public string? Description { get; init; }
    public decimal Discount { get; init; }
    public decimal ShippingDiscount { get; init; }
}

public sealed class CheckoutQuoteRequest
{
    public List<CartLineInput> Lines { get; set; } = [];
    public string? ProvinceCode { get; set; }
    public string? CouponCode { get; set; }
}

public sealed class CheckoutQuote
{
    public IReadOnlyList<CartCheckLine> Lines { get; init; } = [];
    public PricingSummary Summary { get; init; } = new();
    public CouponCheck? Coupon { get; init; }
    public bool CanCheckout { get; init; }
}

public sealed class ShippingAddressInput
{
    public string FullName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string ProvinceCode { get; set; } = string.Empty;
    public string WardCode { get; set; } = string.Empty;
    public string AddressLine { get; set; } = string.Empty;
    public string? Note { get; set; }
}

public sealed class PlaceOrderLineInput
{
    public Guid VariantId { get; set; }
    public int Quantity { get; set; }
    public decimal ExpectedPrice { get; set; }
}

public sealed class PlaceOrderRequest
{
    public string ClientRequestId { get; set; } = string.Empty;
    public List<PlaceOrderLineInput> Lines { get; set; } = [];
    public ShippingAddressInput Shipping { get; set; } = new();
    public PaymentMethod? PaymentMethod { get; set; }
    public string? CouponCode { get; set; }

    /// <summary>Lấy từ header <c>X-Device-Id</c>, không nhận từ body.</summary>
    [System.Text.Json.Serialization.JsonIgnore]
    public string? DeviceId { get; set; }
}

public sealed class TransferInfo
{
    public string BankBin { get; init; } = string.Empty;
    public string BankName { get; init; } = string.Empty;
    public string BankAccount { get; init; } = string.Empty;
    public string BankAccountName { get; init; } = string.Empty;
    public decimal Amount { get; init; }
    public string Content { get; init; } = string.Empty;
    public DateTime DueAt { get; init; }
    public string QrPayload { get; init; } = string.Empty;
}

public class OrderLineView
{
    public string ProductName { get; init; } = string.Empty;
    public string? Slug { get; init; }
    public string Sku { get; init; } = string.Empty;
    public string ColorName { get; init; } = string.Empty;
    public string? Size { get; init; }
    public string? ImageUrl { get; init; }
    public decimal UnitPrice { get; init; }
    public int Quantity { get; init; }
    public decimal LineTotal { get; init; }
}

public sealed class PlacedOrderSummary
{
    public string Code { get; init; } = string.Empty;
    public DateTime PlacedAt { get; init; }
    public OrderStatus Status { get; init; }
    public PaymentMethod PaymentMethod { get; init; }
    public PaymentStatus PaymentStatus { get; init; }
    public DateTime? PaymentDueAt { get; init; }
    public string RecipientName { get; init; } = string.Empty;
    public string Phone { get; init; } = string.Empty;
    public string? Email { get; init; }
    public string ProvinceName { get; init; } = string.Empty;
    public string WardName { get; init; } = string.Empty;
    public string AddressLine { get; init; } = string.Empty;
    public string? CustomerNote { get; init; }
    public IReadOnlyList<OrderLineView> Lines { get; init; } = [];
    public PricingSummary Summary { get; init; } = new();
    public TransferInfo? Transfer { get; init; }
}

public sealed class PlaceOrderResult
{
    public PlacedOrderSummary Order { get; init; } = new();
    public bool Duplicate { get; init; }
}

// ---------- Tra cứu ----------

public sealed class OrderLookupRequest
{
    public string Code { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;

    [System.Text.Json.Serialization.JsonIgnore]
    public string? DeviceId { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public string? IpAddress { get; set; }
}

public sealed class PublicTimelineItem
{
    public DateTime At { get; init; }
    public OrderStatus? Status { get; init; }
    public string Text { get; init; } = string.Empty;
}

public sealed class PublicShipmentView
{
    public Carrier Carrier { get; init; }
    public string TrackingCode { get; init; } = string.Empty;
    public DateTime HandedOverAt { get; init; }
    public DateTime? DeliveredAt { get; init; }
}

public sealed class PublicOrderView
{
    public string Code { get; init; } = string.Empty;
    public DateTime PlacedAt { get; init; }
    public OrderStatus Status { get; init; }
    public PaymentMethod PaymentMethod { get; init; }
    public PaymentStatus PaymentStatus { get; init; }
    public DateTime? PaymentDueAt { get; init; }
    public string RecipientName { get; init; } = string.Empty;
    public string MaskedPhone { get; init; } = string.Empty;
    public string WardName { get; init; } = string.Empty;
    public string ProvinceName { get; init; } = string.Empty;
    public IReadOnlyList<OrderLineView> Lines { get; init; } = [];
    public PricingSummary Summary { get; init; } = new();
    public PublicShipmentView? Shipment { get; init; }
    public IReadOnlyList<PublicTimelineItem> Timeline { get; init; } = [];
    public CancelReason? CancelReason { get; init; }
    public bool CanCancel { get; init; }
    public TransferInfo? Transfer { get; init; }
}

public sealed class PublicCancelRequest
{
    public string Phone { get; set; } = string.Empty;
    public CancelReason? Reason { get; set; }
    public string? Note { get; set; }
}
