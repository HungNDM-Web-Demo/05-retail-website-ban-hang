import type { CouponType, PricingSummary, ShippingZone } from '@/types/shop'
import type { PricingLine } from './coupon-rules'
import { SalesRules } from './rules'

/**
 * Tiền đơn hàng (BR-05, BR-06, 07 §3.1–3.3, §3.13). Thuần: giỏ, thanh toán, handler mock, sửa đơn, báo cáo.
 * BE `Domain/Entities/Sales/OrderPricing.cs` cùng công thức. Mọi số tiền là số nguyên đồng.
 */

export const lineTotalOf = (unitPrice: number, quantity: number) => unitPrice * quantity

export function subtotalOf(lines: { lineTotal: number }[]): number {
  return lines.reduce((s, l) => s + l.lineTotal, 0)
}

/** Phí theo vùng; chưa chọn tỉnh → 0 (FE ghi "Chọn tỉnh/thành để tính phí") */
export function shippingFeeFor(zone?: ShippingZone | null): number {
  if (!zone) return 0
  return zone === 'TpHcm' ? SalesRules.shippingFeeHcm : SalesRules.shippingFeeOther
}

export const freeShipRemainingOf = (subtotal: number, discount: number) =>
  Math.max(0, SalesRules.freeShipThreshold - (subtotal - discount))

/** Mã đã kiểm hợp lệ, đưa vào tính tiền */
export type AppliedCoupon = { code: string; type: CouponType; discount: number }

/**
 * Tính tiền đơn (§3.1–3.3):
 * total = subtotal − discount + shippingFee; shippingFee = 0 khi subtotal − discount ≥ 499.000;
 * mã MienPhiVanChuyen hợp lệ: shippingDiscount = phí, phí = 0.
 */
export function priceOrder(input: {
  lines: PricingLine[]
  zone?: ShippingZone | null
  coupon?: AppliedCoupon | null
}): PricingSummary {
  const subtotal = subtotalOf(input.lines)
  const coupon = input.coupon ?? undefined
  const discount = coupon ? Math.max(0, Math.min(coupon.discount, subtotal)) : 0
  const fee = shippingFeeFor(input.zone)
  let shippingFee = subtotal - discount >= SalesRules.freeShipThreshold ? 0 : fee
  let shippingDiscount = 0
  if (coupon?.type === 'MienPhiVanChuyen') {
    shippingDiscount = shippingFee
    shippingFee = 0
  }
  return {
    subtotal,
    discount,
    shippingFee,
    shippingDiscount,
    total: subtotal - discount + shippingFee,
    couponCode: coupon?.code,
    freeShipRemaining: freeShipRemainingOf(subtotal, discount),
  }
}

/**
 * Phân bổ giảm giá cho từng dòng thuộc phạm vi (07 §3.13, quyết định 19): theo tỉ lệ thành tiền,
 * làm tròn xuống tới đồng, dòng thuộc phạm vi cuối cùng nhận phần dư. Trả mảng cùng độ dài `lines`.
 */
export function allocateDiscount(
  lines: PricingLine[],
  discount: number,
  scopeCategoryId?: string | null
): number[] {
  const result = lines.map(() => 0)
  if (discount <= 0) return result
  const inScope = lines
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => !scopeCategoryId || l.categoryId === scopeCategoryId)
  const base = inScope.reduce((s, { l }) => s + l.lineTotal, 0)
  if (base <= 0 || inScope.length === 0) return result
  let given = 0
  inScope.forEach(({ l, i }, k) => {
    if (k === inScope.length - 1) {
      result[i] = discount - given
    } else {
      const share = Math.floor((discount * l.lineTotal) / base)
      result[i] = share
      given += share
    }
  })
  return result
}

/** Doanh thu thuần của một đơn (BR-22): tạm tính − giảm giá, không gồm phí vận chuyển */
export const netRevenueOf = (o: { subtotal: number; discount: number }) => o.subtotal - o.discount
