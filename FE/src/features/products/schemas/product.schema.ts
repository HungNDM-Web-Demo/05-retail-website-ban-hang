import { z } from 'zod'
import type { ProductDto, SaveProductRequest } from '@/types/shop'

/** Kiểm tra form sản phẩm, đúng câu lỗi 07 §2.4 (BE kiểm lại cùng quy tắc) */
export const productSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Z]{2}\d{3}$/, 'Mã sản phẩm gồm 2 chữ in hoa và 3 số'),
    name: z.string().trim().min(2, 'Tên từ 2 đến 200 ký tự').max(200, 'Tên từ 2 đến 200 ký tự'),
    slug: z.string().trim().max(220).optional(),
    categoryId: z.string().min(1, 'Chọn danh mục'),
    price: z
      .number({ error: 'Nhập giá bán' })
      .int('Giá bán là bội số của 1.000 ₫')
      .positive('Giá bán phải lớn hơn 0')
      .refine((v) => v % 1000 === 0, 'Giá bán là bội số của 1.000 ₫'),
    listPrice: z
      .number()
      .int()
      .refine((v) => v % 1000 === 0, 'Giá gốc là bội số của 1.000 ₫')
      .optional(),
    description: z.string().max(5000, 'Mô tả tối đa 5.000 ký tự').optional(),
    isFeatured: z.boolean(),
    isHidden: z.boolean(),
    images: z
      .array(z.object({ url: z.string(), colorId: z.string().optional(), isCover: z.boolean() }))
      .max(8, 'Tối đa 8 ảnh'),
    colorIds: z.array(z.string()).min(1, 'Chọn ít nhất một màu'),
    sizes: z.array(z.string()),
    variants: z.array(
      z.object({
        colorId: z.string(),
        size: z.string().optional(),
        isActive: z.boolean(),
        initialStock: z.number().int('Tồn mới là số nguyên từ 0').min(0, 'Tồn mới là số nguyên từ 0').optional(),
      })
    ),
    sizeChart: z
      .object({ title: z.string(), columns: z.array(z.string()), rows: z.array(z.array(z.string())) })
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (v.listPrice !== undefined && v.listPrice <= v.price) {
      ctx.addIssue({ code: 'custom', path: ['listPrice'], message: 'Giá gốc phải lớn hơn giá bán' })
    }
    if (v.variants.length && v.variants.every((x) => !x.isActive)) {
      ctx.addIssue({ code: 'custom', path: ['variants'], message: 'Sản phẩm cần ít nhất một biến thể' })
    }
  })

export type ProductFormValues = z.input<typeof productSchema>

export const emptyProductForm = (): ProductFormValues => ({
  code: '',
  name: '',
  slug: '',
  categoryId: '',
  price: undefined as unknown as number,
  listPrice: undefined,
  description: '',
  isFeatured: false,
  isHidden: false,
  images: [],
  colorIds: [],
  sizes: [],
  variants: [],
  sizeChart: undefined,
})

export const productToForm = (p: ProductDto): ProductFormValues => ({
  code: p.code,
  name: p.name,
  slug: p.slug,
  categoryId: p.categoryId,
  price: p.price,
  // BE trả null cho trường trống; zod `.optional()` chỉ nhận undefined
  listPrice: p.listPrice ?? undefined,
  description: p.description ?? '',
  isFeatured: p.isFeatured,
  isHidden: p.status === 'An',
  images: [...p.images].sort((a, b) => a.sortOrder - b.sortOrder).map((i) => ({ url: i.url, colorId: i.colorId ?? undefined, isCover: i.isCover })),
  colorIds: p.colorIds,
  sizes: p.sizes,
  variants: p.variants.map((v) => ({ colorId: v.colorId, size: v.size ?? undefined, isActive: v.isActive })),
  sizeChart: p.sizeChart ?? undefined,
})

/** Bỏ bảng size rỗng, chuẩn hóa chuỗi trước khi gửi */
export function formToRequest(v: ProductFormValues): SaveProductRequest {
  const chart = v.sizeChart
  const hasChart = !!chart && chart.columns.some((c) => c.trim()) && chart.rows.length > 0
  return {
    code: v.code.trim(),
    name: v.name.trim(),
    slug: v.slug?.trim() || undefined,
    categoryId: v.categoryId,
    price: v.price,
    listPrice: v.listPrice || undefined,
    description: v.description?.trim() || undefined,
    sizeChart: hasChart ? { title: chart!.title.trim(), columns: chart!.columns, rows: chart!.rows } : undefined,
    isFeatured: v.isFeatured,
    isHidden: v.isHidden,
    images: v.images,
    colorIds: v.colorIds,
    sizes: v.sizes,
    variants: v.variants.map((x) => ({ colorId: x.colorId, size: x.size, isActive: x.isActive, initialStock: x.initialStock })),
  }
}

/** Dựng lại lưới colorIds × sizes, giữ trạng thái các ô đã có (07 §3.12) */
export function rebuildGrid(
  colorIds: string[],
  sizes: string[],
  current: ProductFormValues['variants']
): ProductFormValues['variants'] {
  const key = (c: string, s?: string) => `${c}|${s ?? ''}`
  const map = new Map(current.map((v) => [key(v.colorId, v.size), v]))
  const cells = sizes.length ? sizes : [undefined]
  return colorIds.flatMap((c) =>
    cells.map((s) => map.get(key(c, s)) ?? { colorId: c, size: s, isActive: true, initialStock: undefined })
  )
}
