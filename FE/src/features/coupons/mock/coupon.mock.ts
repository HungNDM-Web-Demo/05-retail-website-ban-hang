import { permissions } from '@/config/permissions'
import { mockDelay } from '@/lib/data-source'
import { matchesSearch } from '@/lib/normalize'
import { auditCreate, auditDelete, auditUpdate } from '@/mock/mock-audit'
import { requirePermission } from '@/mock/mock-auth'
import { newId, paginate, sortItems } from '@/mock/mock-helpers'
import { couponStatus, normalizeCouponCode } from '@/features/sales/lib/coupon-rules'
import { fieldConflict, fieldErrors, SalesErrors } from '@/features/sales/lib/sales-errors'
import { msOf } from '@/features/sales/lib/vn-time'
import { categoriesDb, couponsDb, liveCoupons } from '@/features/sales/mock/catalog.store'
import { orderViewContext, toOrderListItem } from '@/features/sales/mock/order-views'
import { sweepOverdue } from '@/features/sales/mock/order-workflow'
import { allOrders } from '@/features/sales/mock/order.store'
import { notFound } from '@/mock/mock-errors'
import type { PaginatedResult, PaginationQuery } from '@/types/api'
import type {
  CouponDto,
  CouponQuery,
  CouponRecord,
  OrderListItem,
  OrderRecord,
  PauseCouponRequest,
  SaveCouponRequest,
} from '@/types/shop'

/** Handler mock mã giảm giá (07 §2.6, BR-26). Collection `coupons` của lõi features/sales. */

function toDto(c: CouponRecord, orders: OrderRecord[], now = Date.now()): CouponDto {
  const mine = orders.filter((o) => o.couponId === c.id)
  const live = mine.filter((o) => o.status !== 'DaHuy')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- bỏ trường không có trong DTO
  const { createdAt: _c, updatedAt: _u, isDeleted: _d, ...rest } = c
  return {
    ...rest,
    ...(c.categoryId ? { categoryName: categoriesDb.get(c.categoryId)?.name } : {}),
    usedCount: live.length,
    discountTotal: live.reduce((s, o) => s + o.discount + o.shippingDiscount, 0),
    orderValueTotal: live.reduce((s, o) => s + o.total, 0),
    status: couponStatus(c, now, live.length),
    canDelete: mine.length === 0,
  }
}

function getLive(id: string): CouponRecord {
  const c = couponsDb.get(id)
  if (!c || c.isDeleted) throw notFound('Không tìm thấy mã giảm giá')
  return c
}

function validate(body: SaveCouponRequest, id?: string): Omit<CouponRecord, 'id' | 'createdAt' | 'isPaused'> {
  const code = normalizeCouponCode(body.code)
  const errors: Record<string, string> = {}
  if (!/^[A-Z0-9]{4,20}$/.test(code)) errors.code = 'Mã 4–20 ký tự chữ in hoa và số'
  const name = (body.name ?? '').trim()
  if (name.length < 2 || name.length > 200) errors.name = 'Tên từ 2 đến 200 ký tự'
  if (body.type === 'PhanTram') {
    if (!Number.isInteger(body.value) || body.value < 1 || body.value > 50) errors.value = 'Phần trăm từ 1 đến 50'
    if (!body.maxDiscount || body.maxDiscount <= 0) errors.maxDiscount = 'Nhập mức giảm tối đa cho mã phần trăm'
    else if (body.maxDiscount % 1000 !== 0) errors.maxDiscount = 'Mức giảm tối đa là bội số của 1.000 ₫'
  } else if (body.type === 'SoTien') {
    if (!Number.isInteger(body.value) || body.value <= 0 || body.value % 1000 !== 0) errors.value = 'Số tiền giảm là bội số của 1.000 ₫'
  } else if (body.type === 'MienPhiVanChuyen') {
    if (body.value !== 0) errors.value = 'Mã miễn phí vận chuyển có giá trị 0'
  } else errors.type = 'Chọn kiểu mã'
  if (!Number.isInteger(body.minOrder) || body.minOrder < 0) errors.minOrder = 'Đơn tối thiểu từ 0'
  if (!Number.isInteger(body.perCustomerLimit) || body.perCustomerLimit < 1) errors.perCustomerLimit = 'Lượt mỗi khách từ 1'
  if (body.totalLimit !== undefined && body.totalLimit !== null && (!Number.isInteger(body.totalLimit) || body.totalLimit < 1))
    errors.totalLimit = 'Tổng lượt từ 1 hoặc để trống'
  if (body.categoryId && (!categoriesDb.get(body.categoryId) || categoriesDb.get(body.categoryId)?.isDeleted))
    errors.categoryId = 'Danh mục không tồn tại'
  if (!body.startAt || Number.isNaN(msOf(body.startAt))) errors.startAt = 'Chọn thời điểm bắt đầu'
  if (!body.endAt || Number.isNaN(msOf(body.endAt))) errors.endAt = 'Chọn thời điểm kết thúc'
  else if (body.startAt && msOf(body.endAt) <= msOf(body.startAt)) errors.endAt = 'Thời điểm kết thúc phải sau thời điểm bắt đầu'
  if (Object.keys(errors).length) throw fieldErrors(errors)
  if (liveCoupons().some((c) => c.id !== id && c.code === code)) throw fieldConflict({ code: 'Mã giảm giá đã tồn tại' })
  return {
    code,
    name,
    type: body.type,
    value: body.type === 'MienPhiVanChuyen' ? 0 : body.value,
    ...(body.type === 'PhanTram' ? { maxDiscount: body.maxDiscount } : {}),
    minOrder: body.minOrder,
    ...(body.categoryId ? { categoryId: body.categoryId } : {}),
    ...(body.totalLimit ? { totalLimit: body.totalLimit } : {}),
    perCustomerLimit: body.perCustomerLimit,
    startAt: new Date(body.startAt).toISOString(),
    endAt: new Date(body.endAt).toISOString(),
  }
}

export const couponMock = {
  async list(query: CouponQuery): Promise<PaginatedResult<CouponDto>> {
    await mockDelay()
    requirePermission(permissions.coupons.view)
    sweepOverdue()
    const orders = allOrders()
    let items = liveCoupons().map((c) => toDto(c, orders))
    if (query.status) items = items.filter((c) => c.status === query.status)
    if (query.search) items = items.filter((c) => matchesSearch(`${c.code} ${c.name}`, query.search))
    return paginate(sortItems(items, query.sortBy || 'startAt', query.sortDir || 'desc'), query)
  },

  async detail(id: string): Promise<CouponDto> {
    await mockDelay()
    requirePermission(permissions.coupons.view)
    return toDto(getLive(id), allOrders())
  },

  async orders(id: string, query: PaginationQuery): Promise<PaginatedResult<OrderListItem>> {
    await mockDelay()
    requirePermission(permissions.coupons.view)
    getLive(id)
    const orders = allOrders()
    const ctx = orderViewContext(orders)
    const list = orders
      .filter((o) => o.couponId === id)
      .sort((a, b) => b.placedAt.localeCompare(a.placedAt))
      .map((o) => toOrderListItem(o, ctx))
    return paginate(list, query)
  },

  async create(body: SaveCouponRequest): Promise<CouponDto> {
    await mockDelay()
    requirePermission(permissions.coupons.create)
    const record = couponsDb.insert({ ...validate(body), id: newId(), isPaused: false, createdAt: new Date().toISOString() })
    auditCreate('Coupon', record)
    return toDto(record, allOrders())
  },

  async update(id: string, body: SaveCouponRequest): Promise<CouponDto> {
    await mockDelay()
    requirePermission(permissions.coupons.update)
    const before = getLive(id)
    const next = validate(body, id)
    const orders = allOrders()
    if (orders.some((o) => o.couponId === id)) {
      const locked = 'Mã đã có lượt dùng, không đổi được'
      const errors: Record<string, string> = {}
      if (next.code !== before.code) errors.code = locked
      if (next.type !== before.type) errors.type = locked
      if ((next.categoryId ?? '') !== (before.categoryId ?? '')) errors.categoryId = locked
      if (Object.keys(errors).length) throw fieldErrors(errors)
    }
    const after = couponsDb.update(id, (c) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- bỏ trường không có trong DTO
      const { maxDiscount: _m, categoryId: _c, totalLimit: _t, ...keep } = c
      return { ...keep, ...next, updatedAt: new Date().toISOString() }
    })!
    auditUpdate('Coupon', before, after)
    return toDto(after, orders)
  },

  async pause(id: string, body: PauseCouponRequest): Promise<void> {
    await mockDelay(100, 200)
    requirePermission(permissions.coupons.update)
    const before = getLive(id)
    const after = couponsDb.update(id, { isPaused: body.paused, updatedAt: new Date().toISOString() })!
    auditUpdate('Coupon', before, after)
  },

  async remove(id: string): Promise<void> {
    await mockDelay()
    requirePermission(permissions.coupons.delete)
    const c = getLive(id)
    if (allOrders().some((o) => o.couponId === id)) throw SalesErrors.couponUsed()
    couponsDb.update(id, { isDeleted: true, updatedAt: new Date().toISOString() })
    auditDelete('Coupon', c)
  },
}
