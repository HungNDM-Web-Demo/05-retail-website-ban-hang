import type {
  ActorType,
  CancelReason,
  Carrier,
  DeliveryFailReason,
  OrderEventRecord,
  OrderEventType,
  OrderLineRecord,
  OrderRecord,
  OrderStatus,
  PaymentMethod,
  PricingSummary,
} from '@/types/shop'
import { STAFF_CANCELLABLE, codAmountOf } from './order-rules'
import { OrderText } from './order-text'
import { SalesRules } from './rules'
import { SalesErrors, fieldErrors, fieldMessages } from './sales-errors'
import { msOf, toIso } from './vn-time'

/**
 * Máy trạng thái đơn hàng thuần (07 §3.5, chữ §3.10). Không đọc, ghi kho: trả bản ghi mới kèm tồn cần
 * cộng/trừ và số đã bán cần cộng, để handler mock (`mock/order-workflow.ts`) và phát lại seed
 * (`lib/seed-expand.ts`) dùng **cùng một hàm** (06 §5.4). BE `OrderWorkflow.cs` cùng bảng.
 */

export type Actor = { type: ActorType; id?: string; name: string }
export const CUSTOMER_ACTOR: Actor = { type: 'Khach', name: 'Khách' }
export const SYSTEM_ACTOR: Actor = { type: 'HeThong', name: 'Hệ thống' }

export type StockDelta = { variantId: string; productId: string; delta: number }
export type SoldDelta = { productId: string; quantity: number }

export type WorkflowCommand =
  | { type: 'Confirm'; note?: string }
  | { type: 'ConfirmPayment'; transactionRef: string }
  | { type: 'Cancel'; reason: CancelReason; note?: string }
  | { type: 'Ship'; carrier: Carrier; weightGrams: number; shipperNote?: string; trackingCode: string }
  | { type: 'Deliver' }
  | { type: 'DeliveryFailed'; reason: DeliveryFailReason; note?: string }
  | { type: 'ReceiveReturn' }
  | { type: 'Refund'; refundRef: string }
  | { type: 'Note'; content: string }
  | { type: 'LabelPrinted' }

export type MachineResult = { order: OrderRecord; stock: StockDelta[]; sold: SoldDelta[] }

export type MachineOptions = {
  /** Sinh id sự kiện (seed: stableId theo chỉ số; vận hành: newId) */
  nextEventId: () => string
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

function pushEvent(
  order: OrderRecord,
  opts: MachineOptions,
  type: OrderEventType,
  at: string,
  actor: Actor,
  content: string,
  from?: OrderStatus,
  to?: OrderStatus
) {
  const e: OrderEventRecord = {
    id: opts.nextEventId(),
    type,
    at,
    actorType: actor.type,
    actorName: actor.name,
    ...(actor.id ? { actorId: actor.id } : {}),
    ...(from ? { fromStatus: from } : {}),
    ...(to ? { toStatus: to } : {}),
    content,
  }
  order.events.push(e)
}

const SMS = SYSTEM_ACTOR

function linesDelta(lines: OrderLineRecord[], sign: 1 | -1): StockDelta[] {
  return lines.map((l) => ({ variantId: l.variantId, productId: l.productId, delta: sign * l.quantity }))
}

/** Kiểm dữ liệu lệnh trước khi đổi đơn (07 §2.12 câu theo trường). Phát lại seed không gọi. */
export function validateCommand(cmd: WorkflowCommand): void {
  switch (cmd.type) {
    case 'ConfirmPayment': {
      const ref = (cmd.transactionRef ?? '').trim()
      if (!ref) throw fieldErrors({ transactionRef: fieldMessages.transactionRefEmpty })
      if (!SalesRules.transactionRefPattern.test(ref))
        throw fieldErrors({ transactionRef: fieldMessages.transactionRefFormat })
      return
    }
    case 'Refund': {
      const ref = (cmd.refundRef ?? '').trim()
      if (!ref) throw fieldErrors({ refundRef: fieldMessages.transactionRefEmpty })
      if (!SalesRules.transactionRefPattern.test(ref))
        throw fieldErrors({ refundRef: fieldMessages.transactionRefFormat })
      return
    }
    case 'Cancel':
    case 'DeliveryFailed':
      if (!cmd.reason) throw fieldErrors({ reason: fieldMessages.reason })
      if (cmd.reason === 'Khac' && !cmd.note?.trim()) throw fieldErrors({ note: fieldMessages.otherNote })
      if (cmd.note && cmd.note.length > 500) throw fieldErrors({ note: fieldMessages.note })
      return
    case 'Ship':
      if (
        !Number.isInteger(cmd.weightGrams) ||
        cmd.weightGrams < SalesRules.minWeightGrams ||
        cmd.weightGrams > SalesRules.maxWeightGrams
      )
        throw fieldErrors({ weightGrams: fieldMessages.weight })
      return
    case 'Note': {
      const c = (cmd.content ?? '').trim()
      if (!c || c.length > 500) throw fieldErrors({ content: fieldMessages.internalNote })
      return
    }
    default:
      return
  }
}

/**
 * Áp một lệnh lên đơn (bảng §3.5). Sai trạng thái → `TrangThaiKhongHopLe` (hủy từ Đang giao trở đi →
 * `KhongHuyDonDaBanGiao`). Tăng `version`, ghi sự kiện, trả tồn cần cộng và số đã bán cần cộng.
 */
export function applyCommand(
  current: OrderRecord,
  cmd: WorkflowCommand,
  actor: Actor,
  at: string,
  opts: MachineOptions
): MachineResult {
  const order = clone(current)
  const from = order.status
  let stock: StockDelta[] = []
  let sold: SoldDelta[] = []
  const requireStatus = (...allowed: OrderStatus[]) => {
    if (!allowed.includes(from)) throw SalesErrors.invalidStatus(from)
  }

  switch (cmd.type) {
    case 'Confirm':
      requireStatus('ChoXacNhan')
      order.status = 'DaXacNhan'
      pushEvent(order, opts, 'DoiTrangThai', at, actor, OrderText.confirmed(cmd.note), from, 'DaXacNhan')
      pushEvent(order, opts, 'TinGuiKhach', at, SMS, OrderText.smsConfirmed())
      break
    case 'ConfirmPayment':
      requireStatus('ChoThanhToan')
      order.status = 'DaXacNhan'
      order.paymentStatus = 'DaThanhToan'
      order.transactionRef = cmd.transactionRef.trim()
      order.paidAt = at
      pushEvent(order, opts, 'DoiTrangThai', at, actor, OrderText.paymentConfirmed(order.transactionRef), from, 'DaXacNhan')
      pushEvent(order, opts, 'TinGuiKhach', at, SMS, OrderText.smsPaymentConfirmed())
      break
    case 'Cancel': {
      if (!STAFF_CANCELLABLE.includes(from)) {
        if (['DangGiao', 'DaGiao', 'DangHoan', 'DaHoan'].includes(from)) throw SalesErrors.cannotCancelShipped()
        throw SalesErrors.invalidStatus(from)
      }
      order.status = 'DaHuy'
      order.cancelReason = cmd.reason
      order.cancelNote = cmd.note?.trim() || undefined
      order.cancelledAt = at
      order.cancelledById = actor.id
      order.cancelledByName = actor.name
      let refund: number | undefined
      if (order.paymentStatus === 'DaThanhToan') {
        order.paymentStatus = 'CanHoanTien'
        order.refundAmount = order.total
        refund = order.total
      }
      stock = linesDelta(order.lines, 1)
      pushEvent(order, opts, 'DoiTrangThai', at, actor, OrderText.cancelled(cmd.reason, cmd.note, refund), from, 'DaHuy')
      pushEvent(order, opts, 'TinGuiKhach', at, SMS, OrderText.smsCancelled())
      break
    }
    case 'Ship':
      requireStatus('DaXacNhan')
      order.status = 'DangGiao'
      order.shipment = {
        carrier: cmd.carrier,
        trackingCode: cmd.trackingCode,
        weightGrams: cmd.weightGrams,
        codAmount: codAmountOf(order),
        shipperNote: cmd.shipperNote?.trim() || undefined,
        handedOverAt: at,
        handedOverByName: actor.name,
        ...(actor.id ? { handedOverById: actor.id } : {}),
        labelPrintCount: 0,
      }
      pushEvent(order, opts, 'DoiTrangThai', at, actor, OrderText.shipped(cmd.carrier, cmd.trackingCode, cmd.weightGrams), from, 'DangGiao')
      pushEvent(order, opts, 'TinGuiKhach', at, SMS, OrderText.smsShipped(cmd.carrier, cmd.trackingCode))
      break
    case 'Deliver':
      requireStatus('DangGiao')
      order.status = 'DaGiao'
      if (order.paymentMethod === 'Cod') {
        order.paymentStatus = 'DaThanhToan'
        order.paidAt = at
      }
      if (order.shipment) order.shipment.deliveredAt = at
      sold = order.lines.map((l) => ({ productId: l.productId, quantity: l.quantity }))
      pushEvent(order, opts, 'DoiTrangThai', at, actor, OrderText.delivered(), from, 'DaGiao')
      pushEvent(order, opts, 'TinGuiKhach', at, SMS, OrderText.smsDelivered())
      break
    case 'DeliveryFailed':
      requireStatus('DangGiao')
      order.status = 'DangHoan'
      if (order.shipment) {
        order.shipment.failedAt = at
        order.shipment.failReason = cmd.reason
        order.shipment.failNote = cmd.note?.trim() || undefined
      }
      pushEvent(order, opts, 'DoiTrangThai', at, actor, OrderText.deliveryFailed(cmd.reason, cmd.note), from, 'DangHoan')
      break
    case 'ReceiveReturn':
      requireStatus('DangHoan')
      order.status = 'DaHoan'
      if (order.shipment) order.shipment.returnedAt = at
      stock = linesDelta(order.lines, 1)
      pushEvent(order, opts, 'DoiTrangThai', at, actor, OrderText.returned(), from, 'DaHoan')
      break
    case 'Refund':
      if (from !== 'DaHuy' || order.paymentStatus !== 'CanHoanTien') throw SalesErrors.noRefundNeeded()
      order.paymentStatus = 'DaHoanTien'
      order.refundRef = cmd.refundRef.trim()
      order.refundedAt = at
      pushEvent(order, opts, 'HoanTien', at, actor, OrderText.refunded(order.refundAmount ?? order.total, order.refundRef))
      break
    case 'Note':
      pushEvent(order, opts, 'GhiChuNoiBo', at, actor, cmd.content.trim())
      break
    case 'LabelPrinted':
      requireStatus('DaXacNhan', 'DangGiao', 'DangHoan', 'DaGiao', 'DaHoan')
      if (order.shipment) order.shipment.labelPrintCount += 1
      break
  }

  order.version += 1
  order.updatedAt = at
  return { order, stock, sold }
}

/** Dữ liệu tạo đơn (đặt hàng công khai, phát lại seed) */
export type NewOrderInput = {
  id: string
  code: string
  placedAt: string
  customerId: string
  paymentMethod: PaymentMethod
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
  summary: PricingSummary
  couponId?: string
  clientRequestId?: string
  deviceId?: string
}

/**
 * Tạo bản ghi đơn mới (dòng đầu §3.5): COD → Chờ xác nhận; chuyển khoản → Chờ thanh toán, hạn 24 giờ.
 * Sự kiện: DoiTrangThai (Khách) + TinGuiKhach SMS (+ email nếu có). Tồn cần trừ do người gọi áp.
 */
export function createOrderRecord(input: NewOrderInput, opts: MachineOptions): OrderRecord {
  const isTransfer = input.paymentMethod === 'ChuyenKhoan'
  const status: OrderStatus = isTransfer ? 'ChoThanhToan' : 'ChoXacNhan'
  const paymentDueAt = isTransfer
    ? toIso(msOf(input.placedAt) + SalesRules.paymentHours * 3600_000)
    : undefined
  const order: OrderRecord = {
    id: input.id,
    code: input.code,
    version: 1,
    ...(input.clientRequestId ? { clientRequestId: input.clientRequestId } : {}),
    ...(input.deviceId ? { deviceId: input.deviceId } : {}),
    placedAt: input.placedAt,
    customerId: input.customerId,
    status,
    paymentMethod: input.paymentMethod,
    paymentStatus: 'ChuaThanhToan',
    ...(paymentDueAt ? { paymentDueAt } : {}),
    recipientName: input.recipientName,
    phone: input.phone,
    ...(input.email ? { email: input.email } : {}),
    provinceCode: input.provinceCode,
    provinceName: input.provinceName,
    wardCode: input.wardCode,
    wardName: input.wardName,
    addressLine: input.addressLine,
    ...(input.customerNote ? { customerNote: input.customerNote } : {}),
    lines: input.lines,
    subtotal: input.summary.subtotal,
    discount: input.summary.discount,
    shippingFee: input.summary.shippingFee,
    shippingDiscount: input.summary.shippingDiscount,
    total: input.summary.total,
    ...(input.couponId ? { couponId: input.couponId, couponCode: input.summary.couponCode } : {}),
    events: [],
  }
  pushEvent(
    order,
    opts,
    'DoiTrangThai',
    input.placedAt,
    CUSTOMER_ACTOR,
    isTransfer ? OrderText.placedTransfer(paymentDueAt!) : OrderText.placedCod(),
    undefined,
    status
  )
  pushEvent(order, opts, 'TinGuiKhach', input.placedAt, SMS, isTransfer ? OrderText.smsPlacedTransfer() : OrderText.smsPlacedCod())
  if (input.email) pushEvent(order, opts, 'TinGuiKhach', input.placedAt, SMS, OrderText.emailPlaced(input.email))
  return order
}

/** Đơn chuyển khoản quá hạn cần hệ thống hủy (§3.5 quét quá hạn) */
export const isOverdue = (o: Pick<OrderRecord, 'status' | 'paymentDueAt'>, now: number) =>
  o.status === 'ChoThanhToan' && !!o.paymentDueAt && msOf(o.paymentDueAt) <= now

/** Hệ thống tự hủy đơn quá hạn: lý do QuaHanThanhToan, người "Hệ thống", cancelledAt = paymentDueAt */
export function cancelOverdue(order: OrderRecord, opts: MachineOptions): MachineResult {
  return applyCommand(order, { type: 'Cancel', reason: 'QuaHanThanhToan' }, SYSTEM_ACTOR, order.paymentDueAt!, opts)
}
