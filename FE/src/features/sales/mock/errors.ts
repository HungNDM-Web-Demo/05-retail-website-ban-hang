import { ApiError } from '@/lib/api-error'

/**
 * Lỗi mock của Website Bán hàng (07 §4.8). Mọi lỗi nghiệp vụ có `code` nằm ở `lib/sales-errors.ts`
 * (dùng chung lõi thuần); file này thêm `tooMany` (429) và xuất lại cho handler.
 */
export { SalesErrors, salesError, fieldErrors, fieldConflict, fieldMessages, couponMessages } from '../lib/sales-errors'

/** 429 kèm trường mở rộng (vd `retryAfterSeconds`) */
export function tooMany(detail: string, extra: Record<string, unknown> = {}): ApiError {
  return ApiError.fromStatus(429, detail, extra)
}
