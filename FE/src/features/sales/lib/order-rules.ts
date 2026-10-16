import type {
  CustomerTag,
  OrderAction,
  OrderLabel,
  OrderRecord,
  OrderStatus,
  PaymentStatus,
} from '@/types/shop'
import { SalesRules } from './rules'
import { DAY_MS, msOf } from './vn-time'

/**
 * Quy tắc đơn hàng thuần (07 §3.5, §3.8, §3.9): thao tác được phép, nhãn đơn, nhãn khách, che số điện thoại.
 * BE `OrderWorkflow.cs`, `OrderLabels.cs`.
 */

export { netRevenueOf } from './pricing'

/** Trạng thái còn chờ shop xử lý (Trùng SĐT, khách tự hủy được) */
export const PENDING_STATUSES: OrderStatus[] = ['ChoThanhToan', 'ChoXacNhan']
/** Trạng thái đang xử lý (nhãn Khách cần lưu ý) */
export const PROCESSING_STATUSES: OrderStatus[] = ['ChoThanhToan', 'ChoXacNhan', 'DaXacNhan']
/** Nhân viên hủy được (BR-16) */
export const STAFF_CANCELLABLE: OrderStatus[] = ['ChoThanhToan', 'ChoXacNhan', 'DaXacNhan']
/** Trạng thái tính là hoàn hàng */
export const RETURN_STATUSES: OrderStatus[] = ['DangHoan', 'DaHoan']

/** allowedActions theo trạng thái (§3.5), không xét quyền */
export function allowedActions(order: { status: OrderStatus; paymentStatus: PaymentStatus; paymentMethod?: string }): OrderAction[] {
  switch (order.status) {
    case 'ChoThanhToan':
      return ['ConfirmPayment', 'Cancel']
    case 'ChoXacNhan':
      return order.paymentMethod === 'ChuyenKhoan' ? ['Confirm', 'Cancel'] : ['Confirm', 'Edit', 'Cancel']
    case 'DaXacNhan':
      return ['Ship', 'Cancel', 'PrintLabel']
    case 'DangGiao':
      return ['Deliver', 'DeliveryFailed', 'PrintLabel']
    case 'DangHoan':
      return ['ReceiveReturn', 'PrintLabel']
    case 'DaGiao':
    case 'DaHoan':
      return ['PrintLabel']
    case 'DaHuy':
      return order.paymentStatus === 'CanHoanTien' ? ['Refund'] : []
  }
}

/** Khách tự hủy được (BR-16) */
export const canSelfCancel = (status: OrderStatus) => PENDING_STATUSES.includes(status)

/** Giao chậm (BR-18): Đang giao và now − handedOverAt > 5 ngày */
export function isSlowDelivery(
  order: { status: OrderStatus; shipment?: { handedOverAt: string } | null },
  now: number
): boolean {
  if (order.status !== 'DangGiao' || !order.shipment) return false
  return now - msOf(order.shipment.handedOverAt) > SalesRules.slowDeliveryDays * DAY_MS
}

type LabelOrder = Pick<OrderRecord, 'id' | 'phone' | 'status' | 'placedAt' | 'shipment'>

/** Đơn chờ khác cùng số điện thoại, đặt cách nhau ≤ 24 giờ (BR-20, UC-07 4a) */
export function duplicateOrdersOf<T extends LabelOrder>(order: LabelOrder, others: T[]): T[] {
  if (!PENDING_STATUSES.includes(order.status)) return []
  const at = msOf(order.placedAt)
  const window = SalesRules.duplicateWindowHours * 3600_000
  return others.filter(
    (o) =>
      o.id !== order.id &&
      o.phone === order.phone &&
      PENDING_STATUSES.includes(o.status) &&
      Math.abs(msOf(o.placedAt) - at) <= window
  )
}

export type OrderLabelContext = {
  now: number
  /** Đơn cùng số điện thoại (hoặc mọi đơn) để tính Trùng SĐT */
  samePhoneOrders: LabelOrder[]
  /** Số đơn hoàn của khách (Đang hoàn + Đã hoàn) */
  customerReturnCount: number
}

/** Nhãn đơn tính lúc đọc (§3.8) */
export function orderLabels(order: LabelOrder, ctx: OrderLabelContext): OrderLabel[] {
  const labels: OrderLabel[] = []
  if (duplicateOrdersOf(order, ctx.samePhoneOrders).length > 0) labels.push('TrungSdt')
  if (isSlowDelivery(order, ctx.now)) labels.push('GiaoCham')
  if (ctx.customerReturnCount >= SalesRules.returnWarnCount && PROCESSING_STATUSES.includes(order.status))
    labels.push('KhachCanLuuY')
  return labels
}

/** Nhãn khách (BR-21) */
export function customerTags(c: { totalSpent: number; returnCount: number }): CustomerTag[] {
  const tags: CustomerTag[] = []
  if (c.totalSpent >= SalesRules.vipSpent) tags.push('KhachVip')
  if (c.returnCount >= SalesRules.returnWarnCount) tags.push('CanLuuY')
  return tags
}

/** Che số điện thoại (BR-28): 3 số đầu + **** + 3 số cuối */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 7) return phone
  return `${digits.slice(0, 3)}****${digits.slice(-3)}`
}

/** Chuẩn hóa số điện thoại: bỏ khoảng trắng, dấu chấm, +84 → 0 */
export function normalizePhone(phone: string | undefined | null): string {
  let digits = (phone ?? '').replace(/\D/g, '')
  if (digits.startsWith('84') && digits.length === 11) digits = `0${digits.slice(2)}`
  return digits
}

/** Tiền thu hộ (BR-17): tổng với COD chưa thanh toán, 0 với chuyển khoản */
export const codAmountOf = (o: { paymentMethod: string; total: number }) =>
  o.paymentMethod === 'Cod' ? o.total : 0
