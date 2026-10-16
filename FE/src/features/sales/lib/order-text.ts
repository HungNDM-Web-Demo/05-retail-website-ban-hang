import { cancelReasonLabels, carrierLabels, deliveryFailReasonLabels } from '@/config/shop-labels'
import type {
  CancelReason,
  Carrier,
  DeliveryFailReason,
  OrderRecord,
  PublicTimelineItem,
} from '@/types/shop'
import { money } from './money'
import { variantLabel } from './stock'
import { vnTimeDate } from './vn-time'

/**
 * Chữ trên dòng thời gian (07 §3.10). Dùng chung cho handler mock, phát lại seed, trang tra cứu.
 * BE `OrderWorkflow.cs` cùng câu.
 */
export const OrderText = {
  placedCod: () => 'Đặt hàng qua website',
  placedTransfer: (dueAt: string) => `Đặt hàng qua website, hạn thanh toán ${vnTimeDate(dueAt)}`,
  smsPlacedCod: () => 'Đã gửi SMS xác nhận đơn (giả lập)',
  smsPlacedTransfer: () => 'Đã gửi SMS hướng dẫn chuyển khoản (giả lập)',
  emailPlaced: (email: string) => `Đã gửi email xác nhận đơn tới ${email} (giả lập)`,
  confirmed: (note?: string) => note?.trim() ?? '',
  smsConfirmed: () => 'Đơn đã được xác nhận (SMS giả lập)',
  paymentConfirmed: (ref: string) => `Đã nhận tiền chuyển khoản, mã giao dịch ${ref}`,
  smsPaymentConfirmed: () => 'Đã nhận tiền, đơn đã được xác nhận (SMS giả lập)',
  edited: (changes: string[]) => `Sửa đơn: ${changes.join('; ')}`,
  cancelled: (reason: CancelReason, note?: string, refundAmount?: number) => {
    const base =
      reason === 'Khac' ? `Khác: ${note?.trim() ?? ''}` : cancelReasonLabels[reason]
    return refundAmount ? `${base} · Cần hoàn tiền ${money(refundAmount)}` : base
  },
  smsCancelled: () => 'Đơn đã hủy (SMS giả lập)',
  shipped: (carrier: Carrier, trackingCode: string, weightGrams: number) =>
    `Bàn giao ${carrierLabels[carrier]}, mã vận đơn ${trackingCode}, ${weightGrams} g`,
  smsShipped: (carrier: Carrier, trackingCode: string) =>
    `Đơn đã giao cho ${carrierLabels[carrier]}, mã vận đơn ${trackingCode} (SMS giả lập)`,
  delivered: () => 'Giao hàng thành công',
  smsDelivered: () => 'Giao hàng thành công, cảm ơn quý khách (SMS giả lập)',
  deliveryFailed: (reason: DeliveryFailReason, note?: string) =>
    reason === 'Khac'
      ? `Giao thất bại: Khác: ${note?.trim() ?? ''}`
      : `Giao thất bại: ${deliveryFailReasonLabels[reason]}`,
  returned: () => 'Đã nhận hàng hoàn về kho',
  refunded: (amount: number, ref: string) => `Đã hoàn tiền ${money(amount)}, mã giao dịch ${ref}`,
} as const

/** Câu trên trang tra cứu (cột cuối bảng §3.10) */
export const PublicText = {
  placedCod: 'Đặt hàng thành công, chờ shop xác nhận',
  placedTransfer: 'Đặt hàng thành công, chờ chuyển khoản',
  confirmed: 'Shop đã xác nhận đơn',
  paymentConfirmed: 'Shop đã nhận tiền và xác nhận đơn',
  edited: 'Shop đã cập nhật đơn theo yêu cầu của bạn',
  cancelled: (reason?: CancelReason) =>
    `Đơn đã hủy: ${reason ? cancelReasonLabels[reason] : cancelReasonLabels.Khac}`,
  shipped: (carrier: Carrier, trackingCode: string) =>
    `Đã giao cho ${carrierLabels[carrier]}, mã vận đơn ${trackingCode}`,
  delivered: 'Giao hàng thành công',
  deliveryFailed: 'Giao hàng không thành công, đơn đang hoàn về shop',
  returned: 'Đơn đã hoàn về shop',
  refunded: (amount: number) => `Shop đã hoàn tiền ${money(amount)}`,
} as const

/** Dòng thời gian cho khách (cũ trước), không có ghi chú nội bộ, tin gửi khách, tên nhân viên */
export function publicTimeline(order: OrderRecord): PublicTimelineItem[] {
  const items: PublicTimelineItem[] = []
  for (const e of order.events) {
    if (e.type === 'SuaDon') {
      items.push({ at: e.at, text: PublicText.edited })
      continue
    }
    if (e.type === 'HoanTien') {
      items.push({ at: e.at, text: PublicText.refunded(order.refundAmount ?? order.total) })
      continue
    }
    if (e.type !== 'DoiTrangThai' || !e.toStatus) continue
    const to = e.toStatus
    let text: string | undefined
    switch (to) {
      case 'ChoXacNhan':
        text = PublicText.placedCod
        break
      case 'ChoThanhToan':
        text = PublicText.placedTransfer
        break
      case 'DaXacNhan':
        text = e.fromStatus === 'ChoThanhToan' ? PublicText.paymentConfirmed : PublicText.confirmed
        break
      case 'DangGiao':
        text = order.shipment
          ? PublicText.shipped(order.shipment.carrier, order.shipment.trackingCode)
          : PublicText.delivered
        break
      case 'DaGiao':
        text = PublicText.delivered
        break
      case 'DangHoan':
        text = PublicText.deliveryFailed
        break
      case 'DaHoan':
        text = PublicText.returned
        break
      case 'DaHuy':
        text = PublicText.cancelled(order.cancelReason)
        break
    }
    if (text) items.push({ at: e.at, status: to, text })
  }
  return items
}

type EditLine = { variantId: string; productName: string; colorName: string; size?: string; quantity: number }
type EditShipping = { recipientName: string; phone: string; provinceCode: string; wardCode: string; addressLine: string }

/**
 * Danh sách thay đổi khi sửa đơn (§3.10): "{nhãn} {cũ} → {mới}", "Thêm {nhãn} × {n}", "Bỏ {nhãn}",
 * "Đổi thông tin nhận hàng", "Gỡ mã {MÃ}". Nhãn trùng giữa hai dòng thì thêm tên sản phẩm phía trước.
 */
export function describeEditChanges(
  before: { lines: EditLine[]; shipping: EditShipping },
  after: { lines: EditLine[]; shipping: EditShipping },
  removedCouponCode?: string
): string[] {
  const all = [...before.lines, ...after.lines]
  const labelCount = new Map<string, Set<string>>()
  for (const l of all) {
    const key = variantLabel(l.colorName, l.size)
    const set = labelCount.get(key) ?? new Set<string>()
    set.add(l.variantId)
    labelCount.set(key, set)
  }
  const labelOf = (l: EditLine) => {
    const key = variantLabel(l.colorName, l.size)
    return (labelCount.get(key)?.size ?? 0) > 1 ? `${l.productName} ${key}` : key
  }
  const changes: string[] = []
  for (const b of before.lines) {
    const a = after.lines.find((x) => x.variantId === b.variantId)
    if (!a) changes.push(`Bỏ ${labelOf(b)}`)
    else if (a.quantity !== b.quantity) changes.push(`${labelOf(b)} ${b.quantity} → ${a.quantity}`)
  }
  for (const a of after.lines) {
    if (!before.lines.some((b) => b.variantId === a.variantId)) changes.push(`Thêm ${labelOf(a)} × ${a.quantity}`)
  }
  const s1 = before.shipping
  const s2 = after.shipping
  if (
    s1.recipientName.trim() !== s2.recipientName.trim() ||
    s1.phone !== s2.phone ||
    s1.provinceCode !== s2.provinceCode ||
    s1.wardCode !== s2.wardCode ||
    s1.addressLine.trim() !== s2.addressLine.trim()
  )
    changes.push('Đổi thông tin nhận hàng')
  if (removedCouponCode) changes.push(`Gỡ mã ${removedCouponCode}`)
  return changes
}
