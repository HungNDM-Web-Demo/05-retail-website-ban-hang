import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { PaginatedResult } from '@/types/api'
import type {
  AddOrderNoteRequest,
  BulkConfirmRequest,
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
  OrderStatusCounts,
  PublicStoreInfo,
  RefundRequest,
  ShipOrderRequest,
  VersionedRequest,
} from '@/types/shop'
import { orderMock } from '../mock/order.mock'

/** Đơn hàng quản trị (07 §2.5, SCR-11…13). Thao tác đổi đơn trả `OrderDetailDto` mới. */
export const orderService = {
  list: (query: OrderQuery): Promise<PaginatedResult<OrderListItem>> =>
    isMockMode() ? orderMock.list(query) : apiCall.get(apiRoutes.orders.list, { params: query }),

  statusCounts: (query: OrderQuery): Promise<OrderStatusCounts> =>
    isMockMode()
      ? orderMock.statusCounts(query)
      : apiCall.get(apiRoutes.orders.statusCounts, { params: query }),

  detail: (id: string): Promise<OrderDetailDto> =>
    isMockMode() ? orderMock.detail(id) : apiCall.get(apiRoutes.orders.detail(id)),

  addNote: (id: string, body: AddOrderNoteRequest): Promise<OrderDetailDto> =>
    isMockMode() ? orderMock.addNote(id, body) : apiCall.post(apiRoutes.orders.notes(id), body),

  confirm: (id: string, body: ConfirmOrderRequest): Promise<OrderDetailDto> =>
    isMockMode() ? orderMock.confirm(id, body) : apiCall.post(apiRoutes.orders.confirm(id), body),

  confirmPayment: (id: string, body: ConfirmPaymentRequest): Promise<OrderDetailDto> =>
    isMockMode()
      ? orderMock.confirmPayment(id, body)
      : apiCall.post(apiRoutes.orders.confirmPayment(id), body),

  editPreview: (id: string, body: EditOrderRequest): Promise<EditOrderPreview> =>
    isMockMode()
      ? orderMock.editPreview(id, body)
      : apiCall.post(apiRoutes.orders.editPreview(id), body),

  edit: (id: string, body: EditOrderRequest): Promise<OrderDetailDto> =>
    isMockMode() ? orderMock.edit(id, body) : apiCall.put(apiRoutes.orders.detail(id), body),

  cancel: (id: string, body: CancelOrderRequest): Promise<OrderDetailDto> =>
    isMockMode() ? orderMock.cancel(id, body) : apiCall.post(apiRoutes.orders.cancel(id), body),

  ship: (id: string, body: ShipOrderRequest): Promise<OrderDetailDto> =>
    isMockMode() ? orderMock.ship(id, body) : apiCall.post(apiRoutes.orders.ship(id), body),

  deliver: (id: string, body: VersionedRequest): Promise<OrderDetailDto> =>
    isMockMode() ? orderMock.deliver(id, body) : apiCall.post(apiRoutes.orders.deliver(id), body),

  deliveryFailed: (id: string, body: DeliveryFailedRequest): Promise<OrderDetailDto> =>
    isMockMode()
      ? orderMock.deliveryFailed(id, body)
      : apiCall.post(apiRoutes.orders.deliveryFailed(id), body),

  receiveReturn: (id: string, body: VersionedRequest): Promise<OrderDetailDto> =>
    isMockMode()
      ? orderMock.receiveReturn(id, body)
      : apiCall.post(apiRoutes.orders.receiveReturn(id), body),

  refund: (id: string, body: RefundRequest): Promise<OrderDetailDto> =>
    isMockMode() ? orderMock.refund(id, body) : apiCall.post(apiRoutes.orders.refund(id), body),

  labelPrinted: (id: string): Promise<{ labelPrintCount: number }> =>
    isMockMode() ? orderMock.labelPrinted(id) : apiCall.post(apiRoutes.orders.labelPrinted(id)),

  bulkConfirm: (body: BulkConfirmRequest): Promise<BulkResult> =>
    isMockMode() ? orderMock.bulkConfirm(body) : apiCall.post(apiRoutes.orders.bulkConfirm, body),

  /** GET /api/public/store: người gửi trên phiếu giao (07 §2.11) */
  storeInfo: (): Promise<PublicStoreInfo> =>
    isMockMode() ? orderMock.storeInfo() : apiCall.get(apiRoutes.public.store),

  bulkShip: (body: BulkShipRequest): Promise<BulkResult> =>
    isMockMode() ? orderMock.bulkShip(body) : apiCall.post(apiRoutes.orders.bulkShip, body),
}
