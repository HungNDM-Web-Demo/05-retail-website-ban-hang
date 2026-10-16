import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { PaginatedResult, PaginationQuery } from '@/types/api'
import type { CustomerDetail, CustomerListItem, CustomerQuery, OrderListItem } from '@/types/shop'
import { customerMock } from '../mock/customer.mock'

/** Khách hàng (07 §2.7, SCR-15) */
export const customerService = {
  list: (query: CustomerQuery): Promise<PaginatedResult<CustomerListItem>> =>
    isMockMode() ? customerMock.list(query) : apiCall.get(apiRoutes.customers.list, { params: query }),
  detail: (id: string): Promise<CustomerDetail> =>
    isMockMode() ? customerMock.detail(id) : apiCall.get(apiRoutes.customers.detail(id)),
  orders: (id: string, query: PaginationQuery): Promise<PaginatedResult<OrderListItem>> =>
    isMockMode() ? customerMock.orders(id, query) : apiCall.get(apiRoutes.customers.orders(id), { params: query }),
  updateNote: (id: string, note?: string): Promise<CustomerDetail> =>
    isMockMode() ? customerMock.updateNote(id, { note }) : apiCall.put(apiRoutes.customers.note(id), { note }),
}
