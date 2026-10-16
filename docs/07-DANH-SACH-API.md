# Danh sách API — Website Bán hàng

> Base URL dev: `https://localhost:7105` · Swagger: `https://localhost:7105/swagger`
> Demo công khai (chế độ `mock`, không có BE): `https://pum-ban-hang.vercel.app`.
> Quy ước chung (đường dẫn, phân trang, lỗi) và API nền (auth, users, roles, settings, audit-logs, demo): xem `ZDOCS/03-KIEN-TRUC/QUY-UOC-API.md`.
> File này là **hợp đồng giữa BE và FE**: BE (`Application/DTOs`) và FE (`FE/src/types/shop.ts`, đã viết sẵn, khớp từng trường với các khối `ts` dưới đây) phải khớp nhau. Ở chế độ `mock`, handler trả đúng các kiểu này, áp đúng quy tắc ở §3 và câu lỗi ở §2.12. Bảng, enum, dữ liệu mẫu: `06-THIET-KE-CSDL.md`.

---

## 1. Mã quyền nghiệp vụ

Đúng `02-SRS.md` §7; các mã ghép `create / update / delete` tách thành từng mã. `ADMIN` luôn đủ quyền. Đã khai báo trong `FE/src/mock/seed/project.json` và FE `config/permissions.ts`; BE thêm vào `Application/Constants/Permissions.cs`.

| Nhóm | Mã quyền | Tên hiển thị | ADMIN | MANAGER | STAFF |
| :--- | :--- | :--- | :---: | :---: | :---: |
| Sản phẩm | `products.view` | Xem sản phẩm, biến thể, tồn kho | ✓ | ✓ | ✓ |
| Sản phẩm | `products.create` | Thêm danh mục, màu, sản phẩm, biến thể | ✓ | ✓ | |
| Sản phẩm | `products.update` | Sửa, ẩn, sắp xếp danh mục và sản phẩm, bật tắt biến thể | ✓ | ✓ | |
| Sản phẩm | `products.delete` | Xóa danh mục trống, sản phẩm và biến thể chưa có trong đơn | ✓ | ✓ | |
| Sản phẩm | `products.adjust-stock` | Điều chỉnh tồn kho | ✓ | ✓ | |
| Đơn hàng | `orders.view` | Xem danh sách, chi tiết đơn | ✓ | ✓ | ✓ |
| Đơn hàng | `orders.confirm` | Xác nhận đơn | ✓ | ✓ | ✓ |
| Đơn hàng | `orders.confirm-payment` | Xác nhận đã nhận tiền chuyển khoản | ✓ | ✓ | ✓ |
| Đơn hàng | `orders.update` | Sửa đơn Chờ xác nhận, ghi chú nội bộ | ✓ | ✓ | ✓ |
| Đơn hàng | `orders.cancel` | Hủy đơn chưa bàn giao | ✓ | ✓ | ✓ |
| Đơn hàng | `orders.ship` | Bàn giao vận chuyển, in phiếu giao, cập nhật kết quả giao | ✓ | ✓ | ✓ |
| Đơn hàng | `orders.refund` | Đánh dấu đã hoàn tiền cho đơn chuyển khoản bị hủy | ✓ | ✓ | |
| Mã giảm giá | `coupons.view` | Xem mã giảm giá | ✓ | ✓ | ✓ |
| Mã giảm giá | `coupons.create` | Thêm mã giảm giá | ✓ | ✓ | |
| Mã giảm giá | `coupons.update` | Sửa, tạm dừng, chạy lại mã | ✓ | ✓ | |
| Mã giảm giá | `coupons.delete` | Xóa mã chưa có lượt dùng | ✓ | ✓ | |
| Khách hàng | `customers.view` | Xem khách, lịch sử đơn | ✓ | ✓ | ✓ |
| Khách hàng | `customers.update` | Sửa ghi chú khách | ✓ | ✓ | |
| Báo cáo | `reports.view` | Xem báo cáo và các thẻ doanh thu ở Tổng quan | ✓ | ✓ | |

Quyền nền `dashboard.view` có sẵn ở `MANAGER` và `STAFF` trong `system.json`: trang Tổng quan `/dashboard` gắn quyền này (thẻ việc cần làm cho cả hai vai trò, FR-03); phần số liệu doanh thu gọi API riêng gắn `reports.view` (FR-01, FR-02, UC-12 3a). Cửa hàng (`/`, `/products`, `/products/[slug]`, `/cart`, `/checkout`, `/checkout/success`, `/tra-cuu-don`) và API `/api/public/*`, `/api/provinces` không cần đăng nhập.

---

## 2. API nghiệp vụ

Bảng tra enum dùng chung (chuỗi PascalCase, khớp `06` §4):

```ts
type ProductStatus = 'DangBan' | 'An'
type StockStatus = 'ConHang' | 'SapHet' | 'HetHang'                 // BR-02: >5, 1–5, 0
type OrderStatus = 'ChoThanhToan' | 'ChoXacNhan' | 'DaXacNhan' | 'DangGiao' | 'DaGiao' | 'DangHoan' | 'DaHoan' | 'DaHuy'
type PaymentMethod = 'Cod' | 'ChuyenKhoan'
type PaymentStatus = 'ChuaThanhToan' | 'DaThanhToan' | 'CanHoanTien' | 'DaHoanTien'
type CancelReason = 'KhachDoiY' | 'KhongLienLacDuoc' | 'HetHang' | 'DatTrung' | 'QuaHanThanhToan' | 'Khac'
type DeliveryFailReason = 'KhachKhongNgheMay' | 'KhachTuChoiNhan' | 'SaiDiaChi' | 'Khac'
type Carrier = 'Ghn' | 'Ghtk' | 'Vtp' | 'Jt'                          // tiền tố mã vận đơn GHN, GHTK, VTP, JT
type OrderEventType = 'DoiTrangThai' | 'GhiChuNoiBo' | 'TinGuiKhach' | 'SuaDon' | 'HoanTien'
type ActorType = 'NhanVien' | 'Khach' | 'HeThong'
type OrderLabel = 'TrungSdt' | 'GiaoCham' | 'KhachCanLuuY'
type OrderAction = 'Confirm' | 'ConfirmPayment' | 'Edit' | 'Cancel' | 'Ship' | 'Deliver' | 'DeliveryFailed' | 'ReceiveReturn' | 'Refund' | 'PrintLabel'
type CouponType = 'PhanTram' | 'SoTien' | 'MienPhiVanChuyen'
type CouponStatus = 'SapChay' | 'DangChay' | 'TamDung' | 'HetLuot' | 'HetHan'
type StockAdjustReason = 'NhapHang' | 'KiemKe' | 'HangLoi' | 'Khac'
type CustomerTag = 'KhachVip' | 'CanLuuY'
type ShippingZone = 'TpHcm' | 'TinhKhac'
type ProductSort = 'newest' | 'bestselling' | 'priceAsc' | 'priceDesc'
type CartLineIssue = 'GiaDaDoi' | 'KhongDuTon' | 'HetHang' | 'NgungKinhDoanh' | 'BienTheDaTat'
type TopProductGroupBy = 'product' | 'variant'
```

Chữ hiển thị đặt sẵn ở `FE/src/config/shop-labels.ts` (gồm thứ tự tab trạng thái, màu `StatusBadge`, khoảng giá nhanh, lý do hủy cho nhân viên và cho khách).

- Tham số ngày `from`, `to`, `fromDate`, `toDate` dạng `yyyy-MM-dd`, hiểu theo giờ Việt Nam (00:00 ngày đầu đến 23:59:59 ngày cuối). Khoảng dài hơn 366 ngày → 400 `errors.from` "Khoảng ngày tối đa 366 ngày"; ngày cuối nhỏ hơn ngày đầu → 400 `errors.to` "Ngày kết thúc phải sau ngày bắt đầu".
- Thao tác đổi đơn trả **200 kèm `OrderDetailDto` mới** (không 204) để FE thay cache ngay.
- Tiền là số nguyên đồng. Số tiền trong câu lỗi định dạng `500.000 ₫`, giờ `HH:mm` giờ Việt Nam.

### 2.1. Danh mục hành chính — `/api/provinces`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/provinces` | Công khai | 34 tỉnh/thành kèm phường/xã → `ProvinceDto[]`; cache phía FE vô hạn (`staleTime: Infinity`) |

```ts
type WardDto = { code: string; name: string }
type ProvinceDto = { code: string; name: string; zone: ShippingZone; wards: WardDto[] }
```

### 2.2. Cửa hàng công khai — `/api/public`

Khách không đăng nhập. FE gọi bằng axios riêng **không** gắn `Authorization`, gửi header `X-Device-Id` (mã trình duyệt ẩn danh, §4.3). Chỉ trả sản phẩm, danh mục đang hiển thị; không bao giờ trả ghi chú nội bộ, người thao tác, thông tin khách khác.

- **Giới hạn tần suất** (`IPublicRateLimiter` đếm trong `IMemoryCache` theo `TimeProvider`, bộ lọc `[PublicRateLimit]`, cửa sổ cố định 1 phút, khóa theo IP): `public-read` 120 yêu cầu/phút cho các `GET` và `cart/check`, `checkout/quote`; `public-write` 10 yêu cầu/phút cho đặt hàng, tra cứu, tự hủy. Vượt → 429 `QuaNhieuYeuCau` kèm header `Retry-After`. Chế độ `mock` không giả lập.
- **Chặn tra cứu sai** (BR-28): sai mã đơn hoặc số điện thoại 5 lần trong 10 phút từ cùng `X-Device-Id` (thiếu header thì theo IP) → chặn 10 phút; chính lần sai thứ 5 đã trả 429 `TraCuuTamKhoa` (kèm `retryAfterSeconds`). Mock giả lập bằng localStorage (§4.8).

| Method | Đường dẫn | Mô tả |
| :--- | :--- | :--- |
| GET | `/api/public/store` | Thông tin shop, phí vận chuyển → `PublicStoreInfo` |
| GET | `/api/public/home` | Trang chủ → `PublicHome` (FR-04) |
| GET | `/api/public/categories` | Danh mục đang hiển thị có sản phẩm đang bán → `PublicCategory[]` theo `sortOrder` |
| GET | `/api/public/products` | Danh sách, lọc, sắp xếp `PublicProductQuery` → `PublicProductListResult` (FR-05, FR-06); `category` không tồn tại hoặc đang ẩn → 404 `KhongTimThayDanhMuc` |
| GET | `/api/public/products/suggest?search=` | Gợi ý từ 2 ký tự, tối đa 5 → `PublicSuggestion[]` (FR-06); dưới 2 ký tự → `[]` |
| GET | `/api/public/products/{slug}` | Chi tiết → `PublicProductLookup`; sản phẩm ẩn → `discontinued` + `related`; slug chưa từng có → 404 `KhongTimThaySanPham` (FR-07, BR-23) |
| POST | `/api/public/cart/check` | Kiểm lại giá, tồn của giỏ `CartCheckRequest` → `CartCheckResult` (BR-04) |
| POST | `/api/public/checkout/quote` | Tính tiền và kiểm mã `CheckoutQuoteRequest` → `CheckoutQuote` (FR-11, FR-12); mã không dùng được vẫn trả 200, lý do ở `coupon` |
| POST | `/api/public/orders` | Đặt hàng `PlaceOrderRequest` → 201 `PlaceOrderResult`; cùng `clientRequestId` → 200, `duplicate = true` (FR-10, FR-13, NFR-05) |
| POST | `/api/public/orders/lookup` | Tra cứu `OrderLookupRequest` → `PublicOrderView` (FR-14); sai mã hoặc số → 404 `KhongTimThayDon` |
| POST | `/api/public/orders/{code}/cancel` | Khách tự hủy `PublicCancelRequest` → `PublicOrderView` (FR-15) |

Tra cứu và tự hủy dùng `POST` để số điện thoại nằm trong body, không lên URL.

```ts
type PublicStoreInfo = {
  name: string; tagline?: string; logoUrl: string; primaryColor: string
  hotline: string; email?: string; address: string; workingHours: string
  bankBin: string; bankName: string; bankAccount: string; bankAccountName: string   // bankName tra theo BIN (§3.9)
  freeShipThreshold: number                       // 499.000 (BR-06)
  shippingFees: Record<ShippingZone, number>       // { TpHcm: 20000, TinhKhac: 35000 }
  paymentHours: number                             // 24 (BR-11)
}

type PublicColor = { code: string; name: string; hex: string }
type PublicCategory = { id: string; name: string; slug: string; imageUrl?: string; color: string; productCount: number }
type Banner = { imageUrl: string; title: string; subtitle?: string; link: string; buttonText: string }

type PublicProductCard = {
  id: string; code: string; slug: string; name: string
  categorySlug: string; categoryName: string
  price: number; listPrice?: number; discountPercent?: number   // BR-01
  coverUrl?: string; hoverUrl?: string                           // ảnh thứ hai nếu có
  colors: PublicColor[]                                          // màu có ít nhất một biến thể bật
  isOutOfStock: boolean                                          // mọi biến thể bật tồn 0 (BR-02)
  soldCount: number; isFeatured: boolean; createdAt: string
}
type PublicHome = {
  banners: Banner[]                  // FE đọc thẳng từ seed ở cả hai chế độ (§5 quyết định 9); BE trả [] 
  categories: PublicCategory[]
  featured: PublicProductCard[]      // nổi bật, tối đa 8, theo sortOrder
  newest: PublicProductCard[]        // 8 sản phẩm mới nhất
  onSale: PublicProductCard[]        // có giá gốc, giảm nhiều nhất trước, tối đa 8
}

type PublicProductQuery = {
  category?: string                  // slug
  search?: string                    // tên, mã, SKU; không dấu (FR-06)
  minPrice?: number; maxPrice?: number
  colors?: string                    // mã màu ngăn bằng dấu phẩy "TR,DE"
  sizes?: string                     // "M,L"
  inStock?: boolean                  // "Chỉ hiện còn hàng"
  sort?: ProductSort                 // mặc định newest
  page?: number; pageSize?: number   // mặc định 24, tối đa 48
}
type PublicProductFacets = { colors: PublicColor[]; sizes: string[]; minPrice: number; maxPrice: number }
type PublicProductListResult = PaginatedResult<PublicProductCard> & { facets: PublicProductFacets; category?: PublicCategory }
type PublicSuggestion = { slug: string; name: string; coverUrl?: string; price: number; listPrice?: number }

type PublicVariant = { id: string; sku: string; colorCode: string; size?: string; stock: number; stockStatus: StockStatus }
type PublicProductDetail = PublicProductCard & {
  description?: string; sizeChart?: SizeChart
  images: { url: string; colorCode?: string; isCover: boolean }[]
  sizes: string[]                    // thứ tự size; [] = không size
  variants: PublicVariant[]          // chỉ biến thể bật
  related: PublicProductCard[]       // 8 sản phẩm cùng danh mục, bán chạy trước (FR-07)
}
type PublicProductLookup = {
  product?: PublicProductDetail
  discontinued?: { name: string; slug: string; categoryName: string; categorySlug: string; coverUrl?: string }
  related: PublicProductCard[]
}

// Giỏ
type CartLineInput = { variantId: string; quantity: number; price?: number }   // price = giá lúc thêm
type CartCheckRequest = { lines: CartLineInput[] }
type CartCheckLine = {
  variantId: string; productId?: string; productName: string; slug?: string
  sku: string; colorCode: string; colorName: string; size?: string; imageUrl?: string
  price: number; oldPrice?: number   // oldPrice khi giá gửi lên khác giá hiện tại
  stock: number; quantity: number; maxQuantity: number   // min(10, tồn) (BR-03)
  lineTotal: number
  issue?: CartLineIssue; issueText?: string             // §3.4
}
type CartCheckResult = { lines: CartCheckLine[]; subtotal: number; freeShipRemaining: number; canCheckout: boolean }

// Thanh toán
type PricingSummary = {
  subtotal: number; discount: number
  shippingFee: number; shippingDiscount: number          // shippingDiscount: phí được miễn nhờ mã MienPhiVanChuyen
  total: number; couponCode?: string
  freeShipRemaining: number                              // max(0, 499.000 − (subtotal − discount))
}
type CouponCheck = {
  code: string; ok: boolean
  errorCode?: string; message?: string                   // §2.12, hiển thị nguyên văn
  description?: string                                   // tên mã
  discount: number; shippingDiscount: number
}
type CheckoutQuoteRequest = { lines: CartLineInput[]; provinceCode?: string; couponCode?: string }   // không kiểm lượt theo số điện thoại (TC-14)
type CheckoutQuote = { lines: CartCheckLine[]; summary: PricingSummary; coupon?: CouponCheck; canCheckout: boolean }

type ShippingAddressInput = { fullName: string; phone: string; email?: string; provinceCode: string; wardCode: string; addressLine: string; note?: string }
type PlaceOrderRequest = {
  clientRequestId: string
  lines: { variantId: string; quantity: number; expectedPrice: number }[]
  shipping: ShippingAddressInput
  paymentMethod: PaymentMethod
  couponCode?: string
}
type TransferInfo = {
  bankBin: string; bankName: string; bankAccount: string; bankAccountName: string
  amount: number; content: string                        // content = mã đơn (BR-12)
  dueAt: string; qrPayload: string                       // §3.9
}
type OrderLineView = { productName: string; slug?: string; sku: string; colorName: string; size?: string; imageUrl?: string; unitPrice: number; quantity: number; lineTotal: number }
type PlacedOrderSummary = {
  code: string; placedAt: string; status: OrderStatus
  paymentMethod: PaymentMethod; paymentStatus: PaymentStatus; paymentDueAt?: string
  recipientName: string; phone: string; email?: string
  provinceName: string; wardName: string; addressLine: string; customerNote?: string
  lines: OrderLineView[]; summary: PricingSummary
  transfer?: TransferInfo                                // chỉ đơn chuyển khoản
}
type PlaceOrderResult = { order: PlacedOrderSummary; duplicate: boolean }

// Tra cứu
type OrderLookupRequest = { code: string; phone: string }
type PublicTimelineItem = { at: string; status?: OrderStatus; text: string }
type PublicOrderView = {
  code: string; placedAt: string; status: OrderStatus
  paymentMethod: PaymentMethod; paymentStatus: PaymentStatus; paymentDueAt?: string
  recipientName: string; maskedPhone: string             // BR-28
  wardName: string; provinceName: string                 // không trả địa chỉ chi tiết
  lines: OrderLineView[]; summary: PricingSummary
  shipment?: { carrier: Carrier; trackingCode: string; handedOverAt: string; deliveredAt?: string }
  timeline: PublicTimelineItem[]                         // cũ trước; §3.10
  cancelReason?: CancelReason
  canCancel: boolean                                     // ChoThanhToan, ChoXacNhan
  transfer?: TransferInfo                                // chỉ khi ChoThanhToan
}
type PublicCancelRequest = { phone: string; reason: CancelReason; note?: string }   // reason ∈ KhachDoiY | DatTrung | Khac
```

Kiểm tra khi đặt hàng (`POST /api/public/orders`), theo thứ tự, lỗi đầu tiên dừng lại:

1. Trùng `clientRequestId` → 200 kết quả cũ (§3.7).
2. Dữ liệu (BR-07, BR-03): `errors` theo trường `shipping.fullName`, `shipping.phone`, `shipping.email`, `shipping.provinceCode`, `shipping.wardCode` (phường phải thuộc tỉnh), `shipping.addressLine`, `shipping.note`, `lines`, `lines[i].quantity`, `paymentMethod`.
3. Sản phẩm ẩn, biến thể tắt hoặc không có → 409 `SanPhamNgungBan`.
4. Giá khác `expectedPrice` → 409 `GiaDaThayDoi` kèm `priceChanges: { variantId, oldPrice, newPrice }[]` (UC-04 E5).
5. Mã giảm giá (nếu có) theo §3.2 bước 1–8 → 400 mã lỗi mã; bước 9 lượt theo số điện thoại → 400 `SdtDaDungMa` (UC-04 E3). Không tạo đơn.
6. Trừ tồn từng dòng có điều kiện (06 §3) → thiếu → 409 `KhongDuTon` kèm `stockIssues: { variantId, stock }[]` và `errors["lines[i]"]` "Chỉ còn {n} sản phẩm"; `detail` là câu của dòng đầu tiên (TC-17).
7. Tạo đơn, tạo hoặc cập nhật khách (FR-34), cộng lượt mã, ghi sự kiện, commit; phát sự kiện `order-created` (§2.10).

### 2.3. Danh mục, màu — `/api/categories`, `/api/colors`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/categories` | `products.view` | Mọi danh mục chưa xóa theo `sortOrder` → `CategoryDto[]` |
| POST | `/api/categories` | `products.create` | `SaveCategoryRequest` → 201 `CategoryDto`; `sortOrder` = max + 10 |
| PUT | `/api/categories/{id}` | `products.update` | `SaveCategoryRequest` → `CategoryDto` |
| PATCH | `/api/categories/{id}/visibility` | `products.update` | `VisibilityRequest` → 204 |
| PUT | `/api/categories/order` | `products.update` | `ReorderRequest` (đủ mọi id) → 204 |
| DELETE | `/api/categories/{id}` | `products.delete` | Còn sản phẩm chưa xóa → 400 `DanhMucConSanPham` kèm `productCount` |
| GET | `/api/colors` | `products.view` | → `ColorDto[]` theo `sortOrder` |
| POST | `/api/colors` | `products.create` | `SaveColorRequest` → 201 `ColorDto`; trùng mã hoặc tên → 409 |
| PUT | `/api/colors/{id}` | `products.update` | Đổi tên, mã hex; **không** đổi `code` (SKU đã sinh) |

```ts
type CategoryDto = { id: string; code: string; name: string; slug: string; imageUrl?: string; color: string; sortOrder: number; isVisible: boolean; productCount: number }
type SaveCategoryRequest = { code: string; name: string; slug?: string; imageUrl?: string; color: string; isVisible: boolean }
type ReorderRequest = { ids: string[] }
type VisibilityRequest = { isVisible: boolean }
type ColorDto = { id: string; code: string; name: string; hex: string; sortOrder: number }
type SaveColorRequest = { code: string; name: string; hex: string }
type SizeChart = { title: string; columns: string[]; rows: string[][] }
```

### 2.4. Sản phẩm, biến thể, tồn kho — `/api/products`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/products` | `products.view` | `ProductQuery` → `PaginatedResult<ProductListItem>` (FR-19); `search` theo tên, mã, SKU không dấu; mặc định sắp `sortOrder` |
| GET | `/api/products/{id}` | `products.view` | → `ProductDto` |
| POST | `/api/products` | `products.create` | `SaveProductRequest` → 201 `ProductDto` (FR-17, FR-18) |
| PUT | `/api/products/{id}` | `products.update` | `SaveProductRequest` → `ProductDto`; lưới biến thể theo §3.12 |
| PATCH | `/api/products/{id}/hidden` | `products.update` | `HiddenRequest` → 204 |
| DELETE | `/api/products/{id}` | `products.delete` | Đã có trong đơn → 400 `SanPhamDaCoTrongDon` (BR-23, TC-23) |
| POST | `/api/products/images` | `products.create` hoặc `products.update` | Tải ảnh (multipart `file`, JPG/PNG/WebP ≤ 2 MB) → 201 `UploadedImage` (DTO nền) |
| POST | `/api/products/{id}/variants/{variantId}/stock-adjustments` | `products.adjust-stock` | `StockAdjustmentRequest` → `ProductVariantDto` (FR-20, BR-27) |
| GET | `/api/products/{id}/stock-adjustments` | `products.view` | Lịch sử điều chỉnh của sản phẩm, mới trước → `StockAdjustmentDto[]` |

```ts
type ProductImageDto = { id: string; url: string; colorId?: string; sortOrder: number; isCover: boolean }
type ProductVariantDto = {
  id: string; sku: string
  colorId: string; colorCode: string; colorName: string; colorHex: string
  size?: string; stock: number; isActive: boolean; stockStatus: StockStatus
  everOrdered: boolean               // không xóa được, chỉ tắt (BR-23)
}
type ProductListItem = {
  id: string; code: string; name: string; slug: string
  categoryId: string; categoryName: string
  price: number; listPrice?: number; coverUrl?: string
  status: ProductStatus; isFeatured: boolean
  totalStock: number                 // Σ tồn biến thể bật
  variantCount: number
  outOfStockCount: number            // biến thể bật tồn 0
  lowStockCount: number              // biến thể bật tồn 1–5
  stockStatus: StockStatus           // §3.8
  soldCount: number; createdAt: string
}
type ProductDto = ProductListItem & {
  description?: string; sizeChart?: SizeChart
  colorIds: string[]; sizes: string[]
  images: ProductImageDto[]
  variants: ProductVariantDto[]      // theo (thứ tự màu, thứ tự size)
  everOrdered: boolean; updatedAt?: string
}
type ProductQuery = PaginationQuery & { categoryId?: string; status?: ProductStatus; stockStatus?: StockStatus }

type SaveProductVariantInput = { colorId: string; size?: string; isActive: boolean; initialStock?: number }
type SaveProductRequest = {
  code: string; name: string; slug?: string; categoryId: string
  price: number; listPrice?: number
  description?: string; sizeChart?: SizeChart
  isFeatured: boolean; isHidden: boolean
  images: { url: string; colorId?: string; isCover: boolean }[]   // tối đa 8, theo thứ tự
  colorIds: string[]; sizes: string[]
  variants: SaveProductVariantInput[]                             // đúng lưới colorIds × sizes
}
type HiddenRequest = { isHidden: boolean }
type StockAdjustmentRequest = { newStock: number; reason: StockAdjustReason; note?: string }
type StockAdjustmentDto = {
  id: string; variantId: string; sku: string; productName: string; colorName: string; size?: string
  before: number; after: number; reason: StockAdjustReason; note?: string; byName: string; at: string
}
```

Kiểm tra khi lưu: mã `^[A-Z]{2}\d{3}$` (`errors.code` "Mã sản phẩm gồm 2 chữ in hoa và 3 số"), trùng → 409 `errors.code` "Mã sản phẩm đã tồn tại" (TC-22); tên 2–200 ký tự; slug trùng → 409 `errors.slug` "Đường dẫn đã được dùng" (slug để trống thì tự sinh và tự thêm hậu tố, BR-24); giá > 0 và bội số 1.000 (`errors.price` "Giá bán là bội số của 1.000 ₫"); giá gốc bội số 1.000 và lớn hơn giá bán (`errors.listPrice` "Giá gốc phải lớn hơn giá bán"); tối đa 8 ảnh (`errors.images` "Tối đa 8 ảnh"); có ít nhất một màu (`errors.colorIds` "Chọn ít nhất một màu"); mọi biến thể đều tắt → 400 `CanItNhatMotBienThe`; `initialStock` nguyên ≥ 0. Thứ tự lỗi trường trả cùng lúc trong `errors`.

### 2.5. Đơn hàng — `/api/orders`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/orders` | `orders.view` | `OrderQuery` → `PaginatedResult<OrderListItem>` (FR-21); mặc định `pageSize` 50; `search` theo mã đơn, số điện thoại, tên người nhận không dấu; sắp xếp §3.8 |
| GET | `/api/orders/status-counts` | `orders.view` | Cùng bộ lọc trừ `status` → `OrderStatusCounts` (số trên tab) |
| GET | `/api/orders/{id}` | `orders.view` | → `OrderDetailDto` (FR-22); không có → 404 `KhongTimThayDon` (TC-26) |
| POST | `/api/orders/{id}/notes` | `orders.update` | `AddOrderNoteRequest` (1–500 ký tự) → `OrderDetailDto` (FR-23); không kiểm `version`, vẫn tăng `version` |
| POST | `/api/orders/{id}/confirm` | `orders.confirm` | `ConfirmOrderRequest` → `OrderDetailDto` (FR-24) |
| POST | `/api/orders/{id}/confirm-payment` | `orders.confirm-payment` | `ConfirmPaymentRequest` → `OrderDetailDto` (FR-25, BR-12) |
| POST | `/api/orders/{id}/edit-preview` | `orders.update` | `EditOrderRequest` → `EditOrderPreview`, không lưu (UC-08 E3) |
| PUT | `/api/orders/{id}` | `orders.update` | `EditOrderRequest` → `OrderDetailDto` (FR-26, BR-15) |
| POST | `/api/orders/{id}/cancel` | `orders.cancel` | `CancelOrderRequest` → `OrderDetailDto` (FR-27, BR-16) |
| POST | `/api/orders/{id}/ship` | `orders.ship` | `ShipOrderRequest` → `OrderDetailDto` (FR-28, BR-17) |
| POST | `/api/orders/{id}/deliver` | `orders.ship` | `VersionedRequest` → `OrderDetailDto` (FR-30) |
| POST | `/api/orders/{id}/delivery-failed` | `orders.ship` | `DeliveryFailedRequest` → `OrderDetailDto` (BR-19) |
| POST | `/api/orders/{id}/receive-return` | `orders.ship` | `VersionedRequest` → `OrderDetailDto` |
| POST | `/api/orders/{id}/refund` | `orders.refund` | `RefundRequest` → `OrderDetailDto` (BR-16) |
| POST | `/api/orders/{id}/label-printed` | `orders.ship` | Ghi đã in phiếu → `{ labelPrintCount: number }` (UC-10 5a); chỉ khi `allowedActions` có `PrintLabel` (khác → 400 `TrangThaiKhongHopLe`); đơn chưa có vận đơn chỉ tăng `version`, trả 0 |
| POST | `/api/orders/bulk/confirm` | `orders.confirm` | `BulkConfirmRequest` → `BulkResult` (FR-31, P3) |
| POST | `/api/orders/bulk/ship` | `orders.ship` | `BulkShipRequest` (khối lượng gợi ý §3.9) → `BulkResult` |

```ts
type OrderListItem = {
  id: string; code: string; placedAt: string
  customerId: string; customerName: string; phone: string; provinceName: string
  itemCount: number                  // Σ số lượng
  total: number; paymentMethod: PaymentMethod; paymentStatus: PaymentStatus
  status: OrderStatus; labels: OrderLabel[]; couponCode?: string; version: number
}
type OrderQuery = PaginationQuery & {
  status?: OrderStatus; paymentStatus?: PaymentStatus
  fromDate?: string; toDate?: string          // theo ngày đặt
  paymentMethod?: PaymentMethod; provinceCode?: string; label?: OrderLabel
  customerId?: string; couponId?: string
}
type OrderStatusCounts = Record<OrderStatus | 'TatCa', number>

type OrderLineDto = OrderLineView & { id: string; variantId: string; productId: string }
type OrderEventDto = {
  id: string; type: OrderEventType; at: string
  actorType: ActorType; actorName: string     // họ tên, "Khách" hoặc "Hệ thống"
  fromStatus?: OrderStatus; toStatus?: OrderStatus; content: string
}
type ShipmentDto = {
  carrier: Carrier; trackingCode: string; weightGrams: number; codAmount: number; shipperNote?: string
  handedOverAt: string; handedOverByName: string
  deliveredAt?: string; failedAt?: string; failReason?: DeliveryFailReason; failNote?: string; returnedAt?: string
  labelPrintCount: number
}
type OrderCustomerBrief = { id: string; name: string; phone: string; returnCount: number; orderCount: number; tags: CustomerTag[]; note?: string }
type OrderDetailDto = {
  id: string; code: string; version: number; placedAt: string
  status: OrderStatus; paymentMethod: PaymentMethod; paymentStatus: PaymentStatus
  paymentDueAt?: string; transactionRef?: string; paidAt?: string
  refundAmount?: number; refundRef?: string; refundedAt?: string
  customer: OrderCustomerBrief
  recipientName: string; phone: string; email?: string
  provinceCode: string; provinceName: string; wardCode: string; wardName: string; addressLine: string
  customerNote?: string
  lines: OrderLineDto[]
  subtotal: number; discount: number; shippingFee: number; shippingDiscount: number; total: number
  codAmount: number                           // tiền thu hộ (BR-17), có cả trước khi bàn giao
  couponId?: string; couponCode?: string
  cancelReason?: CancelReason; cancelNote?: string; cancelledAt?: string; cancelledByName?: string
  labels: OrderLabel[]
  duplicateOrders: { id: string; code: string; status: OrderStatus; placedAt: string }[]   // UC-07 4a
  shipment?: ShipmentDto
  events: OrderEventDto[]                     // cũ trước
  allowedActions: OrderAction[]               // §3.5, không xét quyền
}

type VersionedRequest = { version?: number }  // vắng = không kiểm (§3.6)
type ConfirmOrderRequest = VersionedRequest & { note?: string }
type ConfirmPaymentRequest = VersionedRequest & { transactionRef: string }
type CancelOrderRequest = VersionedRequest & { reason: CancelReason; note?: string }   // QuaHanThanhToan chỉ hệ thống dùng
type ShipOrderRequest = VersionedRequest & { carrier: Carrier; weightGrams: number; shipperNote?: string }
type DeliveryFailedRequest = VersionedRequest & { reason: DeliveryFailReason; note?: string }
type RefundRequest = VersionedRequest & { refundRef: string }
type AddOrderNoteRequest = { content: string }
type EditOrderRequest = VersionedRequest & {
  lines: { variantId: string; quantity: number }[]
  recipientName: string; phone: string; email?: string
  provinceCode: string; wardCode: string; addressLine: string
}
type EditOrderPreview = { lines: OrderLineView[]; summary: PricingSummary; couponRemoved: boolean; couponMessage?: string; changes: string[] }
type BulkItem = { id: string; version?: number }
type BulkConfirmRequest = { items: BulkItem[] }
type BulkShipRequest = { items: BulkItem[]; carrier: Carrier }
type BulkResult = { succeeded: string[]; failed: { id: string; code: string; message: string }[] }
```

### 2.6. Mã giảm giá — `/api/coupons`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/coupons` | `coupons.view` | `CouponQuery` → `PaginatedResult<CouponDto>`; mặc định sắp `startAt` giảm dần |
| GET | `/api/coupons/{id}` | `coupons.view` | → `CouponDto` (FR-33) |
| GET | `/api/coupons/{id}/orders` | `coupons.view` | Đơn đã dùng mã (cả đơn hủy) → `PaginatedResult<OrderListItem>` |
| POST | `/api/coupons` | `coupons.create` | `SaveCouponRequest` → 201 `CouponDto` (FR-32, BR-26) |
| PUT | `/api/coupons/{id}` | `coupons.update` | `SaveCouponRequest` → `CouponDto`; mã đã có lượt dùng thì **không** đổi `code`, `type`, `categoryId` (`errors.code`… "Mã đã có lượt dùng, không đổi được") |
| PATCH | `/api/coupons/{id}/pause` | `coupons.update` | `PauseCouponRequest` → 204 |
| DELETE | `/api/coupons/{id}` | `coupons.delete` | Đã có lượt dùng (kể cả đơn đã hủy) → 400 `MaDaCoLuotDung` |

```ts
type CouponDto = {
  id: string; code: string; name: string; type: CouponType
  value: number; maxDiscount?: number; minOrder: number
  categoryId?: string; categoryName?: string
  totalLimit?: number; perCustomerLimit: number
  usedCount: number                  // đơn chưa hủy có mã
  discountTotal: number              // Σ discount + shippingDiscount của đơn chưa hủy
  orderValueTotal: number            // Σ total của đơn chưa hủy
  startAt: string; endAt: string; isPaused: boolean
  status: CouponStatus               // 06 §4 Sales_Coupons
  canDelete: boolean
}
type CouponQuery = PaginationQuery & { status?: CouponStatus }
type SaveCouponRequest = {
  code: string; name: string; type: CouponType; value: number; maxDiscount?: number; minOrder: number
  categoryId?: string; totalLimit?: number; perCustomerLimit: number; startAt: string; endAt: string
}
type PauseCouponRequest = { paused: boolean }
```

Kiểm tra (BR-26): `code` chuyển chữ hoa rồi khớp `^[A-Z0-9]{4,20}$` ("Mã 4–20 ký tự chữ in hoa và số"), trùng → 409 `errors.code` "Mã giảm giá đã tồn tại" (TC-41); `PhanTram`: `value` 1–50 ("Phần trăm từ 1 đến 50"), `maxDiscount` bắt buộc ("Nhập mức giảm tối đa cho mã phần trăm", TC-41); `SoTien`: `value` > 0, bội số 1.000; `MienPhiVanChuyen`: `value` = 0; `minOrder` ≥ 0; `perCustomerLimit` ≥ 1; `totalLimit` vắng hoặc ≥ 1; `endAt` > `startAt` (`errors.endAt` "Thời điểm kết thúc phải sau thời điểm bắt đầu").

### 2.7. Khách hàng — `/api/customers`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/customers` | `customers.view` | `CustomerQuery` → `PaginatedResult<CustomerListItem>` (FR-35); mặc định sắp `lastOrderAt` giảm dần; `search` tên, số điện thoại |
| GET | `/api/customers/{id}` | `customers.view` | → `CustomerDetail` |
| GET | `/api/customers/{id}/orders` | `customers.view` | → `PaginatedResult<OrderListItem>`, mới trước |
| PUT | `/api/customers/{id}/note` | `customers.update` | `UpdateCustomerNoteRequest` (≤ 1.000 ký tự) → `CustomerDetail` (FR-36) |

```ts
type CustomerListItem = {
  id: string; phone: string; name: string; provinceCode: string; provinceName: string
  orderCount: number; deliveredCount: number
  returnCount: number                // Đang hoàn + Đã hoàn
  totalSpent: number                 // Σ total đơn Đã giao (BR-21)
  lastOrderAt: string; tags: CustomerTag[]
}
type CustomerQuery = PaginationQuery & { tag?: CustomerTag; provinceCode?: string }
type CustomerDetail = CustomerListItem & {
  email?: string; wardCode: string; wardName: string; addressLine: string; note?: string
  cancelledCount: number; firstOrderAt: string; createdAt: string
}
type UpdateCustomerNoteRequest = { note?: string }
```

### 2.8. Tổng quan, báo cáo — `/api/reports`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/reports/dashboard/todo` | `orders.view` | Thẻ việc cần làm → `DashboardTodo` (FR-03) |
| GET | `/api/reports/dashboard/sales` | `reports.view` | Số liệu doanh thu → `DashboardSales` (FR-01, FR-02) |
| GET | `/api/reports/revenue` | `reports.view` | `DateRangeQuery` → `RevenueReport` (FR-37) |
| GET | `/api/reports/top-products` | `reports.view` | `TopProductsQuery` → `TopProductsReport` (FR-38) |
| GET | `/api/reports/order-status` | `reports.view` | `OrderStatusReportQuery` → `OrderStatusReport` (FR-39) |
| GET | `/api/reports/provinces` | `reports.view` | `DateRangeQuery` → `ProvinceReportRow[]`, nhiều đơn trước |
| GET | `/api/reports/coupons` | `reports.view` | `CouponReportQuery` → `CouponReportRow[]` |

```ts
type DateRangeQuery = { from: string; to: string }
type DashboardTodo = { choXacNhan: number; choThanhToan: number; choBanGiao: number; dangHoan: number; giaoCham: number; canHoanTien: number; asOf: string }
type SalesFigures = { netRevenue: number; orderValue: number; newOrders: number }
type LowStockItem = { productId: string; variantId: string; sku: string; productName: string; colorName: string; size?: string; stock: number }
type DashboardSales = {
  today: SalesFigures
  yesterdaySamePeriod: SalesFigures  // 00:00 tới cùng giờ của hôm qua
  cancelRate30d: number; returnRate30d: number
  series30d: { date: string; orderValue: number; netRevenue: number }[]
  topProducts30d: { productId: string; code: string; name: string; coverUrl?: string; quantity: number; netRevenue: number }[]
  lowStock: LowStockItem[]           // tồn 1–5
  outOfStock: LowStockItem[]         // tồn 0
  asOf: string
}
type RevenueTotals = { orderValue: number; netRevenue: number; orderCount: number; avgOrderValue: number }
type RevenueReport = {
  days: ({ date: string } & RevenueTotals)[]
  totals: RevenueTotals
  previous: RevenueTotals            // kỳ liền trước cùng độ dài
  previousDays: { date: string; orderValue: number; netRevenue: number }[]
}
type TopProductsQuery = DateRangeQuery & { categoryId?: string; groupBy?: TopProductGroupBy }
type TopProductRow = {
  key: string; productId: string; code: string; name: string
  sku?: string; colorName?: string; size?: string     // khi groupBy = variant
  quantity: number; netRevenue: number; share: number // share: % doanh thu thuần
}
type TopProductsReport = { groupBy: TopProductGroupBy; rows: TopProductRow[]; totalQuantity: number; totalNetRevenue: number }
type OrderStatusReportQuery = DateRangeQuery & { paymentMethod?: PaymentMethod }
type OrderStatusReport = {
  orderCount: number; cancelledCount: number; cancelRate: number
  returnCount: number; returnRate: number
  cancelReasons: { reason: CancelReason; count: number }[]
  failReasons: { reason: DeliveryFailReason; count: number }[]
  byPaymentMethod: { paymentMethod: PaymentMethod; orderCount: number; cancelRate: number; returnRate: number }[]
}
type ProvinceReportRow = { provinceCode: string; provinceName: string; orderCount: number; netRevenue: number; returnRate: number }
type CouponReportQuery = DateRangeQuery & { couponId?: string }
type CouponReportRow = { couponId: string; code: string; usedCount: number; discountTotal: number; orderValue: number }
```

Công thức số liệu ở §3.13. Xuất Excel (FR-40, P3) làm ở FE bằng `write-excel-file` từ dữ liệu đang xem, không có endpoint.

### 2.9. Demo — bổ sung cho `/api/demo`

Chỉ bật khi `DEMO_MODE=true` (tắt → 404).

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| POST | `/api/demo/simulate-order` | Đã đăng nhập | Giả lập một khách đặt đơn qua **đúng luồng đặt hàng công khai** (§4.2) → `SimulateOrderResult` |

```ts
type SimulateOrderResult = { code: string; total: number }
```

Đơn giả lập: khách ngẫu nhiên trong dữ liệu mẫu hoặc khách mới (tên, số điện thoại ngẫu nhiên hợp lệ, không trùng số test), 1–3 biến thể còn hàng (không lấy biến thể ở 06 §5.6), COD 70% / chuyển khoản 30%, không mã giảm giá, `clientRequestId` mới.

### 2.10. Cập nhật giữa các màn hình

Không có SignalR (SRS không yêu cầu thời gian thực).

- **Chế độ `api`**: danh sách đơn, số trên tab, thẻ việc cần làm hỏi lại mỗi 30 giây (`refetchInterval`) và khi tab hiện lại (`refetchOnWindowFocus`).
- **Chế độ `mock`**: `mockDb.subscribe` (`remote = true`) đã tự làm mới mọi query khi tab khác ghi. Ngoài ra handler gọi `publishShopEvent(tên, payload)` sau khi ghi; sự kiện đi qua `BroadcastChannel` khóa `retail-website-ban-hang:shop-events` tới các tab khác:

| Sự kiện | Payload | Tab quản trị làm gì |
| :--- | :--- | :--- |
| `order-created` | `{ orderId, code, status, total }` | Thông báo nổi "Đơn mới {mã} · {tổng}" có nút "Xem đơn" (chỉ người có `orders.view`) |
| `orders-changed` | `{ orderIds }` | Không cần làm gì thêm (đã làm mới qua `mockDb.subscribe`) |
| `catalog-changed` | `{ productIds }` | Như trên; tab cửa hàng làm mới sản phẩm, giỏ |

Kiểu payload: `ShopEventMap` trong `FE/src/types/shop.ts`.

### 2.11. Bản in phiếu giao

Không có endpoint riêng. Route group `app/(print)` có `AuthGuard` (quyền `orders.view` qua mục "Đơn hàng"), không sidebar, CSS `@page { size: 105mm 148mm; margin: 4mm }`, chữ ≥ 10 pt (NFR-07):

- `/admin/orders/[id]/print`: `GET /api/orders/{id}` + `GET /api/public/store`. Đầu phiếu: đơn vị vận chuyển (chữ lớn), mã vận đơn kèm mã vạch Code 128 (`jsbarcode`, SVG); mã đơn kèm mã vạch; người gửi (`Store.Name`, `Store.Hotline`, `Store.Address`); người nhận, số điện thoại **đầy đủ**, địa chỉ đầy đủ; danh sách sản phẩm (tên, màu/size, số lượng); khối lượng; **tiền thu hộ** chữ lớn (`codAmount`, BR-17); ghi chú cho shipper và ghi chú của khách; dòng "IN LẠI" khi `labelPrintCount > 0` lúc mở. In xong (sự kiện `afterprint`) gọi `POST label-printed`. Đơn chưa có vận đơn: phiếu vẫn in được, ô mã vận đơn ghi "Chưa bàn giao".
- `/admin/orders/print?ids=a,b,c` (P3): nhiều phiếu, mỗi phiếu một trang A6.
- Sau "Tạo vận đơn" FE mở bản in bằng `iframe` ẩn (không tab mới, tránh chặn cửa sổ bật lên); nút "In phiếu giao" ở chi tiết đơn mở tab mới.

### 2.12. Bảng mã lỗi nghiệp vụ

Lỗi 400/404/409/429 nghiệp vụ có trường mở rộng `code` trong ProblemDetails để FE rẽ nhánh mà không so chuỗi; `detail` đúng câu dưới đây (FE hiển thị nguyên văn). Lỗi validate theo trường dùng `errors` như `QUY-UOC-API.md` §1.3; khi chỉ có một lỗi thì `detail` là chính câu đó. Ở `checkout/quote`, lỗi mã giảm giá không ném ra mà nằm trong `coupon.errorCode`, `coupon.message`.

| `code` | HTTP | `detail` | Nơi phát sinh |
| :--- | :---: | :--- | :--- |
| `KhongTimThaySanPham` | 404 | Không tìm thấy sản phẩm | Chi tiết công khai |
| `KhongTimThayDanhMuc` | 404 | Danh mục không tồn tại | Danh sách công khai (UC-01 E2: FE chuyển về `/products`) |
| `GioHangTrong` | 400 | Giỏ hàng trống | Kiểm giỏ, tính tiền, đặt hàng (`errors.lines`) |
| `GioQuaNhieuDong` | 400 | Giỏ hàng tối đa 20 sản phẩm | Như trên (UC-03 E3) |
| `SanPhamNgungBan` | 409 | {tên sản phẩm} đã ngừng kinh doanh, vui lòng xóa khỏi giỏ | Đặt hàng; kèm `variantIds` |
| `GiaDaThayDoi` | 409 | Giá sản phẩm đã thay đổi, vui lòng kiểm tra lại rồi đặt hàng | Đặt hàng; kèm `priceChanges` (UC-04 E5) |
| `KhongDuTon` | 409 | {tên sản phẩm} – {màu} / {size} chỉ còn {n} sản phẩm (không size: "{tên} – {màu} chỉ còn {n} sản phẩm") | Đặt hàng, sửa đơn; kèm `stockIssues` (TC-17, TC-30) |
| `MaKhongTonTai` | 400 | Mã giảm giá không tồn tại | Mã giảm giá (§3.2) |
| `MaHetHan` | 400 | Mã đã hết hạn | TC-13 |
| `MaTamDung` | 400 | Mã đang tạm dừng | |
| `MaChuaApDung` | 400 | Mã chưa đến thời gian áp dụng | TC-41 |
| `MaHetLuot` | 400 | Mã đã hết lượt sử dụng | |
| `MaKhongApDungDanhMuc` | 400 | Mã chỉ áp dụng cho sản phẩm thuộc danh mục {tên danh mục} | |
| `ChuaDatToiThieu` | 400 | Đơn tối thiểu {số tiền} (mã theo danh mục: "Đơn tối thiểu {số tiền} cho sản phẩm danh mục {tên}") | TC-13 |
| `DaMienPhiVanChuyen` | 400 | Đơn đã được miễn phí vận chuyển | TC-13 |
| `SdtDaDungMa` | 400 | Số điện thoại này đã dùng mã {MÃ} | Đặt hàng, sửa đơn (TC-14) |
| `KhongTimThayDon` | 404 | Không tìm thấy đơn hàng | Tra cứu (TC-19), tự hủy, mọi API `/api/orders/{id}` (TC-26) |
| `TraCuuTamKhoa` | 429 | Bạn đã tra cứu sai quá 5 lần, vui lòng thử lại sau {n} phút | Tra cứu (BR-28); kèm `retryAfterSeconds` |
| `KhongTheTuHuy` | 400 | Đơn đã được shop xử lý, không tự hủy được. Vui lòng gọi hotline {hotline} | Tự hủy |
| `QuaNhieuYeuCau` | 429 | Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút | API công khai |
| `DonDaThayDoi` | 409 | Đơn vừa được {tên} cập nhật lúc {HH:mm}, vui lòng xem lại | Mọi thao tác đổi đơn khi lệch `version`; kèm `order` |
| `DonDaBiHuy` | 409 | Đơn đã bị hủy lúc {HH:mm} | Như trên khi đơn hiện tại `DaHuy` (UC-08 E4); kèm `order` |
| `TrangThaiKhongHopLe` | 400 | Thao tác không áp dụng cho đơn {trạng thái} | Thao tác sai trạng thái; kèm `currentStatus` |
| `KhongHuyDonDaBanGiao` | 400 | Không thể hủy đơn đã bàn giao vận chuyển | Hủy đơn từ `DangGiao` trở đi (TC-33) |
| `ChiSuaDonCod` | 400 | Chỉ sửa được đơn COD đang Chờ xác nhận | Sửa đơn (BR-15) |
| `KhongCanHoanTien` | 400 | Đơn không ở trạng thái Cần hoàn tiền | Hoàn tiền |
| `CanItNhatMotBienThe` | 400 | Sản phẩm cần ít nhất một biến thể | Lưu sản phẩm (UC-06 E3) |
| `SanPhamDaCoTrongDon` | 400 | Sản phẩm đã có trong đơn hàng, không xóa được. Hãy dùng Ẩn | Xóa sản phẩm (TC-23) |
| `BienTheDaCoTrongDon` | 400 | Biến thể {SKU} đã có trong đơn hàng, không xóa được. Hãy tắt biến thể | Lưu sản phẩm bỏ màu, size; kèm `skus` |
| `DanhMucConSanPham` | 400 | Danh mục đang có {n} sản phẩm, chuyển sản phẩm sang danh mục khác trước | Xóa danh mục |
| `MaDaCoLuotDung` | 400 | Mã đã có lượt dùng, không xóa được. Hãy tạm dừng | Xóa mã (BR-26) |

Câu theo trường (`errors`): thông tin giao hàng (BR-07, TC-15) "Họ tên từ 2 đến 100 ký tự", "Số điện thoại không hợp lệ", "Email chưa đúng định dạng", "Vui lòng chọn tỉnh/thành", "Vui lòng chọn phường/xã", "Địa chỉ chi tiết từ 5 đến 200 ký tự", "Ghi chú tối đa 500 ký tự"; số lượng "Số lượng từ 1 đến 10"; mã giao dịch (TC-28) để trống "Nhập mã giao dịch ngân hàng", sai dạng "Mã giao dịch gồm 6–30 chữ và số"; lý do hủy, giao thất bại để trống "Chọn lý do", `Khac` thiếu ghi chú "Nhập ghi chú cho lý do Khác"; khối lượng (TC-36) "Khối lượng từ 50 đến 30.000 g"; tồn mới (TC-24) "Tồn mới là số nguyên từ 0"; lý do điều chỉnh tồn "Chọn lý do"; ghi chú nội bộ "Nhập ghi chú, tối đa 500 ký tự".

---

## 3. Công thức và quy tắc (nguồn sự thật chung của BE, FE và mock)

FE tính tại chỗ để giỏ, trang thanh toán phản hồi ngay bằng `features/sales/lib/pricing.ts`; handler mock dùng lại chính hàm đó; BE tính trong `OrderPricing`, `CouponRules` (Domain). Mọi số tiền là số nguyên đồng.

### 3.1. Tạm tính, tổng (BR-05)

```
lineTotal  = unitPrice × quantity                       // quantity nguyên 1–10, ≤ tồn (BR-03)
subtotal   = Σ lineTotal
discount   = §3.2, luôn ≤ subtotal
shippingFee, shippingDiscount = §3.3
total      = subtotal − discount + shippingFee
freeShipRemaining = max(0, 499.000 − (subtotal − discount))
```

### 3.2. Mã giảm giá (BR-08, BR-09)

Khách nhập không phân biệt hoa thường (BE và FE `trim().toUpperCase()`). `eligible` = Σ `lineTotal` của dòng thuộc phạm vi (mọi dòng nếu mã toàn shop; dòng có sản phẩm thuộc `categoryId` nếu mã theo danh mục). Kiểm theo thứ tự, gặp lỗi đầu tiên thì dừng (mã lỗi §2.12):

1. Không có mã chưa xóa → `MaKhongTonTai`.
2. `now > endAt` → `MaHetHan`.
3. `isPaused` → `MaTamDung`.
4. `now < startAt` → `MaChuaApDung`.
5. `totalLimit` có và `usedCount ≥ totalLimit` → `MaHetLuot`.
6. Mã theo danh mục và `eligible = 0` → `MaKhongApDungDanhMuc`.
7. `eligible < minOrder` → `ChuaDatToiThieu`.
8. `MienPhiVanChuyen` và `subtotal ≥ 499.000` (đơn đã được miễn phí theo BR-06) → `DaMienPhiVanChuyen`.
9. Chỉ lúc đặt hàng, sửa đơn: số đơn **chưa hủy** của cùng số điện thoại có mã này (sửa đơn thì trừ chính đơn đó) `≥ perCustomerLimit` → `SdtDaDungMa`.

Tiền giảm:

```
PhanTram:          discount = min(floor(eligible × value / 100 / 1.000) × 1.000, maxDiscount)
SoTien:            discount = min(value, eligible)
MienPhiVanChuyen:  discount = 0; phí vận chuyển về 0 (§3.3)
discount = min(discount, subtotal)
```

### 3.3. Phí vận chuyển (BR-06)

```
fee = 20.000 nếu tỉnh có zone = TpHcm, 35.000 nếu TinhKhac; chưa chọn tỉnh → 0 và FE ghi "Chọn tỉnh/thành để tính phí"
shippingFee = (subtotal − discount ≥ 499.000) ? 0 : fee
nếu mã MienPhiVanChuyen hợp lệ: shippingDiscount = shippingFee; shippingFee = 0      // ngược lại shippingDiscount = 0
```

Mã phần trăm hoặc số tiền có thể làm mất miễn phí vận chuyển (TC-11). Giỏ hàng chưa có tỉnh: chỉ hiện dải "Mua thêm X ₫ để được miễn phí vận chuyển" theo `freeShipRemaining` hoặc "Đơn được miễn phí vận chuyển" khi bằng 0.

### 3.4. Kiểm lại giỏ (BR-03, BR-04)

Mỗi dòng, theo thứ tự: biến thể không có hoặc tắt → `BienTheDaTat` "Mẫu này tạm ngừng bán"; sản phẩm ẩn → `NgungKinhDoanh` "Sản phẩm ngừng kinh doanh"; tồn 0 → `HetHang` "Hết hàng"; `quantity > stock` → `KhongDuTon` "Chỉ còn {n} sản phẩm"; giá gửi lên khác giá hiện tại → `GiaDaDoi` "Giá đã đổi từ {cũ} thành {mới}" (không chặn, tạm tính dùng giá mới, TC-06). `maxQuantity = min(10, stock)`. `canCheckout` = có ít nhất một dòng và không dòng nào có vấn đề khác `GiaDaDoi`. Quá 20 dòng → lỗi `GioQuaNhieuDong`.

### 3.5. Vòng đời đơn, tồn kho, lượt mã (BR-11, BR-13, BR-14, BR-16, BR-19)

| Thao tác | Từ | Sang | Tồn | Lượt mã | Thanh toán, khác |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Đặt COD | — | `ChoXacNhan` | − số lượng | +1 | `ChuaThanhToan` |
| Đặt chuyển khoản | — | `ChoThanhToan` | − số lượng | +1 | `ChuaThanhToan`, `paymentDueAt = placedAt + 24 giờ` |
| Xác nhận | `ChoXacNhan` | `DaXacNhan` | | | |
| Xác nhận đã nhận tiền | `ChoThanhToan` | `DaXacNhan` | | | `DaThanhToan`, `transactionRef`, `paidAt` |
| Sửa đơn | `ChoXacNhan` (COD) | giữ nguyên | ± chênh lệch | kiểm lại; không hợp lệ thì gỡ, −1 | Tính lại tiền (BR-15) |
| Hủy (nhân viên) | `ChoThanhToan`, `ChoXacNhan`, `DaXacNhan` | `DaHuy` | + số lượng | −1 | Đã thanh toán → `CanHoanTien`, `refundAmount = total` |
| Khách tự hủy | `ChoThanhToan`, `ChoXacNhan` | `DaHuy` | + số lượng | −1 | Người làm "Khách" |
| Hệ thống tự hủy | `ChoThanhToan` và `now ≥ paymentDueAt` | `DaHuy` | + số lượng | −1 | Lý do `QuaHanThanhToan`, người "Hệ thống", `cancelledAt = paymentDueAt` |
| Bàn giao vận chuyển | `DaXacNhan` | `DangGiao` | | | Tạo vận đơn, `codAmount` (BR-17) |
| Đã giao | `DangGiao` | `DaGiao` | | | COD → `DaThanhToan`, `paidAt`; `deliveredAt`; `SoldCount` + số lượng |
| Giao thất bại | `DangGiao` | `DangHoan` | | | `failReason` |
| Đã nhận hàng hoàn | `DangHoan` | `DaHoan` | + số lượng | không trả | Đơn chuyển khoản giữ `DaThanhToan` (§5 quyết định 12) |
| Đã hoàn tiền | `DaHuy` + `CanHoanTien` | giữ nguyên | | | `DaHoanTien`, `refundRef`, `refundedAt` |

- Hủy từ `DangGiao` trở đi → `KhongHuyDonDaBanGiao`; thao tác khác sai trạng thái → `TrangThaiKhongHopLe`.
- `allowedActions` theo trạng thái: `ChoThanhToan` [`ConfirmPayment`, `Cancel`]; `ChoXacNhan` [`Confirm`, `Edit`, `Cancel`]; `DaXacNhan` [`Ship`, `Cancel`, `PrintLabel`]; `DangGiao` [`Deliver`, `DeliveryFailed`, `PrintLabel`]; `DangHoan` [`ReceiveReturn`, `PrintLabel`]; `DaGiao`, `DaHoan` [`PrintLabel`]; `DaHuy` [`Refund`] khi `CanHoanTien`, còn lại []. Ghi chú nội bộ được ở mọi trạng thái.
- Mỗi thao tác ghi sự kiện (§3.10), tính lại thống kê khách (06 §4 `Crm_Customers`), tăng `version`, trong một transaction.
- **Quét quá hạn thanh toán**: BE chạy `OverduePaymentJob` mỗi 5 phút và gọi `IOrderWorkflow.SweepOverdue(now)` ở đầu mọi API đọc, ghi đơn (rẻ: lọc `Status = ChoThanhToan AND PaymentDueAt <= now` có index). Mock gọi cùng hàm ở đầu mọi handler có đọc đơn.
- Khách: tạo đơn mới tìm khách theo số điện thoại; chưa có thì tạo; có thì cập nhật tên, email (nếu nhập), địa chỉ theo đơn mới nhất (FR-34, TC-42).

### 3.6. Phiên bản đơn (chống ghi đè)

`OrderDetailDto.version` tăng 1 ở mọi thay đổi của đơn (gồm ghi chú, in phiếu, tự hủy, khách hủy). Thao tác đổi trạng thái và sửa đơn gửi kèm `version` đang thấy:

- Lệch và đơn hiện tại `DaHuy` → 409 `DonDaBiHuy` "Đơn đã bị hủy lúc {HH:mm}" kèm `order`.
- Lệch, trạng thái khác → 409 `DonDaThayDoi` kèm `order` (tên = người của sự kiện mới nhất).
- FE thay cache bằng `order` trong lỗi, hiện câu `detail`, nhân viên xem lại rồi bấm lại.
- `version` vắng (gọi từ Swagger, TC-33) → không kiểm, chỉ kiểm trạng thái.
- BE: `Version` là concurrency token; tranh chấp lúc lưu (`DbUpdateConcurrencyException`) xử lý như lệch `version`.

### 3.7. Đặt hàng một lần (NFR-05)

FE sinh `clientRequestId` bằng `crypto.randomUUID()` khi mở trang thanh toán, giữ nguyên khi bấm lại hoặc thử lại sau lỗi mạng, đổi mới khi giỏ, thông tin giao hàng, phương thức hoặc mã đổi, và sau mỗi lỗi nghiệp vụ (`GiaDaThayDoi`, `KhongDuTon`, `SdtDaDungMa`…). Nút "Đặt hàng" khóa trong lúc chờ. BE: `ClientRequestId` unique; tìm thấy → 200 `PlaceOrderResult` của đơn đó, `duplicate = true`; hai request cùng mã tới đồng thời thì request sau gặp unique index, BE đọc lại và trả kết quả của request trước. Mock lưu `clientRequestId` trên bản ghi đơn.

### 3.8. Trạng thái suy ra, nhãn, sắp xếp

- Biến thể (BR-02): tồn 0 `HetHang`, 1–5 `SapHet`, > 5 `ConHang`. Sản phẩm (danh sách quản trị): mọi biến thể bật tồn 0 → `HetHang`; có biến thể bật tồn ≤ 5 → `SapHet`; còn lại `ConHang`. `isOutOfStock` ở cửa hàng = mọi biến thể bật tồn 0.
- `discountPercent = round((listPrice − price) / listPrice × 100)` (BR-01): 159.000 / 199.000 → 20.
- Nhãn đơn (tính lúc đọc, cả lọc `label`):
  - `TrungSdt` (BR-20): đơn `ChoThanhToan` hoặc `ChoXacNhan` và có đơn khác cùng số điện thoại cũng ở hai trạng thái đó, đặt cách nhau ≤ 24 giờ. `duplicateOrders` liệt kê các đơn đó. Một đơn được xác nhận hoặc hủy thì nhãn ở đơn còn lại tự mất (UC-09 1b).
  - `GiaoCham` (BR-18): `DangGiao` và `now − handedOverAt > 5 ngày`.
  - `KhachCanLuuY` (BR-21): khách có `returnCount ≥ 2` và đơn đang `ChoThanhToan`, `ChoXacNhan` hoặc `DaXacNhan`. Chi tiết đơn hiện cảnh báo vàng "Khách có {n} đơn hoàn hàng" mọi khi `customer.returnCount ≥ 2`.
- Nhãn khách: `KhachVip` khi `totalSpent ≥ 5.000.000`, `CanLuuY` khi `returnCount ≥ 2`.
- Sắp xếp danh sách đơn: `sortBy` ∈ `placedAt`, `total`, `code`; vắng thì `placedAt` tăng dần khi lọc `ChoThanhToan`, `ChoXacNhan`, `DaXacNhan` (đơn chờ lâu nhất lên trên, UC-07), còn lại giảm dần.
- Sắp xếp cửa hàng: `newest` = `createdAt` giảm dần, sản phẩm `isOutOfStock` xếp cuối (BR-02); `bestselling` = `soldCount` giảm dần; `priceAsc`, `priceDesc` theo `price`; cùng giá trị thì theo `sortOrder`. Lọc: sản phẩm khớp khi có **một biến thể bật** cùng lúc thỏa màu (nếu chọn), size (nếu chọn), tồn > 0 (nếu bật "Chỉ hiện còn hàng") (UC-01 bước 4). `facets` tính trên danh mục (và từ khóa) trước khi lọc màu, size, giá.

### 3.9. Mã đơn, mã vận đơn, QR, che thông tin

- Mã đơn (BR-10): `DH` + `yyMMdd` (ngày đặt giờ Việt Nam) + 4 số, số = (số lớn nhất đã có trong ngày) + 1.
- Mã vận đơn (BR-17): tiền tố `GHN` | `GHTK` | `VTP` | `JT` + `yyMMdd` (ngày bàn giao) + 4 số thứ tự trong ngày của đơn vị đó, vd `GHTK2610150003`. Khối lượng gợi ý = 300 g × tổng số lượng + 100 g, làm tròn tới 50 g (UC-10 bước 2); đơn vị mặc định = đơn vị lần trước (localStorage `retail-website-ban-hang:last-carrier`).
- QR chuyển khoản giả lập (BR-12): chuỗi `VIETQR|{bankBin}|{bankAccount}|{amount}|{mã đơn}`, FE vẽ bằng gói `qrcode` (mức sửa lỗi M). Tên ngân hàng tra theo BIN trong `features/sales/lib/vietqr.ts` (`970422` → `MB Bank`, `970436` → `Vietcombank`, `970407` → `Techcombank`, `970418` → `BIDV`, `970415` → `VietinBank`, `970405` → `Agribank`, `970416` → `ACB`, khác → `Ngân hàng {BIN}`); BE dùng cùng bảng.
- Che số điện thoại (BR-28): 3 số đầu + `****` + 3 số cuối, vd `0901000001` → `090****001`. Trang tra cứu chỉ có phường/xã, tỉnh/thành; không có ghi chú nội bộ, tên nhân viên.

### 3.10. Chữ trên dòng thời gian

| Thao tác | Sự kiện (người làm) | Tin gửi khách (`TinGuiKhach`, người "Hệ thống") | Trang tra cứu (`PublicTimelineItem.text`) |
| :--- | :--- | :--- | :--- |
| Đặt COD | `DoiTrangThai` → `ChoXacNhan` "Đặt hàng qua website" (Khách) | "Đã gửi SMS xác nhận đơn (giả lập)"; có email thêm "Đã gửi email xác nhận đơn tới {email} (giả lập)" | Đặt hàng thành công, chờ shop xác nhận |
| Đặt chuyển khoản | → `ChoThanhToan` "Đặt hàng qua website, hạn thanh toán {HH:mm dd/MM}" (Khách) | "Đã gửi SMS hướng dẫn chuyển khoản (giả lập)" (+ email như trên) | Đặt hàng thành công, chờ chuyển khoản |
| Xác nhận | `ChoXacNhan` → `DaXacNhan` "{ghi chú}" hoặc rỗng | "Đơn đã được xác nhận (SMS giả lập)" | Shop đã xác nhận đơn |
| Xác nhận tiền | `ChoThanhToan` → `DaXacNhan` "Đã nhận tiền chuyển khoản, mã giao dịch {mã}" | "Đã nhận tiền, đơn đã được xác nhận (SMS giả lập)" | Shop đã nhận tiền và xác nhận đơn |
| Sửa đơn | `SuaDon` "Sửa đơn: {các thay đổi, ngăn bằng '; '}" | | Shop đã cập nhật đơn theo yêu cầu của bạn |
| Hủy | → `DaHuy` "{tên lý do}" hoặc "Khác: {ghi chú}"; đã thanh toán thêm " · Cần hoàn tiền {số tiền}" | "Đơn đã hủy (SMS giả lập)" | Đơn đã hủy: {tên lý do} |
| Bàn giao | `DaXacNhan` → `DangGiao` "Bàn giao {đơn vị}, mã vận đơn {mã}, {khối lượng} g" (khối lượng có dấu chấm ngăn nghìn, vd 1.200 g) | "Đơn đã giao cho {đơn vị}, mã vận đơn {mã} (SMS giả lập)" | Đã giao cho {đơn vị}, mã vận đơn {mã} |
| Đã giao | → `DaGiao` "Giao hàng thành công" | "Giao hàng thành công, cảm ơn quý khách (SMS giả lập)" | Giao hàng thành công |
| Giao thất bại | → `DangHoan` "Giao thất bại: {lý do}" hoặc "Giao thất bại: Khác: {ghi chú}" | | Giao hàng không thành công, đơn đang hoàn về shop |
| Nhận hàng hoàn | → `DaHoan` "Đã nhận hàng hoàn về kho" | | Đơn đã hoàn về shop |
| Hoàn tiền | `HoanTien` "Đã hoàn tiền {số tiền}, mã giao dịch {mã}" | | Shop đã hoàn tiền {số tiền} |
| Ghi chú nội bộ | `GhiChuNoiBo` "{nội dung}" | | (không hiện) |

Thay đổi khi sửa đơn: dòng đổi số lượng "{nhãn} {cũ} → {mới}"; dòng thêm "Thêm {nhãn} × {n}"; dòng bỏ "Bỏ {nhãn}"; đổi người nhận, số điện thoại hoặc địa chỉ "Đổi thông tin nhận hàng"; mã bị gỡ "Gỡ mã {MÃ}". `{nhãn}` = "{màu}/{size}" (không size: "{màu}"); nếu đơn có hai dòng cùng nhãn thì thêm tên sản phẩm phía trước. TC-29: "Sửa đơn: Trắng/M 2 → 4". Trong cùng thời điểm, `DoiTrangThai` đứng trước `TinGuiKhach` (`Seq`).

### 3.11. Số tính sẵn cho test

| Ca | Phép tính | Kết quả |
| :--- | :--- | ---: |
| TC-05 bước 1, demo bước 3 | 2 × 159.000 = 318.000; 499.000 − 318.000 | tạm tính **318.000**, còn thiếu **181.000** |
| TC-05 bước 2 | 318.000 + 389.000 | **707.000**, miễn phí vận chuyển |
| TC-06 | 2 × 169.000 = 338.000; 499.000 − 338.000 | **338.000**, còn thiếu **161.000** |
| TC-08 | 318.000 + 20.000 (TP.HCM) | **338.000** |
| TC-09, demo bước 4 | 707.000 × 10% = 70.700 → 70.000 → tối đa 50.000; 657.000 ≥ 499.000 nên phí 0 | **657.000** |
| TC-10 | 318.000 × 10% = 31.800 → 31.000; 287.000 < 499.000 nên phí 35.000 | **322.000** |
| TC-11 trước mã | 389.000 + 129.000 = 518.000 ≥ 499.000, phí 0 | **518.000** |
| TC-11 sau mã | 518.000 − 50.000 = 468.000 < 499.000, phí 35.000 | **503.000** |
| TC-12 | trước 389.000 + 35.000 = **424.000**; sau `FREESHIP` phí 0 (`shippingDiscount` 35.000) | **389.000** |
| TC-13 | `HETHAN` → bước 2; 318.000 < 500.000 → bước 7; 707.000 + `FREESHIP` → bước 8; 159.000 < 200.000 → bước 7 | 4 câu lỗi |
| TC-14 bước 3–4 | gỡ `GIAM10`: 707.000, phí 0 | **707.000** |
| TC-16 | 389.000 + 20.000 | **409.000** |
| TC-29 | 4 × 159.000 = 636.000 ≥ 499.000, phí 0 | **636.000** |
| TC-31 | như TC-09 | **657.000** |
| TC-32 | 129.000 + 20.000 | **149.000** |
| TC-37 | doanh thu thuần đơn TC-08 = 338.000 − 20.000 | **318.000** |
| TC-21 | (350.000 − 299.000) / 350.000 = 14,57% | **−15%** |
| TC-03 | (199.000 − 159.000) / 199.000 = 20,1% | **−20%** |

### 3.12. Lưới biến thể khi lưu sản phẩm (FR-18, BR-23, BR-24)

- Lưới = `colorIds × sizes` (không size: một biến thể mỗi màu). `variants` gửi lên phải đúng lưới (thiếu, thừa → 400 `errors.variants` "Lưới biến thể không khớp màu và size").
- Biến thể đã có (cùng màu, size) giữ `id`, `sku`, `stock`; chỉ đổi `isActive`. Biến thể mới: `sku` theo BR-24, `stock = initialStock ?? 0`. SKU trùng với sản phẩm khác → 409 `errors.variants` "SKU {sku} đã tồn tại".
- Biến thể cũ không còn trong lưới: chưa có trong đơn thì xóa cứng; đã có → 400 `BienTheDaCoTrongDon`.
- Đổi mã sản phẩm khi đã có biến thể trong đơn → `errors.code` "Sản phẩm đã có trong đơn, không đổi mã được" (SKU cũ đã in trên phiếu); chưa có thì sinh lại SKU.
- Slug (BR-24): bỏ dấu (đ → d), chữ thường, ký tự khác chữ số thành `-`, gộp `-` liên tiếp, bỏ `-` đầu cuối; trùng thì thêm `-2`, `-3`. "Áo sơ mi linen" → `ao-so-mi-linen` (TC-21).

### 3.13. Số liệu tổng quan, báo cáo (BR-22)

- **Doanh thu thuần** ngày D = Σ (`subtotal` − `discount`) của đơn `DaGiao` có `deliveredAt` thuộc ngày D (giờ Việt Nam). Không gồm phí vận chuyển.
- **Giá trị đặt hàng** ngày D = Σ `total` của đơn đặt trong ngày D, trừ đơn `DaHuy` (trạng thái hiện tại). **Số đơn** (báo cáo doanh thu) cùng cơ sở; **giá trị trung bình** = giá trị đặt hàng / số đơn, làm tròn tới đồng (0 khi không có đơn).
- **Số đơn mới** (Tổng quan) = mọi đơn đặt trong kỳ, kể cả đã hủy (TC-39).
- **Tỉ lệ hủy** = đơn `DaHuy` / đơn đặt trong kỳ. **Tỉ lệ hoàn** = (`DangHoan` + `DaHoan`) / (`DaGiao` + `DangHoan` + `DaHoan`), cùng tập đơn đặt trong kỳ. Phần trăm làm tròn 1 chữ số thập phân; mẫu số 0 → 0.
- Tổng quan: `today` từ 00:00 hôm nay tới `now`; `yesterdaySamePeriod` từ 00:00 hôm qua tới cùng giờ hôm qua; 30 ngày = 29 ngày trước + hôm nay. Thẻ việc cần làm: `choXacNhan`, `choThanhToan`, `choBanGiao` (= `DaXacNhan`), `dangHoan`, `giaoCham` (nhãn `GiaoCham`), `canHoanTien` (`DaHuy` + `CanHoanTien`); thẻ mở `/admin/orders?status=…` (giao chậm thêm `&label=GiaoCham`, cần hoàn tiền `?status=DaHuy&paymentStatus=CanHoanTien`).
- Top sản phẩm, báo cáo bán chạy: dòng của đơn `DaGiao` có `deliveredAt` trong kỳ; `quantity` = Σ số lượng; `netRevenue` dòng = `lineTotal` − phần giảm giá phân bổ. Phân bổ: chia `discount` cho các dòng thuộc phạm vi mã theo tỉ lệ `lineTotal`, làm tròn xuống tới đồng, dòng thuộc phạm vi cuối cùng (theo thứ tự dòng) nhận phần dư. `share` = `netRevenue` / tổng × 100, 1 chữ số thập phân. Sắp `netRevenue` giảm dần (Tổng quan: `quantity` giảm dần, lấy 5).
- Báo cáo tình trạng đơn: tập đơn đặt trong kỳ (lọc thêm `paymentMethod`); lý do hủy từ đơn `DaHuy`, lý do giao thất bại từ vận đơn có `failReason`. Theo tỉnh: `orderCount` = đơn đặt trong kỳ, `netRevenue` = doanh thu thuần của đơn giao trong kỳ, `returnRate` như trên. Báo cáo mã: đơn đặt trong kỳ có mã, chưa hủy; `discountTotal` = Σ (`discount` + `shippingDiscount`), `orderValue` = Σ `total`.
- Kỳ liền trước: cùng số ngày, kết thúc ngay trước `from`.

---

## 4. Quy ước riêng cho FE

### 4.1. Đường dẫn, menu, trang sau đăng nhập

- **Menu sidebar** (`config/routes/main.routes.ts`, đã khai báo): Tổng quan `/dashboard` (`dashboard.view`), Đơn hàng `/admin/orders` (`orders.view`), Sản phẩm `/admin/products` (`products.view`), Mã giảm giá `/admin/coupons` (`coupons.view`), Khách hàng `/admin/customers` (`customers.view`), Báo cáo `/admin/reports` (`reports.view`), Xem cửa hàng `/` (mở tab mới), rồi nhóm Cài đặt của nền. Trang ẩn trong `hidden.routes.ts`: Thêm sản phẩm (`products.create`), In nhiều phiếu (`orders.ship`).
- **Trang sau đăng nhập**: `homeAfterLogin = /dashboard`; mọi vai trò nghiệp vụ có `dashboard.view` nên đều vào Tổng quan (UC-12 bước 1). Nhân viên gõ `/admin/reports` → `/forbidden` (TC-40).
- **Cửa hàng** nằm ở route group `app/(shop)/` với `layout.tsx` riêng (`ShopHeader`, `ShopFooter`, không `AuthGuard`, không sidebar, không `DemoToolbar` mặc định): `page.tsx` (`/`, **thay** `app/page.tsx` `RootRedirect` của nền, xóa file đó), `products/page.tsx`, `products/[slug]/page.tsx`, `cart/page.tsx`, `checkout/page.tsx`, `checkout/success/page.tsx`, `tra-cuu-don/page.tsx`. `/login` vẫn là trang nền.
- **Khu quản trị** ở `app/(protected)/dashboard`, `app/(protected)/admin/**`; **bản in** ở `app/(print)/admin/orders/[id]/print`, `app/(print)/admin/orders/print` (§2.11).
- **SEO** (NFR-04): `/`, `/products`, `/products/[slug]` render phía máy chủ qua `serverFetch` (`features/shop/services/shop.server.ts`, mock lấy từ seed bằng chính hàm chiếu của handler như demo Danh mục Demo); `generateMetadata` cho tiêu đề "{tên sản phẩm} | {Store.Name}", mô tả (160 ký tự đầu của mô tả), `openGraph.images` = ảnh đại diện (URL tuyệt đối), `alternates.canonical`; `app/sitemap.ts` (trang chủ, `/products`, `/products?category={slug}` từng danh mục, mọi sản phẩm đang bán), `app/robots.ts` (chặn `/admin/`, `/dashboard`, `/login`, `/settings/`, `/profile`, `/forbidden`, `/cart`, `/checkout`, `/tra-cuu-don`), `app/opengraph-image.tsx` (ảnh chia sẻ chung theo tên, màu cửa hàng); địa chỉ gốc `getSiteUrl()` chép từ demo Danh mục Demo (`NEXT_PUBLIC_SITE_URL`, trên Vercel đặt `https://pum-ban-hang.vercel.app`). `/cart`, `/checkout`, `/checkout/success`, `/tra-cuu-don` render phía trình duyệt, `robots: noindex`.

### 4.2. Trình diễn trên một trình duyệt (chế độ `mock` trên Vercel)

Người xem demo `https://pum-ban-hang.vercel.app` thường chỉ có một trình duyệt, không có BE. Dữ liệu mock nằm trong localStorage nên **mọi tab cùng trình duyệt thấy cùng dữ liệu**; vai trò đổi nhanh theo từng tab (nền). Luồng "khách đặt hàng → quản trị thấy đơn mới → xử lý → khách tra cứu thấy trạng thái" chạy bằng nhiều tab:

1. **Lối vào cửa hàng**:
   - Trang đăng nhập: thẻ **"Xem như khách mua hàng"** dưới các nút Đăng nhập nhanh: câu "Website bán hàng cho khách, không cần tài khoản", nút "Mở cửa hàng" mở **tab mới** `/`, dòng gợi ý "Đăng nhập Nhân viên ở tab này để nhận đơn". Hiện ở cả hai chế độ.
   - Header khu quản trị: nút **"Xem cửa hàng"** (icon `Store`, tab mới `/`) qua `AppShell.headerActions`; menu cũng có mục "Xem cửa hàng".
   - Chi tiết đơn quản trị: nút "Xem như khách" mở tab mới `/tra-cuu-don?code={mã}` (số điện thoại tự điền vì cùng trình duyệt, xem bước 4).
2. **Đầu trang cửa hàng khi đang đăng nhập** (cùng trình duyệt có phiên quản trị): dải mỏng "Bạn đang xem cửa hàng như khách · Về trang quản trị" (`/dashboard`). Không đăng nhập thì không có dải này.
3. **Đơn mới hiện ngay ở tab quản trị**: `order-created` (§2.10) → thông báo nổi "Đơn mới {mã} · {tổng}" + nút "Xem đơn"; thẻ việc cần làm, số trên tab tự tăng (mock-db đồng bộ giữa tab).
4. **Tra cứu sau khi đặt**: trang thành công lưu `{ code, phone }` của các đơn đã đặt trong trình duyệt (localStorage `retail-website-ban-hang:my-orders`, tối đa 10); `/tra-cuu-don?code=` tự điền số điện thoại nếu khớp. Trang tra cứu đang mở tự làm mới khi mock-db đổi (nhân viên bấm "Bàn giao" ở tab kia thì tab khách thấy "Đang giao" ngay).
5. **Hai khách trong một trình duyệt** (TC-17): tham số `?khach=2` (hoặc 3…) ở bất kỳ trang cửa hàng gán cho **tab đó** một danh tính khách riêng, lưu sessionStorage (`retail-website-ban-hang:shop-identity`); giỏ, mã thiết bị, danh sách đơn của tab dùng khóa có hậu tố `:k{N}`. Không có tham số = khách 1. Liên kết nội bộ không cần mang tham số.
6. **`DemoToolbar` mục "Cửa hàng"** (thêm vào `components/demo/DemoToolbar.tsx`, hiện ở trang đã đăng nhập): "Mở cửa hàng" (tab mới), "Giả lập khách đặt đơn" (`POST /api/demo/simulate-order`, §2.9; mock gọi chính handler đặt hàng công khai).

Kịch bản gợi ý cho người xem một mình: tab 1 đăng nhập Nhân viên ở `/dashboard` → bấm "Xem cửa hàng" → tab 2 chọn sản phẩm, đặt COD → tab 1 hiện "Đơn mới DH…", thẻ Chờ xác nhận tăng 1 → xác nhận, bàn giao GHTK, in phiếu → tab 2 vào Tra cứu đơn thấy "Đang giao", mã vận đơn.

### 4.3. Cửa hàng (SCR-01…SCR-07)

- Thiết kế cho điện thoại 375–430 px trước (NFR-01): vùng chạm ≥ 44 px; trang chi tiết có thanh cố định cuối màn hình "Thêm vào giỏ" + "Mua ngay"; giỏ và thanh toán có thanh cố định "Đặt hàng" kèm tổng. Desktop: lưới 4 cột, bộ lọc cột trái; điện thoại: lưới 2 cột, bộ lọc trong `Drawer` (`vaul`) với nút "Áp dụng". Ảnh `next/image` hoặc `<img loading="lazy">` WebP (NFR-02); ô ảnh tỉ lệ 4:5.
- **Đầu trang**: logo, `Store.Name`, ô tìm (gợi ý từ 2 ký tự, debounce 250 ms, tối đa 5 kèm ảnh, giá; Enter mở `/products?search=`), biểu tượng giỏ có số dòng, menu danh mục. **Chân trang**: hotline, email, địa chỉ, giờ làm việc, liên kết "Tra cứu đơn hàng", phí vận chuyển; dòng nhỏ "Website demo do {Company.Name} thực hiện" lấy từ cài đặt công khai `Company.*` của nền (không viết cứng).
- **Danh sách** `/products`: mọi bộ lọc, sắp xếp, trang ghi trên URL (`category`, `search`, `minPrice`, `maxPrice`, `colors`, `sizes`, `inStock=1`, `sort`, `page`) để gửi link (TC-01). Điện thoại tải thêm khi cuộn tới cuối (UC-01 4a), vẫn ghi `page` lên URL; desktop có phân trang. Trống: "Không tìm thấy sản phẩm phù hợp", nút "Xóa bộ lọc", gợi ý `home.featured` (TC-02).
- **Chi tiết**: bộ ảnh (tối đa 8, chạm phóng to bằng `Dialog`, vuốt bằng `embla-carousel-react`); chọn màu đổi ảnh sang ảnh của màu (UC-02 bước 2); nút size hết hàng gạch chéo, không chọn được (TC-03); tình trạng theo BR-02 "Chỉ còn {n} sản phẩm"; chưa chọn đủ: nút khóa, câu "Vui lòng chọn size" (hoặc "Vui lòng chọn màu", TC-04); số lượng dừng ở `min(10, tồn, 10 − số đã có trong giỏ)`; một biến thể thì chọn sẵn (UC-02 1a); bảng size trong `Dialog`; "Mua ngay" thêm vào giỏ rồi sang `/checkout`. Sản phẩm ẩn: "Sản phẩm ngừng kinh doanh" + `related`.
- **Giỏ** lưu localStorage khóa `retail-website-ban-hang:cart` (`CartStorage`, hậu tố `:k{N}` ở §4.2 bước 5), bỏ khi `updatedAt` quá 30 ngày (BR-04); thêm cùng biến thể cộng dồn tới tối đa 10; quá 20 dòng báo "Giỏ hàng tối đa 20 sản phẩm". Mở giỏ, mở thanh toán gọi `cart/check`; dòng `GiaDaDoi` hiện `issueText` và cập nhật giá lưu; dòng chặn đánh dấu đỏ, nút "Đặt hàng" khóa (TC-07). Đổi màu, size trên dòng: trùng biến thể với dòng khác thì gộp (UC-03 4a).
- **Thanh toán** (một trang, NFR-03): khung thông tin giao hàng (ô điện thoại `inputMode="tel"`; tỉnh/thành, phường/xã dạng `Combobox` có tìm không dấu, TP.HCM và Hà Nội đầu danh sách), phương thức, mã giảm giá ("Áp dụng", "Gỡ"), tóm tắt. Tính tại chỗ bằng `pricing.ts` khi đổi tỉnh, số lượng; bấm "Áp dụng" mã thì gọi `checkout/quote` và hiện "Giảm giá ({MÃ}) −{số tiền}" hoặc câu lỗi (TC-13). Lỗi khi đặt: `SdtDaDungMa` → gỡ mã, tính lại, hiện câu, chờ bấm lại (TC-14); `KhongDuTon`, `SanPhamNgungBan` → về `/cart` với dòng đỏ (TC-17); `GiaDaThayDoi` → cập nhật giá giỏ, hiện câu, chờ bấm lại; lỗi trường gắn dưới ô, giữ dữ liệu (TC-15). Thông tin giao hàng nhớ ở localStorage `retail-website-ban-hang:shipping` để lần sau điền sẵn.
- **Thành công** `/checkout/success?code=`: đọc `PlaceOrderResult` từ sessionStorage `retail-website-ban-hang:last-order`; không có (mở link trực tiếp) thì chỉ hiện mã đơn và nút "Tra cứu đơn". COD: câu "Shop sẽ gọi xác nhận trong giờ làm việc {Store.WorkingHours}". Chuyển khoản: QR (§3.9), ngân hàng, số tài khoản, chủ tài khoản, số tiền, nội dung = mã đơn, nút "Sao chép" cho số tài khoản và nội dung, hạn thanh toán (TC-16). Làm trống giỏ khi đặt thành công.
- **Tra cứu** `/tra-cuu-don`: ô mã đơn (chữ hoa), số điện thoại; kết quả: trạng thái, dòng thời gian, đơn vị vận chuyển, mã vận đơn, sản phẩm, tổng; đơn chờ chuyển khoản hiện lại QR; `canCancel` → nút "Hủy đơn" mở hộp chọn lý do (`publicCancelReasonLabels`), "Khác" bắt buộc ghi chú (TC-20). `TraCuuTamKhoa` hiện câu và khóa nút tới hết giờ.
- Mã thiết bị `X-Device-Id`: `crypto.randomUUID()` lưu `retail-website-ban-hang:device` (hậu tố `:k{N}`).
- Màu chủ đạo cửa hàng theo `Brand.PrimaryColor` (cơ chế `BrandThemeSync` của nền chạy cả ở `(shop)` layout).

### 4.4. Đơn hàng quản trị (SCR-11…SCR-13)

- Tối ưu 1366 × 768 (NFR-06). Thanh tab trạng thái theo `orderStatusTabs` + "Tất cả", số từ `status-counts`; mặc định tab `ChoXacNhan` (UC-07). Bộ lọc: tìm, khoảng ngày đặt, phương thức, tỉnh/thành, nhãn; đọc và ghi URL (thẻ Tổng quan mở đúng bộ lọc). Bảng 50 dòng: mã, thời điểm đặt, khách, số điện thoại, tỉnh, số sản phẩm, tổng, phương thức, nhãn (`StatusBadge`), ô chọn nhiều (P3: "Xác nhận", "Bàn giao", "In phiếu" hàng loạt).
- Chi tiết: cột trái thông tin khách (bấm số điện thoại là `tel:`), địa chỉ, dòng sản phẩm, tiền, thanh toán, ghi chú khách; cảnh báo vàng "Khách có {n} đơn hoàn hàng" + link lịch sử (TC-25); nhãn Trùng SĐT kèm link các đơn trùng; cột phải dòng thời gian + ô "Ghi chú nội bộ" (gợi ý nhanh `internalNoteSuggestions`). Nút thao tác theo `allowedActions` **và** quyền: Xác nhận đơn, Xác nhận đã nhận tiền (ô mã giao dịch), Sửa đơn (P2), Hủy đơn (hộp lý do `staffCancelReasons`, nút xác nhận khóa khi chưa chọn), Bàn giao vận chuyển (đơn vị, khối lượng gợi ý, ghi chú shipper, hiện tiền thu hộ), Đã giao (hỏi xác nhận, hiện tiền thu hộ), Giao thất bại, Đã nhận hàng hoàn, Đã hoàn tiền (chỉ `orders.refund`, TC-32), In phiếu giao. Mọi thao tác gửi `version`; lỗi 409 thay cache bằng `order` trong lỗi và hiện `detail`.
- Sửa đơn: hộp thoại chọn biến thể theo sản phẩm (tìm theo tên, mã, SKU), số lượng, người nhận, địa chỉ; mỗi thay đổi gọi `edit-preview` để hiện tổng mới, `couponMessage`, danh sách thay đổi; "Lưu" gọi `PUT`.
- Không có đơn khớp bộ lọc: trạng thái trống + "Xóa bộ lọc"; URL đơn không tồn tại: "Không tìm thấy đơn hàng" (TC-26).

### 4.5. Sản phẩm quản trị (SCR-09, SCR-10)

- `/admin/products`: tab Sản phẩm (bảng: ảnh, mã, tên, danh mục, giá, tổng tồn, số biến thể hết, trạng thái; lọc danh mục, trạng thái, tình trạng tồn; tìm tên, mã, SKU) và tab Danh mục (thêm, đổi tên, kéo thả, bật tắt hiển thị). Người chỉ có `products.view` (Nhân viên) xem được, không có nút thêm, sửa, xóa, điều chỉnh tồn.
- `/admin/products/new`, `/admin/products/[id]`: form mã, tên, slug (tự sinh, sửa được), danh mục, giá bán, giá gốc (hiện "−{n}%" xem trước), mô tả, bảng size (bảng nhập dòng, cột), nổi bật, ẩn; ảnh tối đa 8 (tải lên `POST /api/products/images`, kéo thả thứ tự, chọn ảnh đại diện, gắn màu); chọn màu (từ `/api/colors`, có "Thêm màu"), chọn size (nhóm nhanh S–XL, 26–32, hoặc "Không có size"); lưới biến thể màu × size: SKU, tồn (ô nhập cho biến thể mới, "Điền cùng số tồn"), công tắc bật/tắt; biến thể cũ có nút "Điều chỉnh tồn" (hộp tồn mới + lý do + ghi chú) và "Lịch sử tồn". Xóa sản phẩm, bỏ màu đã bán: hiện câu lỗi và gợi ý "Ẩn"/"Tắt" (TC-23).

### 4.6. Mã giảm giá, khách hàng, tổng quan, báo cáo (SCR-08, SCR-14…16)

- Mã giảm giá: bảng mã, tên, kiểu, giá trị, điều kiện, đã dùng / tổng lượt, hiệu lực, trạng thái; form theo §2.6 (ô `maxDiscount` hiện khi `PhanTram`, `value` ẩn khi `MienPhiVanChuyen`); chi tiết mã: số lượt, tổng tiền giảm, giá trị đơn, danh sách đơn. Công tắc tạm dừng/chạy lại.
- Khách hàng: bảng theo §2.7, lọc nhãn "Khách VIP", "Cần lưu ý"; `/admin/customers/[id]`: thông tin, thống kê, ghi chú (sửa khi có `customers.update`), lịch sử đơn (link sang chi tiết đơn).
- Tổng quan `/dashboard` (thay nội dung `app/(protected)/dashboard/page.tsx` của nền bằng `features/reports`): hàng thẻ việc cần làm (mọi người có `orders.view`, bấm mở danh sách lọc sẵn); với `reports.view`: thẻ doanh thu thuần, giá trị đặt hàng, số đơn mới hôm nay kèm mức tăng giảm so với cùng giờ hôm qua ("—" khi hôm qua bằng 0, UC-12 E1), tỉ lệ hủy, tỉ lệ hoàn 30 ngày; biểu đồ 30 ngày (`recharts`), top 5 sản phẩm, danh sách biến thể sắp hết và hết hàng (bấm mở sản phẩm).
- Báo cáo `/admin/reports`: tab Doanh thu (mặc định 30 ngày, đường kỳ trước làm nền), Sản phẩm bán chạy (theo sản phẩm, theo biến thể, lọc danh mục), Tình trạng đơn, Theo tỉnh/thành, Mã giảm giá; chọn nhanh 7 ngày, 30 ngày, Tháng này, Tháng trước, Tùy chọn (chặn > 366 ngày trước khi gọi); nút "Xuất Excel" (P3).
- Định dạng: tiền `formatVnd` (`657.000 ₫`), tỉ lệ một chữ số thập phân dấu phẩy + `%`, ngày giờ `formatDateTime`.

### 4.7. Phiếu giao (SCR-13)

Theo §2.11. Component mã vạch `features/orders/components/Barcode.tsx` (`jsbarcode` vẽ vào `<svg>`, Code 128, cao 40 px). Chữ đen trên nền trắng, không dùng màu thương hiệu.

### 4.8. Mock

- **Collection** (`mockDb.collection`, scope `business`): `categories`, `colors`, `products` (ảnh, biến thể lồng trong bản ghi), `stock-adjustments`, `coupons`, `customers`, `orders` (dòng, sự kiện, vận đơn lồng trong bản ghi), `seed-meta` (`{ seedNow }`). Kiểu bản ghi `*Record` trong `FE/src/types/shop.ts`. Tỉnh/thành đọc thẳng từ seed (chỉ đọc, không vào mock-db). Thông tin cửa hàng đọc `settingsDb` của nền (`@/mock/system-data`), id tài khoản bằng `userIdOf(username)`.
- **Seed**: `mockDb.registerSeed('demo-data', demoData)` và `mockDb.registerSeed('demo-day', vnDateKey(now))` (sang ngày mới theo giờ Việt Nam thì tự nạp lại, 06 §5.3). Suy ra trường đúng `06` §5 bằng `features/sales/lib/seed-expand.ts` (hàm thuần, dùng chung cho handler và `serverFetch` phía máy chủ), phát lại sự kiện qua **cùng hàm chuyển trạng thái** với handler (`order-workflow.ts`), tính tiền bằng `pricing.ts`, rồi chạy quét quá hạn.
- **Bộ nhớ đơn**: 775 đơn lịch sử (đơn có `d`, mọi sự kiện dạng số) dựng lại trong bộ nhớ từ seed và `seedNow` mỗi lần tải trang, **không** ghi localStorage; collection `orders` chỉ chứa đơn gần đây (đơn không có `d` hoặc có sự kiện `"n-N"`), đơn tạo trong phiên demo, và **bản sao đầy đủ** của đơn lịch sử nào bị sửa (ghi chú, in lại phiếu…). `allOrders()` = bộ nhớ ghép collection theo `id` (collection thắng). Đặt lại dữ liệu xóa collection và dựng lại bộ nhớ.
- Mã đơn, mã vận đơn sinh trong handler theo §3.9 trên `allOrders()`. Lỗi trả đúng ProblemDetails có `code` và trường mở rộng như §2.12 (`domain(detail, { code, … })`, `conflict`, `notFound` của `mock-errors.ts`; thêm hàm `tooMany(detail, extra)` trả 429 trong `features/sales/mock/errors.ts`).
- **API công khai ở mock**: handler không gọi `requirePermission`, không đọc phiên đăng nhập; `X-Device-Id` truyền bằng tham số hàm. Chặn tra cứu sai (BR-28) lưu localStorage `retail-website-ban-hang:lookup-guard:{deviceId}` `{ fails: string[], blockedUntil? }`.
- Sự kiện giữa các tab: `publishShopEvent` qua `BroadcastChannel` `retail-website-ban-hang:shop-events` (§2.10).
- Dữ liệu tạo trong phiên demo dùng `newId()`; dữ liệu seed dùng `stableId` theo `06` §5.2.

### 4.9. Chia việc FE (hai agent làm song song)

Đã viết sẵn, **dùng chung, không agent nào tự đổi cấu trúc** (cần đổi hợp đồng thì sửa 07 trước, báo bên kia): `src/types/shop.ts` (mọi DTO, enum, `*Record`, `ShopEventMap`, kiểu seed), `src/config/shop-labels.ts`, `src/config/permissions.ts`, `src/config/route-path.ts`, `src/config/routes/main.routes.ts`, `src/config/routes/hidden.routes.ts`, `src/config/api-routes.ts`, `src/config/setting-labels.ts`, `src/app/theme.css` (màu dự phòng `#1E40AF`), `src/mock/seed/*.json`, `scripts/generate-orders.mjs`, `package.json` (đã thêm `qrcode`, `@types/qrcode`, `jsbarcode`, `write-excel-file`, script `seed:orders`; đã `pnpm install`). Được **thêm** hằng mới vào các file config (nối cuối nhóm của mình), không sửa dòng của bên kia. Cần gói mới: FE-Cửa hàng thêm vào `package.json` (FE-Quản trị nhờ FE-Cửa hàng).

| | **FE-Cửa hàng** | **FE-Quản trị** |
| :--- | :--- | :--- |
| Màn hình | `/`, `/products`, `/products/[slug]`, `/cart`, `/checkout`, `/checkout/success`, `/tra-cuu-don` (SCR-01…07); SEO (`sitemap`, `robots`, `opengraph-image`); lối vào cửa hàng ở trang đăng nhập, header quản trị; mục "Cửa hàng" của `DemoToolbar`; thông báo "Đơn mới" ở khu quản trị | `/dashboard` (SCR-08), `/admin/products/**` (SCR-09, 10), `/admin/orders/**` (SCR-11, 12), phiếu giao `app/(print)/**` (SCR-13), `/admin/coupons` (SCR-14), `/admin/customers/**` (SCR-15), `/admin/reports` (SCR-16) |
| Thư mục feature sở hữu | `features/sales/` (lõi, xem dưới), `features/shop/` (trang công khai, giỏ, thanh toán, tra cứu, handler công khai) | `features/products/`, `features/orders/`, `features/coupons/`, `features/customers/`, `features/reports/` |
| Route `app/` | `app/(shop)/**`, `app/sitemap.ts`, `app/robots.ts`, `app/opengraph-image.tsx`; xóa `app/page.tsx` | `app/(protected)/admin/**`, `app/(protected)/dashboard/page.tsx` (thay nội dung), `app/(print)/**` |
| Collection mock-db sở hữu (khai báo, nạp seed) | **Tất cả** trong `features/sales/mock/` | Không khai báo collection; handler của mình (`features/*/mock/*.mock.ts`) đọc, ghi qua API của store và workflow |
| Handler mock | `features/shop/mock/` (`/api/public/*`, `/api/provinces`, `/api/demo/simulate-order`) | `features/products/mock/` (danh mục, màu, sản phẩm, ảnh, tồn), `features/orders/mock/`, `features/coupons/mock/`, `features/customers/mock/`, `features/reports/mock/` (tổng quan, báo cáo) |
| File nền được sửa | `features/auth/pages/LoginPage.tsx` (chèn thẻ "Xem như khách mua hàng"), `app/(protected)/layout.tsx` (nút "Xem cửa hàng" qua `headerActions`, gắn `ShopEventToaster`), `components/demo/DemoToolbar.tsx` (thêm một `Section`), `app/page.tsx` (xóa), `package.json` | Không sửa file nền ngoài trang dashboard; `features/audit-logs/audit-labels.ts` (thêm tên entity Product, Category, Color, Coupon, nối cuối) |

**Lõi `features/sales/` (FE-Cửa hàng viết, FE-Quản trị chỉ import).** Mốc 1, làm **trước tiên** để FE-Quản trị dùng được ngay:

| File | Xuất ra |
| :--- | :--- |
| `lib/rules.ts` | `SalesRules` (hằng số 06 §3: phí, ngưỡng, 24 giờ, 1–5, 10, 20, 30 ngày, 5 ngày, 5.000.000, 2, 50–30.000 g) |
| `lib/vn-time.ts` | `vnNow()`, `vnDateKey(iso)`, `vnStartOfDay(dateKey)`, `vnRange(from, to)`, `vnTime(iso)` ("HH:mm"), `addVnDays` (chép demo 03, 04) |
| `lib/pricing.ts` | `subtotalOf(lines)`, `shippingFeeFor(zone)`, `priceOrder({ lines, zone?, coupon? }) → PricingSummary`, `allocateDiscount(lines, discount, scopeCategoryId?)` (§3.1–3.3, §3.13) |
| `lib/coupon-rules.ts` | `couponStatus(c, now)`, `checkCoupon(c, ctx) → CouponCheck` (§3.2, câu lỗi §2.12) |
| `lib/stock.ts` | `stockStatus(n)`, `productStockStatus(variants)`, `discountPercent(price, listPrice)`, `skuOf(code, color, size?)`, `slugify(name)` (§3.8, §3.12) |
| `lib/order-rules.ts` | `allowedActions(order)`, `orderLabels(order, ctx)`, `customerTags(c)`, `isSlowDelivery(order, now)`, `maskPhone(p)`, `netRevenueOf(order)` (§3.5, §3.8, §3.9) |
| `lib/order-text.ts` | Chữ dòng thời gian, `publicTimeline(order)`, `describeEditChanges(before, after)` (§3.10) |
| `lib/codes.ts` | `nextOrderCode(orders, now)`, `nextTrackingCode(orders, carrier, now)`, `suggestWeight(lines)` (§3.9) |
| `lib/vietqr.ts` | `bankNameOf(bin)`, `vietQrPayload(store, amount, code)` |
| `lib/seed-expand.ts` | Suy ra bản ghi từ seed (06 §5) cho cả handler và máy chủ |
| `mock/catalog.store.ts` | Collection `categories`, `colors`, `products`, `stock-adjustments`, `coupons`; `catalogIds.product(code)`…, `findVariant(id)`, `adjustStock(...)` |
| `mock/order.store.ts`, `mock/order-workflow.ts` | `allOrders()`, `getOrder(id)`, `saveOrder(r)`, `createOrder(input, actor)`, `applyAction(id, action, input, actor)` (mọi chuyển trạng thái §3.5 + tồn + lượt mã + sự kiện + `version`), `sweepOverdue(now)`, `editOrder(...)`, `previewEdit(...)` |
| `mock/customer.store.ts` | Collection `customers`; `recalcCustomer(phone)`, `upsertFromOrder(...)` |
| `mock/shop-events.ts` | `publishShopEvent(name, payload)`, `subscribeShopEvents(fn)` |
| `components/ProductImage.tsx`, `PriceTag.tsx`, `StockBadge.tsx`, `OrderStatusBadge.tsx`, `PaymentStatusBadge.tsx`, `ProvinceWardSelect.tsx`, `TransferQr.tsx` | Ảnh có ô màu dự phòng; giá + giá gốc + "−n%"; huy hiệu tình trạng; chọn tỉnh, phường (dùng ở thanh toán và sửa đơn); QR chuyển khoản |
| `services/province.service.ts`, `hooks/use-provinces.ts` | `GET /api/provinces` |

Mốc 2 (FE-Cửa hàng): `ShopEventToaster`, lối vào ở trang đăng nhập và header, `DemoToolbar`. FE-Quản trị trước mốc 1 làm giao diện bằng dữ liệu tĩnh theo kiểu trong `types/shop.ts`, sau mốc 1 nối handler.

Service: mỗi feature có `services/*.service.ts` riêng, chỉ gọi đường dẫn trong `apiRoutes`; cửa hàng dùng `features/shop/services/public-api.ts` (axios không token, gắn `X-Device-Id`). Query key (FE-Quản trị dùng đúng key để làm mới chéo): `['public', 'store']`, `['public', 'home']`, `['public', 'categories']`, `['public', 'products', query]`, `['public', 'product', slug]`, `['public', 'order', code]`, `['provinces']`, `['categories']`, `['colors']`, `['products', query]`, `['product', id]`, `['stock-adjustments', productId]`, `['orders', query]`, `['orders-counts', query]`, `['order', id]`, `['coupons', query]`, `['coupon', id]`, `['customers', query]`, `['customer', id]`, `['reports', loại, query]`, `['dashboard', 'todo' | 'sales']`.

### 4.10. Thứ tự làm BE (một agent)

Namespace theo `BE-CAU-TRUC-THU-MUC.md`; Area `Sales` (module `Locations`, `Catalog`, `Coupons`, `Orders`, `Storefront`, `Reports`), Area `Crm` (module `Customers`). Chép nguyên từ demo Quản lý Nhà hàng: `Application/Common/Time/VietnamTime.cs`, `VietnamDates.cs`; từ demo Menu QR: `IPublicRateLimiter`, bộ lọc `[PublicRateLimit]`, cách trả ProblemDetails có `code` (đổi mã lỗi theo file này).

1. **Domain**: `Domain/Enums/Sales/{Catalog,Coupons,Orders,Locations}/*.cs`, `Domain/Enums/Crm/Customers/*.cs` (mọi enum `06` §4); entity `Domain/Entities/Sales/Locations/{Province,Ward}.cs`, `Sales/Catalog/{Category,Color,Product,ProductImage,ProductVariant,StockAdjustment}.cs`, `Sales/Coupons/Coupon.cs`, `Sales/Orders/{Order,OrderLine,OrderEvent,Shipment}.cs`, `Crm/Customers/Customer.cs`; `Domain/Entities/Sales/SalesRules.cs` (hằng số), `SalesErrors.cs` (mã lỗi §2.12), `OrderPricing.cs` (§3.1–3.3), `CouponRules.cs` (§3.2), `OrderWorkflow.cs` (bảng §3.5, chữ §3.10, trả danh sách tồn cần cộng/trừ để service áp), `OrderLabels.cs` (§3.8), `SalesCodes.cs` (§3.9, slug, SKU).
2. **Persistence**: `Infrastructure/Persistence/Configurations/Sales/{Location,Catalog,Coupon,Order}Configurations.cs`, `Crm/CustomerConfiguration.cs` (index, unique, check, concurrency `06` §4); migration `Add_Sales` (Postgres).
3. **Seed**: `SalesSeedRecords.cs` (kiểu đọc JSON `06` §5), `DemoDataSeeder.cs` suy ra đúng `06` §5 (phát lại sự kiện qua `OrderWorkflow`, chạy quét quá hạn); đối chiếu số `06` §5.7 bằng `GET /api/reports/revenue` và `GET /api/orders/status-counts`. `project.json` đã có quyền, tài khoản, cài đặt.
4. **Danh mục hành chính, danh mục, màu, sản phẩm**: DTO, validator, mapping, `IProvinceService`, `ICategoryService`, `IColorService`, `IProductService` (lưới biến thể §3.12, ảnh qua `IFileStorage`, `IStockAdjustmentService`); controller `Controllers/Catalog/*`, `Controllers/Locations/ProvincesController.cs` (`[AllowAnonymous]`). `Permissions.cs` thêm nhóm như §1.
5. **Cửa hàng công khai (đọc)**: `IStorefrontService` + `Controllers/Storefront/PublicStoreController.cs` (`[AllowAnonymous]`, route `api/public`), giới hạn tần suất §2.2; truy vấn lọc §3.8 bằng `AppDbFunctions.Matches` trên `NameSearch`.
6. **Đặt hàng**: `ICheckoutService` (`cart/check`, `checkout/quote`, đặt hàng theo §2.2 bước 1–7 trong một transaction, trừ tồn và cộng lượt mã bằng câu cập nhật có điều kiện, upsert khách, idempotent §3.7), `IOrderLookupService` (tra cứu, chặn sai BR-28 bằng `IMemoryCache`, khách tự hủy); `OverduePaymentJob` (hosted service 5 phút) + quét lười §3.5.
7. **Đơn hàng quản trị**: `IOrderService` (danh sách, đếm, chi tiết với nhãn §3.8, mọi thao tác §2.5 qua `OrderWorkflow`, `version` §3.6, sửa đơn + xem trước, ghi chú, in phiếu, hàng loạt); lọc nhãn trong `OrderListing`: Trùng SĐT tính trên tập đơn đang chờ (nhỏ) rồi lọc theo Id, Khách cần lưu ý dùng `EXISTS` sang `Crm_Customers` (cùng kết quả với `EXISTS`, không phụ thuộc phép cộng giờ của provider).
8. **Mã giảm giá, khách hàng**: `ICouponService`, `ICustomerService` (`CustomerStats.Recalculate` dùng chung với workflow).
9. **Báo cáo**: `IReportService` + `ISalesReportRepository` (truy vấn gộp theo §3.13, ngày theo giờ Việt Nam), controller `Reports`; bổ sung `DemoController` §2.9.
10. Kiểm: `dotnet publish` không lỗi (máy dev không có Docker/Postgres; dùng Postgres portable nếu cần chạy), chạy tay các TC trọng tâm qua Swagger (TC-08, 09, 11, 12, 14, 17, 18, 19, 27, 29, 31, 32, 33, 34, 37, 38, 43).

---

## 5. Quyết định thiết kế (BE và FE làm theo)

Những điểm SRS, use case chưa nói rõ đã được chốt như sau; FE mock làm giống BE để hai chế độ ra cùng kết quả.

| # | Chỗ | Quyết định | Lý do |
| :---: | :--- | :--- | :--- |
| 1 | Tổng quan và vai trò | `/dashboard` gắn `dashboard.view` (nền đã cấp cho `MANAGER`, `STAFF`); thẻ việc cần làm gọi API gắn `orders.view`, thẻ doanh thu gọi API gắn `reports.view` | FR-03 cho cả Nhân viên; UC-12 3a Nhân viên không thấy doanh thu (TC-40) |
| 2 | Tài khoản | Dùng đúng `admin`, `quanly`, `nhanvien` của nền (đổi mô tả); thêm `nhanvien2` (Phạm Thu Trang) không có thẻ Đăng nhập nhanh để dữ liệu mẫu có ca tối | SRS §2.2; tài khoản nền đều dùng nên không có tài khoản `enabled: false` |
| 3 | Cửa hàng mẫu | **Nhà Sợi**, thời trang basic cotton, linen; màu chính `#1E40AF` | SRS §2.1 chọn thời trang vì biến thể màu × size rõ nhất; màu khác các demo 02, 03, 04, 06 |
| 4 | Trang `/` | Là trang chủ cửa hàng, bỏ `RootRedirect` của nền; quản trị vào qua `/login` → `/dashboard` | SRS §9 SCR-01 ở `/`; khách vào từ link quảng cáo |
| 5 | Mã giảm giá ở `checkout/quote` | Không kiểm lượt theo số điện thoại; kiểm khi bấm "Đặt hàng" | TC-14: bước 2 áp được, bước 3 mới báo đã dùng |
| 6 | Thứ tự kiểm mã | Hết hạn trước tạm dừng, chưa tới ngày, hết lượt, phạm vi, tối thiểu, miễn phí vận chuyển (§3.2) | Câu lỗi cụ thể nhất cho khách; TC-13 bước 3 (707.000 ₫ với `FREESHIP`) báo "Đơn đã được miễn phí vận chuyển" |
| 7 | "Đã được miễn phí vận chuyển" với `FREESHIP` | So `subtotal ≥ 499.000` (mã này không giảm tiền hàng) | BR-08 |
| 8 | Lượt mã khi đơn hoàn | Không trả; `usedCount` = đơn chưa hủy có mã | BR-09 |
| 9 | Banner trang chủ | Nội dung tĩnh trong seed, FE đọc thẳng; không có bảng, không có màn quản trị | FR-04 chỉ yêu cầu hiển thị; ngoài phạm vi SRS |
| 10 | Tồn trong seed | Là tồn lúc nạp, không suy từ đơn lịch sử | Đơn lịch sử đã giao, hủy, hoàn qua nhiều lần nhập hàng; giữ số test cố định |
| 11 | Số đã bán (`soldCount`) | Chỉ tính đơn Đã giao | Cùng cơ sở với doanh thu thuần, sắp xếp "Bán chạy" ổn định |
| 12 | Đơn chuyển khoản giao thất bại, đã hoàn | Giữ "Đã thanh toán"; hoàn tiền xử lý ngoài hệ thống | BR-16 chỉ quy định hoàn tiền khi hủy; đổi trả ngoài phạm vi (SRS §1.2) |
| 13 | Nhãn đơn | Tính lúc đọc, không lưu: Trùng SĐT chỉ giữa các đơn đang chờ; Khách cần lưu ý chỉ gắn đơn đang xử lý | Nhãn tự mất khi đơn kia được xác nhận hoặc hủy (UC-09 1b) mà không cần ghi |
| 14 | Hạn thanh toán | Quét định kỳ 5 phút + quét lười ở mọi API đơn; `cancelledAt = paymentDueAt` | Dòng thời gian đúng giờ hết hạn dù quét trễ; mock không có tác vụ nền (TC-34) |
| 15 | Phiên bản đơn | `version` tăng ở mọi thay đổi; thao tác đổi trạng thái gửi `version`, vắng thì không kiểm | UC-08 E4; Swagger và TC-33 gọi được không cần `version` |
| 16 | Câu khi đơn bị khách hủy lúc nhân viên đang mở | 409 `DonDaBiHuy` "Đơn đã bị hủy lúc HH:mm" | UC-08 E4 |
| 17 | So sánh hôm nay | So với 00:00 → cùng giờ của hôm qua | So cả ngày hôm qua thì buổi sáng luôn "giảm" |
| 18 | Số đơn mới vs số đơn báo cáo | Tổng quan đếm mọi đơn đặt (TC-39); báo cáo doanh thu đếm đơn không hủy (cùng cơ sở giá trị đặt hàng) | BR-22 |
| 19 | Phân bổ giảm giá theo dòng | Tỉ lệ thành tiền các dòng thuộc phạm vi, làm tròn xuống, dòng cuối nhận dư | Báo cáo bán chạy theo doanh thu thuần (FR-38) cộng đúng bằng tổng |
| 20 | Tra cứu và tự hủy | `POST`, số điện thoại trong body; chặn sai theo `X-Device-Id` | Không đưa số điện thoại lên URL, log; BR-28 "từ một trình duyệt" |
| 21 | Lý do khách tự hủy | Đổi ý, Đặt trùng đơn, Lý do khác (bắt buộc ghi chú) | Các lý do còn lại là của shop |
| 22 | Phường/xã | Danh mục rút gọn 164 phường/xã, mã nội bộ | Danh mục đầy đủ ~3.300 dòng, chỉ cần khi triển khai (06 §5.5) |
| 23 | Thời gian thực | Không SignalR; `api` hỏi lại 30 giây; `mock` đồng bộ tab qua mock-db + `BroadcastChannel` | SRS không yêu cầu; vẫn trình diễn được trên một trình duyệt |
| 24 | Hai khách một trình duyệt | `?khach=N` gán danh tính theo tab (sessionStorage) | TC-17 chạy được ở mock; cửa sổ ẩn danh là localStorage khác, không thấy dữ liệu demo |
| 25 | Trang công khai ở mock | Máy chủ render từ seed; trình duyệt đọc lại mock-db. Slug không có trong seed ở chế độ `mock` **không** trả 404 phía máy chủ mà để trình duyệt tra mock-db | Sản phẩm thêm trong phiên demo (TC-21 "Áo sơ mi linen") chỉ có trong localStorage |
| 26 | Lịch sử đơn ở mock | Đơn lịch sử trong bộ nhớ, chỉ ghi bản sao khi bị sửa; dữ liệu tự nạp lại mỗi ngày | Giới hạn ~5 MB của localStorage; số "hôm nay" luôn có |
| 27 | Sửa mã sản phẩm, mã màu | Không đổi mã khi đã có trong đơn; mã màu không đổi được | SKU đã in trên phiếu giao, đơn cũ |
| 28 | Xóa | Danh mục, sản phẩm, mã: xóa mềm có điều kiện; biến thể chưa bán: xóa cứng; đơn, khách: không xóa | BR-23, BR-26 |
| 29 | Ảnh theo màu | Ảnh gắn màu tùy chọn; chọn màu chuyển tới ảnh đầu tiên của màu đó | UC-02 bước 2 |
| 30 | In lại phiếu | Đếm `labelPrintCount` sau sự kiện `afterprint`; > 0 thì "IN LẠI" | UC-10 5a |
| 31 | Nhật ký thao tác | Đơn, dòng, sự kiện, vận đơn, khách không ghi `System_AuditLogs` | Ghi rất nhiều; bản ghi đã chụp người, giờ |
| 32 | Giá trong dòng đơn lịch sử | Giá bán hiện tại của sản phẩm | Không có lịch sử giá; đủ cho báo cáo mẫu |
| 33 | Mã danh mục | Đúng 2 chữ in hoa `^[A-Z]{2}$` (BE, FE-Quản trị, mock cùng một luật) | Khớp mã màu, tiền tố mã sản phẩm (`AT001`) |
| 34 | Sửa đơn đổi số điện thoại | Đơn chuyển sang hồ sơ khách của số mới (chưa có thì tạo); tính lại thống kê cả khách cũ và khách mới | FR-34: hồ sơ khách theo số điện thoại |
| 35 | Dòng trùng biến thể | Đặt hàng và sửa đơn gộp các dòng cùng biến thể, cộng số lượng | Một biến thể chỉ một dòng trên phiếu giao |
| 36 | Giả lập khách đặt đơn | Bỏ hẳn sản phẩm dùng trong test `AT001`, `QJ003`, `TX001`, `VD002`; chỉ lấy biến thể tồn ≥ 3 | Không làm lệch số tồn của TC |
| 37 | Danh sách đơn của khách, của mã | Mới đặt trước | Xem đơn gần nhất trước |
| 38 | Kiểu mã trong `CouponCheck` | Không có trường kiểu; FE suy "miễn phí vận chuyển" khi `discount = 0` | Đủ để hiển thị, không đổi hợp đồng |
| 39 | Giá trị `null` | BE luôn gửi trường `null` (không bỏ trường); FE đổi `null` thành `undefined` khi nạp form sửa | zod `.optional()` không nhận `null` |
| 40 | Khóa sắp xếp danh sách quản trị | Sản phẩm thêm `totalStock`; khách thêm `deliveredCount`, `returnCount` | FE có cột sắp xếp tương ứng |
