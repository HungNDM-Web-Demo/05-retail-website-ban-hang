import { normalizeVi } from '@/lib/normalize'
import type { StockStatus } from '@/types/shop'
import { SalesRules } from './rules'

/** Tình trạng biến thể (BR-02): 0 HetHang, 1–5 SapHet, > 5 ConHang */
export function stockStatus(stock: number): StockStatus {
  if (stock <= 0) return 'HetHang'
  if (stock <= SalesRules.lowStockMax) return 'SapHet'
  return 'ConHang'
}

/**
 * Tình trạng sản phẩm ở danh sách quản trị (07 §3.8): mọi biến thể bật tồn 0 → HetHang;
 * có biến thể bật tồn ≤ 5 → SapHet; còn lại ConHang. Không có biến thể bật → HetHang.
 */
export function productStockStatus(variants: { stock: number; isActive: boolean }[]): StockStatus {
  const active = variants.filter((v) => v.isActive)
  if (active.length === 0 || active.every((v) => v.stock <= 0)) return 'HetHang'
  if (active.some((v) => v.stock <= SalesRules.lowStockMax)) return 'SapHet'
  return 'ConHang'
}

/** Cửa hàng: mọi biến thể bật tồn 0 (BR-02) */
export const isOutOfStock = (variants: { stock: number; isActive: boolean }[]) =>
  variants.filter((v) => v.isActive).every((v) => v.stock <= 0)

/** BR-01: round((giá gốc − giá bán) / giá gốc × 100); không có giá gốc → undefined */
export function discountPercent(price: number, listPrice?: number | null): number | undefined {
  if (!listPrice || listPrice <= price) return undefined
  return Math.round(((listPrice - price) / listPrice) * 100)
}

/** SKU (BR-24): `{mã SP}-{mã màu}-{size}` hoặc `{mã SP}-{mã màu}` */
export const skuOf = (code: string, colorCode: string, size?: string | null) =>
  size ? `${code}-${colorCode}-${size}` : `${code}-${colorCode}`

/** Slug (BR-24): bỏ dấu (đ → d), chữ thường, ký tự khác chữ số thành `-`, gộp, bỏ đầu cuối */
export function slugify(name: string): string {
  return normalizeVi(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Slug không trùng: thêm `-2`, `-3`… (BR-24) */
export function uniqueSlug(base: string, taken: (slug: string) => boolean): string {
  if (!taken(base)) return base
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`
    if (!taken(candidate)) return candidate
  }
}

/** Nhãn biến thể "{màu}/{size}" hoặc "{màu}" (07 §3.10) */
export const variantLabel = (colorName: string, size?: string | null) =>
  size ? `${colorName}/${size}` : colorName

/** Nhãn biến thể trong câu lỗi tồn "{màu} / {size}" (07 §2.12) */
export const variantLabelSpaced = (colorName: string, size?: string | null) =>
  size ? `${colorName} / ${size}` : colorName
