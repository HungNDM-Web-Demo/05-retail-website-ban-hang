import { format } from 'date-fns'
import { z } from 'zod'
import type { CouponDto, SaveCouponRequest } from '@/types/shop'

/** Form mã giảm giá (BR-26, 07 §2.6): câu lỗi đúng hợp đồng */
export const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9]{4,20}$/, 'Mã 4–20 ký tự chữ in hoa và số')),
    name: z.string().trim().min(2, 'Tên từ 2 đến 200 ký tự').max(200, 'Tên từ 2 đến 200 ký tự'),
    type: z.enum(['PhanTram', 'SoTien', 'MienPhiVanChuyen']),
    value: z.number().optional(),
    maxDiscount: z.number().optional(),
    minOrder: z.number({ error: 'Nhập đơn tối thiểu' }).int().min(0, 'Đơn tối thiểu từ 0'),
    categoryId: z.string().optional(),
    totalLimit: z.number().int().min(1, 'Tổng lượt từ 1 hoặc để trống').optional(),
    perCustomerLimit: z.number({ error: 'Nhập lượt mỗi khách' }).int().min(1, 'Lượt mỗi khách từ 1'),
    startAt: z.string().min(1, 'Chọn thời điểm bắt đầu'),
    endAt: z.string().min(1, 'Chọn thời điểm kết thúc'),
  })
  .superRefine((v, ctx) => {
    if (v.type === 'PhanTram') {
      if (!v.value || v.value < 1 || v.value > 50 || !Number.isInteger(v.value))
        ctx.addIssue({ code: 'custom', path: ['value'], message: 'Phần trăm từ 1 đến 50' })
      if (!v.maxDiscount) ctx.addIssue({ code: 'custom', path: ['maxDiscount'], message: 'Nhập mức giảm tối đa cho mã phần trăm' })
      else if (v.maxDiscount % 1000 !== 0)
        ctx.addIssue({ code: 'custom', path: ['maxDiscount'], message: 'Mức giảm tối đa là bội số của 1.000 ₫' })
    }
    if (v.type === 'SoTien' && (!v.value || v.value % 1000 !== 0))
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'Số tiền giảm là bội số của 1.000 ₫' })
    if (v.startAt && v.endAt && new Date(v.endAt).getTime() <= new Date(v.startAt).getTime())
      ctx.addIssue({ code: 'custom', path: ['endAt'], message: 'Thời điểm kết thúc phải sau thời điểm bắt đầu' })
  })

export type CouponFormInput = z.input<typeof couponSchema>
export type CouponFormOutput = z.output<typeof couponSchema>

/** ISO → giá trị ô datetime-local (giờ máy, demo dùng giờ Việt Nam) */
const toLocal = (iso: string) => format(new Date(iso), "yyyy-MM-dd'T'HH:mm")

export function couponToForm(c?: CouponDto): CouponFormInput {
  if (!c) {
    const start = new Date()
    start.setDate(start.getDate() + 1)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 30)
    end.setHours(23, 59, 0, 0)
    return {
      code: '',
      name: '',
      type: 'PhanTram',
      value: undefined,
      maxDiscount: undefined,
      minOrder: 0,
      categoryId: undefined,
      totalLimit: undefined,
      perCustomerLimit: 1,
      startAt: toLocal(start.toISOString()),
      endAt: toLocal(end.toISOString()),
    }
  }
  return {
    code: c.code,
    name: c.name,
    type: c.type,
    value: c.value,
    maxDiscount: c.maxDiscount ?? undefined,
    minOrder: c.minOrder,
    categoryId: c.categoryId ?? undefined,
    totalLimit: c.totalLimit ?? undefined,
    perCustomerLimit: c.perCustomerLimit,
    startAt: toLocal(c.startAt),
    endAt: toLocal(c.endAt),
  }
}

export const formToCouponRequest = (v: CouponFormOutput): SaveCouponRequest => ({
  code: v.code,
  name: v.name,
  type: v.type,
  value: v.type === 'MienPhiVanChuyen' ? 0 : (v.value ?? 0),
  maxDiscount: v.type === 'PhanTram' ? v.maxDiscount : undefined,
  minOrder: v.minOrder,
  categoryId: v.categoryId || undefined,
  totalLimit: v.totalLimit || undefined,
  perCustomerLimit: v.perCustomerLimit,
  startAt: new Date(v.startAt).toISOString(),
  endAt: new Date(v.endAt).toISOString(),
})
