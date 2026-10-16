import axios from 'axios'
import { appConfig } from '@/config/app.config'
import { toApiError } from '@/lib/axios'

/**
 * Axios riêng cho API công khai (07 §2.2): KHÔNG gắn Authorization, không tự làm mới token.
 * Header `X-Device-Id` do người gọi truyền (cửa hàng: `features/shop/lib/shop-identity.ts`).
 */
export const publicHttp = axios.create({
  baseURL: appConfig.apiUrl,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
})
publicHttp.interceptors.response.use(
  (r) => r,
  (error) => Promise.reject(toApiError(error))
)
