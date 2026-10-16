import { mockDb } from '@/mock/mock-db'
import { newId } from '@/mock/mock-helpers'
import type {
  CategoryRecord,
  ColorRecord,
  CouponRecord,
  ProductRecord,
  StockAdjustReason,
  StockAdjustmentRecord,
  VariantRecord,
} from '@/types/shop'
import type { Actor, SoldDelta, StockDelta } from '../lib/order-machine'
import { demoData, expandSeedCached, seedIds, type ExpandedSeed } from '../lib/seed-expand'
import { fieldErrors, fieldMessages } from '../lib/sales-errors'
import { floorToMinute, msOf, toIso, vnDateKey } from '../lib/vn-time'
import { publishShopEvent } from './shop-events'

/**
 * Kho danh mục ở chế độ mock (07 §4.8, scope `business`): `categories`, `colors`, `products` (ảnh, biến thể
 * lồng trong bản ghi), `stock-adjustments`, `coupons`, `seed-meta`. FE-Cửa hàng khai báo, mọi feature
 * đọc ghi qua các hàm ở đây.
 *
 * Seed tự nạp lại khi sang ngày mới theo giờ Việt Nam (`demo-day`, 06 §5.3) hoặc khi `demo-data.json` đổi.
 */

mockDb.registerSeed('demo-data', demoData)
mockDb.registerSeed('demo-day', vnDateKey(Date.now()))

type SeedMeta = { id: string; seedNow: string }

export const seedMetaDb = mockDb.collection<SeedMeta>('seed-meta', () => [
  { id: 'meta', seedNow: toIso(floorToMinute(Date.now())) },
])

/** Thời điểm nạp seed (ms) — mốc của mọi thời điểm tương đối trong dữ liệu mẫu */
export function seedNow(): number {
  const meta = seedMetaDb.get('meta')
  return meta ? msOf(meta.seedNow) : floorToMinute(Date.now())
}

/** Dữ liệu suy ra từ seed tại `seedNow` (chỉ đọc; nhớ trong bộ nhớ) */
export const expandedSeed = (): ExpandedSeed => expandSeedCached(seedNow())

export const categoriesDb = mockDb.collection<CategoryRecord>('categories', () => expandedSeed().categories)
export const colorsDb = mockDb.collection<ColorRecord>('colors', () => expandedSeed().colors)
export const productsDb = mockDb.collection<ProductRecord>('products', () => expandedSeed().products)
export const stockAdjustmentsDb = mockDb.collection<StockAdjustmentRecord>(
  'stock-adjustments',
  () => expandedSeed().stockAdjustments
)
export const couponsDb = mockDb.collection<CouponRecord>('coupons', () => expandedSeed().coupons)

/** Id cố định của bản ghi seed (06 §5.2): catalogIds.product('AT001'), catalogIds.variant('AT001-TR-M')… */
export const catalogIds = seedIds

// ───────────────────────── Truy vấn ─────────────────────────

export const liveCategories = () =>
  categoriesDb.filter((c) => !c.isDeleted).sort((a, b) => a.sortOrder - b.sortOrder)
export const liveColors = () => colorsDb.filter((c) => !c.isDeleted).sort((a, b) => a.sortOrder - b.sortOrder)
export const liveProducts = () => productsDb.filter((p) => !p.isDeleted)
export const liveCoupons = () => couponsDb.filter((c) => !c.isDeleted)

export function colorMap(): Map<string, ColorRecord> {
  return new Map(colorsDb.all().map((c) => [c.id, c]))
}
export function categoryMap(): Map<string, CategoryRecord> {
  return new Map(categoriesDb.all().map((c) => [c.id, c]))
}

export function findCouponByCode(code: string): CouponRecord | undefined {
  const up = code.trim().toUpperCase()
  return couponsDb.find((c) => !c.isDeleted && c.code === up)
}

export type VariantHit = { product: ProductRecord; variant: VariantRecord; color?: ColorRecord }

/** Tìm biến thể theo id (kể cả sản phẩm ẩn; sản phẩm đã xóa → undefined) */
export function findVariant(variantId: string): VariantHit | undefined {
  const product = productsDb.find((p) => !p.isDeleted && p.variants.some((v) => v.id === variantId))
  if (!product) return undefined
  const variant = product.variants.find((v) => v.id === variantId)!
  return { product, variant, color: colorsDb.get(variant.colorId) }
}

/** Bản đồ biến thể → (sản phẩm, biến thể) cho xử lý nhiều dòng một lần */
export function variantIndex(): Map<string, VariantHit> {
  const colors = colorMap()
  const map = new Map<string, VariantHit>()
  for (const product of liveProducts())
    for (const variant of product.variants)
      map.set(variant.id, { product, variant, color: colors.get(variant.colorId) })
  return map
}

/** Ảnh của màu (ảnh đầu tiên gắn màu đó), không có thì ảnh đại diện */
export function imageForColor(product: ProductRecord, colorId?: string): string | undefined {
  const byColor = colorId ? product.images.find((i) => i.colorId === colorId) : undefined
  return (byColor ?? product.images.find((i) => i.isCover) ?? product.images[0])?.url
}

// ───────────────────────── Ghi tồn, số đã bán ─────────────────────────

/** Cộng/trừ tồn theo danh sách (không cho âm). Phát `catalog-changed`. */
export function applyStockDeltas(deltas: StockDelta[]): void {
  const changed = deltas.filter((d) => d.delta !== 0)
  if (changed.length === 0) return
  const byProduct = new Map<string, StockDelta[]>()
  for (const d of changed) byProduct.set(d.productId, [...(byProduct.get(d.productId) ?? []), d])
  mockDb.batch(() => {
    for (const [productId, list] of byProduct) {
      productsDb.update(productId, (p) => ({
        ...p,
        variants: p.variants.map((v) => {
          const delta = list.filter((d) => d.variantId === v.id).reduce((s, d) => s + d.delta, 0)
          return delta ? { ...v, stock: Math.max(0, v.stock + delta) } : v
        }),
      }))
    }
  })
  publishShopEvent('catalog-changed', { productIds: [...byProduct.keys()] })
}

/** Cộng số đã bán khi đơn Đã giao (quyết định 11) */
export function applySoldDeltas(deltas: SoldDelta[]): void {
  if (deltas.length === 0) return
  mockDb.batch(() => {
    for (const d of deltas) productsDb.update(d.productId, (p) => ({ ...p, soldCount: p.soldCount + d.quantity }))
  })
}

/**
 * Trừ tồn có điều kiện cho mọi dòng (06 §3 "Tồn không âm"): thiếu một dòng thì không trừ dòng nào,
 * trả danh sách dòng thiếu kèm tồn hiện có.
 */
export function tryReserveStock(
  lines: { variantId: string; productId: string; quantity: number }[]
): { ok: true } | { ok: false; issues: { index: number; variantId: string; stock: number }[] } {
  const index = variantIndex()
  const need = new Map<string, number>()
  for (const l of lines) need.set(l.variantId, (need.get(l.variantId) ?? 0) + l.quantity)
  const issues: { index: number; variantId: string; stock: number }[] = []
  lines.forEach((l, i) => {
    const stock = index.get(l.variantId)?.variant.stock ?? 0
    if ((need.get(l.variantId) ?? 0) > stock) issues.push({ index: i, variantId: l.variantId, stock })
  })
  if (issues.length > 0) return { ok: false, issues }
  applyStockDeltas(lines.map((l) => ({ variantId: l.variantId, productId: l.productId, delta: -l.quantity })))
  return { ok: true }
}

/**
 * Điều chỉnh tồn (FR-20, BR-27): ghi lịch sử, đặt tồn mới. Lý do Khác bắt buộc ghi chú.
 * Trả biến thể sau khi đổi.
 */
export function adjustStock(input: {
  productId: string
  variantId: string
  newStock: number
  reason: StockAdjustReason
  note?: string
  actor: Actor
  at?: string
}): VariantRecord {
  if (!Number.isInteger(input.newStock) || input.newStock < 0)
    throw fieldErrors({ newStock: fieldMessages.newStock })
  if (!input.reason) throw fieldErrors({ reason: fieldMessages.reason })
  if (input.reason === 'Khac' && !input.note?.trim()) throw fieldErrors({ note: fieldMessages.otherNote })
  const product = productsDb.get(input.productId)
  const variant = product?.variants.find((v) => v.id === input.variantId)
  if (!product || !variant) throw fieldErrors({ variantId: 'Không tìm thấy biến thể' })
  const at = input.at ?? new Date().toISOString()
  mockDb.batch(() => {
    stockAdjustmentsDb.insert({
      id: newId(),
      variantId: variant.id,
      productId: product.id,
      before: variant.stock,
      after: input.newStock,
      reason: input.reason,
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      ...(input.actor.id ? { byId: input.actor.id } : {}),
      byName: input.actor.name,
      at,
    })
    productsDb.update(product.id, (p) => ({
      ...p,
      updatedAt: at,
      variants: p.variants.map((v) => (v.id === variant.id ? { ...v, stock: input.newStock } : v)),
    }))
  })
  publishShopEvent('catalog-changed', { productIds: [product.id] })
  return { ...variant, stock: input.newStock }
}
