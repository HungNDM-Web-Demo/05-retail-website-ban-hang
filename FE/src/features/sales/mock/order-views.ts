import { getSettingsMap } from '@/mock/system-data'
import type {
  CustomerRecord,
  OrderDetailDto,
  OrderLineDto,
  OrderLineView,
  OrderListItem,
  OrderRecord,
  PlacedOrderSummary,
  PricingSummary,
  PublicOrderView,
  PublicStoreInfo,
} from '@/types/shop'
import { allowedActions, canSelfCancel, codAmountOf, customerTags, duplicateOrdersOf, maskPhone, orderLabels } from '../lib/order-rules'
import { publicTimeline } from '../lib/order-text'
import { freeShipRemainingOf, lineTotalOf } from '../lib/pricing'
import { storeInfoFromSettings, transferInfoOf } from '../lib/store-info'
import { productsDb } from './catalog.store'
import { customersDb } from './customer.store'
import { allOrders } from './order.store'

/**
 * Chiếu bản ghi đơn sang DTO (07 §2.2, §2.5). Dùng chung: handler đơn hàng quản trị (FE-Quản trị),
 * trang công khai, lỗi 409 kèm `order`. Nhãn tính lúc đọc (§3.8).
 */

/** Thông tin cửa hàng từ cài đặt hiện tại (mock) */
export const currentStoreInfo = (): PublicStoreInfo => storeInfoFromSettings(getSettingsMap())

export type OrderViewContext = {
  now: number
  byPhone: Map<string, OrderRecord[]>
  customers: Map<string, CustomerRecord>
  slugs: Map<string, string>
}

/** Ngữ cảnh tính nhãn cho nhiều đơn một lần (danh sách 800 đơn < 1 giây, NFR-06) */
export function orderViewContext(orders: OrderRecord[] = allOrders(), now = Date.now()): OrderViewContext {
  const byPhone = new Map<string, OrderRecord[]>()
  for (const o of orders) byPhone.set(o.phone, [...(byPhone.get(o.phone) ?? []), o])
  return {
    now,
    byPhone,
    customers: new Map(customersDb.all().map((c) => [c.id, c])),
    slugs: new Map(productsDb.all().map((p) => [p.id, p.slug])),
  }
}

export const summaryOf = (o: OrderRecord): PricingSummary => ({
  subtotal: o.subtotal,
  discount: o.discount,
  shippingFee: o.shippingFee,
  shippingDiscount: o.shippingDiscount,
  total: o.total,
  ...(o.couponCode ? { couponCode: o.couponCode } : {}),
  freeShipRemaining: freeShipRemainingOf(o.subtotal, o.discount),
})

function linesOf(o: OrderRecord, slugs: Map<string, string>): OrderLineDto[] {
  return o.lines.map((l) => ({
    ...l,
    slug: slugs.get(l.productId),
    lineTotal: lineTotalOf(l.unitPrice, l.quantity),
  }))
}

/** Bỏ id nội bộ của dòng đơn cho API công khai */
function toLineView(l: OrderLineDto): OrderLineView {
  return {
    productName: l.productName,
    slug: l.slug,
    sku: l.sku,
    colorName: l.colorName,
    size: l.size,
    imageUrl: l.imageUrl,
    unitPrice: l.unitPrice,
    quantity: l.quantity,
    lineTotal: l.lineTotal,
  }
}

function labelsOf(o: OrderRecord, ctx: OrderViewContext) {
  return orderLabels(o, {
    now: ctx.now,
    samePhoneOrders: ctx.byPhone.get(o.phone) ?? [],
    customerReturnCount: ctx.customers.get(o.customerId)?.returnCount ?? 0,
  })
}

export function toOrderListItem(o: OrderRecord, ctx: OrderViewContext): OrderListItem {
  const customer = ctx.customers.get(o.customerId)
  return {
    id: o.id,
    code: o.code,
    placedAt: o.placedAt,
    customerId: o.customerId,
    customerName: customer?.name ?? o.recipientName,
    phone: o.phone,
    provinceName: o.provinceName,
    itemCount: o.lines.reduce((s, l) => s + l.quantity, 0),
    total: o.total,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    status: o.status,
    labels: labelsOf(o, ctx),
    ...(o.couponCode ? { couponCode: o.couponCode } : {}),
    version: o.version,
  }
}

export function toOrderDetail(o: OrderRecord, ctx: OrderViewContext = orderViewContext()): OrderDetailDto {
  const customer = ctx.customers.get(o.customerId)
  const dups = duplicateOrdersOf(o, ctx.byPhone.get(o.phone) ?? [])
  const { shipment } = o
  return {
    id: o.id,
    code: o.code,
    version: o.version,
    placedAt: o.placedAt,
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    paymentDueAt: o.paymentDueAt,
    transactionRef: o.transactionRef,
    paidAt: o.paidAt,
    refundAmount: o.refundAmount,
    refundRef: o.refundRef,
    refundedAt: o.refundedAt,
    customer: {
      id: o.customerId,
      name: customer?.name ?? o.recipientName,
      phone: customer?.phone ?? o.phone,
      returnCount: customer?.returnCount ?? 0,
      orderCount: customer?.orderCount ?? 1,
      tags: customer ? customerTags(customer) : [],
      note: customer?.note,
    },
    recipientName: o.recipientName,
    phone: o.phone,
    email: o.email,
    provinceCode: o.provinceCode,
    provinceName: o.provinceName,
    wardCode: o.wardCode,
    wardName: o.wardName,
    addressLine: o.addressLine,
    customerNote: o.customerNote,
    lines: linesOf(o, ctx.slugs),
    subtotal: o.subtotal,
    discount: o.discount,
    shippingFee: o.shippingFee,
    shippingDiscount: o.shippingDiscount,
    total: o.total,
    codAmount: shipment?.codAmount ?? codAmountOf(o),
    couponId: o.couponId,
    couponCode: o.couponCode,
    cancelReason: o.cancelReason,
    cancelNote: o.cancelNote,
    cancelledAt: o.cancelledAt,
    cancelledByName: o.cancelledByName,
    labels: labelsOf(o, ctx),
    duplicateOrders: dups.map((d) => ({ id: d.id, code: d.code, status: d.status, placedAt: d.placedAt })),
    ...(shipment
      ? {
          shipment: {
            carrier: shipment.carrier,
            trackingCode: shipment.trackingCode,
            weightGrams: shipment.weightGrams,
            codAmount: shipment.codAmount,
            shipperNote: shipment.shipperNote,
            handedOverAt: shipment.handedOverAt,
            handedOverByName: shipment.handedOverByName,
            deliveredAt: shipment.deliveredAt,
            failedAt: shipment.failedAt,
            failReason: shipment.failReason,
            failNote: shipment.failNote,
            returnedAt: shipment.returnedAt,
            labelPrintCount: shipment.labelPrintCount,
          },
        }
      : {}),
    events: o.events.map((e) => {
      const copy = { ...e }
      delete copy.actorId
      return copy
    }),
    allowedActions: allowedActions(o),
  }
}

/** Kết quả đặt hàng cho trang thành công (07 §2.2) */
export function toPlacedOrderSummary(o: OrderRecord, store: PublicStoreInfo = currentStoreInfo()): PlacedOrderSummary {
  const slugs = new Map(productsDb.all().map((p) => [p.id, p.slug]))
  return {
    code: o.code,
    placedAt: o.placedAt,
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    paymentDueAt: o.paymentDueAt,
    recipientName: o.recipientName,
    phone: o.phone,
    email: o.email,
    provinceName: o.provinceName,
    wardName: o.wardName,
    addressLine: o.addressLine,
    customerNote: o.customerNote,
    lines: linesOf(o, slugs).map(toLineView),
    summary: summaryOf(o),
    ...(o.paymentMethod === 'ChuyenKhoan' ? { transfer: transferInfoOf(o, store) } : {}),
  }
}

/** Đơn cho trang tra cứu (BR-28): che số, chỉ phường/xã + tỉnh, không ghi chú nội bộ, không tên nhân viên */
export function toPublicOrderView(o: OrderRecord, store: PublicStoreInfo = currentStoreInfo()): PublicOrderView {
  const slugs = new Map(productsDb.all().map((p) => [p.id, p.slug]))
  return {
    code: o.code,
    placedAt: o.placedAt,
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    paymentDueAt: o.paymentDueAt,
    recipientName: o.recipientName,
    maskedPhone: maskPhone(o.phone),
    wardName: o.wardName,
    provinceName: o.provinceName,
    lines: linesOf(o, slugs).map(toLineView),
    summary: summaryOf(o),
    ...(o.shipment
      ? {
          shipment: {
            carrier: o.shipment.carrier,
            trackingCode: o.shipment.trackingCode,
            handedOverAt: o.shipment.handedOverAt,
            deliveredAt: o.shipment.deliveredAt,
          },
        }
      : {}),
    timeline: publicTimeline(o),
    cancelReason: o.cancelReason,
    canCancel: canSelfCancel(o.status),
    ...(o.status === 'ChoThanhToan' ? { transfer: transferInfoOf(o, store) } : {}),
  }
}
