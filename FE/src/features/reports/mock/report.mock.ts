import { permissions } from '@/config/permissions'
import { mockDelay } from '@/lib/data-source'
import { requirePermission } from '@/mock/mock-auth'
import { isSlowDelivery } from '@/features/sales/lib/order-rules'
import { allocateDiscount, lineTotalOf, netRevenueOf } from '@/features/sales/lib/pricing'
import { fieldErrors } from '@/features/sales/lib/sales-errors'
import { addVnDays, DAY_MS, diffVnDays, msOf, vnDateKey, vnStartOfDay } from '@/features/sales/lib/vn-time'
import { colorsDb, couponsDb, liveProducts, productsDb } from '@/features/sales/mock/catalog.store'
import { sweepOverdue } from '@/features/sales/mock/order-workflow'
import { allOrders } from '@/features/sales/mock/order.store'
import type {
  CancelReason,
  CouponReportQuery,
  CouponReportRow,
  DashboardSales,
  DashboardTodo,
  DateRangeQuery,
  DeliveryFailReason,
  LowStockItem,
  OrderRecord,
  OrderStatusReport,
  OrderStatusReportQuery,
  PaymentMethod,
  ProvinceReportRow,
  RevenueReport,
  RevenueTotals,
  SalesFigures,
  TopProductRow,
  TopProductsQuery,
  TopProductsReport,
} from '@/types/shop'

/**
 * Handler mock Tổng quan, Báo cáo (07 §2.8, công thức §3.13, BR-22). Ngày theo giờ Việt Nam.
 * - Doanh thu thuần: Σ (tạm tính − giảm giá) của đơn Đã giao theo ngày giao.
 * - Giá trị đặt hàng, số đơn (báo cáo): đơn đặt trong ngày, trừ đơn Đã hủy.
 * - Số đơn mới (Tổng quan): mọi đơn đặt trong kỳ, kể cả đã hủy.
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/
/** Tỉ lệ %, 1 chữ số thập phân; mẫu số 0 → 0 */
const rate = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0)

function checkRange(q: DateRangeQuery) {
  if (!DATE.test(q.from ?? '')) throw fieldErrors({ from: 'Chọn ngày bắt đầu' })
  if (!DATE.test(q.to ?? '')) throw fieldErrors({ to: 'Chọn ngày kết thúc' })
  const days = diffVnDays(q.from, q.to) + 1
  if (days < 1) throw fieldErrors({ to: 'Ngày kết thúc phải sau ngày bắt đầu' })
  if (days > 366) throw fieldErrors({ from: 'Khoảng ngày tối đa 366 ngày' })
  return days
}

function load() {
  sweepOverdue()
  return allOrders()
}

const placedKey = (o: OrderRecord) => vnDateKey(o.placedAt)
const deliveredAt = (o: OrderRecord) => (o.status === 'DaGiao' ? o.shipment?.deliveredAt : undefined)
const inKeys = (key: string, from: string, to: string) => key >= from && key <= to

function dayKeys(from: string, to: string): string[] {
  const n = diffVnDays(from, to) + 1
  return Array.from({ length: n }, (_, i) => addVnDays(from, i))
}

function revenueByDay(orders: OrderRecord[], from: string, to: string) {
  const map = new Map(dayKeys(from, to).map((d) => [d, { orderValue: 0, netRevenue: 0, orderCount: 0 }]))
  for (const o of orders) {
    const placed = map.get(placedKey(o))
    if (placed && o.status !== 'DaHuy') {
      placed.orderValue += o.total
      placed.orderCount += 1
    }
    const d = deliveredAt(o)
    const delivered = d ? map.get(vnDateKey(d)) : undefined
    if (delivered) delivered.netRevenue += netRevenueOf(o)
  }
  return map
}

const totalsOf = (rows: { orderValue: number; netRevenue: number; orderCount: number }[]): RevenueTotals => {
  const orderValue = rows.reduce((s, r) => s + r.orderValue, 0)
  const orderCount = rows.reduce((s, r) => s + r.orderCount, 0)
  return {
    orderValue,
    netRevenue: rows.reduce((s, r) => s + r.netRevenue, 0),
    orderCount,
    avgOrderValue: orderCount ? Math.round(orderValue / orderCount) : 0,
  }
}

/** Tỉ lệ hủy, hoàn trên tập đơn đặt (§3.13) */
function cancelReturn(set: OrderRecord[]) {
  const cancelled = set.filter((o) => o.status === 'DaHuy').length
  const returned = set.filter((o) => o.status === 'DangHoan' || o.status === 'DaHoan').length
  const shipped = set.filter((o) => o.status === 'DaGiao').length + returned
  return { cancelled, returned, cancelRate: rate(cancelled, set.length), returnRate: rate(returned, shipped) }
}

/** Dòng bán (đơn Đã giao trong khoảng ms) kèm doanh thu thuần đã phân bổ giảm giá */
function soldLines(orders: OrderRecord[], start: number, end: number) {
  const productCat = new Map(productsDb.all().map((p) => [p.id, p.categoryId]))
  const rows: { line: OrderRecord['lines'][number]; net: number; categoryId?: string }[] = []
  for (const o of orders) {
    const d = deliveredAt(o)
    if (!d) continue
    const t = msOf(d)
    if (t < start || t > end) continue
    const pricing = o.lines.map((l) => ({ lineTotal: lineTotalOf(l.unitPrice, l.quantity), categoryId: productCat.get(l.productId) }))
    const scope = o.couponId ? couponsDb.get(o.couponId)?.categoryId : undefined
    const alloc = allocateDiscount(pricing, o.discount, scope)
    o.lines.forEach((l, i) => rows.push({ line: l, net: pricing[i].lineTotal - alloc[i], categoryId: pricing[i].categoryId }))
  }
  return rows
}

function figures(orders: OrderRecord[], start: number, end: number): SalesFigures {
  let netRevenue = 0
  let orderValue = 0
  let newOrders = 0
  for (const o of orders) {
    const placed = msOf(o.placedAt)
    if (placed >= start && placed <= end) {
      newOrders += 1
      if (o.status !== 'DaHuy') orderValue += o.total
    }
    const d = deliveredAt(o)
    if (d && msOf(d) >= start && msOf(d) <= end) netRevenue += netRevenueOf(o)
  }
  return { netRevenue, orderValue, newOrders }
}

export const reportMock = {
  async dashboardTodo(): Promise<DashboardTodo> {
    await mockDelay(100, 250)
    requirePermission(permissions.orders.view)
    const orders = load()
    const now = Date.now()
    const count = (fn: (o: OrderRecord) => boolean) => orders.filter(fn).length
    return {
      choXacNhan: count((o) => o.status === 'ChoXacNhan'),
      choThanhToan: count((o) => o.status === 'ChoThanhToan'),
      choBanGiao: count((o) => o.status === 'DaXacNhan'),
      dangHoan: count((o) => o.status === 'DangHoan'),
      giaoCham: count((o) => isSlowDelivery(o, now)),
      canHoanTien: count((o) => o.status === 'DaHuy' && o.paymentStatus === 'CanHoanTien'),
      asOf: new Date(now).toISOString(),
    }
  },

  async dashboardSales(): Promise<DashboardSales> {
    await mockDelay()
    requirePermission(permissions.reports.view)
    const orders = load()
    const now = Date.now()
    const today = vnDateKey(now)
    const todayStart = vnStartOfDay(today)
    const from30 = addVnDays(today, -29)
    const start30 = vnStartOfDay(from30)
    const placed30 = orders.filter((o) => inKeys(placedKey(o), from30, today))
    const cr = cancelReturn(placed30)
    const byDay = revenueByDay(orders, from30, today)

    const top = new Map<string, { quantity: number; netRevenue: number }>()
    for (const r of soldLines(orders, start30, now)) {
      const cur = top.get(r.line.productId) ?? { quantity: 0, netRevenue: 0 }
      cur.quantity += r.line.quantity
      cur.netRevenue += r.net
      top.set(r.line.productId, cur)
    }
    const products = new Map(productsDb.all().map((p) => [p.id, p]))
    const topProducts30d = [...top.entries()]
      .sort((a, b) => b[1].quantity - a[1].quantity || b[1].netRevenue - a[1].netRevenue)
      .slice(0, 5)
      .map(([productId, v]) => {
        const p = products.get(productId)
        return {
          productId,
          code: p?.code ?? '',
          name: p?.name ?? '',
          coverUrl: p ? (p.images.find((i) => i.isCover) ?? p.images[0])?.url : undefined,
          ...v,
        }
      })

    const colors = new Map(colorsDb.all().map((c) => [c.id, c]))
    const stockItems: LowStockItem[] = liveProducts()
      .filter((p) => !p.isHidden)
      .flatMap((p) =>
        p.variants
          .filter((v) => v.isActive)
          .map((v) => ({
            productId: p.id,
            variantId: v.id,
            sku: v.sku,
            productName: p.name,
            colorName: colors.get(v.colorId)?.name ?? '',
            ...(v.size ? { size: v.size } : {}),
            stock: v.stock,
          }))
      )
    return {
      today: figures(orders, todayStart, now),
      yesterdaySamePeriod: figures(orders, todayStart - DAY_MS, now - DAY_MS),
      cancelRate30d: cr.cancelRate,
      returnRate30d: cr.returnRate,
      series30d: [...byDay.entries()].map(([date, v]) => ({ date, orderValue: v.orderValue, netRevenue: v.netRevenue })),
      topProducts30d,
      lowStock: stockItems.filter((v) => v.stock >= 1 && v.stock <= 5).sort((a, b) => a.stock - b.stock || a.sku.localeCompare(b.sku)),
      outOfStock: stockItems.filter((v) => v.stock <= 0).sort((a, b) => a.sku.localeCompare(b.sku)),
      asOf: new Date(now).toISOString(),
    }
  },

  async revenue(q: DateRangeQuery): Promise<RevenueReport> {
    await mockDelay()
    requirePermission(permissions.reports.view)
    const days = checkRange(q)
    const orders = load()
    const prevTo = addVnDays(q.from, -1)
    const prevFrom = addVnDays(q.from, -days)
    const cur = revenueByDay(orders, q.from, q.to)
    const prev = revenueByDay(orders, prevFrom, prevTo)
    const rows = [...cur.entries()].map(([date, v]) => ({ date, ...totalsOf([v]) }))
    return {
      days: rows,
      totals: totalsOf([...cur.values()]),
      previous: totalsOf([...prev.values()]),
      previousDays: [...prev.entries()].map(([date, v]) => ({ date, orderValue: v.orderValue, netRevenue: v.netRevenue })),
    }
  },

  async topProducts(q: TopProductsQuery): Promise<TopProductsReport> {
    await mockDelay()
    requirePermission(permissions.reports.view)
    checkRange(q)
    const groupBy = q.groupBy ?? 'product'
    const end = vnStartOfDay(addVnDays(q.to, 1)) - 1
    const lines = soldLines(load(), vnStartOfDay(q.from), end).filter((r) => !q.categoryId || r.categoryId === q.categoryId)
    const products = new Map(productsDb.all().map((p) => [p.id, p]))
    const map = new Map<string, TopProductRow>()
    for (const { line, net } of lines) {
      const key = groupBy === 'variant' ? line.variantId : line.productId
      const p = products.get(line.productId)
      const row =
        map.get(key) ??
        ({
          key,
          productId: line.productId,
          code: p?.code ?? '',
          name: p?.name ?? line.productName,
          ...(groupBy === 'variant' ? { sku: line.sku, colorName: line.colorName, ...(line.size ? { size: line.size } : {}) } : {}),
          quantity: 0,
          netRevenue: 0,
          share: 0,
        } as TopProductRow)
      row.quantity += line.quantity
      row.netRevenue += net
      map.set(key, row)
    }
    const totalNetRevenue = [...map.values()].reduce((s, r) => s + r.netRevenue, 0)
    const rows = [...map.values()]
      .map((r) => ({ ...r, share: rate(r.netRevenue, totalNetRevenue) }))
      .sort((a, b) => b.netRevenue - a.netRevenue || b.quantity - a.quantity)
    return { groupBy, rows, totalQuantity: rows.reduce((s, r) => s + r.quantity, 0), totalNetRevenue }
  },

  async orderStatus(q: OrderStatusReportQuery): Promise<OrderStatusReport> {
    await mockDelay()
    requirePermission(permissions.reports.view)
    checkRange(q)
    const placed = load().filter((o) => inKeys(placedKey(o), q.from, q.to))
    const set = q.paymentMethod ? placed.filter((o) => o.paymentMethod === q.paymentMethod) : placed
    const cr = cancelReturn(set)
    const cancel = new Map<CancelReason, number>()
    const fail = new Map<DeliveryFailReason, number>()
    for (const o of set) {
      if (o.status === 'DaHuy' && o.cancelReason) cancel.set(o.cancelReason, (cancel.get(o.cancelReason) ?? 0) + 1)
      if (o.shipment?.failReason) fail.set(o.shipment.failReason, (fail.get(o.shipment.failReason) ?? 0) + 1)
    }
    const methods: PaymentMethod[] = q.paymentMethod ? [q.paymentMethod] : ['Cod', 'ChuyenKhoan']
    return {
      orderCount: set.length,
      cancelledCount: cr.cancelled,
      cancelRate: cr.cancelRate,
      returnCount: cr.returned,
      returnRate: cr.returnRate,
      cancelReasons: [...cancel.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
      failReasons: [...fail.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
      byPaymentMethod: methods.map((m) => {
        const sub = placed.filter((o) => o.paymentMethod === m)
        const r = cancelReturn(sub)
        return { paymentMethod: m, orderCount: sub.length, cancelRate: r.cancelRate, returnRate: r.returnRate }
      }),
    }
  },

  async provinces(q: DateRangeQuery): Promise<ProvinceReportRow[]> {
    await mockDelay()
    requirePermission(permissions.reports.view)
    checkRange(q)
    const orders = load()
    const groups = new Map<string, { name: string; placed: OrderRecord[]; net: number }>()
    const get = (o: OrderRecord) => {
      const g = groups.get(o.provinceCode) ?? { name: o.provinceName, placed: [], net: 0 }
      groups.set(o.provinceCode, g)
      return g
    }
    for (const o of orders) {
      if (inKeys(placedKey(o), q.from, q.to)) get(o).placed.push(o)
      const d = deliveredAt(o)
      if (d && inKeys(vnDateKey(d), q.from, q.to)) get(o).net += netRevenueOf(o)
    }
    return [...groups.entries()]
      .map(([provinceCode, g]) => ({
        provinceCode,
        provinceName: g.name,
        orderCount: g.placed.length,
        netRevenue: g.net,
        returnRate: cancelReturn(g.placed).returnRate,
      }))
      .filter((r) => r.orderCount > 0 || r.netRevenue > 0)
      .sort((a, b) => b.orderCount - a.orderCount || b.netRevenue - a.netRevenue)
  },

  async coupons(q: CouponReportQuery): Promise<CouponReportRow[]> {
    await mockDelay()
    requirePermission(permissions.reports.view)
    checkRange(q)
    const map = new Map<string, CouponReportRow>()
    for (const o of load()) {
      if (!o.couponId || o.status === 'DaHuy' || !inKeys(placedKey(o), q.from, q.to)) continue
      if (q.couponId && o.couponId !== q.couponId) continue
      const row = map.get(o.couponId) ?? {
        couponId: o.couponId,
        code: o.couponCode ?? couponsDb.get(o.couponId)?.code ?? '',
        usedCount: 0,
        discountTotal: 0,
        orderValue: 0,
      }
      row.usedCount += 1
      row.discountTotal += o.discount + o.shippingDiscount
      row.orderValue += o.total
      map.set(o.couponId, row)
    }
    return [...map.values()].sort((a, b) => b.usedCount - a.usedCount)
  },
}

