import type { StatusTone } from '@/components/shared/StatusBadge'
import type {
  Carrier,
  OrderLabel,
  OrderLineView,
  OrderQuery,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '@/types/shop'
import { orderStatusTabs } from '@/config/shop-labels'
import { readJson, storageKey, writeJson } from '@/lib/storage'

export const paymentStatusTone: Record<PaymentStatus, StatusTone> = {
  ChuaThanhToan: 'neutral',
  DaThanhToan: 'success',
  CanHoanTien: 'danger',
  DaHoanTien: 'info',
}

export const orderLabelTone: Record<OrderLabel, StatusTone> = {
  TrungSdt: 'warning',
  GiaoCham: 'danger',
  KhachCanLuuY: 'warning',
}

const STATUSES = new Set<string>(orderStatusTabs)
const LABELS = new Set<string>(['TrungSdt', 'GiaoCham', 'KhachCanLuuY'])
const METHODS = new Set<string>(['Cod', 'ChuyenKhoan'])
const PAYMENT_STATUSES = new Set<string>(['ChuaThanhToan', 'DaThanhToan', 'CanHoanTien', 'DaHoanTien'])
const DATE = /^\d{4}-\d{2}-\d{2}$/

/** Tab "Tất cả" trên URL là status=all; vắng status → mặc định Chờ xác nhận (UC-07) */
export type OrderTab = OrderStatus | 'all'

export type OrderFilters = {
  tab: OrderTab
  search?: string
  fromDate?: string
  toDate?: string
  paymentMethod?: PaymentMethod
  paymentStatus?: PaymentStatus
  provinceCode?: string
  label?: OrderLabel
  customerId?: string
  couponId?: string
  page: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

/** Đọc bộ lọc từ URL (thẻ Tổng quan mở `/admin/orders?status=…&label=…`) */
export function parseOrderFilters(params: URLSearchParams): OrderFilters {
  const status = params.get('status')
  const get = (k: string) => params.get(k) || undefined
  const from = get('fromDate')
  const to = get('toDate')
  const sortDir = get('sortDir')
  return {
    tab: status === 'all' ? 'all' : status && STATUSES.has(status) ? (status as OrderStatus) : 'ChoXacNhan',
    search: get('search'),
    fromDate: from && DATE.test(from) ? from : undefined,
    toDate: to && DATE.test(to) ? to : undefined,
    paymentMethod: METHODS.has(params.get('paymentMethod') ?? '') ? (get('paymentMethod') as PaymentMethod) : undefined,
    paymentStatus: PAYMENT_STATUSES.has(params.get('paymentStatus') ?? '')
      ? (get('paymentStatus') as PaymentStatus)
      : undefined,
    provinceCode: get('provinceCode'),
    label: LABELS.has(params.get('label') ?? '') ? (get('label') as OrderLabel) : undefined,
    customerId: get('customerId'),
    couponId: get('couponId'),
    page: Math.max(1, Number(params.get('page')) || 1),
    sortBy: ['placedAt', 'total', 'code'].includes(params.get('sortBy') ?? '') ? get('sortBy') : undefined,
    sortDir: sortDir === 'asc' || sortDir === 'desc' ? sortDir : undefined,
  }
}

export function filtersToParams(f: OrderFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.tab !== 'ChoXacNhan') p.set('status', f.tab)
  const entries: [string, string | number | undefined][] = [
    ['search', f.search],
    ['fromDate', f.fromDate],
    ['toDate', f.toDate],
    ['paymentMethod', f.paymentMethod],
    ['paymentStatus', f.paymentStatus],
    ['provinceCode', f.provinceCode],
    ['label', f.label],
    ['customerId', f.customerId],
    ['couponId', f.couponId],
    ['sortBy', f.sortBy],
    ['sortDir', f.sortDir],
    ['page', f.page > 1 ? f.page : undefined],
  ]
  for (const [k, v] of entries) if (v !== undefined && v !== '') p.set(k, String(v))
  return p
}

/** Bộ lọc → OrderQuery (trừ status, dùng cho status-counts) */
export function baseQuery(f: OrderFilters): OrderQuery {
  const q: OrderQuery = {
    search: f.search,
    fromDate: f.fromDate,
    toDate: f.toDate,
    paymentMethod: f.paymentMethod,
    paymentStatus: f.paymentStatus,
    provinceCode: f.provinceCode,
    label: f.label,
    customerId: f.customerId,
    couponId: f.couponId,
  }
  return Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined)) as OrderQuery
}

export const hasExtraFilters = (f: OrderFilters) =>
  !!(f.search || f.fromDate || f.toDate || f.paymentMethod || f.paymentStatus || f.provinceCode || f.label || f.customerId || f.couponId)

/** Nhãn biến thể "Trắng / M" (không size: "Trắng") */
export const variantText = (line: Pick<OrderLineView, 'colorName' | 'size'>) =>
  line.size ? `${line.colorName} / ${line.size}` : line.colorName

// ---------- Bàn giao vận chuyển (07 §3.9) ----------

const LAST_CARRIER_KEY = storageKey('last-carrier')
const CARRIERS: Carrier[] = ['Ghn', 'Ghtk', 'Vtp', 'Jt']

export function lastCarrier(): Carrier {
  const v = readJson<string>('local', LAST_CARRIER_KEY)
  return v && (CARRIERS as string[]).includes(v) ? (v as Carrier) : 'Ghtk'
}
export const rememberCarrier = (c: Carrier) => writeJson('local', LAST_CARRIER_KEY, c)
export const carrierOptions = CARRIERS

/** Khối lượng gợi ý = 300 g × tổng số lượng + 100 g, làm tròn tới 50 g (UC-10 bước 2) */
export const suggestWeightGrams = (lines: { quantity: number }[]) => {
  const qty = lines.reduce((s, l) => s + l.quantity, 0)
  return Math.round((300 * qty + 100) / 50) * 50
}

/** Mã giao dịch ngân hàng (TC-28) */
export const TRANSACTION_REF = /^[A-Za-z0-9]{6,30}$/
export function transactionRefError(v: string): string | null {
  if (!v.trim()) return 'Nhập mã giao dịch ngân hàng'
  if (!TRANSACTION_REF.test(v.trim())) return 'Mã giao dịch gồm 6–30 chữ và số'
  return null
}

/** Khóa thử nghiệm: đặt "1" thì trang in không tự gọi window.print() (kiểm thử tự động) */
export const NO_AUTO_PRINT_KEY = storageKey('print.no-auto')
