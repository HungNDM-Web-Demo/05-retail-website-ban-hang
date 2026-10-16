import type {
  ActorType,
  CancelReason,
  Carrier,
  CartLineIssue,
  CouponStatus,
  CouponType,
  CustomerTag,
  DeliveryFailReason,
  OrderEventType,
  OrderLabel,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductSort,
  ProductStatus,
  StockAdjustReason,
  StockStatus,
} from '@/types/shop'

/**
 * Chữ hiển thị của enum nghiệp vụ (docs/07-DANH-SACH-API.md §2), dùng chung FE-Cửa hàng và FE-Quản trị.
 * Trang công khai dùng nhãn `public*` khi câu cho khách khác câu cho nhân viên.
 */
export const productStatusLabels: Record<ProductStatus, string> = { DangBan: 'Đang bán', An: 'Ẩn' }
export const stockStatusLabels: Record<StockStatus, string> = {
  ConHang: 'Còn hàng',
  SapHet: 'Sắp hết',
  HetHang: 'Hết hàng',
}

export const orderStatusLabels: Record<OrderStatus, string> = {
  ChoThanhToan: 'Chờ thanh toán',
  ChoXacNhan: 'Chờ xác nhận',
  DaXacNhan: 'Đã xác nhận',
  DangGiao: 'Đang giao',
  DaGiao: 'Đã giao',
  DangHoan: 'Đang hoàn',
  DaHoan: 'Đã hoàn',
  DaHuy: 'Đã hủy',
}
/** Thứ tự tab ở danh sách đơn (UC-07 bước 1); tab "Tất cả" đứng đầu */
export const orderStatusTabs: OrderStatus[] = [
  'ChoThanhToan',
  'ChoXacNhan',
  'DaXacNhan',
  'DangGiao',
  'DaGiao',
  'DangHoan',
  'DaHoan',
  'DaHuy',
]
/** Màu StatusBadge theo trạng thái đơn */
export const orderStatusTone: Record<
  OrderStatus,
  'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral'
> = {
  ChoThanhToan: 'warning',
  ChoXacNhan: 'warning',
  DaXacNhan: 'info',
  DangGiao: 'primary',
  DaGiao: 'success',
  DangHoan: 'danger',
  DaHoan: 'neutral',
  DaHuy: 'neutral',
}
export const paymentMethodLabels: Record<PaymentMethod, string> = {
  Cod: 'Thanh toán khi nhận hàng (COD)',
  ChuyenKhoan: 'Chuyển khoản ngân hàng',
}
export const paymentMethodShortLabels: Record<PaymentMethod, string> = {
  Cod: 'COD',
  ChuyenKhoan: 'Chuyển khoản',
}
export const paymentStatusLabels: Record<PaymentStatus, string> = {
  ChuaThanhToan: 'Chưa thanh toán',
  DaThanhToan: 'Đã thanh toán',
  CanHoanTien: 'Cần hoàn tiền',
  DaHoanTien: 'Đã hoàn tiền',
}
export const cancelReasonLabels: Record<CancelReason, string> = {
  KhachDoiY: 'Khách đổi ý',
  KhongLienLacDuoc: 'Không liên lạc được',
  HetHang: 'Hết hàng',
  DatTrung: 'Đặt trùng',
  QuaHanThanhToan: 'Quá hạn thanh toán',
  Khac: 'Khác',
}
/** Lý do nhân viên chọn khi hủy (QuaHanThanhToan chỉ hệ thống dùng) */
export const staffCancelReasons: CancelReason[] = [
  'KhachDoiY',
  'KhongLienLacDuoc',
  'HetHang',
  'DatTrung',
  'Khac',
]
/** Lý do khách chọn khi tự hủy ở trang tra cứu (TC-20 chọn "Đổi ý") */
export const publicCancelReasonLabels: Partial<Record<CancelReason, string>> = {
  KhachDoiY: 'Đổi ý',
  DatTrung: 'Đặt trùng đơn',
  Khac: 'Lý do khác',
}
export const deliveryFailReasonLabels: Record<DeliveryFailReason, string> = {
  KhachKhongNgheMay: 'Khách không nghe máy',
  KhachTuChoiNhan: 'Khách từ chối nhận',
  SaiDiaChi: 'Sai địa chỉ',
  Khac: 'Khác',
}
export const carrierLabels: Record<Carrier, string> = {
  Ghn: 'GHN',
  Ghtk: 'GHTK',
  Vtp: 'Viettel Post',
  Jt: 'J&T Express',
}
/** Tiền tố mã vận đơn (BR-17) */
export const carrierPrefixes: Record<Carrier, string> = {
  Ghn: 'GHN',
  Ghtk: 'GHTK',
  Vtp: 'VTP',
  Jt: 'JT',
}
export const orderEventTypeLabels: Record<OrderEventType, string> = {
  DoiTrangThai: 'Đổi trạng thái',
  GhiChuNoiBo: 'Ghi chú nội bộ',
  TinGuiKhach: 'Tin gửi khách',
  SuaDon: 'Sửa đơn',
  HoanTien: 'Hoàn tiền',
}
export const actorTypeLabels: Record<ActorType, string> = {
  NhanVien: 'Nhân viên',
  Khach: 'Khách',
  HeThong: 'Hệ thống',
}
export const orderLabelLabels: Record<OrderLabel, string> = {
  TrungSdt: 'Trùng SĐT',
  GiaoCham: 'Giao chậm',
  KhachCanLuuY: 'Khách cần lưu ý',
}
export const couponTypeLabels: Record<CouponType, string> = {
  PhanTram: 'Giảm theo phần trăm',
  SoTien: 'Giảm số tiền',
  MienPhiVanChuyen: 'Miễn phí vận chuyển',
}
export const couponStatusLabels: Record<CouponStatus, string> = {
  SapChay: 'Sắp chạy',
  DangChay: 'Đang chạy',
  TamDung: 'Tạm dừng',
  HetLuot: 'Hết lượt',
  HetHan: 'Hết hạn',
}
export const stockAdjustReasonLabels: Record<StockAdjustReason, string> = {
  NhapHang: 'Nhập hàng',
  KiemKe: 'Kiểm kê',
  HangLoi: 'Hàng lỗi',
  Khac: 'Khác',
}
export const customerTagLabels: Record<CustomerTag, string> = {
  KhachVip: 'Khách VIP',
  CanLuuY: 'Cần lưu ý',
}
export const productSortLabels: Record<ProductSort, string> = {
  newest: 'Mới nhất',
  bestselling: 'Bán chạy',
  priceAsc: 'Giá tăng dần',
  priceDesc: 'Giá giảm dần',
}
export const cartLineIssueLabels: Record<CartLineIssue, string> = {
  GiaDaDoi: 'Giá đã đổi',
  KhongDuTon: 'Không đủ hàng',
  HetHang: 'Hết hàng',
  NgungKinhDoanh: 'Sản phẩm ngừng kinh doanh',
  BienTheDaTat: 'Mẫu này tạm ngừng bán',
}
/** Khoảng giá nhanh ở bộ lọc cửa hàng (FR-05) */
export const priceRangeOptions: { label: string; minPrice?: number; maxPrice?: number }[] = [
  { label: 'Dưới 200.000 ₫', maxPrice: 199999 },
  { label: '200.000 – 400.000 ₫', minPrice: 200000, maxPrice: 400000 },
  { label: '400.000 – 700.000 ₫', minPrice: 400001, maxPrice: 700000 },
  { label: 'Trên 700.000 ₫', minPrice: 700001 },
]
/** Size theo thứ tự hiển thị */
export const sizeOrder = ['S', 'M', 'L', 'XL', '26', '27', '28', '29', '30', '31', '32']
/** Gợi ý ghi chú nội bộ nhanh */
export const internalNoteSuggestions = [
  'Gọi lần 1 không nghe máy',
  'Khách hẹn giao sau 17h',
  'Khách xác nhận lại địa chỉ',
  'Gọi kỹ trước khi gửi',
]
