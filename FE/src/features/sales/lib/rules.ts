/**
 * Hằng số nghiệp vụ (06 §3, 07 §3). BE `Domain/Entities/Sales/SalesRules.cs` cùng giá trị.
 */
export const SalesRules = {
  /** Phí vận chuyển (BR-06) */
  shippingFeeHcm: 20_000,
  shippingFeeOther: 35_000,
  /** Miễn phí vận chuyển khi tạm tính − giảm giá ≥ ngưỡng (BR-06) */
  freeShipThreshold: 499_000,
  /** Hạn thanh toán chuyển khoản (BR-11) */
  paymentHours: 24,
  /** Tồn sắp hết 1–5 (BR-02) */
  lowStockMax: 5,
  /** Mỗi dòng giỏ tối đa 10, giỏ tối đa 20 dòng, giỏ giữ 30 ngày (BR-03, BR-04) */
  maxQuantityPerLine: 10,
  maxCartLines: 20,
  cartKeepDays: 30,
  /** Giao chậm sau 5 ngày (BR-18) */
  slowDeliveryDays: 5,
  /** Khách VIP từ 5.000.000 ₫, cần lưu ý từ 2 đơn hoàn (BR-21) */
  vipSpent: 5_000_000,
  returnWarnCount: 2,
  /** Khối lượng 50–30.000 g (BR-17); gợi ý 300 g × số lượng + 100 g, làm tròn 50 g */
  minWeightGrams: 50,
  maxWeightGrams: 30_000,
  weightPerItemGrams: 300,
  weightPackageGrams: 100,
  /** Trùng SĐT: hai đơn chờ cách nhau ≤ 24 giờ (BR-20) */
  duplicateWindowHours: 24,
  /** Tra cứu sai 5 lần trong 10 phút → chặn 10 phút (BR-28) */
  lookupMaxFails: 5,
  lookupWindowMinutes: 10,
  lookupBlockMinutes: 10,
  /** Danh sách cửa hàng mặc định 24, tối đa 48 sản phẩm mỗi trang */
  publicPageSize: 24,
  publicMaxPageSize: 48,
  /** Tối đa 8 ảnh mỗi sản phẩm */
  maxImages: 8,
  /** Gợi ý tìm kiếm: từ 2 ký tự, tối đa 5 */
  suggestMinChars: 2,
  suggestLimit: 5,
  /** Trang chủ: tối đa 8 sản phẩm mỗi khối; liên quan 8 */
  homeBlockSize: 8,
  relatedSize: 8,
  /** Số điện thoại di động (BR-07) */
  phonePattern: /^0(3|5|7|8|9)\d{8}$/,
  /** Mã giao dịch ngân hàng 6–30 chữ và số (BR-12) */
  transactionRefPattern: /^[A-Za-z0-9]{6,30}$/,
  emailPattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
} as const
