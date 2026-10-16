import type { ProductSort, PublicProductQuery } from '@/types/shop'

/**
 * Bộ lọc danh sách sản phẩm ghi trên URL (07 §4.3, TC-01): `category`, `search`, `minPrice`, `maxPrice`,
 * `colors`, `sizes`, `inStock=1`, `sort`, `page`. Dùng chung cho trang máy chủ và trình duyệt.
 */

const SORTS: ProductSort[] = ['newest', 'bestselling', 'priceAsc', 'priceDesc']

type ParamSource = Record<string, string | string[] | undefined> | URLSearchParams

function get(source: ParamSource, key: string): string | undefined {
  if (source instanceof URLSearchParams) return source.get(key) ?? undefined
  const v = source[key]
  return Array.isArray(v) ? v[0] : v
}

const num = (v?: string) => {
  if (v === undefined || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined
}

export function parseProductQuery(source: ParamSource): PublicProductQuery {
  const sort = get(source, 'sort') as ProductSort | undefined
  const page = num(get(source, 'page'))
  const query: PublicProductQuery = {
    category: get(source, 'category') || undefined,
    search: get(source, 'search')?.trim() || undefined,
    minPrice: num(get(source, 'minPrice')),
    maxPrice: num(get(source, 'maxPrice')),
    colors: get(source, 'colors') || undefined,
    sizes: get(source, 'sizes') || undefined,
    inStock: get(source, 'inStock') === '1' ? true : undefined,
    sort: sort && SORTS.includes(sort) ? sort : undefined,
    page: page && page > 1 ? page : undefined,
  }
  return Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined)) as PublicProductQuery
}

export function productQueryString(query: PublicProductQuery): string {
  const params = new URLSearchParams()
  if (query.category) params.set('category', query.category)
  if (query.search) params.set('search', query.search)
  if (query.minPrice !== undefined) params.set('minPrice', String(query.minPrice))
  if (query.maxPrice !== undefined) params.set('maxPrice', String(query.maxPrice))
  if (query.colors) params.set('colors', query.colors)
  if (query.sizes) params.set('sizes', query.sizes)
  if (query.inStock) params.set('inStock', '1')
  if (query.sort && query.sort !== 'newest') params.set('sort', query.sort)
  if (query.page && query.page > 1) params.set('page', String(query.page))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const splitCsv = (s?: string) => (s ? s.split(',').filter(Boolean) : [])
export const joinCsv = (list: string[]) => (list.length ? list.join(',') : undefined)

/** Số bộ lọc đang bật (không tính danh mục, từ khóa, sắp xếp) */
export function activeFilterCount(q: PublicProductQuery): number {
  return (
    splitCsv(q.colors).length +
    splitCsv(q.sizes).length +
    (q.minPrice !== undefined || q.maxPrice !== undefined ? 1 : 0) +
    (q.inStock ? 1 : 0)
  )
}
