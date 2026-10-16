import { mockDb } from '@/mock/mock-db'
import type { OrderRecord } from '@/types/shop'
import { expandedSeed } from './catalog.store'

/**
 * Kho đơn ở chế độ mock (07 §4.8 "Bộ nhớ đơn"):
 * - 775 đơn lịch sử dựng lại trong bộ nhớ từ seed + `seedNow` mỗi lần tải trang, **không** ghi localStorage;
 * - collection `orders` chứa đơn gần đây, đơn tạo trong phiên demo, và bản sao đầy đủ của đơn lịch sử bị sửa.
 * `allOrders()` = bộ nhớ ghép collection theo `id` (collection thắng).
 *
 * Bản ghi trả về từ `allOrders()` là **chỉ đọc**; muốn đổi thì `getOrder` → sửa → `saveOrder`
 * (thao tác nghiệp vụ dùng `order-workflow.ts`).
 */

export const ordersDb = mockDb.collection<OrderRecord>('orders', () => {
  const seed = expandedSeed()
  return seed.orders.filter((o) => !seed.historyOrderIds.has(o.id))
})

/** Mọi đơn (lịch sử + collection), sắp theo thời điểm đặt tăng dần */
export function allOrders(): OrderRecord[] {
  const seed = expandedSeed()
  const stored = ordersDb.all()
  const storedIds = new Set(stored.map((o) => o.id))
  const history = seed.orders.filter((o) => seed.historyOrderIds.has(o.id) && !storedIds.has(o.id))
  return [...history, ...stored].sort((a, b) => a.placedAt.localeCompare(b.placedAt))
}

/** Một đơn (bản sao, sửa thoải mái rồi `saveOrder`) */
export function getOrder(id: string): OrderRecord | undefined {
  const stored = ordersDb.get(id)
  if (stored) return stored
  const seed = expandedSeed()
  if (!seed.historyOrderIds.has(id)) return undefined
  const found = seed.orders.find((o) => o.id === id)
  return found ? (JSON.parse(JSON.stringify(found)) as OrderRecord) : undefined
}

export function getOrderByCode(code: string): OrderRecord | undefined {
  const up = code.trim().toUpperCase()
  const hit = allOrders().find((o) => o.code === up)
  return hit ? getOrder(hit.id) : undefined
}

/** Ghi đơn: có trong collection thì thay, chưa có (đơn mới hoặc đơn lịch sử bị sửa) thì thêm bản sao */
export function saveOrder(order: OrderRecord): OrderRecord {
  if (ordersDb.get(order.id)) return ordersDb.update(order.id, () => order)!
  return ordersDb.insert(order)
}

/** Số đơn chưa hủy có mã (lượt đã dùng, BR-09) */
export function couponUsedCount(couponId: string, orders: OrderRecord[] = allOrders()): number {
  return orders.filter((o) => o.couponId === couponId && o.status !== 'DaHuy').length
}

/** Số đơn chưa hủy của số điện thoại có mã (bước 9, sửa đơn thì trừ chính đơn đó) */
export function phoneCouponUses(
  phone: string,
  couponId: string,
  excludeOrderId?: string,
  orders: OrderRecord[] = allOrders()
): number {
  return orders.filter(
    (o) => o.phone === phone && o.couponId === couponId && o.status !== 'DaHuy' && o.id !== excludeOrderId
  ).length
}
