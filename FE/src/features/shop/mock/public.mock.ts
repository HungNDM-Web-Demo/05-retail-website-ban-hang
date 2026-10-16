import { mockDelay } from '@/lib/data-source'
import { readJson, removeKey, storageKey, writeJson } from '@/lib/storage'
import { checkCoupon, normalizeCouponCode } from '@/features/sales/lib/coupon-rules'
import { CUSTOMER_ACTOR } from '@/features/sales/lib/order-machine'
import { canSelfCancel, normalizePhone } from '@/features/sales/lib/order-rules'
import { lineTotalOf, priceOrder } from '@/features/sales/lib/pricing'
import { SalesRules } from '@/features/sales/lib/rules'
import { money } from '@/features/sales/lib/money'
import { SalesErrors, fieldErrors, fieldMessages, type FieldErrors } from '@/features/sales/lib/sales-errors'
import {
  categoriesDb,
  categoryMap,
  colorsDb,
  expandedSeed,
  findCouponByCode,
  imageForColor,
  productsDb,
  tryReserveStock,
  variantIndex,
  type VariantHit,
} from '@/features/sales/mock/catalog.store'
import { applyAction, createOrder, sweepOverdue } from '@/features/sales/mock/order-workflow'
import { currentStoreInfo, toPlacedOrderSummary, toPublicOrderView } from '@/features/sales/mock/order-views'
import { allOrders, couponUsedCount, getOrder, getOrderByCode, phoneCouponUses } from '@/features/sales/mock/order.store'
import type {
  CartCheckLine,
  CartCheckRequest,
  CartCheckResult,
  CartLineInput,
  CheckoutQuote,
  CheckoutQuoteRequest,
  OrderLookupRequest,
  PlaceOrderRequest,
  PlaceOrderResult,
  PublicCancelRequest,
  PublicCategory,
  PublicHome,
  PublicOrderView,
  PublicProductListResult,
  PublicProductLookup,
  PublicProductQuery,
  PublicStoreInfo,
  PublicSuggestion,
} from '@/types/shop'
import {
  publicCategories,
  publicHome,
  publicProductLookup,
  publicProducts,
  publicSuggest,
  type CatalogSnapshot,
} from '../lib/public-catalog'

/**
 * Handler mock cho API công khai `/api/public/*` (07 §2.2, §3.4, §3.7, §4.8). Không đọc phiên đăng nhập,
 * không kiểm quyền; `X-Device-Id` truyền bằng tham số. Đặt hàng đi đúng thứ tự kiểm tra 1–7 của §2.2.
 */

const snapshot = (): CatalogSnapshot => ({
  categories: categoriesDb.all(),
  colors: colorsDb.all(),
  products: productsDb.all(),
})

const BLOCKING = new Set(['BienTheDaTat', 'NgungKinhDoanh', 'HetHang', 'KhongDuTon'])

/** Kiểm từng dòng giỏ theo §3.4 */
function checkLine(input: CartLineInput, hit: VariantHit | undefined, categoryVisible: (id: string) => boolean): CartCheckLine {
  const quantity = Math.max(1, Math.floor(Number(input.quantity) || 1))
  if (!hit) {
    return {
      variantId: input.variantId,
      productName: '',
      sku: '',
      colorCode: '',
      colorName: '',
      price: input.price ?? 0,
      stock: 0,
      quantity,
      maxQuantity: 0,
      lineTotal: (input.price ?? 0) * quantity,
      issue: 'BienTheDaTat',
      issueText: 'Mẫu này tạm ngừng bán',
    }
  }
  const { product, variant, color } = hit
  const price = product.price
  const line: CartCheckLine = {
    variantId: variant.id,
    productId: product.id,
    productName: product.name,
    slug: product.slug,
    sku: variant.sku,
    colorCode: color?.code ?? '',
    colorName: color?.name ?? '',
    ...(variant.size ? { size: variant.size } : {}),
    imageUrl: imageForColor(product, variant.colorId),
    price,
    ...(input.price !== undefined && input.price !== price ? { oldPrice: input.price } : {}),
    stock: variant.stock,
    quantity,
    maxQuantity: Math.min(SalesRules.maxQuantityPerLine, variant.stock),
    lineTotal: lineTotalOf(price, quantity),
  }
  if (!variant.isActive) return { ...line, issue: 'BienTheDaTat', issueText: 'Mẫu này tạm ngừng bán' }
  if (product.isHidden || !categoryVisible(product.categoryId))
    return { ...line, issue: 'NgungKinhDoanh', issueText: 'Sản phẩm ngừng kinh doanh' }
  if (variant.stock <= 0) return { ...line, issue: 'HetHang', issueText: 'Hết hàng' }
  if (quantity > variant.stock)
    return { ...line, issue: 'KhongDuTon', issueText: fieldMessages.stockLeft(variant.stock) }
  if (input.price !== undefined && input.price !== price)
    return { ...line, issue: 'GiaDaDoi', issueText: `Giá đã đổi từ ${money(input.price)} thành ${money(price)}` }
  return line
}

function checkLines(lines: CartLineInput[]) {
  if (!lines?.length) throw SalesErrors.cartEmpty()
  if (lines.length > SalesRules.maxCartLines) throw SalesErrors.cartTooManyLines()
  const index = variantIndex()
  const cats = categoryMap()
  const visible = (id: string) => !!cats.get(id)?.isVisible && !cats.get(id)?.isDeleted
  const checked = lines.map((l) => checkLine(l, index.get(l.variantId), visible))
  const valid = checked.filter((l) => !l.issue || !BLOCKING.has(l.issue))
  const pricingLines = valid.map((l) => ({
    lineTotal: l.lineTotal,
    categoryId: l.productId ? index.get(l.variantId)?.product.categoryId : undefined,
  }))
  return { checked, pricingLines, canCheckout: checked.length > 0 && valid.length === checked.length }
}

function zoneOf(provinceCode?: string) {
  return provinceCode ? expandedSeed().provinces.find((p) => p.code === provinceCode)?.zone : undefined
}

/** Kiểm mã + tính tiền (không kiểm lượt theo số điện thoại trừ khi truyền `phone`) */
function quoteWith(
  pricingLines: { lineTotal: number; categoryId?: string }[],
  provinceCode: string | undefined,
  rawCode: string | undefined,
  phone?: string
) {
  const code = normalizeCouponCode(rawCode)
  const zone = zoneOf(provinceCode)
  if (!code) return { summary: priceOrder({ lines: pricingLines, zone }), coupon: undefined, couponId: undefined }
  const coupon = findCouponByCode(code)
  const check = checkCoupon(coupon, code, {
    now: Date.now(),
    lines: pricingLines,
    usedCount: coupon ? couponUsedCount(coupon.id) : 0,
    categoryName: coupon?.categoryId ? categoryMap().get(coupon.categoryId)?.name : undefined,
    ...(phone && coupon ? { phoneUsedCount: phoneCouponUses(phone, coupon.id) } : {}),
  })
  const summary = priceOrder({
    lines: pricingLines,
    zone,
    coupon: check.ok && coupon ? { code: coupon.code, type: coupon.type, discount: check.discount } : null,
  })
  return {
    summary,
    coupon: { ...check, shippingDiscount: check.ok ? summary.shippingDiscount : 0 },
    couponId: check.ok ? coupon?.id : undefined,
  }
}

// ───────────────────────── Tra cứu sai (BR-28) ─────────────────────────

type Guard = { fails: string[]; blockedUntil?: string }
const guardKey = (deviceId?: string) => storageKey(`lookup-guard:${deviceId || 'anon'}`)

function assertNotLocked(deviceId?: string) {
  const guard = readJson<Guard>('local', guardKey(deviceId))
  if (!guard?.blockedUntil) return
  const remaining = new Date(guard.blockedUntil).getTime() - Date.now()
  if (remaining <= 0) {
    removeKey('local', guardKey(deviceId))
    return
  }
  throw SalesErrors.lookupLocked(Math.ceil(remaining / 60_000), Math.ceil(remaining / 1000))
}

function recordFail(deviceId?: string) {
  const now = Date.now()
  const guard = readJson<Guard>('local', guardKey(deviceId)) ?? { fails: [] }
  const fails = [...guard.fails, new Date(now).toISOString()].filter(
    (t) => now - new Date(t).getTime() <= SalesRules.lookupWindowMinutes * 60_000
  )
  if (fails.length >= SalesRules.lookupMaxFails) {
    const blockedUntil = new Date(now + SalesRules.lookupBlockMinutes * 60_000).toISOString()
    writeJson('local', guardKey(deviceId), { fails: [], blockedUntil } satisfies Guard)
    throw SalesErrors.lookupLocked(SalesRules.lookupBlockMinutes, SalesRules.lookupBlockMinutes * 60)
  }
  writeJson('local', guardKey(deviceId), { fails } satisfies Guard)
}

function findForCustomer(code: string, phone: string) {
  const order = getOrderByCode(code ?? '')
  if (!order || order.phone !== normalizePhone(phone)) return undefined
  return order
}

// ───────────────────────── Handler ─────────────────────────

export const publicMock = {
  async store(): Promise<PublicStoreInfo> {
    await mockDelay(60, 120)
    return currentStoreInfo()
  },

  async home(): Promise<PublicHome> {
    await mockDelay()
    return publicHome(snapshot(), expandedSeed().banners)
  },

  async categories(): Promise<PublicCategory[]> {
    await mockDelay(80, 160)
    return publicCategories(snapshot())
  },

  async products(query: PublicProductQuery): Promise<PublicProductListResult> {
    await mockDelay()
    return publicProducts(snapshot(), query)
  },

  async suggest(search: string): Promise<PublicSuggestion[]> {
    await mockDelay(60, 120)
    return publicSuggest(snapshot(), search)
  },

  async product(slug: string): Promise<PublicProductLookup> {
    await mockDelay()
    return publicProductLookup(snapshot(), slug)
  },

  async cartCheck(req: CartCheckRequest): Promise<CartCheckResult> {
    await mockDelay(100, 200)
    const { checked, pricingLines, canCheckout } = checkLines(req.lines)
    const summary = priceOrder({ lines: pricingLines })
    return { lines: checked, subtotal: summary.subtotal, freeShipRemaining: summary.freeShipRemaining, canCheckout }
  },

  async quote(req: CheckoutQuoteRequest): Promise<CheckoutQuote> {
    await mockDelay(120, 240)
    const { checked, pricingLines, canCheckout } = checkLines(req.lines)
    const { summary, coupon } = quoteWith(pricingLines, req.provinceCode, req.couponCode)
    return { lines: checked, summary, ...(coupon ? { coupon } : {}), canCheckout }
  },

  /** Đặt hàng (§2.2 bước 1–7, NFR-05) */
  async placeOrder(req: PlaceOrderRequest, deviceId?: string): Promise<PlaceOrderResult> {
    await mockDelay(300, 600)
    sweepOverdue()
    // 1. Trùng clientRequestId → kết quả cũ
    if (req.clientRequestId) {
      const existing = allOrders().find((o) => o.clientRequestId === req.clientRequestId)
      if (existing) return { order: toPlacedOrderSummary(getOrder(existing.id)!), duplicate: true }
    }

    // 2. Dữ liệu (BR-07, BR-03)
    const s = req.shipping ?? ({} as PlaceOrderRequest['shipping'])
    const errors: FieldErrors = {}
    const fullName = (s.fullName ?? '').trim()
    const phone = normalizePhone(s.phone)
    const email = s.email?.trim()
    const address = (s.addressLine ?? '').trim()
    const note = s.note?.trim()
    if (fullName.length < 2 || fullName.length > 100) errors['shipping.fullName'] = fieldMessages.fullName
    if (!SalesRules.phonePattern.test(phone)) errors['shipping.phone'] = fieldMessages.phone
    if (email && !SalesRules.emailPattern.test(email)) errors['shipping.email'] = fieldMessages.email
    const province = expandedSeed().provinces.find((p) => p.code === s.provinceCode)
    if (!province) errors['shipping.provinceCode'] = fieldMessages.provinceCode
    const ward = province?.wards.find((w) => w.code === s.wardCode)
    if (!ward) errors['shipping.wardCode'] = fieldMessages.wardCode
    if (address.length < 5 || address.length > 200) errors['shipping.addressLine'] = fieldMessages.addressLine
    if (note && note.length > 500) errors['shipping.note'] = fieldMessages.note
    if (req.paymentMethod !== 'Cod' && req.paymentMethod !== 'ChuyenKhoan') errors.paymentMethod = fieldMessages.paymentMethod
    if (!req.lines?.length) throw SalesErrors.cartEmpty()
    if (req.lines.length > SalesRules.maxCartLines) throw SalesErrors.cartTooManyLines()
    req.lines.forEach((l, i) => {
      if (!Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > SalesRules.maxQuantityPerLine)
        errors[`lines[${i}].quantity`] = fieldMessages.quantity
    })
    if (Object.keys(errors).length) throw fieldErrors(errors)
    // Gộp dòng trùng biến thể (như BE)
    req = { ...req, lines: mergeCartLines(req.lines) }

    // 3. Sản phẩm ẩn, biến thể tắt hoặc không có
    const index = variantIndex()
    const cats = categoryMap()
    const discontinued = req.lines.filter((l) => {
      const hit = index.get(l.variantId)
      return !hit || !hit.variant.isActive || hit.product.isHidden || !cats.get(hit.product.categoryId)?.isVisible
    })
    if (discontinued.length) {
      const first = index.get(discontinued[0].variantId)
      throw SalesErrors.productDiscontinued(first?.product.name ?? 'Sản phẩm', discontinued.map((l) => l.variantId))
    }

    // 4. Giá đổi
    const priceChanges = req.lines
      .map((l) => ({ variantId: l.variantId, oldPrice: l.expectedPrice, newPrice: index.get(l.variantId)!.product.price }))
      .filter((c) => c.oldPrice !== c.newPrice)
    if (priceChanges.length) throw SalesErrors.priceChanged(priceChanges)

    // 5. Mã giảm giá (kể cả lượt theo số điện thoại)
    const hits = req.lines.map((l) => index.get(l.variantId)!)
    const pricingLines = req.lines.map((l, i) => ({
      lineTotal: lineTotalOf(hits[i].product.price, l.quantity),
      categoryId: hits[i].product.categoryId,
    }))
    const { summary, coupon, couponId } = quoteWith(pricingLines, province!.code, req.couponCode, phone)
    if (coupon && !coupon.ok) throw SalesErrors.coupon(coupon.errorCode as Parameters<typeof SalesErrors.coupon>[0], coupon.message!)

    // 6. Trừ tồn có điều kiện
    const reserve = tryReserveStock(
      req.lines.map((l, i) => ({ variantId: l.variantId, productId: hits[i].product.id, quantity: l.quantity }))
    )
    if (!reserve.ok) {
      const first = reserve.issues[0]
      const hit = hits[first.index]
      throw SalesErrors.notEnoughStock(
        { productName: hit.product.name, colorName: hit.color?.name ?? '', size: hit.variant.size, stock: first.stock },
        reserve.issues.map((x) => ({ variantId: x.variantId, stock: x.stock })),
        Object.fromEntries(reserve.issues.map((x) => [`lines[${x.index}]`, fieldMessages.stockLeft(x.stock)]))
      )
    }

    // 7. Tạo đơn
    const order = createOrder({
      placedAt: new Date().toISOString(),
      paymentMethod: req.paymentMethod,
      recipientName: fullName,
      phone,
      ...(email ? { email } : {}),
      provinceCode: province!.code,
      provinceName: province!.name,
      wardCode: ward!.code,
      wardName: ward!.name,
      addressLine: address,
      ...(note ? { customerNote: note } : {}),
      lines: req.lines.map((l, i) => ({
        variantId: hits[i].variant.id,
        productId: hits[i].product.id,
        productName: hits[i].product.name,
        sku: hits[i].variant.sku,
        colorName: hits[i].color?.name ?? '',
        ...(hits[i].variant.size ? { size: hits[i].variant.size } : {}),
        imageUrl: imageForColor(hits[i].product, hits[i].variant.colorId),
        unitPrice: hits[i].product.price,
        quantity: l.quantity,
      })),
      summary,
      ...(couponId ? { couponId } : {}),
      ...(req.clientRequestId ? { clientRequestId: req.clientRequestId } : {}),
      ...(deviceId ? { deviceId } : {}),
    })
    return { order: toPlacedOrderSummary(order), duplicate: false }
  },

  /** Tra cứu (FR-14, BR-28) */
  async lookup(req: OrderLookupRequest, deviceId?: string): Promise<PublicOrderView> {
    await mockDelay(150, 300)
    assertNotLocked(deviceId)
    sweepOverdue()
    const order = findForCustomer(req.code, req.phone)
    if (!order) {
      recordFail(deviceId)
      throw SalesErrors.orderNotFound()
    }
    return toPublicOrderView(order)
  },

  /** Xem lại đơn đã tra cứu (làm mới tự động, không tính lượt sai) */
  async refresh(req: OrderLookupRequest): Promise<PublicOrderView> {
    sweepOverdue()
    const order = findForCustomer(req.code, req.phone)
    if (!order) throw SalesErrors.orderNotFound()
    return toPublicOrderView(order)
  },

  /** Khách tự hủy (FR-15): chỉ Chờ thanh toán, Chờ xác nhận; lý do KhachDoiY | DatTrung | Khac */
  async cancel(code: string, req: PublicCancelRequest, deviceId?: string): Promise<PublicOrderView> {
    await mockDelay(200, 400)
    assertNotLocked(deviceId)
    sweepOverdue()
    const order = findForCustomer(code, req.phone)
    if (!order) {
      recordFail(deviceId)
      throw SalesErrors.orderNotFound()
    }
    if (!['KhachDoiY', 'DatTrung', 'Khac'].includes(req.reason)) throw fieldErrors({ reason: fieldMessages.reason })
    if (!canSelfCancel(order.status)) throw SalesErrors.cannotSelfCancel(currentStoreInfo().hotline)
    const next = applyAction(order.id, { type: 'Cancel', reason: req.reason, note: req.note }, CUSTOMER_ACTOR)
    return toPublicOrderView(next)
  },
}

/** Gộp các dòng cùng biến thể: cộng số lượng, giữ giá kỳ vọng của dòng đầu (như BE `PlaceOrderAsync`) */
function mergeCartLines<T extends { variantId: string; quantity: number }>(lines: T[]): T[] {
  const merged = new Map<string, T>()
  for (const l of lines) {
    const prev = merged.get(l.variantId)
    merged.set(l.variantId, prev ? { ...prev, quantity: prev.quantity + l.quantity } : { ...l })
  }
  return [...merged.values()]
}
