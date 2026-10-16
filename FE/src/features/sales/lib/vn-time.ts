/**
 * Giờ Việt Nam (UTC+7, không đổi giờ mùa hè) cho mã đơn, mã vận đơn, "hôm nay", báo cáo (06 §3; BE `VietnamTime`).
 * Không phụ thuộc múi giờ của máy. Chép từ demo Quản lý Nhà hàng, Menu QR.
 */

const OFFSET_MS = 7 * 60 * 60_000
export const DAY_MS = 86_400_000
export const MINUTE_MS = 60_000

type DateInput = Date | number | string

export type VnParts = { year: number; month: number; day: number; hour: number; minute: number }

/** Thời điểm hiện tại (ms). Một chỗ để mock và giao diện dùng chung. */
export const vnNow = (): number => Date.now()

/** Tách ngày giờ Việt Nam của một thời điểm */
export function vnParts(date: DateInput): VnParts {
  const d = new Date(new Date(date).getTime() + OFFSET_MS)
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  }
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Khóa ngày "yyyy-MM-dd" theo giờ Việt Nam */
export function vnDateKey(date: DateInput): string {
  const p = vnParts(date)
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`
}

/** "yyMMdd" theo giờ Việt Nam (mã đơn, mã vận đơn) */
export function vnYyMMdd(date: DateInput): string {
  return vnDateKey(date).slice(2).replace(/-/g, '')
}

/** Thời điểm UTC (ms) của 00:00 ngày "yyyy-MM-dd" giờ Việt Nam */
export function vnStartOfDay(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  return Date.UTC(y, m - 1, d) - OFFSET_MS
}

/** Thời điểm (ms) của "HH:mm" giờ Việt Nam ngày dateKey */
export function vnAt(dateKey: string, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return vnStartOfDay(dateKey) + (h * 60 + (m || 0)) * MINUTE_MS
}

/** Cộng n ngày vào khóa ngày */
export function addVnDays(dateKey: string, days: number): string {
  return vnDateKey(vnStartOfDay(dateKey) + days * DAY_MS + 12 * 3600_000)
}

/** Số ngày giữa hai khóa ngày (to − from) */
export function diffVnDays(from: string, to: string): number {
  return Math.round((vnStartOfDay(to) - vnStartOfDay(from)) / DAY_MS)
}

/** Khoảng [from 00:00, to 23:59:59.999] giờ Việt Nam → ms */
export function vnRange(from: string, to: string): { start: number; end: number } {
  return { start: vnStartOfDay(from), end: vnStartOfDay(addVnDays(to, 1)) - 1 }
}

/** "HH:mm" giờ Việt Nam */
export function vnTime(date: DateInput): string {
  const p = vnParts(date)
  return `${pad2(p.hour)}:${pad2(p.minute)}`
}

/** "HH:mm dd/MM" giờ Việt Nam (hạn thanh toán trong dòng thời gian, 07 §3.10) */
export function vnTimeDate(date: DateInput): string {
  const p = vnParts(date)
  return `${pad2(p.hour)}:${pad2(p.minute)} ${pad2(p.day)}/${pad2(p.month)}`
}

/** "dd/MM/yyyy HH:mm" giờ Việt Nam */
export function vnDateTime(date: DateInput): string {
  const p = vnParts(date)
  return `${pad2(p.day)}/${pad2(p.month)}/${p.year} ${pad2(p.hour)}:${pad2(p.minute)}`
}

/** Làm tròn xuống tới phút (thời điểm nạp seed, 06 §5.3) */
export const floorToMinute = (ms: number) => Math.floor(ms / MINUTE_MS) * MINUTE_MS

export const toIso = (ms: number) => new Date(ms).toISOString()
export const msOf = (iso: string) => new Date(iso).getTime()
