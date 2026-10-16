import { addVnDays, diffVnDays, vnDateKey } from '@/features/sales/lib/vn-time'

/**
 * Chọn nhanh khoảng ngày của báo cáo (07 §4.6): Hôm nay, 7 ngày, 30 ngày, Tháng này, Tháng trước, Tùy chọn.
 * Ngày theo giờ Việt Nam, dạng "yyyy-MM-dd"; chặn > 366 ngày trước khi gọi API.
 */
export type RangePreset = 'today' | '7d' | '30d' | 'thisMonth' | 'lastMonth' | 'custom'
export type DateRange = { from: string; to: string }

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: 'today', label: 'Hôm nay' },
  { value: '7d', label: '7 ngày' },
  { value: '30d', label: '30 ngày' },
  { value: 'thisMonth', label: 'Tháng này' },
  { value: 'lastMonth', label: 'Tháng trước' },
  { value: 'custom', label: 'Tùy chọn' },
]

export const MAX_RANGE_DAYS = 366
export const DEFAULT_PRESET: Exclude<RangePreset, 'custom'> = '30d'

export function presetRange(preset: Exclude<RangePreset, 'custom'>, now: number = Date.now()): DateRange {
  const today = vnDateKey(now)
  const firstOfMonth = `${today.slice(0, 8)}01`
  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case '7d':
      return { from: addVnDays(today, -6), to: today }
    case '30d':
      return { from: addVnDays(today, -29), to: today }
    case 'thisMonth':
      return { from: firstOfMonth, to: today }
    case 'lastMonth': {
      const end = addVnDays(firstOfMonth, -1)
      return { from: `${end.slice(0, 8)}01`, to: end }
    }
  }
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

/** Số ngày tính cả hai đầu; null khi sai định dạng */
export function rangeDays(from: string, to: string): number | null {
  if (!DATE_KEY.test(from) || !DATE_KEY.test(to)) return null
  return diffVnDays(from, to) + 1
}

/** Lỗi khoảng ngày, chặn trước khi gọi API; null là hợp lệ (câu lỗi 07 §2) */
export function rangeError(from: string, to: string): string | null {
  const days = rangeDays(from, to)
  if (days === null) return 'Chọn đủ ngày bắt đầu và kết thúc'
  if (days < 1) return 'Ngày kết thúc phải sau ngày bắt đầu'
  if (days > MAX_RANGE_DAYS) return `Khoảng ngày tối đa ${MAX_RANGE_DAYS} ngày`
  return null
}

/** "2026-10-14" → "14/10/2026" */
export const displayDateKey = (key: string) => key.split('-').reverse().join('/')
/** "2026-10-14" → "14/10" (trục biểu đồ) */
export const shortDateKey = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`
