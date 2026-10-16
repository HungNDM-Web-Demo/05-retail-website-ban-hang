import type { CouponCheck, CouponStatus, CouponType } from '@/types/shop'
import { couponMessages, type CouponErrorCode } from './sales-errors'
import { SalesRules } from './rules'
import { msOf } from './vn-time'

/**
 * Mã giảm giá (BR-08, BR-09, 07 §3.2). Thuần: handler mock, trang thanh toán, sửa đơn dùng chung.
 * BE `Domain/Entities/Sales/CouponRules.cs` cùng thứ tự kiểm, cùng câu lỗi.
 */

/** Thông tin mã cần để kiểm (CouponRecord, CouponDto đều khớp) */
export type CouponLike = {
  id?: string
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
  isPaused: boolean
  isDeleted?: boolean
}

/** Dòng dùng để tính tiền: thành tiền + danh mục của sản phẩm (để tính phần thuộc phạm vi mã) */
export type PricingLine = { lineTotal: number; categoryId?: string }

/** Chuẩn hóa mã khách nhập: `trim().toUpperCase()` */
export const normalizeCouponCode = (code: string | undefined | null) =>
  (code ?? '').trim().toUpperCase()

/** Trạng thái suy ra lúc đọc (06 §4 Sales_Coupons): HetHan → TamDung → SapChay → HetLuot → DangChay */
export function couponStatus(c: CouponLike, now: number, usedCount: number): CouponStatus {
  if (now > msOf(c.endAt)) return 'HetHan'
  if (c.isPaused) return 'TamDung'
  if (now < msOf(c.startAt)) return 'SapChay'
  if (c.totalLimit !== undefined && c.totalLimit !== null && usedCount >= c.totalLimit) return 'HetLuot'
  return 'DangChay'
}

/** Σ thành tiền thuộc phạm vi mã (mọi dòng nếu mã toàn shop) */
export function eligibleOf(c: Pick<CouponLike, 'categoryId'>, lines: PricingLine[]): number {
  return lines
    .filter((l) => !c.categoryId || l.categoryId === c.categoryId)
    .reduce((s, l) => s + l.lineTotal, 0)
}

/** Tiền giảm trên tiền hàng (§3.2); MienPhiVanChuyen = 0 */
export function couponDiscount(c: CouponLike, lines: PricingLine[]): number {
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0)
  const eligible = eligibleOf(c, lines)
  let discount = 0
  if (c.type === 'PhanTram') {
    discount = Math.floor((eligible * c.value) / 100 / 1000) * 1000
    if (c.maxDiscount !== undefined && c.maxDiscount !== null) discount = Math.min(discount, c.maxDiscount)
  } else if (c.type === 'SoTien') {
    discount = Math.min(c.value, eligible)
  }
  return Math.max(0, Math.min(discount, subtotal))
}

export type CouponCheckContext = {
  now: number
  lines: PricingLine[]
  /** Số đơn chưa hủy đang dùng mã (lượt đã dùng) */
  usedCount: number
  /** Tên danh mục của mã theo danh mục (cho câu lỗi) */
  categoryName?: string
  /**
   * Chỉ lúc đặt hàng, sửa đơn (bước 9): số đơn chưa hủy của cùng số điện thoại có mã này
   * (sửa đơn thì trừ chính đơn đó). Vắng = không kiểm (checkout/quote, quyết định 5).
   */
  phoneUsedCount?: number
}

/**
 * Kiểm mã theo thứ tự §3.2 bước 1–9, gặp lỗi đầu tiên thì dừng. Trả `CouponCheck`;
 * `shippingDiscount` để 0 — `priceOrder` mới biết phí vận chuyển để điền.
 */
export function checkCoupon(
  coupon: CouponLike | undefined | null,
  rawCode: string,
  ctx: CouponCheckContext
): CouponCheck {
  const code = normalizeCouponCode(rawCode)
  const fail = (errorCode: CouponErrorCode, message: string): CouponCheck => ({
    code,
    ok: false,
    errorCode,
    message,
    description: coupon && !coupon.isDeleted ? coupon.name : undefined,
    discount: 0,
    shippingDiscount: 0,
  })
  if (!coupon || coupon.isDeleted) return fail('MaKhongTonTai', couponMessages.MaKhongTonTai())
  if (ctx.now > msOf(coupon.endAt)) return fail('MaHetHan', couponMessages.MaHetHan())
  if (coupon.isPaused) return fail('MaTamDung', couponMessages.MaTamDung())
  if (ctx.now < msOf(coupon.startAt)) return fail('MaChuaApDung', couponMessages.MaChuaApDung())
  if (coupon.totalLimit !== undefined && coupon.totalLimit !== null && ctx.usedCount >= coupon.totalLimit)
    return fail('MaHetLuot', couponMessages.MaHetLuot())
  const eligible = eligibleOf(coupon, ctx.lines)
  const categoryName = coupon.categoryId ? (ctx.categoryName ?? '') : undefined
  if (coupon.categoryId && eligible === 0)
    return fail('MaKhongApDungDanhMuc', couponMessages.MaKhongApDungDanhMuc(categoryName ?? ''))
  if (eligible < coupon.minOrder)
    return fail('ChuaDatToiThieu', couponMessages.ChuaDatToiThieu(coupon.minOrder, categoryName))
  const subtotal = ctx.lines.reduce((s, l) => s + l.lineTotal, 0)
  if (coupon.type === 'MienPhiVanChuyen' && subtotal >= SalesRules.freeShipThreshold)
    return fail('DaMienPhiVanChuyen', couponMessages.DaMienPhiVanChuyen())
  if (ctx.phoneUsedCount !== undefined && ctx.phoneUsedCount >= coupon.perCustomerLimit)
    return fail('SdtDaDungMa', couponMessages.SdtDaDungMa(coupon.code))
  return {
    code: coupon.code,
    ok: true,
    description: coupon.name,
    discount: couponDiscount(coupon, ctx.lines),
    shippingDiscount: 0,
  }
}
