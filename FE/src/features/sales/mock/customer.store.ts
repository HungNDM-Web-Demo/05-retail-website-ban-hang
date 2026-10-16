import { mockDb } from '@/mock/mock-db'
import { newId } from '@/mock/mock-helpers'
import type { CustomerRecord, OrderRecord } from '@/types/shop'
import { customerStats } from '../lib/seed-expand'
import { expandedSeed } from './catalog.store'
import { allOrders } from './order.store'

/**
 * Kho khách hàng ở chế độ mock (collection `customers`, 06 §4 Crm_Customers). Thống kê tính lại từ đơn
 * sau mọi thao tác tạo, đổi trạng thái, sửa đơn (`recalcCustomer`, như `CustomerStats.Recalculate` của BE).
 */

export const customersDb = mockDb.collection<CustomerRecord>('customers', () => expandedSeed().customers)

export function findCustomerByPhone(phone: string): CustomerRecord | undefined {
  return customersDb.find((c) => c.phone === phone)
}

/** Tính lại thống kê khách từ đơn */
export function recalcCustomer(customerId: string, orders: OrderRecord[] = allOrders()): CustomerRecord | undefined {
  const mine = orders.filter((o) => o.customerId === customerId)
  if (mine.length === 0) return customersDb.get(customerId)
  const stats = customerStats(mine)
  return customersDb.update(customerId, (c) => ({
    ...c,
    ...stats,
    createdAt: c.createdAt || stats.createdAt,
    updatedAt: new Date().toISOString(),
  }))
}

/**
 * Tạo hoặc cập nhật khách theo số điện thoại khi có đơn mới (FR-34, TC-42): chưa có thì tạo;
 * có thì cập nhật tên, email (nếu nhập), địa chỉ theo đơn mới nhất. Trả id khách.
 */
export function upsertFromOrder(input: {
  phone: string
  name: string
  email?: string
  provinceCode: string
  wardCode: string
  addressLine: string
  at: string
}): string {
  const existing = findCustomerByPhone(input.phone)
  if (existing) {
    customersDb.update(existing.id, (c) => ({
      ...c,
      name: input.name,
      ...(input.email ? { email: input.email } : {}),
      provinceCode: input.provinceCode,
      wardCode: input.wardCode,
      addressLine: input.addressLine,
      updatedAt: input.at,
    }))
    return existing.id
  }
  const id = newId()
  customersDb.insert({
    id,
    phone: input.phone,
    name: input.name,
    ...(input.email ? { email: input.email } : {}),
    provinceCode: input.provinceCode,
    wardCode: input.wardCode,
    addressLine: input.addressLine,
    orderCount: 0,
    deliveredCount: 0,
    returnCount: 0,
    cancelledCount: 0,
    totalSpent: 0,
    firstOrderAt: input.at,
    lastOrderAt: input.at,
    createdAt: input.at,
  })
  return id
}
