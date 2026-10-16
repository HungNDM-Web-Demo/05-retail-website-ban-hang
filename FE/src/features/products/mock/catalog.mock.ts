import { permissions } from '@/config/permissions'
import type { UploadedImage } from '@/features/settings/types/setting.types'
import { mockDelay } from '@/lib/data-source'
import { matchesSearch } from '@/lib/normalize'
import { mockBlobs, readImageSize } from '@/mock/mock-blobs'
import { auditCreate, auditDelete, auditUpdate } from '@/mock/mock-audit'
import { requirePermission } from '@/mock/mock-auth'
import { mockDb } from '@/mock/mock-db'
import { newId, paginate, sortItems } from '@/mock/mock-helpers'
import { fieldConflict, fieldErrors, SalesErrors } from '@/features/sales/lib/sales-errors'
import { productStockStatus, skuOf, slugify, stockStatus, uniqueSlug } from '@/features/sales/lib/stock'
import {
  adjustStock,
  categoriesDb,
  colorsDb,
  liveCategories,
  liveColors,
  liveProducts,
  productsDb,
  stockAdjustmentsDb,
} from '@/features/sales/mock/catalog.store'
import { allOrders } from '@/features/sales/mock/order.store'
import { publishShopEvent } from '@/features/sales/mock/shop-events'
import type { PaginatedResult } from '@/types/api'
import type {
  CategoryDto,
  CategoryRecord,
  ColorDto,
  ColorRecord,
  HiddenRequest,
  ProductDto,
  ProductImageDto,
  ProductListItem,
  ProductQuery,
  ProductRecord,
  ProductVariantDto,
  ReorderRequest,
  SaveCategoryRequest,
  SaveColorRequest,
  SaveProductRequest,
  StockAdjustmentDto,
  StockAdjustmentRequest,
  VariantRecord,
  VisibilityRequest,
} from '@/types/shop'

/**
 * Handler mock danh mục, màu, sản phẩm, ảnh, tồn (07 §2.3, §2.4). Collection do lõi `features/sales`
 * khai báo; ở đây chỉ đọc ghi qua các collection đó.
 */

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_BYTES = 2 * 1024 * 1024

const nowIso = () => new Date().toISOString()

/** Biến thể đã có trong đơn (không xóa được, chỉ tắt — BR-23) */
function orderedVariantIds(): Set<string> {
  const set = new Set<string>()
  for (const o of allOrders()) for (const l of o.lines) set.add(l.variantId)
  return set
}

// ───────────────────────── Chiếu DTO ─────────────────────────

function toCategoryDto(c: CategoryRecord, products: ProductRecord[]): CategoryDto {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- bỏ trường không có trong DTO
  const { createdAt: _c, updatedAt: _u, isDeleted: _d, ...rest } = c
  return { ...rest, productCount: products.filter((p) => p.categoryId === c.id).length }
}

const toColorDto = ({ id, code, name, hex, sortOrder }: ColorRecord): ColorDto => ({ id, code, name, hex, sortOrder })

function coverOf(p: ProductRecord): string | undefined {
  return (p.images.find((i) => i.isCover) ?? p.images[0])?.url
}

function toListItem(p: ProductRecord, categories: Map<string, CategoryRecord>): ProductListItem {
  const active = p.variants.filter((v) => v.isActive)
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    slug: p.slug,
    categoryId: p.categoryId,
    categoryName: categories.get(p.categoryId)?.name ?? '—',
    price: p.price,
    ...(p.listPrice ? { listPrice: p.listPrice } : {}),
    coverUrl: coverOf(p),
    status: p.isHidden ? 'An' : 'DangBan',
    isFeatured: p.isFeatured,
    totalStock: active.reduce((s, v) => s + v.stock, 0),
    variantCount: p.variants.length,
    outOfStockCount: active.filter((v) => v.stock <= 0).length,
    lowStockCount: active.filter((v) => v.stock > 0 && v.stock <= 5).length,
    stockStatus: productStockStatus(p.variants),
    soldCount: p.soldCount,
    createdAt: p.createdAt,
  }
}

function toProductDto(p: ProductRecord, ordered = orderedVariantIds()): ProductDto {
  const categories = new Map(categoriesDb.all().map((c) => [c.id, c]))
  const colors = new Map(colorsDb.all().map((c) => [c.id, c]))
  const colorOrder = (id: string) => p.colorIds.indexOf(id)
  const sizeOrder = (s?: string) => (s ? p.sizes.indexOf(s) : 0)
  const variants: ProductVariantDto[] = [...p.variants]
    .sort((a, b) => colorOrder(a.colorId) - colorOrder(b.colorId) || sizeOrder(a.size) - sizeOrder(b.size))
    .map((v) => {
      const c = colors.get(v.colorId)
      return {
        id: v.id,
        sku: v.sku,
        colorId: v.colorId,
        colorCode: c?.code ?? '',
        colorName: c?.name ?? '',
        colorHex: c?.hex ?? '#999999',
        ...(v.size ? { size: v.size } : {}),
        stock: v.stock,
        isActive: v.isActive,
        stockStatus: stockStatus(v.stock),
        everOrdered: ordered.has(v.id),
      }
    })
  return {
    ...toListItem(p, categories),
    description: p.description,
    sizeChart: p.sizeChart,
    colorIds: p.colorIds,
    sizes: p.sizes,
    images: [...p.images].sort((a, b) => a.sortOrder - b.sortOrder),
    variants,
    everOrdered: variants.some((v) => v.everOrdered),
    updatedAt: p.updatedAt,
  }
}

function getLiveProduct(id: string): ProductRecord {
  const p = productsDb.get(id)
  if (!p || p.isDeleted) throw SalesErrors.productNotFound()
  return p
}

// ───────────────────────── Kiểm tra, dựng sản phẩm (07 §2.4, §3.12) ─────────────────────────

function buildProduct(input: SaveProductRequest, existing?: ProductRecord): ProductRecord {
  const errors: Record<string, string> = {}
  const code = (input.code ?? '').trim().toUpperCase()
  const name = (input.name ?? '').trim()
  if (!/^[A-Z]{2}\d{3}$/.test(code)) errors.code = 'Mã sản phẩm gồm 2 chữ in hoa và 3 số'
  if (name.length < 2 || name.length > 200) errors.name = 'Tên từ 2 đến 200 ký tự'
  if (!categoriesDb.get(input.categoryId) || categoriesDb.get(input.categoryId)?.isDeleted) errors.categoryId = 'Chọn danh mục'
  if (!Number.isInteger(input.price) || input.price <= 0 || input.price % 1000 !== 0) errors.price = 'Giá bán là bội số của 1.000 ₫'
  if (input.listPrice !== undefined && input.listPrice !== null) {
    if (input.listPrice % 1000 !== 0 || input.listPrice <= input.price) errors.listPrice = 'Giá gốc phải lớn hơn giá bán'
  }
  if ((input.images ?? []).length > 8) errors.images = 'Tối đa 8 ảnh'
  if (!input.colorIds?.length) errors.colorIds = 'Chọn ít nhất một màu'
  const colors = new Map(liveColors().map((c) => [c.id, c]))
  if (input.colorIds?.some((id) => !colors.has(id))) errors.colorIds = 'Màu không tồn tại'

  // Lưới đúng colorIds × sizes
  const sizes = input.sizes ?? []
  const cells = sizes.length ? sizes : [undefined]
  const expected = new Set((input.colorIds ?? []).flatMap((c) => cells.map((s) => `${c}|${s ?? ''}`)))
  const given = new Set((input.variants ?? []).map((v) => `${v.colorId}|${v.size ?? ''}`))
  if (expected.size !== given.size || [...expected].some((k) => !given.has(k)))
    errors.variants = 'Lưới biến thể không khớp màu và size'
  input.variants?.forEach((v, i) => {
    if (v.initialStock !== undefined && v.initialStock !== null && (!Number.isInteger(v.initialStock) || v.initialStock < 0))
      errors[`variants[${i}].initialStock`] = 'Tồn mới là số nguyên từ 0'
  })
  if (Object.keys(errors).length) throw fieldErrors(errors)
  if (!input.variants.some((v) => v.isActive)) throw SalesErrors.needOneVariant()

  const others = liveProducts().filter((p) => p.id !== existing?.id)
  if (others.some((p) => p.code === code)) throw fieldConflict({ code: 'Mã sản phẩm đã tồn tại' })
  const ordered = orderedVariantIds()
  const productOrdered = !!existing?.variants.some((v) => ordered.has(v.id))
  if (existing && existing.code !== code && productOrdered)
    throw fieldErrors({ code: 'Sản phẩm đã có trong đơn, không đổi mã được' })

  let slug = (input.slug ?? '').trim()
  if (slug) {
    slug = slugify(slug)
    if (others.some((p) => p.slug === slug)) throw fieldConflict({ slug: 'Đường dẫn đã được dùng' })
  } else {
    slug = existing && existing.name === name ? existing.slug : uniqueSlug(slugify(name), (s) => others.some((p) => p.slug === s))
  }

  // Biến thể: giữ id, sku, tồn của ô cũ; ô mới sinh SKU; ô cũ bị bỏ thì xóa cứng nếu chưa bán
  const old = new Map((existing?.variants ?? []).map((v) => [`${v.colorId}|${v.size ?? ''}`, v]))
  const variants: VariantRecord[] = input.variants.map((v) => {
    const prev = old.get(`${v.colorId}|${v.size ?? ''}`)
    const sku = prev && existing!.code === code ? prev.sku : skuOf(code, colors.get(v.colorId)!.code, v.size)
    return prev
      ? { ...prev, sku, isActive: v.isActive }
      : { id: newId(), sku, colorId: v.colorId, ...(v.size ? { size: v.size } : {}), stock: v.initialStock ?? 0, isActive: v.isActive }
  })
  const removed = [...old.values()].filter((v) => !variants.some((n) => n.id === v.id))
  const removedOrdered = removed.filter((v) => ordered.has(v.id))
  if (removedOrdered.length) throw SalesErrors.variantOrdered(removedOrdered.map((v) => v.sku))
  const otherSkus = new Set(others.flatMap((p) => p.variants.map((v) => v.sku)))
  const dup = variants.find((v) => otherSkus.has(v.sku))
  if (dup) throw fieldConflict({ variants: `SKU ${dup.sku} đã tồn tại` })

  const colorOrder = (id: string) => input.colorIds.indexOf(id)
  const images: ProductImageDto[] = (input.images ?? []).map((img, i) => ({
    id: existing?.images.find((x) => x.url === img.url)?.id ?? newId(),
    url: img.url,
    ...(img.colorId && input.colorIds.includes(img.colorId) ? { colorId: img.colorId } : {}),
    sortOrder: i,
    isCover: img.isCover,
  }))
  if (images.length && !images.some((i) => i.isCover)) images[0].isCover = true

  const at = nowIso()
  return {
    id: existing?.id ?? newId(),
    code,
    name,
    slug,
    categoryId: input.categoryId,
    price: input.price,
    ...(input.listPrice ? { listPrice: input.listPrice } : {}),
    description: input.description?.trim() || undefined,
    sizeChart: input.sizeChart,
    isFeatured: !!input.isFeatured,
    isHidden: !!input.isHidden,
    colorIds: [...input.colorIds].sort((a, b) => colorOrder(a) - colorOrder(b)),
    sizes,
    images,
    variants,
    soldCount: existing?.soldCount ?? 0,
    sortOrder: existing?.sortOrder ?? Math.max(0, ...productsDb.all().map((p) => p.sortOrder)) + 10,
    createdAt: existing?.createdAt ?? at,
    ...(existing ? { updatedAt: at } : {}),
  }
}

// ───────────────────────── Handler ─────────────────────────

export const catalogMock = {
  async categories(): Promise<CategoryDto[]> {
    await mockDelay(100, 200)
    requirePermission(permissions.products.view)
    const products = liveProducts()
    return liveCategories().map((c) => toCategoryDto(c, products))
  },

  async createCategory(body: SaveCategoryRequest): Promise<CategoryDto> {
    await mockDelay()
    requirePermission(permissions.products.create)
    const record = saveCategory(body)
    const created = categoriesDb.insert({
      ...record,
      id: newId(),
      sortOrder: Math.max(0, ...categoriesDb.all().map((c) => c.sortOrder)) + 10,
      createdAt: nowIso(),
    })
    auditCreate('Category', created)
    publishShopEvent('catalog-changed', { productIds: [] })
    return toCategoryDto(created, liveProducts())
  },

  async updateCategory(id: string, body: SaveCategoryRequest): Promise<CategoryDto> {
    await mockDelay()
    requirePermission(permissions.products.update)
    const before = categoriesDb.get(id)
    if (!before || before.isDeleted) throw SalesErrors.categoryNotFound()
    const after = categoriesDb.update(id, { ...saveCategory(body, id), updatedAt: nowIso() })!
    auditUpdate('Category', before, after)
    publishShopEvent('catalog-changed', { productIds: [] })
    return toCategoryDto(after, liveProducts())
  },

  async categoryVisibility(id: string, body: VisibilityRequest): Promise<void> {
    await mockDelay(100, 200)
    requirePermission(permissions.products.update)
    const before = categoriesDb.get(id)
    if (!before || before.isDeleted) throw SalesErrors.categoryNotFound()
    const after = categoriesDb.update(id, { isVisible: body.isVisible, updatedAt: nowIso() })!
    auditUpdate('Category', before, after)
    publishShopEvent('catalog-changed', { productIds: [] })
  },

  async reorderCategories(body: ReorderRequest): Promise<void> {
    await mockDelay(100, 200)
    requirePermission(permissions.products.update)
    const live = liveCategories()
    if (body.ids.length !== live.length || live.some((c) => !body.ids.includes(c.id)))
      throw fieldErrors({ ids: 'Danh sách danh mục không đầy đủ' })
    mockDb.batch(() => body.ids.forEach((id, i) => categoriesDb.update(id, { sortOrder: (i + 1) * 10 })))
    publishShopEvent('catalog-changed', { productIds: [] })
  },

  async deleteCategory(id: string): Promise<void> {
    await mockDelay()
    requirePermission(permissions.products.delete)
    const c = categoriesDb.get(id)
    if (!c || c.isDeleted) throw SalesErrors.categoryNotFound()
    const count = liveProducts().filter((p) => p.categoryId === id).length
    if (count) throw SalesErrors.categoryHasProducts(count)
    categoriesDb.update(id, { isDeleted: true, updatedAt: nowIso() })
    auditDelete('Category', c)
    publishShopEvent('catalog-changed', { productIds: [] })
  },

  async colors(): Promise<ColorDto[]> {
    await mockDelay(100, 200)
    requirePermission(permissions.products.view)
    return liveColors().map(toColorDto)
  },

  async createColor(body: SaveColorRequest): Promise<ColorDto> {
    await mockDelay()
    requirePermission(permissions.products.create)
    const { code, name, hex } = checkColor(body)
    const live = liveColors()
    if (live.some((c) => c.code === code)) throw fieldConflict({ code: 'Mã màu đã tồn tại' })
    if (live.some((c) => c.name.toLowerCase() === name.toLowerCase())) throw fieldConflict({ name: 'Tên màu đã tồn tại' })
    const created = colorsDb.insert({
      id: newId(),
      code,
      name,
      hex,
      sortOrder: Math.max(0, ...colorsDb.all().map((c) => c.sortOrder)) + 10,
      createdAt: nowIso(),
    })
    auditCreate('Color', created)
    return toColorDto(created)
  },

  async updateColor(id: string, body: SaveColorRequest): Promise<ColorDto> {
    await mockDelay()
    requirePermission(permissions.products.update)
    const before = colorsDb.get(id)
    if (!before || before.isDeleted) throw fieldErrors({ id: 'Không tìm thấy màu' })
    const { name, hex } = checkColor({ ...body, code: before.code })
    if (liveColors().some((c) => c.id !== id && c.name.toLowerCase() === name.toLowerCase()))
      throw fieldConflict({ name: 'Tên màu đã tồn tại' })
    const after = colorsDb.update(id, { name, hex, updatedAt: nowIso() })!
    auditUpdate('Color', before, after)
    publishShopEvent('catalog-changed', { productIds: [] })
    return toColorDto(after)
  },

  async products(query: ProductQuery): Promise<PaginatedResult<ProductListItem>> {
    await mockDelay()
    requirePermission(permissions.products.view)
    const categories = new Map(categoriesDb.all().map((c) => [c.id, c]))
    const records = liveProducts().filter(
      (p) =>
        (!query.categoryId || p.categoryId === query.categoryId) &&
        (!query.search || matchesSearch(`${p.name} ${p.code} ${p.variants.map((v) => v.sku).join(' ')}`, query.search))
    )
    let items = records.map((p) => ({ item: toListItem(p, categories), sortOrder: p.sortOrder }))
    if (query.status) items = items.filter((x) => x.item.status === query.status)
    if (query.stockStatus) items = items.filter((x) => x.item.stockStatus === query.stockStatus)
    const sorted = query.sortBy
      ? sortItems(items.map((x) => x.item), query.sortBy, query.sortDir ?? 'asc')
      : items.sort((a, b) => a.sortOrder - b.sortOrder).map((x) => x.item)
    return paginate(sorted, query)
  },

  async product(id: string): Promise<ProductDto> {
    await mockDelay()
    requirePermission(permissions.products.view)
    return toProductDto(getLiveProduct(id))
  },

  async createProduct(body: SaveProductRequest): Promise<ProductDto> {
    await mockDelay(300, 500)
    requirePermission(permissions.products.create)
    const record = productsDb.insert(buildProduct(body))
    auditCreate('Product', record)
    publishShopEvent('catalog-changed', { productIds: [record.id] })
    return toProductDto(record)
  },

  async updateProduct(id: string, body: SaveProductRequest): Promise<ProductDto> {
    await mockDelay(300, 500)
    requirePermission(permissions.products.update)
    const before = getLiveProduct(id)
    const next = buildProduct(body, before)
    const after = productsDb.update(id, () => next)!
    auditUpdate('Product', before, after)
    publishShopEvent('catalog-changed', { productIds: [id] })
    return toProductDto(after)
  },

  async setHidden(id: string, body: HiddenRequest): Promise<void> {
    await mockDelay(100, 200)
    requirePermission(permissions.products.update)
    const before = getLiveProduct(id)
    const after = productsDb.update(id, { isHidden: body.isHidden, updatedAt: nowIso() })!
    auditUpdate('Product', before, after)
    publishShopEvent('catalog-changed', { productIds: [id] })
  },

  async deleteProduct(id: string): Promise<void> {
    await mockDelay()
    requirePermission(permissions.products.delete)
    const p = getLiveProduct(id)
    const ordered = orderedVariantIds()
    if (p.variants.some((v) => ordered.has(v.id))) throw SalesErrors.productOrdered()
    productsDb.update(id, { isDeleted: true, updatedAt: nowIso() })
    auditDelete('Product', p)
    publishShopEvent('catalog-changed', { productIds: [id] })
  },

  /** POST /api/products/images: JPG/PNG/WebP ≤ 2 MB, lưu IndexedDB */
  async uploadImage(file: File): Promise<UploadedImage> {
    await mockDelay(300, 600)
    requirePermission(permissions.products.create, permissions.products.update)
    if (!IMAGE_TYPES.includes(file.type)) throw fieldErrors({ file: 'Chỉ nhận ảnh JPG, PNG hoặc WebP' })
    if (file.size > MAX_IMAGE_BYTES) throw fieldErrors({ file: 'Ảnh tối đa 2 MB' })
    const [stored, size] = await Promise.all([mockBlobs.put(file, file.name), readImageSize(file)])
    return { url: stored.url, width: size.width, height: size.height, sizeBytes: file.size }
  },

  async adjustStock(id: string, variantId: string, body: StockAdjustmentRequest): Promise<ProductVariantDto> {
    await mockDelay()
    const { user } = requirePermission(permissions.products.adjustStock)
    getLiveProduct(id)
    adjustStock({
      productId: id,
      variantId,
      newStock: body.newStock,
      reason: body.reason,
      note: body.note,
      actor: { type: 'NhanVien', id: user.id, name: user.fullName },
    })
    return toProductDto(getLiveProduct(id)).variants.find((v) => v.id === variantId)!
  },

  async stockAdjustments(id: string): Promise<StockAdjustmentDto[]> {
    await mockDelay(100, 200)
    requirePermission(permissions.products.view)
    const p = getLiveProduct(id)
    const colors = new Map(colorsDb.all().map((c) => [c.id, c]))
    return stockAdjustmentsDb
      .filter((a) => a.productId === id)
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((a) => {
        const v = p.variants.find((x) => x.id === a.variantId)
        return {
          id: a.id,
          variantId: a.variantId,
          sku: v?.sku ?? '—',
          productName: p.name,
          colorName: v ? (colors.get(v.colorId)?.name ?? '') : '',
          ...(v?.size ? { size: v.size } : {}),
          before: a.before,
          after: a.after,
          reason: a.reason,
          ...(a.note ? { note: a.note } : {}),
          byName: a.byName,
          at: a.at,
        }
      })
  },
}

function saveCategory(body: SaveCategoryRequest, id?: string): Omit<CategoryRecord, 'id' | 'sortOrder' | 'createdAt'> {
  const code = (body.code ?? '').trim().toUpperCase()
  const name = (body.name ?? '').trim()
  const errors: Record<string, string> = {}
  if (!/^[A-Z]{2}$/.test(code)) errors.code = 'Mã danh mục gồm 2 chữ in hoa'
  if (name.length < 2 || name.length > 100) errors.name = 'Tên từ 2 đến 100 ký tự'
  if (!/^#[0-9A-Fa-f]{6}$/.test(body.color ?? '')) errors.color = 'Màu dạng #RRGGBB'
  if (Object.keys(errors).length) throw fieldErrors(errors)
  const others = liveCategories().filter((c) => c.id !== id)
  if (others.some((c) => c.code === code)) throw fieldConflict({ code: 'Mã danh mục đã tồn tại' })
  const slug = body.slug?.trim() ? slugify(body.slug) : uniqueSlug(slugify(name), (s) => others.some((c) => c.slug === s))
  if (others.some((c) => c.slug === slug)) throw fieldConflict({ slug: 'Đường dẫn đã được dùng' })
  return { code, name, slug, ...(body.imageUrl ? { imageUrl: body.imageUrl } : {}), color: body.color, isVisible: body.isVisible }
}

function checkColor(body: SaveColorRequest) {
  const code = (body.code ?? '').trim().toUpperCase()
  const name = (body.name ?? '').trim()
  const errors: Record<string, string> = {}
  if (!/^[A-Z]{2}$/.test(code)) errors.code = 'Mã màu gồm 2 chữ in hoa'
  if (name.length < 2 || name.length > 50) errors.name = 'Tên màu từ 2 đến 50 ký tự'
  if (!/^#[0-9A-Fa-f]{6}$/.test(body.hex ?? '')) errors.hex = 'Mã màu dạng #RRGGBB'
  if (Object.keys(errors).length) throw fieldErrors(errors)
  return { code, name, hex: body.hex.toUpperCase() }
}
