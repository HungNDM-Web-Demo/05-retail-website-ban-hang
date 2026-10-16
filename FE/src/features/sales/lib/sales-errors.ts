import { ApiError } from '@/lib/api-error'
import type { CancelReason, OrderStatus } from '@/types/shop'
import { orderStatusLabels } from '@/config/shop-labels'
import { money } from './money'
import { vnTime } from './vn-time'

/**
 * Lỗi nghiệp vụ dạng ProblemDetails có `code` (07 §2.12). `detail` đúng câu của 07, FE hiển thị nguyên văn.
 * Dùng chung cho lõi thuần (`lib/*`) và handler mock; BE `SalesErrors.cs` cùng mã, cùng câu.
 */

type Extra = Record<string, unknown>
export type FieldErrors = Record<string, string>

const toErrors = (errors: FieldErrors) =>
  Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, [v]]))

export function salesError(status: number, code: string, detail: string, extra: Extra = {}): ApiError {
  return ApiError.fromStatus(status, detail, { code, ...extra })
}

/** 400 lỗi theo trường (`errors`); một lỗi thì `detail` là chính câu đó */
export function fieldErrors(errors: FieldErrors, extra: Extra = {}): ApiError {
  const values = Object.values(errors)
  return ApiError.fromStatus(400, values.length === 1 ? values[0] : 'Dữ liệu chưa hợp lệ.', {
    errors: toErrors(errors),
    ...extra,
  })
}

/** 409 lỗi theo trường (trùng mã, slug…) */
export function fieldConflict(errors: FieldErrors): ApiError {
  const values = Object.values(errors)
  return ApiError.fromStatus(409, values[0], { errors: toErrors(errors) })
}

/** Câu lỗi mã giảm giá (§3.2), dùng cả ở `CouponCheck.message` */
export const couponMessages = {
  MaKhongTonTai: () => 'Mã giảm giá không tồn tại',
  MaHetHan: () => 'Mã đã hết hạn',
  MaTamDung: () => 'Mã đang tạm dừng',
  MaChuaApDung: () => 'Mã chưa đến thời gian áp dụng',
  MaHetLuot: () => 'Mã đã hết lượt sử dụng',
  MaKhongApDungDanhMuc: (categoryName: string) =>
    `Mã chỉ áp dụng cho sản phẩm thuộc danh mục ${categoryName}`,
  ChuaDatToiThieu: (minOrder: number, categoryName?: string) =>
    categoryName
      ? `Đơn tối thiểu ${money(minOrder)} cho sản phẩm danh mục ${categoryName}`
      : `Đơn tối thiểu ${money(minOrder)}`,
  DaMienPhiVanChuyen: () => 'Đơn đã được miễn phí vận chuyển',
  SdtDaDungMa: (code: string) => `Số điện thoại này đã dùng mã ${code}`,
} as const
export type CouponErrorCode = keyof typeof couponMessages

/** Câu theo trường (07 §2.12 cuối bảng) */
export const fieldMessages = {
  fullName: 'Họ tên từ 2 đến 100 ký tự',
  phone: 'Số điện thoại không hợp lệ',
  email: 'Email chưa đúng định dạng',
  provinceCode: 'Vui lòng chọn tỉnh/thành',
  wardCode: 'Vui lòng chọn phường/xã',
  addressLine: 'Địa chỉ chi tiết từ 5 đến 200 ký tự',
  note: 'Ghi chú tối đa 500 ký tự',
  quantity: 'Số lượng từ 1 đến 10',
  transactionRefEmpty: 'Nhập mã giao dịch ngân hàng',
  transactionRefFormat: 'Mã giao dịch gồm 6–30 chữ và số',
  reason: 'Chọn lý do',
  otherNote: 'Nhập ghi chú cho lý do Khác',
  weight: 'Khối lượng từ 50 đến 30.000 g',
  newStock: 'Tồn mới là số nguyên từ 0',
  internalNote: 'Nhập ghi chú, tối đa 500 ký tự',
  paymentMethod: 'Chọn phương thức thanh toán',
  stockLeft: (n: number) => `Chỉ còn ${n} sản phẩm`,
} as const

export const SalesErrors = {
  productNotFound: () => salesError(404, 'KhongTimThaySanPham', 'Không tìm thấy sản phẩm'),
  categoryNotFound: () => salesError(404, 'KhongTimThayDanhMuc', 'Danh mục không tồn tại'),
  cartEmpty: () =>
    salesError(400, 'GioHangTrong', 'Giỏ hàng trống', { errors: { lines: ['Giỏ hàng trống'] } }),
  cartTooManyLines: () =>
    salesError(400, 'GioQuaNhieuDong', 'Giỏ hàng tối đa 20 sản phẩm', {
      errors: { lines: ['Giỏ hàng tối đa 20 sản phẩm'] },
    }),
  productDiscontinued: (productName: string, variantIds: string[]) =>
    salesError(409, 'SanPhamNgungBan', `${productName} đã ngừng kinh doanh, vui lòng xóa khỏi giỏ`, {
      variantIds,
    }),
  priceChanged: (priceChanges: { variantId: string; oldPrice: number; newPrice: number }[]) =>
    salesError(409, 'GiaDaThayDoi', 'Giá sản phẩm đã thay đổi, vui lòng kiểm tra lại rồi đặt hàng', {
      priceChanges,
    }),
  /** detail = câu dòng đầu; errors["lines[i]"] = "Chỉ còn {n} sản phẩm" (TC-17) */
  notEnoughStock: (
    first: { productName: string; colorName: string; size?: string; stock: number },
    stockIssues: { variantId: string; stock: number }[],
    errors: FieldErrors
  ) =>
    salesError(
      409,
      'KhongDuTon',
      first.size
        ? `${first.productName} – ${first.colorName} / ${first.size} chỉ còn ${first.stock} sản phẩm`
        : `${first.productName} – ${first.colorName} chỉ còn ${first.stock} sản phẩm`,
      { stockIssues, errors: toErrors(errors) }
    ),
  coupon: (code: CouponErrorCode, message: string) =>
    salesError(400, code, message, { errors: { couponCode: [message] } }),
  orderNotFound: () => salesError(404, 'KhongTimThayDon', 'Không tìm thấy đơn hàng'),
  lookupLocked: (minutes: number, retryAfterSeconds: number) =>
    salesError(
      429,
      'TraCuuTamKhoa',
      `Bạn đã tra cứu sai quá 5 lần, vui lòng thử lại sau ${minutes} phút`,
      { retryAfterSeconds }
    ),
  cannotSelfCancel: (hotline: string) =>
    salesError(
      400,
      'KhongTheTuHuy',
      `Đơn đã được shop xử lý, không tự hủy được. Vui lòng gọi hotline ${hotline}`
    ),
  tooManyRequests: () =>
    salesError(429, 'QuaNhieuYeuCau', 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút'),
  orderChanged: (byName: string, at: string, order: unknown) =>
    salesError(
      409,
      'DonDaThayDoi',
      `Đơn vừa được ${byName} cập nhật lúc ${vnTime(at)}, vui lòng xem lại`,
      { order }
    ),
  orderCancelled: (cancelledAt: string, order: unknown) =>
    salesError(409, 'DonDaBiHuy', `Đơn đã bị hủy lúc ${vnTime(cancelledAt)}`, { order }),
  invalidStatus: (currentStatus: OrderStatus) =>
    salesError(
      400,
      'TrangThaiKhongHopLe',
      `Thao tác không áp dụng cho đơn ${orderStatusLabels[currentStatus]}`,
      { currentStatus }
    ),
  cannotCancelShipped: () =>
    salesError(400, 'KhongHuyDonDaBanGiao', 'Không thể hủy đơn đã bàn giao vận chuyển'),
  onlyEditCod: () => salesError(400, 'ChiSuaDonCod', 'Chỉ sửa được đơn COD đang Chờ xác nhận'),
  noRefundNeeded: () =>
    salesError(400, 'KhongCanHoanTien', 'Đơn không ở trạng thái Cần hoàn tiền'),
  needOneVariant: () =>
    salesError(400, 'CanItNhatMotBienThe', 'Sản phẩm cần ít nhất một biến thể'),
  productOrdered: () =>
    salesError(
      400,
      'SanPhamDaCoTrongDon',
      'Sản phẩm đã có trong đơn hàng, không xóa được. Hãy dùng Ẩn'
    ),
  variantOrdered: (skus: string[]) =>
    salesError(
      400,
      'BienTheDaCoTrongDon',
      `Biến thể ${skus.join(', ')} đã có trong đơn hàng, không xóa được. Hãy tắt biến thể`,
      { skus }
    ),
  categoryHasProducts: (productCount: number) =>
    salesError(
      400,
      'DanhMucConSanPham',
      `Danh mục đang có ${productCount} sản phẩm, chuyển sản phẩm sang danh mục khác trước`,
      { productCount }
    ),
  couponUsed: () =>
    salesError(400, 'MaDaCoLuotDung', 'Mã đã có lượt dùng, không xóa được. Hãy tạm dừng'),
  /** Lý do hủy ngoài danh sách cho phép (vd khách gửi QuaHanThanhToan) */
  invalidCancelReason: (allowed: CancelReason[]) =>
    fieldErrors({ reason: fieldMessages.reason }, { allowed }),
}
