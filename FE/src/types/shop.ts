/**
 * Hợp đồng dữ liệu nghiệp vụ Website Bán hàng, chép đúng docs/07-DANH-SACH-API.md §2 (07 là nguồn;
 * đổi DTO thì sửa 07 trước rồi sửa file này). BE `Application/DTOs/*` khớp từng trường.
 * Dùng chung cho FE-Cửa hàng và FE-Quản trị (07 §4.9): không tách bản sao trong features/*.
 * Quy ước: `?` là có thể null hoặc vắng; ngày giờ chuỗi ISO UTC; tiền là số nguyên đồng.
 */
import type { PaginatedResult, PaginationQuery } from '@/types/api'

// ============================================================ Enum (06 §4, 07 §2)

export type ProductStatus = 'DangBan' | 'An'
/** BR-02: 0 HetHang, 1–5 SapHet, > 5 ConHang */
export type StockStatus = 'ConHang' | 'SapHet' | 'HetHang'
export type OrderStatus =
  | 'ChoThanhToan'
  | 'ChoXacNhan'
  | 'DaXacNhan'
  | 'DangGiao'
  | 'DaGiao'
  | 'DangHoan'
  | 'DaHoan'
  | 'DaHuy'
export type PaymentMethod = 'Cod' | 'ChuyenKhoan'
export type PaymentStatus = 'ChuaThanhToan' | 'DaThanhToan' | 'CanHoanTien' | 'DaHoanTien'
export type CancelReason =
  'KhachDoiY' | 'KhongLienLacDuoc' | 'HetHang' | 'DatTrung' | 'QuaHanThanhToan' | 'Khac'
export type DeliveryFailReason = 'KhachKhongNgheMay' | 'KhachTuChoiNhan' | 'SaiDiaChi' | 'Khac'
/** Đơn vị vận chuyển giả lập (BR-17); tiền tố mã vận đơn = giá trị viết hoa: GHN, GHTK, VTP, JT */
export type Carrier = 'Ghn' | 'Ghtk' | 'Vtp' | 'Jt'
export type OrderEventType = 'DoiTrangThai' | 'GhiChuNoiBo' | 'TinGuiKhach' | 'SuaDon' | 'HoanTien'
export type ActorType = 'NhanVien' | 'Khach' | 'HeThong'
/** Nhãn đơn, tính lúc đọc (07 §3.8) */
export type OrderLabel = 'TrungSdt' | 'GiaoCham' | 'KhachCanLuuY'
/** Thao tác được phép theo trạng thái (không xét quyền; FE tự xét quyền bằng usePermissions) */
export type OrderAction =
  | 'Confirm'
  | 'ConfirmPayment'
  | 'Edit'
  | 'Cancel'
  | 'Ship'
  | 'Deliver'
  | 'DeliveryFailed'
  | 'ReceiveReturn'
  | 'Refund'
  | 'PrintLabel'
export type CouponType = 'PhanTram' | 'SoTien' | 'MienPhiVanChuyen'
export type CouponStatus = 'SapChay' | 'DangChay' | 'TamDung' | 'HetLuot' | 'HetHan'
export type StockAdjustReason = 'NhapHang' | 'KiemKe' | 'HangLoi' | 'Khac'
export type CustomerTag = 'KhachVip' | 'CanLuuY'
export type ShippingZone = 'TpHcm' | 'TinhKhac'
export type ProductSort = 'newest' | 'bestselling' | 'priceAsc' | 'priceDesc'
/** Vấn đề của một dòng giỏ khi kiểm lại (BR-04); chỉ GiaDaDoi không chặn đặt hàng */
export type CartLineIssue =
  'GiaDaDoi' | 'KhongDuTon' | 'HetHang' | 'NgungKinhDoanh' | 'BienTheDaTat'
export type TopProductGroupBy = 'product' | 'variant'

// ============================================================ Danh mục hành chính (07 §2.1)

export type WardDto = { code: string; name: string }
export type ProvinceDto = { code: string; name: string; zone: ShippingZone; wards: WardDto[] }

// ============================================================ Danh mục, màu (07 §2.3)

export type CategoryDto = {
  id: string
  code: string
  name: string
  slug: string
  imageUrl?: string
  color: string // #RRGGBB, nền ô ảnh mặc định
  sortOrder: number
  isVisible: boolean
  productCount: number // sản phẩm chưa xóa, kể cả ẩn
}
export type SaveCategoryRequest = {
  code: string
  name: string
  slug?: string // trống → sinh từ tên (BR-24)
  imageUrl?: string
  color: string
  isVisible: boolean
}
export type ReorderRequest = { ids: string[] }
export type VisibilityRequest = { isVisible: boolean }

export type ColorDto = { id: string; code: string; name: string; hex: string; sortOrder: number }
export type SaveColorRequest = { code: string; name: string; hex: string }

export type SizeChart = { title: string; columns: string[]; rows: string[][] }

// ============================================================ Sản phẩm, biến thể (07 §2.4)

export type ProductImageDto = {
  id: string
  url: string
  colorId?: string
  sortOrder: number
  isCover: boolean
}

export type ProductVariantDto = {
  id: string
  sku: string
  colorId: string
  colorCode: string
  colorName: string
  colorHex: string
  size?: string
  stock: number
  isActive: boolean
  stockStatus: StockStatus
  everOrdered: boolean // đã có trong đơn → không xóa được, chỉ tắt (BR-23)
}

export type ProductListItem = {
  id: string
  code: string
  name: string
  slug: string
  categoryId: string
  categoryName: string
  price: number
  listPrice?: number
  coverUrl?: string
  status: ProductStatus
  isFeatured: boolean
  totalStock: number // Σ tồn biến thể đang bật
  variantCount: number
  outOfStockCount: number // biến thể đang bật có tồn 0
  lowStockCount: number // biến thể đang bật có tồn 1–5
  stockStatus: StockStatus // HetHang: mọi biến thể bật hết; SapHet: có biến thể 1–5 hoặc 0; ConHang: còn lại
  soldCount: number
  createdAt: string
}

export type ProductDto = ProductListItem & {
  description?: string
  sizeChart?: SizeChart
  colorIds: string[] // thứ tự màu của sản phẩm
  sizes: string[] // thứ tự size; [] = không có size
  images: ProductImageDto[]
  variants: ProductVariantDto[] // theo (thứ tự màu, thứ tự size)
  everOrdered: boolean
  updatedAt?: string
}

export type ProductQuery = PaginationQuery & {
  categoryId?: string
  status?: ProductStatus
  stockStatus?: StockStatus
}

export type SaveProductVariantInput = {
  colorId: string
  size?: string
  isActive: boolean
  initialStock?: number // chỉ dùng cho biến thể mới; biến thể cũ đổi tồn qua điều chỉnh tồn (BR-27)
}
export type SaveProductRequest = {
  code: string
  name: string
  slug?: string
  categoryId: string
  price: number
  listPrice?: number
  description?: string
  sizeChart?: SizeChart
  isFeatured: boolean
  isHidden: boolean
  images: { url: string; colorId?: string; isCover: boolean }[] // theo thứ tự hiển thị, tối đa 8
  colorIds: string[]
  sizes: string[]
  variants: SaveProductVariantInput[] // đúng lưới colorIds × sizes
}
export type HiddenRequest = { isHidden: boolean }

export type StockAdjustmentRequest = { newStock: number; reason: StockAdjustReason; note?: string }
export type StockAdjustmentDto = {
  id: string
  variantId: string
  sku: string
  productName: string
  colorName: string
  size?: string
  before: number
  after: number
  reason: StockAdjustReason
  note?: string
  byName: string
  at: string
}

// ============================================================ Cửa hàng công khai (07 §2.2)

export type PublicStoreInfo = {
  name: string
  tagline?: string
  logoUrl: string
  primaryColor: string
  hotline: string
  email?: string
  address: string
  workingHours: string
  bankBin: string
  bankName: string
  bankAccount: string
  bankAccountName: string
  freeShipThreshold: number // 499.000 (BR-06)
  shippingFees: Record<ShippingZone, number> // TpHcm 20.000, TinhKhac 35.000
  paymentHours: number // 24 (BR-11)
}

export type PublicColor = { code: string; name: string; hex: string }
export type PublicCategory = {
  id: string
  name: string
  slug: string
  imageUrl?: string
  color: string
  productCount: number // sản phẩm đang bán
}
export type Banner = {
  imageUrl: string
  title: string
  subtitle?: string
  link: string
  buttonText: string
}

export type PublicProductCard = {
  id: string
  code: string
  slug: string
  name: string
  categorySlug: string
  categoryName: string
  price: number
  listPrice?: number
  discountPercent?: number // BR-01
  coverUrl?: string
  hoverUrl?: string // ảnh thứ hai nếu có
  colors: PublicColor[] // màu có ít nhất một biến thể bật
  isOutOfStock: boolean // mọi biến thể bật đều tồn 0 (BR-02)
  soldCount: number
  isFeatured: boolean
  createdAt: string
}

export type PublicHome = {
  banners: Banner[]
  categories: PublicCategory[]
  featured: PublicProductCard[] // tối đa 8
  newest: PublicProductCard[] // 8 sản phẩm mới nhất (FR-04)
  onSale: PublicProductCard[] // tối đa 8, giảm nhiều nhất trước
}

export type PublicProductQuery = {
  category?: string // slug
  search?: string
  minPrice?: number
  maxPrice?: number
  colors?: string // mã màu, ngăn bằng dấu phẩy: "TR,DE"
  sizes?: string // "M,L"
  inStock?: boolean
  sort?: ProductSort // mặc định newest
  page?: number
  pageSize?: number // mặc định 24
}
export type PublicProductFacets = {
  colors: PublicColor[]
  sizes: string[]
  minPrice: number
  maxPrice: number
}
export type PublicProductListResult = PaginatedResult<PublicProductCard> & {
  facets: PublicProductFacets
  category?: PublicCategory
}
export type PublicSuggestion = {
  slug: string
  name: string
  coverUrl?: string
  price: number
  listPrice?: number
}

export type PublicVariant = {
  id: string
  sku: string
  colorCode: string
  size?: string
  stock: number
  stockStatus: StockStatus
}
export type PublicProductDetail = PublicProductCard & {
  description?: string
  sizeChart?: SizeChart
  images: { url: string; colorCode?: string; isCover: boolean }[]
  sizes: string[]
  variants: PublicVariant[] // chỉ biến thể đang bật
  related: PublicProductCard[] // 8 sản phẩm cùng danh mục (FR-07)
}
export type PublicProductLookup = {
  product?: PublicProductDetail
  /** Sản phẩm đã ẩn: trang hiện "Sản phẩm ngừng kinh doanh" (BR-23, UC-02 E3) */
  discontinued?: {
    name: string
    slug: string
    categoryName: string
    categorySlug: string
    coverUrl?: string
  }
  related: PublicProductCard[]
}

// ============================================================ Giỏ, thanh toán (07 §2.2)

/** Dòng giỏ lưu localStorage (07 §4.3) */
export type CartLine = {
  variantId: string
  productId: string
  slug: string
  name: string
  sku: string
  colorName: string
  size?: string
  imageUrl?: string
  price: number // giá lúc thêm, để so khi giá đổi (BR-04)
  quantity: number
  addedAt: string
}
export type CartStorage = { updatedAt: string; lines: CartLine[] }

export type CartLineInput = { variantId: string; quantity: number; price?: number }
export type CartCheckRequest = { lines: CartLineInput[] }
export type CartCheckLine = {
  variantId: string
  productId?: string
  productName: string
  slug?: string
  sku: string
  colorCode: string
  colorName: string
  size?: string
  imageUrl?: string
  price: number // giá hiện tại
  oldPrice?: number // giá gửi lên khác giá hiện tại
  stock: number
  quantity: number
  maxQuantity: number // min(10, tồn) (BR-03)
  lineTotal: number // price × quantity
  issue?: CartLineIssue
  issueText?: string // "Giá đã đổi từ 159.000 ₫ thành 169.000 ₫", "Hết hàng", "Chỉ còn 2 sản phẩm"…
}

export type PricingSummary = {
  subtotal: number
  discount: number // giảm trên tiền hàng
  shippingFee: number // phí khách trả
  shippingDiscount: number // phí được miễn nhờ mã MienPhiVanChuyen (để thống kê mã)
  total: number
  couponCode?: string
  freeShipRemaining: number // 499.000 − (tạm tính − giảm giá), tối thiểu 0
}
export type CouponCheck = {
  code: string
  ok: boolean
  errorCode?: string // mã lỗi §2.12
  message?: string // câu lỗi hiển thị nguyên văn
  description?: string // tên mã, vd "Giảm 10% cho mọi đơn từ 300.000 ₫"
  discount: number
  shippingDiscount: number
}
export type CartCheckResult = {
  lines: CartCheckLine[]
  subtotal: number
  freeShipRemaining: number
  canCheckout: boolean
}

export type CheckoutQuoteRequest = {
  lines: CartLineInput[]
  provinceCode?: string
  couponCode?: string // không kiểm lượt mỗi số điện thoại; kiểm lúc đặt hàng (BR-09, TC-14)
}
export type CheckoutQuote = {
  lines: CartCheckLine[]
  summary: PricingSummary
  coupon?: CouponCheck
  canCheckout: boolean
}

export type ShippingAddressInput = {
  fullName: string
  phone: string
  email?: string
  provinceCode: string
  wardCode: string
  addressLine: string
  note?: string
}
export type PlaceOrderRequest = {
  clientRequestId: string // NFR-05, 07 §3.7
  lines: { variantId: string; quantity: number; expectedPrice: number }[]
  shipping: ShippingAddressInput
  paymentMethod: PaymentMethod
  couponCode?: string
}

export type TransferInfo = {
  bankBin: string
  bankName: string
  bankAccount: string
  bankAccountName: string
  amount: number
  content: string // = mã đơn (BR-12)
  dueAt: string
  qrPayload: string // chuỗi VietQR giả lập (07 §3.9)
}
export type OrderLineView = {
  productName: string
  slug?: string
  sku: string
  colorName: string
  size?: string
  imageUrl?: string
  unitPrice: number
  quantity: number
  lineTotal: number
}
export type PlacedOrderSummary = {
  code: string
  placedAt: string
  status: OrderStatus
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  paymentDueAt?: string
  recipientName: string
  phone: string
  email?: string
  provinceName: string
  wardName: string
  addressLine: string
  customerNote?: string
  lines: OrderLineView[]
  summary: PricingSummary
  transfer?: TransferInfo
}
export type PlaceOrderResult = { order: PlacedOrderSummary; duplicate: boolean }

// ============================================================ Tra cứu đơn (07 §2.2)

export type OrderLookupRequest = { code: string; phone: string }
export type PublicTimelineItem = { at: string; status?: OrderStatus; text: string }
export type PublicOrderView = {
  code: string
  placedAt: string
  status: OrderStatus
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  paymentDueAt?: string
  recipientName: string
  maskedPhone: string // 098****321 (BR-28)
  wardName: string
  provinceName: string
  lines: OrderLineView[]
  summary: PricingSummary
  shipment?: { carrier: Carrier; trackingCode: string; handedOverAt: string; deliveredAt?: string }
  timeline: PublicTimelineItem[] // cũ trước; không có ghi chú nội bộ
  cancelReason?: CancelReason
  canCancel: boolean // ChoThanhToan, ChoXacNhan (BR-16)
  transfer?: TransferInfo // chỉ khi ChoThanhToan
}
export type PublicCancelRequest = { phone: string; reason: CancelReason; note?: string }

// ============================================================ Đơn hàng quản trị (07 §2.5)

export type OrderListItem = {
  id: string
  code: string
  placedAt: string
  customerId: string
  customerName: string
  phone: string
  provinceName: string
  itemCount: number // Σ số lượng
  total: number
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  status: OrderStatus
  labels: OrderLabel[]
  couponCode?: string
  version: number
}
export type OrderQuery = PaginationQuery & {
  status?: OrderStatus
  paymentStatus?: PaymentStatus
  fromDate?: string // yyyy-MM-dd giờ Việt Nam
  toDate?: string
  paymentMethod?: PaymentMethod
  provinceCode?: string
  label?: OrderLabel
  customerId?: string
  couponId?: string
}
export type OrderStatusCounts = Record<OrderStatus | 'TatCa', number>

export type OrderLineDto = OrderLineView & { id: string; variantId: string; productId: string }
export type OrderEventDto = {
  id: string
  type: OrderEventType
  at: string
  actorType: ActorType
  actorName: string // họ tên nhân viên, "Khách" hoặc "Hệ thống"
  fromStatus?: OrderStatus
  toStatus?: OrderStatus
  content: string
}
export type ShipmentDto = {
  carrier: Carrier
  trackingCode: string
  weightGrams: number
  codAmount: number
  shipperNote?: string
  handedOverAt: string
  handedOverByName: string
  deliveredAt?: string
  failedAt?: string
  failReason?: DeliveryFailReason
  failNote?: string
  returnedAt?: string
  labelPrintCount: number
}
export type OrderCustomerBrief = {
  id: string
  name: string
  phone: string
  returnCount: number
  orderCount: number
  tags: CustomerTag[]
  note?: string
}
export type OrderDetailDto = {
  id: string
  code: string
  version: number
  placedAt: string
  status: OrderStatus
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  paymentDueAt?: string
  transactionRef?: string
  paidAt?: string
  refundAmount?: number
  refundRef?: string
  refundedAt?: string
  customer: OrderCustomerBrief
  recipientName: string
  phone: string
  email?: string
  provinceCode: string
  provinceName: string
  wardCode: string
  wardName: string
  addressLine: string
  customerNote?: string
  lines: OrderLineDto[]
  subtotal: number
  discount: number
  shippingFee: number
  shippingDiscount: number
  total: number
  codAmount: number // tiền thu hộ (BR-17)
  couponId?: string
  couponCode?: string
  cancelReason?: CancelReason
  cancelNote?: string
  cancelledAt?: string
  cancelledByName?: string
  labels: OrderLabel[]
  duplicateOrders: { id: string; code: string; status: OrderStatus; placedAt: string }[]
  shipment?: ShipmentDto
  events: OrderEventDto[] // cũ trước
  allowedActions: OrderAction[]
}

export type VersionedRequest = { version?: number } // vắng = không kiểm (07 §3.6)
export type ConfirmOrderRequest = VersionedRequest & { note?: string }
export type ConfirmPaymentRequest = VersionedRequest & { transactionRef: string }
export type CancelOrderRequest = VersionedRequest & { reason: CancelReason; note?: string }
export type ShipOrderRequest = VersionedRequest & {
  carrier: Carrier
  weightGrams: number
  shipperNote?: string
}
export type DeliveryFailedRequest = VersionedRequest & { reason: DeliveryFailReason; note?: string }
export type RefundRequest = VersionedRequest & { refundRef: string }
export type AddOrderNoteRequest = { content: string }
export type EditOrderRequest = VersionedRequest & {
  lines: { variantId: string; quantity: number }[]
  recipientName: string
  phone: string
  email?: string
  provinceCode: string
  wardCode: string
  addressLine: string
}
export type EditOrderPreview = {
  lines: OrderLineView[]
  summary: PricingSummary
  couponRemoved: boolean
  couponMessage?: string // lý do gỡ mã (BR-15)
  changes: string[] // "Trắng/M 2 → 4"
}
export type BulkItem = { id: string; version?: number }
export type BulkConfirmRequest = { items: BulkItem[] }
export type BulkShipRequest = { items: BulkItem[]; carrier: Carrier }
export type BulkResult = {
  succeeded: string[]
  failed: { id: string; code: string; message: string }[]
}

// ============================================================ Mã giảm giá (07 §2.6)

export type CouponDto = {
  id: string
  code: string
  name: string
  type: CouponType
  value: number // % (1–50) hoặc số tiền; MienPhiVanChuyen = 0
  maxDiscount?: number
  minOrder: number
  categoryId?: string // vắng = toàn shop
  categoryName?: string
  totalLimit?: number // vắng = không giới hạn
  perCustomerLimit: number
  usedCount: number // đơn chưa hủy có mã (BR-09)
  discountTotal: number // Σ discount + shippingDiscount của đơn chưa hủy
  orderValueTotal: number // Σ total của đơn chưa hủy có mã
  startAt: string
  endAt: string
  isPaused: boolean
  status: CouponStatus
  canDelete: boolean // chưa có lượt dùng nào, kể cả đơn đã hủy (BR-26)
}
export type CouponQuery = PaginationQuery & { status?: CouponStatus }
export type SaveCouponRequest = {
  code: string
  name: string
  type: CouponType
  value: number
  maxDiscount?: number
  minOrder: number
  categoryId?: string
  totalLimit?: number
  perCustomerLimit: number
  startAt: string
  endAt: string
}
export type PauseCouponRequest = { paused: boolean }

// ============================================================ Khách hàng (07 §2.7)

export type CustomerListItem = {
  id: string
  phone: string
  name: string
  provinceCode: string
  provinceName: string
  orderCount: number
  deliveredCount: number
  returnCount: number // Đang hoàn + Đã hoàn
  totalSpent: number // Σ total đơn Đã giao (BR-21)
  lastOrderAt: string
  tags: CustomerTag[]
}
export type CustomerQuery = PaginationQuery & { tag?: CustomerTag; provinceCode?: string }
export type CustomerDetail = CustomerListItem & {
  email?: string
  wardCode: string
  wardName: string
  addressLine: string
  note?: string
  cancelledCount: number
  firstOrderAt: string
  createdAt: string
}
export type UpdateCustomerNoteRequest = { note?: string }

// ============================================================ Tổng quan, báo cáo (07 §2.8)

export type DateRangeQuery = { from: string; to: string } // yyyy-MM-dd giờ Việt Nam, tối đa 366 ngày

export type DashboardTodo = {
  choXacNhan: number
  choThanhToan: number
  choBanGiao: number // DaXacNhan
  dangHoan: number
  giaoCham: number
  canHoanTien: number
  asOf: string
}
export type SalesFigures = { netRevenue: number; orderValue: number; newOrders: number }
export type LowStockItem = {
  productId: string
  variantId: string
  sku: string
  productName: string
  colorName: string
  size?: string
  stock: number
}
export type DashboardSales = {
  today: SalesFigures
  yesterdaySamePeriod: SalesFigures // 00:00 tới cùng giờ hôm qua (07 §5)
  cancelRate30d: number // %, 1 chữ số thập phân
  returnRate30d: number
  series30d: { date: string; orderValue: number; netRevenue: number }[] // 30 ngày tới hôm nay
  topProducts30d: {
    productId: string
    code: string
    name: string
    coverUrl?: string
    quantity: number
    netRevenue: number
  }[]
  lowStock: LowStockItem[] // tồn 1–5, ít nhất trước
  outOfStock: LowStockItem[] // tồn 0, biến thể bật của sản phẩm đang bán
  asOf: string
}

export type RevenueTotals = {
  orderValue: number
  netRevenue: number
  orderCount: number
  avgOrderValue: number
}
export type RevenueReport = {
  days: ({ date: string } & RevenueTotals)[]
  totals: RevenueTotals
  previous: RevenueTotals // kỳ liền trước cùng độ dài
  previousDays: { date: string; orderValue: number; netRevenue: number }[]
}
export type TopProductsQuery = DateRangeQuery & { categoryId?: string; groupBy?: TopProductGroupBy }
export type TopProductRow = {
  key: string // productId hoặc variantId
  productId: string
  code: string
  name: string
  sku?: string
  colorName?: string
  size?: string
  quantity: number
  netRevenue: number
  share: number // % doanh thu thuần
}
export type TopProductsReport = {
  groupBy: TopProductGroupBy
  rows: TopProductRow[]
  totalQuantity: number
  totalNetRevenue: number
}
export type OrderStatusReportQuery = DateRangeQuery & { paymentMethod?: PaymentMethod }
export type OrderStatusReport = {
  orderCount: number
  cancelledCount: number
  cancelRate: number
  returnCount: number
  returnRate: number
  cancelReasons: { reason: CancelReason; count: number }[]
  failReasons: { reason: DeliveryFailReason; count: number }[]
  byPaymentMethod: {
    paymentMethod: PaymentMethod
    orderCount: number
    cancelRate: number
    returnRate: number
  }[]
}
export type ProvinceReportRow = {
  provinceCode: string
  provinceName: string
  orderCount: number
  netRevenue: number
  returnRate: number
}
export type CouponReportQuery = DateRangeQuery & { couponId?: string }
export type CouponReportRow = {
  couponId: string
  code: string
  usedCount: number
  discountTotal: number
  orderValue: number
}

// ============================================================ Demo (07 §2.9)

export type SimulateOrderResult = { code: string; total: number }

// ============================================================ Sự kiện giữa các tab (07 §2.10)

export type ShopEventMap = {
  'order-created': { orderId: string; code: string; status: OrderStatus; total: number }
  'orders-changed': { orderIds: string[] }
  'catalog-changed': { productIds: string[] }
}
export type ShopEventName = keyof ShopEventMap

// ============================================================ Bản ghi mock-db (07 §4.8)

type Audit = { createdAt: string; updatedAt?: string; isDeleted?: boolean }

export type CategoryRecord = Omit<CategoryDto, 'productCount'> & Audit
export type ColorRecord = ColorDto & Audit
export type VariantRecord = {
  id: string
  sku: string
  colorId: string
  size?: string
  stock: number
  isActive: boolean
}
export type ProductRecord = {
  id: string
  code: string
  name: string
  slug: string
  categoryId: string
  price: number
  listPrice?: number
  description?: string
  sizeChart?: SizeChart
  isFeatured: boolean
  isHidden: boolean
  colorIds: string[]
  sizes: string[]
  images: ProductImageDto[]
  variants: VariantRecord[]
  soldCount: number
  sortOrder: number
} & Audit
export type StockAdjustmentRecord = {
  id: string
  variantId: string
  productId: string
  before: number
  after: number
  reason: StockAdjustReason
  note?: string
  byId?: string
  byName: string
  at: string
}
export type CouponRecord = Omit<
  CouponDto,
  'categoryName' | 'usedCount' | 'discountTotal' | 'orderValueTotal' | 'status' | 'canDelete'
> &
  Audit
export type CustomerRecord = {
  id: string
  phone: string
  name: string
  email?: string
  provinceCode: string
  wardCode: string
  addressLine: string
  note?: string
  orderCount: number
  deliveredCount: number
  returnCount: number
  cancelledCount: number
  totalSpent: number
  firstOrderAt: string
  lastOrderAt: string
  createdAt: string
  updatedAt?: string
}
export type OrderLineRecord = Omit<OrderLineDto, 'lineTotal' | 'slug'>
export type OrderEventRecord = OrderEventDto & { actorId?: string }
export type ShipmentRecord = ShipmentDto & { handedOverById?: string }
export type OrderRecord = {
  id: string
  code: string
  version: number
  clientRequestId?: string
  deviceId?: string
  placedAt: string
  customerId: string
  status: OrderStatus
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  paymentDueAt?: string
  transactionRef?: string
  paidAt?: string
  refundAmount?: number
  refundRef?: string
  refundedAt?: string
  recipientName: string
  phone: string
  email?: string
  provinceCode: string
  provinceName: string
  wardCode: string
  wardName: string
  addressLine: string
  customerNote?: string
  lines: OrderLineRecord[]
  subtotal: number
  discount: number
  shippingFee: number
  shippingDiscount: number
  total: number
  couponId?: string
  couponCode?: string
  cancelReason?: CancelReason
  cancelNote?: string
  cancelledAt?: string
  cancelledById?: string
  cancelledByName?: string
  shipment?: ShipmentRecord
  events: OrderEventRecord[]
  updatedAt?: string
}

// ============================================================ Kiểu đọc file seed demo-data.json (06 §5)

/** Thời điểm sự kiện: số phút sau lúc đặt, hoặc "n-N" = N phút trước lúc nạp */
export type SeedAt = number | `n-${number}`
export type SeedOrderEvent =
  | ['cf', SeedAt, string]
  | ['pd', SeedAt, string, string]
  | ['sh', SeedAt, string, 'GHN' | 'GHTK' | 'VTP' | 'JT', number]
  | ['dv', SeedAt, string]
  | ['fl', SeedAt, string, DeliveryFailReason, string?]
  | ['rt', SeedAt, string]
  | ['cx', SeedAt, string, CancelReason, string?]
  | ['rf', SeedAt, string, string]
  | ['nt', SeedAt, string, string]
export type SeedOrder = {
  d?: number
  t: string | number
  c: string
  pm: 'C' | 'B'
  it: [string, number][]
  cp?: string
  n?: string
  ev?: SeedOrderEvent[]
}
export type SeedProduct = {
  code: string
  name: string
  category: string
  price: number
  listPrice?: number
  colors: string[]
  sizes: string[]
  sizeChart?: string
  stock: Record<string, number>
  off?: string[]
  images: [string, string][]
  featured?: boolean
  hidden?: boolean
  createdDaysAgo: number
  sortOrder: number
  description: string
}
export type SeedCoupon = {
  code: string
  name: string
  type: CouponType
  value: number
  maxDiscount?: number
  minOrder: number
  scope?: string
  totalLimit?: number
  perCustomer?: number
  start: string
  end: string
}
export type SeedCustomer = {
  phone: string
  name: string
  email?: string
  province: string
  ward: string
  address: string
  note?: string
}
export type DemoDataSeed = {
  colors: { code: string; name: string; hex: string; sortOrder: number }[]
  sizeCharts: Record<string, SizeChart>
  categories: {
    code: string
    name: string
    slug: string
    color: string
    image: string
    sortOrder: number
  }[]
  products: SeedProduct[]
  coupons: SeedCoupon[]
  banners: { image: string; title: string; subtitle?: string; link: string; buttonText: string }[]
  provinces: { code: string; name: string; zone?: ShippingZone; wards: [string, string][] }[]
  stockAdjustments: [string, string, number, number, StockAdjustReason, string, string | null][]
  customers: SeedCustomer[]
  orders: SeedOrder[]
}
