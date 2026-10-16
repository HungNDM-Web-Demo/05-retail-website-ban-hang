'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CartLineInput,
  CheckoutQuoteRequest,
  OrderLookupRequest,
  PlaceOrderRequest,
  PublicCancelRequest,
  PublicHome,
  PublicProductListResult,
  PublicProductLookup,
  PublicProductQuery,
  PublicStoreInfo,
} from '@/types/shop'
import { shopService } from '../services/public-api'

/** Query key cửa hàng (07 §4.9) — FE-Quản trị dùng đúng key để làm mới chéo */
export const shopKeys = {
  store: ['public', 'store'] as const,
  home: ['public', 'home'] as const,
  categories: ['public', 'categories'] as const,
  products: (query: PublicProductQuery) => ['public', 'products', query] as const,
  product: (slug: string) => ['public', 'product', slug] as const,
  suggest: (search: string) => ['public', 'suggest', search] as const,
  cartCheck: (lines: CartLineInput[]) => ['public', 'cart-check', lines] as const,
  order: (code: string) => ['public', 'order', code] as const,
}

export function useStoreInfo(initialData?: PublicStoreInfo) {
  return useQuery({ queryKey: shopKeys.store, queryFn: shopService.store, staleTime: 5 * 60_000, initialData, initialDataUpdatedAt: 0 })
}

export function useShopHome(initialData?: PublicHome) {
  return useQuery({ queryKey: shopKeys.home, queryFn: shopService.home, initialData, initialDataUpdatedAt: 0 })
}

export function useShopCategories() {
  return useQuery({ queryKey: shopKeys.categories, queryFn: shopService.categories, staleTime: 5 * 60_000 })
}

export function useShopProducts(query: PublicProductQuery, initialData?: PublicProductListResult | null) {
  return useQuery({
    queryKey: shopKeys.products(query),
    queryFn: () => shopService.products(query),
    placeholderData: keepPreviousData,
    initialData: initialData ?? undefined,
    initialDataUpdatedAt: 0,
  })
}

export function useShopProduct(slug: string, initialData?: PublicProductLookup | null) {
  return useQuery({
    queryKey: shopKeys.product(slug),
    queryFn: () => shopService.product(slug),
    initialData: initialData ?? undefined,
    initialDataUpdatedAt: 0,
  })
}

export function useSuggest(search: string) {
  const trimmed = search.trim()
  return useQuery({
    queryKey: shopKeys.suggest(trimmed),
    queryFn: () => shopService.suggest(trimmed),
    enabled: trimmed.length >= 2,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })
}

/** Kiểm lại giỏ khi mở giỏ (BR-04) */
export function useCartCheck(lines: CartLineInput[], enabled = true) {
  return useQuery({
    queryKey: shopKeys.cartCheck(lines),
    queryFn: () => shopService.cartCheck({ lines }),
    enabled: enabled && lines.length > 0,
    staleTime: 0,
    placeholderData: keepPreviousData,
  })
}

export function useCheckoutQuote() {
  return useMutation({ mutationFn: (req: CheckoutQuoteRequest) => shopService.quote(req) })
}

export function usePlaceOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (req: PlaceOrderRequest) => shopService.placeOrder(req),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['public'] })
    },
  })
}

export function useLookupOrder() {
  return useMutation({ mutationFn: (req: OrderLookupRequest) => shopService.lookup(req) })
}

/** Đơn đang xem ở trang tra cứu: tự làm mới khi mock-db đổi (07 §4.2 bước 4) */
export function useTrackedOrder(req: OrderLookupRequest | null) {
  return useQuery({
    queryKey: shopKeys.order(req?.code ?? ''),
    queryFn: () => shopService.refreshOrder(req!),
    enabled: !!req,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
}

export function useCancelOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ code, req }: { code: string; req: PublicCancelRequest }) => shopService.cancel(code, req),
    onSuccess: (view) => {
      qc.setQueryData(shopKeys.order(view.code), view)
      void qc.invalidateQueries({ queryKey: ['public'] })
    },
  })
}

export function useSimulateOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: shopService.simulateOrder,
    onSuccess: () => void qc.invalidateQueries(),
  })
}
