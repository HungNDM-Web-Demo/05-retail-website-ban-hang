import { permissions } from '@/config/permissions'
import { orderStatusTabs } from '@/config/shop-labels'
import { isApiError } from '@/lib/api-error'
import { mockDelay } from '@/lib/data-source'
import { matchesSearch } from '@/lib/normalize'
import { requirePermission } from '@/mock/mock-auth'
import { paginate } from '@/mock/mock-helpers'
import { suggestWeight } from '@/features/sales/lib/codes'
import type { Actor } from '@/features/sales/lib/order-machine'
import { vnDateKey } from '@/features/sales/lib/vn-time'
import { SalesErrors } from '@/features/sales/mock/errors'
import {
  applyAction,
  editOrder,
  markLabelPrinted,
  previewEdit,
  sweepOverdue,
  type ActionInput,
} from '@/features/sales/mock/order-workflow'
import { currentStoreInfo, orderViewContext, toOrderDetail, toOrderListItem } from '@/features/sales/mock/order-views'
import { allOrders, getOrder } from '@/features/sales/mock/order.store'
import type { PaginatedResult } from '@/types/api'
import type {
  AddOrderNoteRequest,
  BulkConfirmRequest,
  BulkItem,
  BulkResult,
  BulkShipRequest,
  CancelOrderRequest,
  ConfirmOrderRequest,
  ConfirmPaymentRequest,
  DeliveryFailedRequest,
  EditOrderPreview,
  EditOrderRequest,
  OrderDetailDto,
  OrderListItem,
  OrderQuery,
  OrderRecord,
  OrderStatus,
  OrderStatusCounts,
  PublicStoreInfo,
  RefundRequest,
  ShipOrderRequest,
  VersionedRequest,
} from '@/types/shop'

/**
 * Handler mock đơn hàng quản trị (07 §2.5). Đọc, ghi qua lõi `features/sales/mock` (FE-Cửa hàng sở hữu):
 * chuyển trạng thái, tồn, lượt mã, sự kiện, `version` đều nằm trong `applyAction` / `editOrder`.
 */

/** Người thao tác = tài khoản đang đăng nhập (sự kiện ghi họ tên) */
function staff(...codes: string[]): Actor {
  const { user } = requirePermission(...codes)
  return { type: 'NhanVien', id: user.id, name: user.fullName }
}

const ASC_DEFAULT: OrderStatus[] = ['ChoThanhToan', 'ChoXacNhan', 'DaXacNhan']

/** Lọc theo bộ lọc chung (trừ status) → danh sách DTO kèm nhãn */
function filtered(query: OrderQuery): { items: OrderListItem[]; records: Map<string, OrderRecord> } {
  sweepOverdue()
  const orders = allOrders()
  const ctx = orderViewContext(orders)
  const records = new Map<string, OrderRecord>()
  const items: OrderListItem[] = []
  for (const o of orders) {
    if (query.fromDate && vnDateKey(o.placedAt) < query.fromDate) continue
    if (query.toDate && vnDateKey(o.placedAt) > query.toDate) continue
    if (query.paymentMethod && o.paymentMethod !== query.paymentMethod) continue
    if (query.paymentStatus && o.paymentStatus !== query.paymentStatus) continue
    if (query.provinceCode && o.provinceCode !== query.provinceCode) continue
    if (query.customerId && o.customerId !== query.customerId) continue
    if (query.couponId && o.couponId !== query.couponId) continue
    const item = toOrderListItem(o, ctx)
    if (query.search && !matchesSearch(`${o.code} ${o.phone} ${o.recipientName} ${item.customerName}`, query.search)) continue
    if (query.label && !item.labels.includes(query.label)) continue
    items.push(item)
    records.set(o.id, o)
  }
  return { items, records }
}

function sortOrders(items: OrderListItem[], query: OrderQuery): OrderListItem[] {
  const by = query.sortBy === 'total' || query.sortBy === 'code' ? query.sortBy : 'placedAt'
  const dir = query.sortDir ?? (query.sortBy ? 'desc' : query.status && ASC_DEFAULT.includes(query.status) ? 'asc' : 'desc')
  const sign = dir === 'asc' ? 1 : -1
  return [...items].sort((a, b) => {
    const va = a[by]
    const vb = b[by]
    const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
    return c * sign
  })
}

function detail(id: string): OrderDetailDto {
  const o = getOrder(id)
  if (!o) throw SalesErrors.orderNotFound()
  return toOrderDetail(o)
}

async function act(id: string, input: ActionInput, perm: string, version?: number): Promise<OrderDetailDto> {
  await mockDelay()
  const actor = staff(perm)
  const record = applyAction(id, input, actor, version)
  return toOrderDetail(record)
}

function bulk(items: BulkItem[], run: (item: BulkItem) => void): BulkResult {
  const result: BulkResult = { succeeded: [], failed: [] }
  for (const item of items) {
    try {
      run(item)
      result.succeeded.push(item.id)
    } catch (e) {
      result.failed.push({
        id: item.id,
        code: isApiError(e) ? String(e.problem.code ?? e.status) : 'Loi',
        message: isApiError(e) ? (e.problem.detail ?? e.message) : String(e),
      })
    }
  }
  return result
}

export const orderMock = {
  async list(query: OrderQuery): Promise<PaginatedResult<OrderListItem>> {
    await mockDelay()
    requirePermission(permissions.orders.view)
    const { items } = filtered(query)
    const byStatus = query.status ? items.filter((o) => o.status === query.status) : items
    return paginate(sortOrders(byStatus, query), { page: query.page, pageSize: query.pageSize ?? 50 })
  },

  async statusCounts(query: OrderQuery): Promise<OrderStatusCounts> {
    await mockDelay(100, 200)
    requirePermission(permissions.orders.view)
    const { items } = filtered({ ...query, status: undefined })
    const counts = Object.fromEntries([...orderStatusTabs.map((s) => [s, 0]), ['TatCa', items.length]]) as OrderStatusCounts
    for (const o of items) counts[o.status] += 1
    return counts
  },

  async detail(id: string): Promise<OrderDetailDto> {
    await mockDelay()
    requirePermission(permissions.orders.view)
    sweepOverdue()
    return detail(id)
  },

  async addNote(id: string, body: AddOrderNoteRequest): Promise<OrderDetailDto> {
    return act(id, { type: 'Note', content: body.content }, permissions.orders.update)
  },
  async confirm(id: string, body: ConfirmOrderRequest): Promise<OrderDetailDto> {
    return act(id, { type: 'Confirm', note: body.note }, permissions.orders.confirm, body.version)
  },
  async confirmPayment(id: string, body: ConfirmPaymentRequest): Promise<OrderDetailDto> {
    return act(id, { type: 'ConfirmPayment', transactionRef: body.transactionRef }, permissions.orders.confirmPayment, body.version)
  },
  async cancel(id: string, body: CancelOrderRequest): Promise<OrderDetailDto> {
    return act(id, { type: 'Cancel', reason: body.reason, note: body.note }, permissions.orders.cancel, body.version)
  },
  async ship(id: string, body: ShipOrderRequest): Promise<OrderDetailDto> {
    return act(
      id,
      { type: 'Ship', carrier: body.carrier, weightGrams: body.weightGrams, shipperNote: body.shipperNote },
      permissions.orders.ship,
      body.version
    )
  },
  async deliver(id: string, body: VersionedRequest): Promise<OrderDetailDto> {
    return act(id, { type: 'Deliver' }, permissions.orders.ship, body.version)
  },
  async deliveryFailed(id: string, body: DeliveryFailedRequest): Promise<OrderDetailDto> {
    return act(id, { type: 'DeliveryFailed', reason: body.reason, note: body.note }, permissions.orders.ship, body.version)
  },
  async receiveReturn(id: string, body: VersionedRequest): Promise<OrderDetailDto> {
    return act(id, { type: 'ReceiveReturn' }, permissions.orders.ship, body.version)
  },
  async refund(id: string, body: RefundRequest): Promise<OrderDetailDto> {
    return act(id, { type: 'Refund', refundRef: body.refundRef }, permissions.orders.refund, body.version)
  },

  async editPreview(id: string, body: EditOrderRequest): Promise<EditOrderPreview> {
    await mockDelay(100, 200)
    requirePermission(permissions.orders.update)
    return previewEdit(id, body)
  },
  async edit(id: string, body: EditOrderRequest): Promise<OrderDetailDto> {
    await mockDelay()
    const actor = staff(permissions.orders.update)
    return toOrderDetail(editOrder(id, body, actor))
  },

  async labelPrinted(id: string): Promise<{ labelPrintCount: number }> {
    await mockDelay(50, 100)
    const actor = staff(permissions.orders.ship)
    return { labelPrintCount: markLabelPrinted(id, actor) }
  },

  async bulkConfirm(body: BulkConfirmRequest): Promise<BulkResult> {
    await mockDelay()
    const actor = staff(permissions.orders.confirm)
    return bulk(body.items, (item) => applyAction(item.id, { type: 'Confirm' }, actor, item.version))
  },
  async bulkShip(body: BulkShipRequest): Promise<BulkResult> {
    await mockDelay()
    const actor = staff(permissions.orders.ship)
    return bulk(body.items, (item) => {
      const o = getOrder(item.id)
      if (!o) throw SalesErrors.orderNotFound()
      applyAction(item.id, { type: 'Ship', carrier: body.carrier, weightGrams: suggestWeight(o.lines) }, actor, item.version)
    })
  },

  async storeInfo(): Promise<PublicStoreInfo> {
    await mockDelay(50, 100)
    return currentStoreInfo()
  },
}
