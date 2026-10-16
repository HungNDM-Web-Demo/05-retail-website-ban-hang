import { apiRoutes } from '@/config/api-routes'
import type { UploadedImage } from '@/features/settings/types/setting.types'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { PaginatedResult } from '@/types/api'
import type {
  CategoryDto,
  ColorDto,
  HiddenRequest,
  ProductDto,
  ProductListItem,
  ProductQuery,
  ProductVariantDto,
  SaveCategoryRequest,
  SaveColorRequest,
  SaveProductRequest,
  StockAdjustmentDto,
  StockAdjustmentRequest,
} from '@/types/shop'
import { catalogMock } from '../mock/catalog.mock'

/** Danh mục, màu (07 §2.3) */
export const categoryService = {
  list: (): Promise<CategoryDto[]> =>
    isMockMode() ? catalogMock.categories() : apiCall.get(apiRoutes.categories.list),
  create: (body: SaveCategoryRequest): Promise<CategoryDto> =>
    isMockMode() ? catalogMock.createCategory(body) : apiCall.post(apiRoutes.categories.list, body),
  update: (id: string, body: SaveCategoryRequest): Promise<CategoryDto> =>
    isMockMode() ? catalogMock.updateCategory(id, body) : apiCall.put(apiRoutes.categories.detail(id), body),
  setVisibility: (id: string, isVisible: boolean): Promise<void> =>
    isMockMode()
      ? catalogMock.categoryVisibility(id, { isVisible })
      : apiCall.patch(apiRoutes.categories.visibility(id), { isVisible }),
  reorder: (ids: string[]): Promise<void> =>
    isMockMode() ? catalogMock.reorderCategories({ ids }) : apiCall.put(apiRoutes.categories.order, { ids }),
  remove: (id: string): Promise<void> =>
    isMockMode() ? catalogMock.deleteCategory(id) : apiCall.delete(apiRoutes.categories.detail(id)),
}

export const colorService = {
  list: (): Promise<ColorDto[]> => (isMockMode() ? catalogMock.colors() : apiCall.get(apiRoutes.colors.list)),
  create: (body: SaveColorRequest): Promise<ColorDto> =>
    isMockMode() ? catalogMock.createColor(body) : apiCall.post(apiRoutes.colors.list, body),
  update: (id: string, body: SaveColorRequest): Promise<ColorDto> =>
    isMockMode() ? catalogMock.updateColor(id, body) : apiCall.put(apiRoutes.colors.detail(id), body),
}

/** Sản phẩm, biến thể, tồn kho (07 §2.4) */
export const productService = {
  list: (query: ProductQuery): Promise<PaginatedResult<ProductListItem>> =>
    isMockMode() ? catalogMock.products(query) : apiCall.get(apiRoutes.products.list, { params: query }),
  detail: (id: string): Promise<ProductDto> =>
    isMockMode() ? catalogMock.product(id) : apiCall.get(apiRoutes.products.detail(id)),
  create: (body: SaveProductRequest): Promise<ProductDto> =>
    isMockMode() ? catalogMock.createProduct(body) : apiCall.post(apiRoutes.products.list, body),
  update: (id: string, body: SaveProductRequest): Promise<ProductDto> =>
    isMockMode() ? catalogMock.updateProduct(id, body) : apiCall.put(apiRoutes.products.detail(id), body),
  setHidden: (id: string, body: HiddenRequest): Promise<void> =>
    isMockMode() ? catalogMock.setHidden(id, body) : apiCall.patch(apiRoutes.products.hidden(id), body),
  remove: (id: string): Promise<void> =>
    isMockMode() ? catalogMock.deleteProduct(id) : apiCall.delete(apiRoutes.products.detail(id)),
  uploadImage: (file: File): Promise<UploadedImage> => {
    if (isMockMode()) return catalogMock.uploadImage(file)
    const form = new FormData()
    form.append('file', file)
    return apiCall.post<UploadedImage>(apiRoutes.products.images, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  adjustStock: (id: string, variantId: string, body: StockAdjustmentRequest): Promise<ProductVariantDto> =>
    isMockMode()
      ? catalogMock.adjustStock(id, variantId, body)
      : apiCall.post(apiRoutes.products.adjustStock(id, variantId), body),
  stockAdjustments: (id: string): Promise<StockAdjustmentDto[]> =>
    isMockMode() ? catalogMock.stockAdjustments(id) : apiCall.get(apiRoutes.products.stockAdjustments(id)),
}
