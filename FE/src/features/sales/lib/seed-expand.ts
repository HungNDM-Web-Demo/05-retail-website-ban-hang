import demoDataJson from '@/mock/seed/demo-data.json'
import { stableId } from '@/mock/mock-helpers'
import { systemSeed } from '@/mock/system-seed'
import type {
  Banner,
  CategoryRecord,
  ColorRecord,
  CouponRecord,
  CustomerRecord,
  DemoDataSeed,
  OrderLineRecord,
  OrderRecord,
  ProductImageDto,
  ProductRecord,
  ProvinceDto,
  SeedAt,
  StockAdjustmentRecord,
  VariantRecord,
} from '@/types/shop'
import { carrierFromPrefix } from './codes'
import { couponDiscount } from './coupon-rules'
import {
  applyCommand,
  cancelOverdue,
  createOrderRecord,
  isOverdue,
  CUSTOMER_ACTOR,
  SYSTEM_ACTOR,
  type Actor,
  type MachineResult,
  type StockDelta,
  type WorkflowCommand,
} from './order-machine'
import { RETURN_STATUSES } from './order-rules'
import { lineTotalOf, priceOrder } from './pricing'
import { skuOf, slugify, uniqueSlug } from './stock'
import { addVnDays, floorToMinute, MINUTE_MS, msOf, toIso, vnAt, vnDateKey, vnStartOfDay, vnYyMMdd } from './vn-time'

/**
 * Suy ra bản ghi từ `demo-data.json` (06 §5) — hàm thuần, dùng chung cho kho mock (trình duyệt) và
 * `serverFetch` phía máy chủ. Phát lại sự kiện đơn qua **cùng hàm chuyển trạng thái** với handler
 * (`order-machine.ts`), tính tiền bằng `pricing.ts`, rồi quét quá hạn. BE `DemoDataSeeder` làm giống hệt.
 */

export const demoData = demoDataJson as unknown as DemoDataSeed

export type ExpandedSeed = {
  seedNow: string
  colors: ColorRecord[]
  categories: CategoryRecord[]
  products: ProductRecord[]
  coupons: CouponRecord[]
  customers: CustomerRecord[]
  stockAdjustments: StockAdjustmentRecord[]
  /** Mọi đơn (796) ở trạng thái sau khi nạp */
  orders: OrderRecord[]
  /** Id đơn lịch sử (có `d`, mọi sự kiện dạng số): chỉ dựng trong bộ nhớ, không ghi localStorage (07 §4.8) */
  historyOrderIds: Set<string>
  provinces: ProvinceDto[]
  banners: Banner[]
}

// ───────────────────────── Id cố định (06 §5.2) ─────────────────────────

export const seedIds = {
  category: (code: string) => stableId('category', code),
  color: (code: string) => stableId('color', code),
  product: (code: string) => stableId('product', code),
  variant: (sku: string) => stableId('variant', sku),
  image: (file: string) => stableId('image', file),
  coupon: (code: string) => stableId('coupon', code),
  customer: (phone: string) => stableId('customer', phone),
  order: (index: number) => stableId('order', index),
  orderLine: (orderIndex: number, lineIndex: number) => stableId('order-line', orderIndex, lineIndex),
  orderEvent: (orderIndex: number, eventIndex: number) => stableId('order-event', orderIndex, eventIndex),
  province: (code: string) => stableId('province', code),
  stockAdjustment: (index: number) => stableId('stock-adjustment', index),
  user: (username: string) => stableId('user', username),
}

/** Tài khoản theo tên đăng nhập (họ tên chụp vào sự kiện) */
export function staffActor(username: string): Actor {
  const user = systemSeed.users.find((u) => u.username === username)
  return { type: 'NhanVien', id: seedIds.user(username), name: user?.fullName ?? username }
}

/** Danh mục hành chính (chỉ đọc, 06 §5.5) */
export function seedProvinces(data: DemoDataSeed = demoData): ProvinceDto[] {
  return data.provinces.map((p) => ({
    code: p.code,
    name: p.name,
    zone: p.zone ?? 'TinhKhac',
    wards: p.wards.map(([code, name]) => ({ code, name })),
  }))
}

/** Banner trang chủ đọc thẳng từ seed (quyết định 9) */
export function seedBanners(data: DemoDataSeed = demoData): Banner[] {
  return data.banners.map((b) => ({
    imageUrl: `/seed/banners/${b.image}`,
    title: b.title,
    subtitle: b.subtitle,
    link: b.link,
    buttonText: b.buttonText,
  }))
}

const RELATIVE = /^(daysAgo|dayOffset):(-?\d+)(?:@(\d{1,2}:\d{2}))?$/

/** "dayOffset:N@HH:mm" | "daysAgo:N@HH:mm" theo giờ Việt Nam so với ngày của `now` */
export function resolveVnRelative(value: string, now: number): string {
  const m = RELATIVE.exec(value)
  if (!m) return value
  const n = Number(m[2])
  const offset = m[1] === 'daysAgo' ? -n : n
  const day = addVnDays(vnDateKey(now), offset)
  return toIso(m[3] ? vnAt(day, m[3]) : vnStartOfDay(day) + (now - vnStartOfDay(vnDateKey(now))))
}

// ───────────────────────── Bản ghi danh mục ─────────────────────────

function buildCatalog(data: DemoDataSeed, now: number) {
  const today = vnDateKey(now)
  const longAgo = toIso(vnAt(addVnDays(today, -200), '09:00'))
  const colors: ColorRecord[] = data.colors.map((c) => ({
    id: seedIds.color(c.code),
    code: c.code,
    name: c.name,
    hex: c.hex,
    sortOrder: c.sortOrder,
    createdAt: longAgo,
  }))
  const categories: CategoryRecord[] = data.categories.map((c) => ({
    id: seedIds.category(c.code),
    code: c.code,
    name: c.name,
    slug: c.slug,
    imageUrl: `/seed/categories/${c.image}`,
    color: c.color,
    sortOrder: c.sortOrder,
    isVisible: true,
    createdAt: longAgo,
  }))
  const slugs = new Set<string>()
  const products: ProductRecord[] = data.products.map((p) => {
    const slug = uniqueSlug(slugify(p.name), (s) => slugs.has(s))
    slugs.add(slug)
    const off = new Set(p.off ?? [])
    const variants: VariantRecord[] = []
    for (const colorCode of p.colors) {
      const sizes = p.sizes.length > 0 ? p.sizes : [undefined]
      for (const size of sizes) {
        const key = size ? `${colorCode}-${size}` : colorCode
        const sku = skuOf(p.code, colorCode, size)
        variants.push({
          id: seedIds.variant(sku),
          sku,
          colorId: seedIds.color(colorCode),
          ...(size ? { size } : {}),
          stock: p.stock[key] ?? 0,
          isActive: !off.has(key),
        })
      }
    }
    const images: ProductImageDto[] = p.images.map(([file, colorCode], i) => ({
      id: seedIds.image(file),
      url: `/seed/products/${file}`,
      ...(colorCode ? { colorId: seedIds.color(colorCode) } : {}),
      sortOrder: i,
      isCover: i === 0,
    }))
    const createdAt = toIso(vnStartOfDay(addVnDays(today, -p.createdDaysAgo)) + p.sortOrder * 1000)
    return {
      id: seedIds.product(p.code),
      code: p.code,
      name: p.name,
      slug,
      categoryId: seedIds.category(p.category),
      price: p.price,
      ...(p.listPrice ? { listPrice: p.listPrice } : {}),
      description: p.description,
      ...(p.sizeChart && data.sizeCharts[p.sizeChart] ? { sizeChart: data.sizeCharts[p.sizeChart] } : {}),
      isFeatured: !!p.featured,
      isHidden: !!p.hidden,
      colorIds: p.colors.map((c) => seedIds.color(c)),
      sizes: [...p.sizes],
      images,
      variants,
      soldCount: 0,
      sortOrder: p.sortOrder,
      createdAt,
    }
  })
  const coupons: CouponRecord[] = data.coupons.map((c) => {
    const startAt = resolveVnRelative(c.start, now)
    return {
      id: seedIds.coupon(c.code),
      code: c.code,
      name: c.name,
      type: c.type,
      value: c.value,
      ...(c.maxDiscount !== undefined ? { maxDiscount: c.maxDiscount } : {}),
      minOrder: c.minOrder,
      ...(c.scope ? { categoryId: seedIds.category(c.scope) } : {}),
      ...(c.totalLimit !== undefined ? { totalLimit: c.totalLimit } : {}),
      perCustomerLimit: c.perCustomer ?? 1,
      startAt,
      endAt: resolveVnRelative(c.end, now),
      isPaused: false,
      createdAt: toIso(msOf(startAt) - 3 * 86_400_000),
    }
  })
  return { colors, categories, products, coupons }
}

// ───────────────────────── Đơn hàng ─────────────────────────

const atOf = (at: SeedAt, placedAt: number, now: number): number =>
  typeof at === 'number' ? placedAt + at * MINUTE_MS : now - Number(String(at).slice(2)) * MINUTE_MS

function actorOf(by: string): Actor {
  if (by === 'K') return CUSTOMER_ACTOR
  if (by === 'S') return SYSTEM_ACTOR
  return staffActor(by)
}

/** Dựng toàn bộ dữ liệu từ seed tại thời điểm nạp `now` (ms, làm tròn phút bên trong). */
export function expandSeed(nowInput: number, data: DemoDataSeed = demoData): ExpandedSeed {
  const now = floorToMinute(nowInput)
  const today = vnDateKey(now)
  const { colors, categories, products, coupons } = buildCatalog(data, now)
  const provinces = seedProvinces(data)

  const colorByCode = new Map(data.colors.map((c) => [c.code, c]))
  const productByCode = new Map(products.map((p) => [p.code, p]))
  const variantBySku = new Map<string, { product: ProductRecord; variant: VariantRecord }>()
  for (const product of products)
    for (const variant of product.variants) variantBySku.set(variant.sku, { product, variant })
  const couponByCode = new Map(coupons.map((c) => [c.code, c]))
  const provinceByCode = new Map(provinces.map((p) => [p.code, p]))
  const customerSeedByPhone = new Map(data.customers.map((c) => [c.phone, c]))

  // 1. Thời điểm đặt, mã đơn theo (PlacedAt, chỉ số) trong ngày
  const placed = data.orders.map((o, index) => ({
    index,
    o,
    placedAt: o.d !== undefined ? vnAt(addVnDays(today, o.d), String(o.t)) : now + Number(o.t) * MINUTE_MS,
  }))
  const codeOf = new Map<number, string>()
  const byDay = new Map<string, typeof placed>()
  for (const p of placed) {
    const key = vnYyMMdd(p.placedAt)
    const list = byDay.get(key) ?? []
    list.push(p)
    byDay.set(key, list)
  }
  for (const [day, list] of byDay) {
    list.sort((a, b) => a.placedAt - b.placedAt || a.index - b.index)
    list.forEach((p, i) => codeOf.set(p.index, `DH${day}${String(i + 1).padStart(4, '0')}`))
  }

  // 2. Mã vận đơn theo (HandedOverAt, mã đơn) của từng đơn vị trong ngày
  const trackingOf = new Map<string, string>() // `${orderIndex}`
  const ships: { index: number; at: number; prefix: string; code: string }[] = []
  for (const p of placed) {
    for (const ev of p.o.ev ?? []) {
      if (ev[0] === 'sh') ships.push({ index: p.index, at: atOf(ev[1], p.placedAt, now), prefix: ev[3], code: codeOf.get(p.index)! })
    }
  }
  ships.sort((a, b) => a.at - b.at || a.code.localeCompare(b.code))
  const shipCounter = new Map<string, number>()
  for (const s of ships) {
    const key = `${s.prefix}${vnYyMMdd(s.at)}`
    const n = (shipCounter.get(key) ?? 0) + 1
    shipCounter.set(key, n)
    trackingOf.set(String(s.index), `${key}${String(n).padStart(4, '0')}`)
  }

  // 3. Tạo đơn, phát lại sự kiện
  const stockDeltas: StockDelta[] = []
  const historyOrderIds = new Set<string>()
  const orders: OrderRecord[] = placed.map(({ index, o, placedAt }) => {
    const cust = customerSeedByPhone.get(o.c)
    if (!cust) throw new Error(`[seed] Không có khách ${o.c}`)
    const province = provinceByCode.get(cust.province)
    const ward = province?.wards.find((w) => w.code === cust.ward)
    const lines: OrderLineRecord[] = o.it.map(([sku, quantity], li) => {
      const found = variantBySku.get(sku)
      if (!found) throw new Error(`[seed] Không có SKU ${sku}`)
      const { product, variant } = found
      const colorCode = sku.split('-')[1]
      const image = product.images.find((im) => im.colorId === variant.colorId) ?? product.images[0]
      return {
        id: seedIds.orderLine(index, li),
        variantId: variant.id,
        productId: product.id,
        productName: product.name,
        sku,
        colorName: colorByCode.get(colorCode)?.name ?? colorCode,
        ...(variant.size ? { size: variant.size } : {}),
        ...(image ? { imageUrl: image.url } : {}),
        unitPrice: product.price,
        quantity,
      }
    })
    const pricingLines = lines.map((l) => ({
      lineTotal: lineTotalOf(l.unitPrice, l.quantity),
      categoryId: productByCode.get(l.sku.split('-')[0])?.categoryId,
    }))
    const coupon = o.cp ? couponByCode.get(o.cp) : undefined
    const summary = priceOrder({
      lines: pricingLines,
      zone: province?.zone,
      coupon: coupon ? { code: coupon.code, type: coupon.type, discount: couponDiscount(coupon, pricingLines) } : null,
    })
    let eventNo = 0
    const opts = { nextEventId: () => seedIds.orderEvent(index, eventNo++) }
    let order = createOrderRecord(
      {
        id: seedIds.order(index),
        code: codeOf.get(index)!,
        placedAt: toIso(placedAt),
        customerId: seedIds.customer(cust.phone),
        paymentMethod: o.pm === 'B' ? 'ChuyenKhoan' : 'Cod',
        recipientName: cust.name,
        phone: cust.phone,
        email: cust.email,
        provinceCode: cust.province,
        provinceName: province?.name ?? cust.province,
        wardCode: cust.ward,
        wardName: ward?.name ?? cust.ward,
        addressLine: cust.address,
        customerNote: o.n,
        lines,
        summary,
        couponId: coupon?.id,
      },
      opts
    )
    for (const ev of o.ev ?? []) {
      const at = toIso(atOf(ev[1], placedAt, now))
      const actor = actorOf(ev[2])
      let cmd: WorkflowCommand
      switch (ev[0]) {
        case 'cf':
          cmd = { type: 'Confirm' }
          break
        case 'pd':
          cmd = { type: 'ConfirmPayment', transactionRef: ev[3] }
          break
        case 'sh':
          cmd = {
            type: 'Ship',
            carrier: carrierFromPrefix(ev[3]),
            weightGrams: ev[4],
            trackingCode: trackingOf.get(String(index))!,
          }
          break
        case 'dv':
          cmd = { type: 'Deliver' }
          break
        case 'fl':
          cmd = { type: 'DeliveryFailed', reason: ev[3], note: ev[4] }
          break
        case 'rt':
          cmd = { type: 'ReceiveReturn' }
          break
        case 'cx':
          cmd = { type: 'Cancel', reason: ev[3], note: ev[4] }
          break
        case 'rf':
          cmd = { type: 'Refund', refundRef: ev[3] }
          break
        case 'nt':
          cmd = { type: 'Note', content: ev[3] }
          break
      }
      // Seed: tồn trong file là tồn lúc nạp, không cộng trừ lại theo đơn lịch sử (06 §5.2)
      order = applyCommand(order, cmd, actor, at, opts).order
    }
    if (order.shipment) order.shipment.labelPrintCount = 1
    // Đơn quá hạn: hệ thống tự hủy lúc nạp, tồn cộng lại như mọi lần hủy (06 §5.4 bước 5)
    if (isOverdue(order, now)) {
      const result: MachineResult = cancelOverdue(order, opts)
      order = result.order
      stockDeltas.push(...result.stock)
    }
    const isHistory = o.d !== undefined && (o.ev ?? []).every((ev) => typeof ev[1] === 'number')
    if (isHistory) historyOrderIds.add(order.id)
    return order
  })

  // 4. Tồn sau quét quá hạn, số đã bán (Đã giao)
  const productById = new Map(products.map((p) => [p.id, p]))
  for (const d of stockDeltas) {
    const v = productById.get(d.productId)?.variants.find((x) => x.id === d.variantId)
    if (v) v.stock = Math.max(0, v.stock + d.delta)
  }
  for (const o of orders) {
    if (o.status !== 'DaGiao') continue
    for (const l of o.lines) {
      const p = productById.get(l.productId)
      if (p) p.soldCount += l.quantity
    }
  }

  // 5. Khách: thống kê từ đơn
  const customers: CustomerRecord[] = data.customers.map((c) => {
    const id = seedIds.customer(c.phone)
    const mine = orders.filter((o) => o.customerId === id)
    return { ...customerStats(mine), id, phone: c.phone, name: c.name, ...(c.email ? { email: c.email } : {}), provinceCode: c.province, wardCode: c.ward, addressLine: c.address, ...(c.note ? { note: c.note } : {}) }
  })

  // 6. Điều chỉnh tồn
  const stockAdjustments: StockAdjustmentRecord[] = data.stockAdjustments.map(
    ([sku, at, before, after, reason, by, note], i) => {
      const found = variantBySku.get(sku)
      const actor = staffActor(by)
      return {
        id: seedIds.stockAdjustment(i),
        variantId: found?.variant.id ?? seedIds.variant(sku),
        productId: found?.product.id ?? '',
        before,
        after,
        reason,
        ...(note ? { note } : {}),
        byId: actor.id,
        byName: actor.name,
        at: resolveVnRelative(at, now),
      }
    }
  )

  return {
    seedNow: toIso(now),
    colors,
    categories,
    products,
    coupons,
    customers,
    stockAdjustments,
    orders,
    historyOrderIds,
    provinces,
    banners: seedBanners(data),
  }
}

/**
 * Thống kê khách tính từ đơn (06 §4 Crm_Customers, `CustomerStats.Recalculate`): mọi đơn; Đã giao;
 * Đang hoàn + Đã hoàn; Đã hủy; Σ total Đã giao; lần đặt đầu, cuối.
 */
export function customerStats(orders: Pick<OrderRecord, 'status' | 'total' | 'placedAt'>[]) {
  const times = orders.map((o) => msOf(o.placedAt)).sort((a, b) => a - b)
  const first = times.length ? toIso(times[0]) : new Date(0).toISOString()
  const last = times.length ? toIso(times[times.length - 1]) : first
  return {
    orderCount: orders.length,
    deliveredCount: orders.filter((o) => o.status === 'DaGiao').length,
    returnCount: orders.filter((o) => RETURN_STATUSES.includes(o.status)).length,
    cancelledCount: orders.filter((o) => o.status === 'DaHuy').length,
    totalSpent: orders.filter((o) => o.status === 'DaGiao').reduce((s, o) => s + o.total, 0),
    firstOrderAt: first,
    lastOrderAt: last,
    createdAt: first,
  }
}

let cache: { key: number; value: ExpandedSeed } | null = null

/** expandSeed có nhớ theo thời điểm nạp (một bản mỗi `seedNow`) */
export function expandSeedCached(now: number): ExpandedSeed {
  const key = floorToMinute(now)
  if (cache?.key === key) return cache.value
  const value = expandSeed(key)
  cache = { key, value }
  return value
}
