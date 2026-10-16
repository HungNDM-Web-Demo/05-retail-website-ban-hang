'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type {
  HiddenRequest,
  ProductQuery,
  SaveCategoryRequest,
  SaveColorRequest,
  SaveProductRequest,
  StockAdjustmentRequest,
} from '@/types/shop'
import { categoryService, colorService, productService } from '../services/product.service'

/** Query key dùng chung (07 §4.9) */
export const productKeys = {
  categories: ['categories'] as const,
  colors: ['colors'] as const,
  list: (q: ProductQuery) => ['products', q] as const,
  detail: (id: string) => ['product', id] as const,
  stock: (id: string) => ['stock-adjustments', id] as const,
}

/** Đổi danh mục/sản phẩm/tồn: làm mới quản trị và cửa hàng công khai (tab khác tự làm mới qua mock-db) */
export function invalidateCatalog(qc: QueryClient) {
  for (const key of ['categories', 'colors', 'products', 'product', 'stock-adjustments', 'public', 'dashboard']) {
    void qc.invalidateQueries({ queryKey: [key] })
  }
}

export const useCategories = () => useQuery({ queryKey: productKeys.categories, queryFn: categoryService.list })
export const useColors = () => useQuery({ queryKey: productKeys.colors, queryFn: colorService.list })

export const useProducts = (query: ProductQuery, enabled = true) =>
  useQuery({
    queryKey: productKeys.list(query),
    queryFn: () => productService.list(query),
    placeholderData: keepPreviousData,
    enabled,
  })

export const useProduct = (id: string | undefined) =>
  useQuery({ queryKey: productKeys.detail(id ?? ''), queryFn: () => productService.detail(id!), enabled: !!id })

export const useStockAdjustments = (id: string, enabled = true) =>
  useQuery({ queryKey: productKeys.stock(id), queryFn: () => productService.stockAdjustments(id), enabled })

function useCatalogMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => invalidateCatalog(qc) })
}

export const useSaveCategory = () =>
  useCatalogMutation(({ id, body }: { id?: string; body: SaveCategoryRequest }) =>
    id ? categoryService.update(id, body) : categoryService.create(body)
  )
export const useCategoryVisibility = () =>
  useCatalogMutation(({ id, isVisible }: { id: string; isVisible: boolean }) => categoryService.setVisibility(id, isVisible))
export const useReorderCategories = () => useCatalogMutation((ids: string[]) => categoryService.reorder(ids))
export const useDeleteCategory = () => useCatalogMutation((id: string) => categoryService.remove(id))

export const useSaveColor = () =>
  useCatalogMutation(({ id, body }: { id?: string; body: SaveColorRequest }) =>
    id ? colorService.update(id, body) : colorService.create(body)
  )

export const useSaveProduct = () =>
  useCatalogMutation(({ id, body }: { id?: string; body: SaveProductRequest }) =>
    id ? productService.update(id, body) : productService.create(body)
  )
export const useSetProductHidden = () =>
  useCatalogMutation(({ id, body }: { id: string; body: HiddenRequest }) => productService.setHidden(id, body))
export const useDeleteProduct = () => useCatalogMutation((id: string) => productService.remove(id))
export const useAdjustStock = () =>
  useCatalogMutation(({ id, variantId, body }: { id: string; variantId: string; body: StockAdjustmentRequest }) =>
    productService.adjustStock(id, variantId, body)
  )
export const useUploadProductImage = () => useMutation({ mutationFn: (file: File) => productService.uploadImage(file) })
