import { mockDb } from '@/mock/mock-db'
import { newId } from '@/mock/mock-helpers'
import type {
  EditOrderPreview,
  EditOrderRequest,
  OrderLineRecord,
  OrderRecord,
  PaymentMethod,
  PricingSummary,
} from '@/types/shop'
import { nextOrderCode, nextTrackingCode } from '../lib/codes'
import { checkCoupon } from '../lib/coupon-rules'
import {
  applyCommand,
  cancelOverdue,
  createOrderRecord,
  isOverdue,
  validateCommand,
  type Actor,
  type WorkflowCommand,
} from '../lib/order-machine'
import { normalizePhone } from '../lib/order-rules'
import { describeEditChanges, OrderText } from '../lib/order-text'
import { lineTotalOf, priceOrder } from '../lib/pricing'
import { SalesRules } from '../lib/rules'
import { SalesErrors, fieldErrors, fieldMessages, type FieldErrors } from '../lib/sales-errors'
import {
  applySoldDeltas,
  applyStockDeltas,
  categoryMap,
  couponsDb,
  expandedSeed,
  imageForColor,
  variantIndex,
} from './catalog.store'
import { findCustomerByPhone, recalcCustomer, upsertFromOrder } from './customer.store'
import { orderViewContext, toOrderDetail } from './order-views'
import { allOrders, couponUsedCount, getOrder, phoneCouponUses, saveOrder } from './order.store'
import { publishShopEvent } from './shop-events'

/**
 * Mọi thao tác đổi đơn ở chế độ mock (07 §3.5–3.7): chuyển trạng thái qua `order-machine.ts`, áp tồn,
 * số đã bán, tính lại khách, tăng `version`, phát sự kiện giữa các tab. Handler của FE-Quản trị
 * (`features/orders/mock`) và cửa hàng (`features/shop/mock`) chỉ gọi các hàm ở đây.
 */

const machineOpts = { nextEventId: () => newId() }

// ───────────────────────── Quét quá hạn thanh toán ─────────────────────────

/**
 * Hủy đơn chuyển khoản quá hạn (07 §3.5, quyết định 14). Gọi ở đầu mọi handler có đọc đơn.
 * Trả id đơn vừa hủy.
 */
export function sweepOverdue(now = Date.now()): string[] {
  const due = allOrders().filter((o) => isOverdue(o, now))
  if (due.length === 0) return []
  mockDb.batch(() => {
    for (const hit of due) {
      const order = getOrder(hit.id)
      if (!order) continue
      const result = cancelOverdue(order, machineOpts)
      applyStockDeltas(result.stock)
      saveOrder(result.order)
      recalcCustomer(order.customerId)
    }
  })
  const ids = due.map((o) => o.id)
  publishShopEvent('orders-changed', { orderIds: ids })
  return ids
}

// ───────────────────────── Thao tác của nhân viên, khách ─────────────────────────

/** Lệnh thao tác (Ship không cần mã vận đơn: sinh trong hàm) */
export type ActionInput =
  | Exclude<WorkflowCommand, { type: 'Ship' }>
  | { type: 'Ship'; carrier: Extract<WorkflowCommand, { type: 'Ship' }>['carrier']; weightGrams: number; shipperNote?: string }

/** Lệnh không kiểm `version` (07 §2.5: ghi chú; in phiếu) */
const UNVERSIONED: ActionInput['type'][] = ['Note', 'LabelPrinted']

/** Kiểm `version` (07 §3.6): lệch → 409 DonDaBiHuy / DonDaThayDoi kèm `order` mới */
export function assertVersion(order: OrderRecord, version: number | undefined): void {
  if (version === undefined || version === null || version === order.version) return
  const detail = toOrderDetail(order)
  if (order.status === 'DaHuy') throw SalesErrors.orderCancelled(order.cancelledAt ?? order.updatedAt ?? order.placedAt, detail)
  const last = order.events[order.events.length - 1]
  const by = [...order.events].reverse().find((e) => e.actorType !== 'HeThong') ?? last
  throw SalesErrors.orderChanged(by?.actorName ?? 'Hệ thống', last?.at ?? order.placedAt, detail)
}

/**
 * Áp một thao tác lên đơn: quét quá hạn → kiểm dữ liệu → kiểm `version` → chuyển trạng thái → ghi.
 * Trả bản ghi mới (chiếu bằng `toOrderDetail`).
 */
export function applyAction(id: string, input: ActionInput, actor: Actor, version?: number): OrderRecord {
  const now = Date.now()
  sweepOverdue(now)
  const order = getOrder(id)
  if (!order) throw SalesErrors.orderNotFound()
  if (input.type === 'Cancel' && actor.type === 'NhanVien' && input.reason === 'QuaHanThanhToan')
    throw fieldErrors({ reason: fieldMessages.reason })
  const cmd: WorkflowCommand =
    input.type === 'Ship'
      ? { ...input, trackingCode: nextTrackingCode(allOrders(), input.carrier, now) }
      : input
  validateCommand(cmd)
  if (!UNVERSIONED.includes(input.type)) assertVersion(order, version)
  const result = applyCommand(order, cmd, actor, new Date(now).toISOString(), machineOpts)
  mockDb.batch(() => {
    applyStockDeltas(result.stock)
    applySoldDeltas(result.sold)
    saveOrder(result.order)
    recalcCustomer(result.order.customerId)
  })
  publishShopEvent('orders-changed', { orderIds: [id] })
  return result.order
}

// ───────────────────────── Tạo đơn ─────────────────────────

export type CreateOrderInput = {
  placedAt: string
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
  lines: Omit<OrderLineRecord, 'id'>[]
  summary: PricingSummary
  couponId?: string
  clientRequestId?: string
  deviceId?: string
}

/**
 * Tạo đơn (§2.2 bước 7): tạo hoặc cập nhật khách, sinh mã đơn, ghi sự kiện, phát `order-created`.
 * **Tồn đã được trừ trước** bằng `tryReserveStock` (bước 6) ở handler đặt hàng.
 */
export function createOrder(input: CreateOrderInput): OrderRecord {
  const customerId = upsertFromOrder({
    phone: input.phone,
    name: input.recipientName,
    email: input.email,
    provinceCode: input.provinceCode,
    wardCode: input.wardCode,
    addressLine: input.addressLine,
    at: input.placedAt,
  })
  const order = createOrderRecord(
    {
      ...input,
      id: newId(),
      code: nextOrderCode(allOrders(), input.placedAt),
      customerId,
      lines: input.lines.map((l) => ({ ...l, id: newId() })),
    },
    machineOpts
  )
  mockDb.batch(() => {
    saveOrder(order)
    recalcCustomer(customerId)
  })
  publishShopEvent('order-created', { orderId: order.id, code: order.code, status: order.status, total: order.total })
  publishShopEvent('orders-changed', { orderIds: [order.id] })
  return order
}

// ───────────────────────── Sửa đơn (BR-15, UC-08 2a) ─────────────────────────

type EditPlan = {
  order: OrderRecord
  lines: OrderLineRecord[]
  summary: PricingSummary
  couponRemoved: boolean
  couponMessage?: string
  changes: string[]
  stockDeltas: { variantId: string; productId: string; delta: number }[]
  provinceName: string
  wardName: string
}

function planEdit(order: OrderRecord, req: EditOrderRequest): EditPlan {
  if (order.status !== 'ChoXacNhan' || order.paymentMethod !== 'Cod') throw SalesErrors.onlyEditCod()

  // Dữ liệu (BR-07, BR-03)
  const errors: FieldErrors = {}
  const name = (req.recipientName ?? '').trim()
  const phone = normalizePhone(req.phone)
  const address = (req.addressLine ?? '').trim()
  if (name.length < 2 || name.length > 100) errors.recipientName = fieldMessages.fullName
  if (!SalesRules.phonePattern.test(phone)) errors.phone = fieldMessages.phone
  if (req.email?.trim() && !SalesRules.emailPattern.test(req.email.trim())) errors.email = fieldMessages.email
  const province = expandedSeed().provinces.find((p) => p.code === req.provinceCode)
  if (!province) errors.provinceCode = fieldMessages.provinceCode
  const ward = province?.wards.find((w) => w.code === req.wardCode)
  if (!ward) errors.wardCode = fieldMessages.wardCode
  if (address.length < 5 || address.length > 200) errors.addressLine = fieldMessages.addressLine
  if (!req.lines?.length) errors.lines = 'Giỏ hàng trống'
  req.lines?.forEach((l, i) => {
    if (!Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > SalesRules.maxQuantityPerLine)
      errors[`lines[${i}].quantity`] = fieldMessages.quantity
  })
  if (Object.keys(errors).length) throw fieldErrors(errors)
  // Gộp dòng trùng biến thể (như BE `PlanEditAsync`)
  const mergedLines = new Map<string, { variantId: string; quantity: number }>()
  for (const l of req.lines) {
    const prev = mergedLines.get(l.variantId)
    mergedLines.set(l.variantId, { variantId: l.variantId, quantity: (prev?.quantity ?? 0) + l.quantity })
  }
  if ([...mergedLines.values()].some((l) => l.quantity > SalesRules.maxQuantityPerLine))
    throw fieldErrors({ lines: fieldMessages.quantity })
  req = { ...req, lines: [...mergedLines.values()] }

  // Dòng mới: giữ ảnh chụp, đơn giá của dòng cũ cùng biến thể; dòng thêm lấy giá hiện tại
  const index = variantIndex()
  const lines: OrderLineRecord[] = []
  const stockIssues: { variantId: string; stock: number }[] = []
  const stockErrors: FieldErrors = {}
  let firstIssue: { productName: string; colorName: string; size?: string; stock: number } | undefined
  req.lines.forEach((l, i) => {
    const old = order.lines.find((x) => x.variantId === l.variantId)
    const hit = index.get(l.variantId)
    if (!old && (!hit || !hit.variant.isActive || hit.product.isHidden))
      throw SalesErrors.productDiscontinued(hit?.product.name ?? 'Sản phẩm', [l.variantId])
    const delta = l.quantity - (old?.quantity ?? 0)
    const stock = hit?.variant.stock ?? 0
    if (delta > stock) {
      const available = stock + (old?.quantity ?? 0)
      stockIssues.push({ variantId: l.variantId, stock: available })
      stockErrors[`lines[${i}]`] = fieldMessages.stockLeft(available)
      firstIssue ??= {
        productName: old?.productName ?? hit!.product.name,
        colorName: old?.colorName ?? hit?.color?.name ?? '',
        size: old?.size ?? hit?.variant.size,
        stock: available,
      }
    }
    lines.push(
      old
        ? { ...old, quantity: l.quantity }
        : {
            id: newId(),
            variantId: hit!.variant.id,
            productId: hit!.product.id,
            productName: hit!.product.name,
            sku: hit!.variant.sku,
            colorName: hit!.color?.name ?? '',
            ...(hit!.variant.size ? { size: hit!.variant.size } : {}),
            imageUrl: imageForColor(hit!.product, hit!.variant.colorId),
            unitPrice: hit!.product.price,
            quantity: l.quantity,
          }
    )
  })
  if (firstIssue) throw SalesErrors.notEnoughStock(firstIssue, stockIssues, stockErrors)

  const stockDeltas = [
    ...lines.map((l) => ({
      variantId: l.variantId,
      productId: l.productId,
      delta: -(l.quantity - (order.lines.find((x) => x.variantId === l.variantId)?.quantity ?? 0)),
    })),
    ...order.lines
      .filter((o) => !lines.some((l) => l.variantId === o.variantId))
      .map((o) => ({ variantId: o.variantId, productId: o.productId, delta: o.quantity })),
  ].filter((d) => d.delta !== 0)

  // Tiền, mã (kiểm lại; không hợp lệ thì gỡ)
  const cats = new Map([...index.values()].map((h) => [h.product.id, h.product.categoryId]))
  const pricingLines = lines.map((l) => ({ lineTotal: lineTotalOf(l.unitPrice, l.quantity), categoryId: cats.get(l.productId) }))
  let applied: { code: string; type: 'PhanTram' | 'SoTien' | 'MienPhiVanChuyen'; discount: number } | null = null
  let couponRemoved = false
  let couponMessage: string | undefined
  if (order.couponId) {
    const coupon = couponsDb.get(order.couponId)
    const orders = allOrders()
    const check = checkCoupon(coupon, order.couponCode ?? '', {
      now: Date.now(),
      lines: pricingLines,
      usedCount: Math.max(0, couponUsedCount(order.couponId, orders) - 1),
      categoryName: coupon?.categoryId ? categoryMap().get(coupon.categoryId)?.name : undefined,
      phoneUsedCount: phoneCouponUses(phone, order.couponId, order.id, orders),
    })
    if (check.ok && coupon) applied = { code: coupon.code, type: coupon.type, discount: check.discount }
    else {
      couponRemoved = true
      couponMessage = check.message
    }
  }
  const summary = priceOrder({ lines: pricingLines, zone: province!.zone, coupon: applied })
  const changes = describeEditChanges(
    { lines: order.lines, shipping: order },
    {
      lines,
      shipping: { recipientName: name, phone, provinceCode: province!.code, wardCode: ward!.code, addressLine: address },
    },
    couponRemoved ? order.couponCode : undefined
  )
  return {
    order,
    lines,
    summary,
    couponRemoved,
    couponMessage,
    changes,
    stockDeltas,
    provinceName: province!.name,
    wardName: ward!.name,
  }
}

/** Xem trước sửa đơn, không lưu (UC-08 E3) */
export function previewEdit(id: string, req: EditOrderRequest): EditOrderPreview {
  sweepOverdue()
  const order = getOrder(id)
  if (!order) throw SalesErrors.orderNotFound()
  const plan = planEdit(order, req)
  const slugs = orderViewContext().slugs
  return {
    lines: plan.lines.map((l) => ({
      productName: l.productName,
      slug: slugs.get(l.productId),
      sku: l.sku,
      colorName: l.colorName,
      size: l.size,
      imageUrl: l.imageUrl,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      lineTotal: lineTotalOf(l.unitPrice, l.quantity),
    })),
    summary: plan.summary,
    couponRemoved: plan.couponRemoved,
    couponMessage: plan.couponMessage,
    changes: plan.changes,
  }
}

/** Lưu sửa đơn (FR-26, BR-15): tồn ± chênh lệch, tính lại tiền, gỡ mã nếu không hợp lệ, sự kiện SuaDon */
export function editOrder(id: string, req: EditOrderRequest, actor: Actor): OrderRecord {
  sweepOverdue()
  const order = getOrder(id)
  if (!order) throw SalesErrors.orderNotFound()
  assertVersion(order, req.version)
  const plan = planEdit(order, req)
  const at = new Date().toISOString()
  // Đổi số điện thoại → đơn thuộc hồ sơ khách của số mới, chưa có thì tạo (FR-34, như BE)
  const newPhone = normalizePhone(req.phone)
  const customerId =
    newPhone === order.phone
      ? order.customerId
      : (findCustomerByPhone(newPhone)?.id ??
        upsertFromOrder({
          phone: newPhone,
          name: req.recipientName.trim(),
          email: req.email?.trim() || undefined,
          provinceCode: req.provinceCode,
          wardCode: req.wardCode,
          addressLine: req.addressLine.trim(),
          at: order.placedAt,
        }))
  const next: OrderRecord = {
    ...order,
    customerId,
    recipientName: req.recipientName.trim(),
    phone: normalizePhone(req.phone),
    email: req.email?.trim() || undefined,
    provinceCode: req.provinceCode,
    provinceName: plan.provinceName,
    wardCode: req.wardCode,
    wardName: plan.wardName,
    addressLine: req.addressLine.trim(),
    lines: plan.lines,
    subtotal: plan.summary.subtotal,
    discount: plan.summary.discount,
    shippingFee: plan.summary.shippingFee,
    shippingDiscount: plan.summary.shippingDiscount,
    total: plan.summary.total,
    couponId: plan.couponRemoved ? undefined : order.couponId,
    couponCode: plan.couponRemoved ? undefined : order.couponCode,
    version: order.version + 1,
    updatedAt: at,
    events: plan.changes.length
      ? [
          ...order.events,
          {
            id: newId(),
            type: 'SuaDon',
            at,
            actorType: actor.type,
            actorName: actor.name,
            ...(actor.id ? { actorId: actor.id } : {}),
            content: OrderText.edited(plan.changes),
          },
        ]
      : order.events,
  }
  mockDb.batch(() => {
    applyStockDeltas(plan.stockDeltas)
    saveOrder(next)
    recalcCustomer(next.customerId)
    if (order.customerId !== next.customerId) recalcCustomer(order.customerId)
  })
  publishShopEvent('orders-changed', { orderIds: [id] })
  return next
}

/** Ghi đã in phiếu (UC-10 5a): tăng `labelPrintCount`, `version` */
export function markLabelPrinted(id: string, actor: Actor): number {
  const order = applyAction(id, { type: 'LabelPrinted' }, actor)
  return order.shipment?.labelPrintCount ?? 0
}
