import { permissions } from '@/config/permissions'
import { mockDelay } from '@/lib/data-source'
import { matchesSearch } from '@/lib/normalize'
import { requirePermission } from '@/mock/mock-auth'
import { notFound } from '@/mock/mock-errors'
import { paginate, sortItems } from '@/mock/mock-helpers'
import { customerTags } from '@/features/sales/lib/order-rules'
import { fieldErrors } from '@/features/sales/lib/sales-errors'
import { expandedSeed } from '@/features/sales/mock/catalog.store'
import { customersDb } from '@/features/sales/mock/customer.store'
import { orderViewContext, toOrderListItem } from '@/features/sales/mock/order-views'
import { sweepOverdue } from '@/features/sales/mock/order-workflow'
import { allOrders } from '@/features/sales/mock/order.store'
import type { PaginatedResult, PaginationQuery } from '@/types/api'
import type {
  CustomerDetail,
  CustomerListItem,
  CustomerQuery,
  CustomerRecord,
  OrderListItem,
  UpdateCustomerNoteRequest,
} from '@/types/shop'

/** Handler mock khách hàng (07 §2.7; FR-34…36). Thống kê do lõi tính lại sau mỗi thao tác đơn. */

function provinceIndex() {
  return new Map(expandedSeed().provinces.map((p) => [p.code, p]))
}

function toListItem(c: CustomerRecord, provinces = provinceIndex()): CustomerListItem {
  return {
    id: c.id,
    phone: c.phone,
    name: c.name,
    provinceCode: c.provinceCode,
    provinceName: provinces.get(c.provinceCode)?.name ?? '',
    orderCount: c.orderCount,
    deliveredCount: c.deliveredCount,
    returnCount: c.returnCount,
    totalSpent: c.totalSpent,
    lastOrderAt: c.lastOrderAt,
    tags: customerTags(c),
  }
}

function toDetail(c: CustomerRecord): CustomerDetail {
  const provinces = provinceIndex()
  return {
    ...toListItem(c, provinces),
    ...(c.email ? { email: c.email } : {}),
    wardCode: c.wardCode,
    wardName: provinces.get(c.provinceCode)?.wards.find((w) => w.code === c.wardCode)?.name ?? '',
    addressLine: c.addressLine,
    ...(c.note ? { note: c.note } : {}),
    cancelledCount: c.cancelledCount,
    firstOrderAt: c.firstOrderAt,
    createdAt: c.createdAt,
  }
}

function getCustomer(id: string): CustomerRecord {
  const c = customersDb.get(id)
  if (!c) throw notFound('Không tìm thấy khách hàng')
  return c
}

export const customerMock = {
  async list(query: CustomerQuery): Promise<PaginatedResult<CustomerListItem>> {
    await mockDelay()
    requirePermission(permissions.customers.view)
    sweepOverdue()
    const provinces = provinceIndex()
    let items = customersDb.all().map((c) => toListItem(c, provinces))
    if (query.tag) items = items.filter((c) => c.tags.includes(query.tag!))
    if (query.provinceCode) items = items.filter((c) => c.provinceCode === query.provinceCode)
    if (query.search) items = items.filter((c) => matchesSearch(`${c.name} ${c.phone}`, query.search))
    return paginate(sortItems(items, query.sortBy || 'lastOrderAt', query.sortDir || 'desc'), query)
  },

  async detail(id: string): Promise<CustomerDetail> {
    await mockDelay()
    requirePermission(permissions.customers.view)
    return toDetail(getCustomer(id))
  },

  async orders(id: string, query: PaginationQuery): Promise<PaginatedResult<OrderListItem>> {
    await mockDelay()
    requirePermission(permissions.customers.view)
    getCustomer(id)
    const orders = allOrders()
    const ctx = orderViewContext(orders)
    const list = orders
      .filter((o) => o.customerId === id)
      .sort((a, b) => b.placedAt.localeCompare(a.placedAt))
      .map((o) => toOrderListItem(o, ctx))
    return paginate(list, query)
  },

  async updateNote(id: string, body: UpdateCustomerNoteRequest): Promise<CustomerDetail> {
    await mockDelay()
    requirePermission(permissions.customers.update)
    getCustomer(id)
    const note = body.note?.trim()
    if (note && note.length > 1000) throw fieldErrors({ note: 'Ghi chú tối đa 1.000 ký tự' })
    const after = customersDb.update(id, (c) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- bỏ trường không có trong DTO
      const { note: _n, ...rest } = c
      return { ...rest, ...(note ? { note } : {}), updatedAt: new Date().toISOString() }
    })!
    return toDetail(after)
  },
}
