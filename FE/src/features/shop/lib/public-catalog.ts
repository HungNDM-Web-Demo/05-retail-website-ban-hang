import { sizeOrder } from '@/config/shop-labels'
import { matchesSearch, normalizeVi } from '@/lib/normalize'
import { SalesRules } from '@/features/sales/lib/rules'
import { SalesErrors } from '@/features/sales/lib/sales-errors'
import { discountPercent, isOutOfStock, stockStatus } from '@/features/sales/lib/stock'
import type {
  Banner,
  CategoryRecord,
  ColorRecord,
  ProductRecord,
  PublicCategory,
  PublicColor,
  PublicHome,
  PublicProductCard,
  PublicProductDetail,
  PublicProductListResult,
  PublicProductLookup,
  PublicProductQuery,
  PublicSuggestion,
} from '@/types/shop'

/**
 * Chiếu danh mục sang dữ liệu cửa hàng công khai (07 §2.2, §3.8) — hàm thuần, dùng chung cho handler mock
 * (đọc mock-db) và trang render phía máy chủ (đọc seed). Chỉ trả sản phẩm, danh mục đang hiển thị.
 */

export type CatalogSnapshot = {
  categories: CategoryRecord[]
  colors: ColorRecord[]
  products: ProductRecord[]
}

type Ctx = {
  categories: Map<string, CategoryRecord>
  colors: Map<string, ColorRecord>
  /** Sản phẩm đang bán: chưa xóa, không ẩn, danh mục đang hiển thị, có biến thể bật */
  selling: ProductRecord[]
  snapshot: CatalogSnapshot
}

const activeVariants = (p: ProductRecord) => p.variants.filter((v) => v.isActive)

function contextOf(snapshot: CatalogSnapshot): Ctx {
  const categories = new Map(snapshot.categories.filter((c) => !c.isDeleted).map((c) => [c.id, c]))
  const colors = new Map(snapshot.colors.filter((c) => !c.isDeleted).map((c) => [c.id, c]))
  const selling = snapshot.products.filter(
    (p) => !p.isDeleted && !p.isHidden && categories.get(p.categoryId)?.isVisible && activeVariants(p).length > 0
  )
  return { categories, colors, selling, snapshot }
}

const sizeRank = (s: string) => {
  const i = sizeOrder.indexOf(s)
  return i < 0 ? 999 : i
}

function colorsOf(p: ProductRecord, ctx: Ctx): PublicColor[] {
  const active = new Set(activeVariants(p).map((v) => v.colorId))
  return p.colorIds
    .filter((id) => active.has(id))
    .map((id) => ctx.colors.get(id))
    .filter((c): c is ColorRecord => !!c)
    .map((c) => ({ code: c.code, name: c.name, hex: c.hex }))
}

function toCard(p: ProductRecord, ctx: Ctx): PublicProductCard {
  const category = ctx.categories.get(p.categoryId)
  const images = [...p.images].sort((a, b) => a.sortOrder - b.sortOrder)
  const cover = images.find((i) => i.isCover) ?? images[0]
  const hover = images.find((i) => i !== cover)
  return {
    id: p.id,
    code: p.code,
    slug: p.slug,
    name: p.name,
    categorySlug: category?.slug ?? '',
    categoryName: category?.name ?? '',
    price: p.price,
    ...(p.listPrice ? { listPrice: p.listPrice } : {}),
    ...(discountPercent(p.price, p.listPrice) ? { discountPercent: discountPercent(p.price, p.listPrice) } : {}),
    ...(cover ? { coverUrl: cover.url } : {}),
    ...(hover ? { hoverUrl: hover.url } : {}),
    colors: colorsOf(p, ctx),
    isOutOfStock: isOutOfStock(p.variants),
    soldCount: p.soldCount,
    isFeatured: p.isFeatured,
    createdAt: p.createdAt,
  }
}

function categoryCards(ctx: Ctx): PublicCategory[] {
  return [...ctx.categories.values()]
    .filter((c) => c.isVisible)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      ...(c.imageUrl ? { imageUrl: c.imageUrl } : {}),
      color: c.color,
      productCount: ctx.selling.filter((p) => p.categoryId === c.id).length,
    }))
    .filter((c) => c.productCount > 0)
}

const bySortOrder = (a: ProductRecord, b: ProductRecord) => a.sortOrder - b.sortOrder

function sortProducts(list: ProductRecord[], sort: PublicProductQuery['sort']): ProductRecord[] {
  const arr = [...list]
  switch (sort) {
    case 'bestselling':
      return arr.sort((a, b) => b.soldCount - a.soldCount || bySortOrder(a, b))
    case 'priceAsc':
      return arr.sort((a, b) => a.price - b.price || bySortOrder(a, b))
    case 'priceDesc':
      return arr.sort((a, b) => b.price - a.price || bySortOrder(a, b))
    default:
      // Mới nhất; sản phẩm hết hàng xếp cuối (BR-02)
      return arr.sort(
        (a, b) =>
          Number(isOutOfStock(a.variants)) - Number(isOutOfStock(b.variants)) ||
          b.createdAt.localeCompare(a.createdAt) ||
          bySortOrder(a, b)
      )
  }
}

function searchText(p: ProductRecord) {
  return `${p.name} ${p.code} ${p.variants.map((v) => v.sku).join(' ')}`
}

export function publicCategories(snapshot: CatalogSnapshot): PublicCategory[] {
  return categoryCards(contextOf(snapshot))
}

export function publicHome(snapshot: CatalogSnapshot, banners: Banner[]): PublicHome {
  const ctx = contextOf(snapshot)
  const size = SalesRules.homeBlockSize
  return {
    banners,
    categories: categoryCards(ctx),
    featured: ctx.selling.filter((p) => p.isFeatured).sort(bySortOrder).slice(0, size).map((p) => toCard(p, ctx)),
    newest: sortProducts(ctx.selling, 'newest').slice(0, size).map((p) => toCard(p, ctx)),
    onSale: ctx.selling
      .filter((p) => discountPercent(p.price, p.listPrice))
      .sort((a, b) => (discountPercent(b.price, b.listPrice) ?? 0) - (discountPercent(a.price, a.listPrice) ?? 0) || bySortOrder(a, b))
      .slice(0, size)
      .map((p) => toCard(p, ctx)),
  }
}

const splitList = (s?: string) =>
  (s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

/** Danh sách, lọc, sắp xếp (FR-05, FR-06, §3.8). Danh mục không có hoặc đang ẩn → 404 KhongTimThayDanhMuc */
export function publicProducts(snapshot: CatalogSnapshot, query: PublicProductQuery): PublicProductListResult {
  const ctx = contextOf(snapshot)
  let base = ctx.selling
  let category: PublicCategory | undefined
  if (query.category) {
    const cat = [...ctx.categories.values()].find((c) => c.slug === query.category)
    if (!cat || !cat.isVisible) throw SalesErrors.categoryNotFound()
    category = categoryCards(ctx).find((c) => c.id === cat.id) ?? {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      imageUrl: cat.imageUrl,
      color: cat.color,
      productCount: 0,
    }
    base = base.filter((p) => p.categoryId === cat.id)
  }
  if (normalizeVi(query.search)) base = base.filter((p) => matchesSearch(searchText(p), query.search))

  // Facet tính trước khi lọc màu, size, giá
  const colorIds = new Set<string>()
  const sizes = new Set<string>()
  for (const p of base)
    for (const v of activeVariants(p)) {
      colorIds.add(v.colorId)
      if (v.size) sizes.add(v.size)
    }
  const prices = base.map((p) => p.price)
  const facets = {
    colors: [...colorIds]
      .map((id) => ctx.colors.get(id))
      .filter((c): c is ColorRecord => !!c)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({ code: c.code, name: c.name, hex: c.hex })),
    sizes: [...sizes].sort((a, b) => sizeRank(a) - sizeRank(b) || a.localeCompare(b)),
    minPrice: prices.length ? Math.min(...prices) : 0,
    maxPrice: prices.length ? Math.max(...prices) : 0,
  }

  const wantColors = new Set(splitList(query.colors))
  const wantSizes = new Set(splitList(query.sizes))
  const colorCodeOf = (id: string) => ctx.colors.get(id)?.code ?? ''
  let filtered = base.filter((p) =>
    activeVariants(p).some(
      (v) =>
        (wantColors.size === 0 || wantColors.has(colorCodeOf(v.colorId))) &&
        (wantSizes.size === 0 || (v.size && wantSizes.has(v.size))) &&
        (!query.inStock || v.stock > 0)
    )
  )
  if (query.minPrice !== undefined && query.minPrice !== null && !Number.isNaN(query.minPrice))
    filtered = filtered.filter((p) => p.price >= query.minPrice!)
  if (query.maxPrice !== undefined && query.maxPrice !== null && !Number.isNaN(query.maxPrice))
    filtered = filtered.filter((p) => p.price <= query.maxPrice!)

  const sorted = sortProducts(filtered, query.sort)
  const pageSize = Math.min(Math.max(Number(query.pageSize) || SalesRules.publicPageSize, 1), SalesRules.publicMaxPageSize)
  const totalCount = sorted.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const page = Math.min(Math.max(Number(query.page) || 1, 1), totalPages)
  return {
    items: sorted.slice((page - 1) * pageSize, page * pageSize).map((p) => toCard(p, ctx)),
    page,
    pageSize,
    totalCount,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
    facets,
    ...(category ? { category } : {}),
  }
}

/** Gợi ý tìm kiếm: từ 2 ký tự, tối đa 5 (FR-06) */
export function publicSuggest(snapshot: CatalogSnapshot, search: string): PublicSuggestion[] {
  if (normalizeVi(search).length < SalesRules.suggestMinChars) return []
  const ctx = contextOf(snapshot)
  return sortProducts(
    ctx.selling.filter((p) => matchesSearch(searchText(p), search)),
    'bestselling'
  )
    .slice(0, SalesRules.suggestLimit)
    .map((p) => {
      const card = toCard(p, ctx)
      return {
        slug: p.slug,
        name: p.name,
        ...(card.coverUrl ? { coverUrl: card.coverUrl } : {}),
        price: p.price,
        ...(p.listPrice ? { listPrice: p.listPrice } : {}),
      }
    })
}

function relatedOf(p: ProductRecord, ctx: Ctx): PublicProductCard[] {
  return sortProducts(
    ctx.selling.filter((x) => x.categoryId === p.categoryId && x.id !== p.id),
    'bestselling'
  )
    .slice(0, SalesRules.relatedSize)
    .map((x) => toCard(x, ctx))
}

/** Chi tiết theo slug (FR-07, BR-23): ẩn → discontinued + related; chưa từng có → 404 KhongTimThaySanPham */
export function publicProductLookup(snapshot: CatalogSnapshot, slug: string): PublicProductLookup {
  const ctx = contextOf(snapshot)
  const p = snapshot.products.find((x) => !x.isDeleted && x.slug === slug)
  if (!p) throw SalesErrors.productNotFound()
  const category = ctx.categories.get(p.categoryId)
  const isSelling = ctx.selling.some((x) => x.id === p.id)
  if (!isSelling) {
    const images = [...p.images].sort((a, b) => a.sortOrder - b.sortOrder)
    return {
      discontinued: {
        name: p.name,
        slug: p.slug,
        categoryName: category?.name ?? '',
        categorySlug: category?.slug ?? '',
        ...(images[0] ? { coverUrl: images[0].url } : {}),
      },
      related: relatedOf(p, ctx),
    }
  }
  const active = activeVariants(p)
  const product: PublicProductDetail = {
    ...toCard(p, ctx),
    ...(p.description ? { description: p.description } : {}),
    ...(p.sizeChart ? { sizeChart: p.sizeChart } : {}),
    images: [...p.images]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .slice(0, SalesRules.maxImages)
      .map((i) => ({
        url: i.url,
        ...(i.colorId && ctx.colors.get(i.colorId) ? { colorCode: ctx.colors.get(i.colorId)!.code } : {}),
        isCover: i.isCover,
      })),
    sizes: p.sizes.filter((s) => active.some((v) => v.size === s)),
    variants: active.map((v) => ({
      id: v.id,
      sku: v.sku,
      colorCode: ctx.colors.get(v.colorId)?.code ?? '',
      ...(v.size ? { size: v.size } : {}),
      stock: v.stock,
      stockStatus: stockStatus(v.stock),
    })),
    related: relatedOf(p, ctx),
  }
  return { product, related: product.related }
}

/** Mọi slug đang bán (sitemap) */
export function sellingSlugs(snapshot: CatalogSnapshot): { slug: string; updatedAt: string }[] {
  return contextOf(snapshot).selling.map((p) => ({ slug: p.slug, updatedAt: p.updatedAt ?? p.createdAt }))
}
