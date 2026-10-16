import { formatVnd } from '@/lib/format'

/** Số tiền trong câu lỗi, dòng thời gian: "500.000 ₫" (khoảng trắng thường như BE, 07 §2) */
export const money = (n: number) => formatVnd(n).replace(/ /g, ' ')
