import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { PaginatedResult, PaginationQuery } from '@/types/api'
import type { CouponDto, CouponQuery, OrderListItem, SaveCouponRequest } from '@/types/shop'
import { couponMock } from '../mock/coupon.mock'

/** Mã giảm giá (07 §2.6, SCR-14) */
export const couponService = {
  list: (query: CouponQuery): Promise<PaginatedResult<CouponDto>> =>
    isMockMode() ? couponMock.list(query) : apiCall.get(apiRoutes.coupons.list, { params: query }),
  detail: (id: string): Promise<CouponDto> =>
    isMockMode() ? couponMock.detail(id) : apiCall.get(apiRoutes.coupons.detail(id)),
  orders: (id: string, query: PaginationQuery): Promise<PaginatedResult<OrderListItem>> =>
    isMockMode() ? couponMock.orders(id, query) : apiCall.get(apiRoutes.coupons.orders(id), { params: query }),
  create: (body: SaveCouponRequest): Promise<CouponDto> =>
    isMockMode() ? couponMock.create(body) : apiCall.post(apiRoutes.coupons.list, body),
  update: (id: string, body: SaveCouponRequest): Promise<CouponDto> =>
    isMockMode() ? couponMock.update(id, body) : apiCall.put(apiRoutes.coupons.detail(id), body),
  pause: (id: string, paused: boolean): Promise<void> =>
    isMockMode() ? couponMock.pause(id, { paused }) : apiCall.patch(apiRoutes.coupons.pause(id), { paused }),
  remove: (id: string): Promise<void> =>
    isMockMode() ? couponMock.remove(id) : apiCall.delete(apiRoutes.coupons.detail(id)),
}
