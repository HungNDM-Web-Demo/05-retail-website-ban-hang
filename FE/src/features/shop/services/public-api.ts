import { apiRoutes } from '@/config/api-routes'
import { api } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import { publicHttp } from '@/features/sales/services/public-http'
import type {
  CartCheckRequest,
  CartCheckResult,
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
  SimulateOrderResult,
} from '@/types/shop'
import { deviceId } from '../lib/shop-identity'

/**
 * API cửa hàng công khai (07 §2.2): axios không token, gửi `X-Device-Id` (mã trình duyệt theo danh tính tab).
 * Chế độ mock gọi handler trong `features/shop/mock` (nạp động để trang máy chủ không kéo mock-db).
 */

const headers = () => ({ 'X-Device-Id': deviceId() })
const mock = () => import('../mock/public.mock').then((m) => m.publicMock)

export const shopService = {
  store: async (): Promise<PublicStoreInfo> =>
    isMockMode() ? (await mock()).store() : (await publicHttp.get<PublicStoreInfo>(apiRoutes.public.store, { headers: headers() })).data,

  home: async (): Promise<PublicHome> =>
    isMockMode() ? (await mock()).home() : (await publicHttp.get<PublicHome>(apiRoutes.public.home, { headers: headers() })).data,

  categories: async (): Promise<PublicCategory[]> =>
    isMockMode()
      ? (await mock()).categories()
      : (await publicHttp.get<PublicCategory[]>(apiRoutes.public.categories, { headers: headers() })).data,

  products: async (query: PublicProductQuery): Promise<PublicProductListResult> =>
    isMockMode()
      ? (await mock()).products(query)
      : (await publicHttp.get<PublicProductListResult>(apiRoutes.public.products, { params: query, headers: headers() })).data,

  suggest: async (search: string): Promise<PublicSuggestion[]> =>
    isMockMode()
      ? (await mock()).suggest(search)
      : (await publicHttp.get<PublicSuggestion[]>(apiRoutes.public.suggest, { params: { search }, headers: headers() })).data,

  product: async (slug: string): Promise<PublicProductLookup> =>
    isMockMode()
      ? (await mock()).product(slug)
      : (await publicHttp.get<PublicProductLookup>(apiRoutes.public.product(encodeURIComponent(slug)), { headers: headers() })).data,

  cartCheck: async (req: CartCheckRequest): Promise<CartCheckResult> =>
    isMockMode()
      ? (await mock()).cartCheck(req)
      : (await publicHttp.post<CartCheckResult>(apiRoutes.public.cartCheck, req, { headers: headers() })).data,

  quote: async (req: CheckoutQuoteRequest): Promise<CheckoutQuote> =>
    isMockMode()
      ? (await mock()).quote(req)
      : (await publicHttp.post<CheckoutQuote>(apiRoutes.public.checkoutQuote, req, { headers: headers() })).data,

  placeOrder: async (req: PlaceOrderRequest): Promise<PlaceOrderResult> =>
    isMockMode()
      ? (await mock()).placeOrder(req, deviceId())
      : (await publicHttp.post<PlaceOrderResult>(apiRoutes.public.orders, req, { headers: headers() })).data,

  lookup: async (req: OrderLookupRequest): Promise<PublicOrderView> =>
    isMockMode()
      ? (await mock()).lookup(req, deviceId())
      : (await publicHttp.post<PublicOrderView>(apiRoutes.public.orderLookup, req, { headers: headers() })).data,

  /** Làm mới đơn đang xem (mock không tính lượt sai; api gọi lại lookup) */
  refreshOrder: async (req: OrderLookupRequest): Promise<PublicOrderView> =>
    isMockMode()
      ? (await mock()).refresh(req)
      : (await publicHttp.post<PublicOrderView>(apiRoutes.public.orderLookup, req, { headers: headers() })).data,

  cancel: async (code: string, req: PublicCancelRequest): Promise<PublicOrderView> =>
    isMockMode()
      ? (await mock()).cancel(code, req, deviceId())
      : (await publicHttp.post<PublicOrderView>(apiRoutes.public.orderCancel(code), req, { headers: headers() })).data,

  /** Giả lập khách đặt đơn (07 §2.9, cần đăng nhập) */
  simulateOrder: async (): Promise<SimulateOrderResult> =>
    isMockMode()
      ? (await import('../mock/simulate.mock')).simulateOrderMock()
      : (await api.post<SimulateOrderResult>(apiRoutes.demo.simulateOrder)).data,
}
