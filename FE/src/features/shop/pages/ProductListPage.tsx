'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Loader2, SlidersHorizontal, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { priceRangeOptions, productSortLabels } from '@/config/shop-labels'
import { routePath } from '@/config/route-path'
import { useIsMobile } from '@/hooks/use-mobile'
import { isApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import type { ProductSort, PublicProductCard, PublicProductListResult, PublicProductQuery } from '@/types/shop'
import { ProductGrid, ProductGridSkeleton } from '../components/ProductCard'
import { ProductFilters } from '../components/ProductFilters'
import { useShopHome, useShopProducts } from '../hooks/use-shop'
import { activeFilterCount, joinCsv, parseProductQuery, productQueryString, splitCsv } from '../lib/product-query'

type Chip = { key: string; label: string; remove: (q: PublicProductQuery) => PublicProductQuery }

function chipsOf(q: PublicProductQuery, data?: PublicProductListResult): Chip[] {
  const chips: Chip[] = []
  for (const code of splitCsv(q.colors)) {
    const name = data?.facets.colors.find((c) => c.code === code)?.name ?? code
    chips.push({ key: `c-${code}`, label: name, remove: (x) => ({ ...x, colors: joinCsv(splitCsv(x.colors).filter((c) => c !== code)) }) })
  }
  for (const size of splitCsv(q.sizes))
    chips.push({ key: `s-${size}`, label: `Size ${size}`, remove: (x) => ({ ...x, sizes: joinCsv(splitCsv(x.sizes).filter((s) => s !== size)) }) })
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    const label = priceRangeOptions.find((r) => r.minPrice === q.minPrice && r.maxPrice === q.maxPrice)?.label ?? 'Khoảng giá'
    chips.push({ key: 'price', label, remove: (x) => ({ ...x, minPrice: undefined, maxPrice: undefined }) })
  }
  if (q.inStock) chips.push({ key: 'stock', label: 'Còn hàng', remove: (x) => ({ ...x, inStock: undefined }) })
  return chips
}

function Pager({ data, go }: { data: PublicProductListResult; go: (page: number) => void }) {
  if (data.totalPages <= 1) return null
  const pages = Array.from({ length: data.totalPages }, (_, i) => i + 1)
  return (
    <nav aria-label="Phân trang" className="mt-10 flex items-center justify-center gap-1">
      <Button variant="outline" size="icon" disabled={!data.hasPreviousPage} onClick={() => go(data.page - 1)} aria-label="Trang trước">
        <ChevronLeft className="size-4" />
      </Button>
      {pages.map((p) => (
        <Button key={p} variant={p === data.page ? 'default' : 'ghost'} size="icon" onClick={() => go(p)} aria-current={p === data.page ? 'page' : undefined}>
          {p}
        </Button>
      ))}
      <Button variant="outline" size="icon" disabled={!data.hasNextPage} onClick={() => go(data.page + 1)} aria-label="Trang sau">
        <ChevronRight className="size-4" />
      </Button>
    </nav>
  )
}

/**
 * Danh sách sản phẩm (SCR-02, UC-01): lọc, sắp xếp, trang ghi trên URL; desktop bộ lọc cột trái + phân trang,
 * điện thoại bộ lọc trong Drawer có "Áp dụng" + tải thêm khi cuộn tới cuối (UC-01 4a).
 */
export function ProductListPage({ initialData }: { initialData?: PublicProductListResult | null }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const query = useMemo(() => parseProductQuery(params), [params])
  const isMobile = useIsMobile()
  // Dữ liệu máy chủ chỉ đúng với bộ lọc lúc tải trang
  const [initialKey] = useState(() => JSON.stringify(query))
  const { data, isFetching, error } = useShopProducts(query, JSON.stringify(query) === initialKey ? initialData : undefined)
  const home = useShopHome()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [draft, setDraft] = useState<PublicProductQuery>(query)

  // Danh mục không có hoặc đang ẩn → về danh sách tất cả (UC-01 E2)
  useEffect(() => {
    if (isApiError(error) && error.problem.code === 'KhongTimThayDanhMuc') {
      toast.info('Danh mục không tồn tại, đang hiện tất cả sản phẩm')
      router.replace(`${routePath.products}${productQueryString({ ...query, category: undefined, page: undefined })}`)
    }
  }, [error, query, router])

  const apply = (next: PublicProductQuery, opts: { scroll?: boolean } = {}) =>
    router.replace(`${pathname}${productQueryString(next)}`, { scroll: opts.scroll ?? false })

  // Điện thoại: cộng dồn các trang đã tải theo cùng bộ lọc
  const filterKey = JSON.stringify({ ...query, page: undefined })
  const [acc, setAcc] = useState<{ key: string; lastPage: number; items: PublicProductCard[] }>({ key: '', lastPage: 0, items: [] })
  useEffect(() => {
    if (!data || isFetching) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cộng dồn trang vừa tải xong
    setAcc((prev) =>
      prev.key === filterKey && data.page === prev.lastPage + 1
        ? { key: filterKey, lastPage: data.page, items: [...prev.items, ...data.items] }
        : prev.key === filterKey && data.page <= prev.lastPage
          ? prev
          : { key: filterKey, lastPage: data.page, items: data.items }
    )
  }, [data, isFetching, filterKey])

  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!isMobile || !data?.hasNextPage || !sentinel.current) return
    const el = sentinel.current
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !isFetching) apply({ ...query, page: data.page + 1 })
    })
    io.observe(el)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, data, isFetching, query])

  const items = isMobile && acc.key === filterKey ? acc.items : (data?.items ?? [])
  const chips = chipsOf(query, data)
  const filterCount = activeFilterCount(query)
  const title = data?.category?.name ?? (query.search ? `Kết quả cho “${query.search}”` : 'Tất cả sản phẩm')

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
      <nav aria-label="Đường dẫn" className="mb-2 text-sm text-muted-foreground">
        <Link href={routePath.shopHome} className="hover:text-primary">
          Trang chủ
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground">{data?.category?.name ?? 'Sản phẩm'}</span>
      </nav>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {data && <p className="text-sm text-muted-foreground">{data.totalCount} sản phẩm</p>}
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Button
            variant="outline"
            className="h-11 flex-1 lg:hidden"
            onClick={() => {
              setDraft(query)
              setDrawerOpen(true)
            }}
          >
            <SlidersHorizontal className="size-4" />
            Bộ lọc{filterCount ? ` (${filterCount})` : ''}
          </Button>
          <Select value={query.sort ?? 'newest'} onValueChange={(v) => apply({ ...query, sort: v as ProductSort, page: undefined })}>
            <SelectTrigger className="h-11 flex-1 sm:w-44" aria-label="Sắp xếp">
              <SelectValue>{productSortLabels[query.sort ?? 'newest']}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(productSortLabels) as ProductSort[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {productSortLabels[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => apply({ ...c.remove(query), page: undefined })}
              className="inline-flex h-9 items-center gap-1 rounded-full border bg-card px-3 text-sm hover:bg-accent"
              aria-label={`Bỏ lọc ${c.label}`}
            >
              {c.label}
              <X className="size-3.5" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => apply({ category: query.category, search: query.search, sort: query.sort })}
            className="h-9 px-2 text-sm font-medium text-primary hover:underline"
          >
            Xóa bộ lọc
          </button>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block" aria-label="Bộ lọc">
          {data && <ProductFilters facets={data.facets} value={query} onChange={(next) => apply(next)} />}
        </aside>
        <section aria-live="polite" className={cn('min-w-0', isFetching && !isMobile && 'opacity-60 transition-opacity')}>
          {!data ? (
            <ProductGridSkeleton />
          ) : items.length === 0 && data.totalCount === 0 ? (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <p className="text-lg font-semibold">Không tìm thấy sản phẩm phù hợp</p>
              <Button variant="outline" onClick={() => apply({ category: query.category })}>
                Xóa bộ lọc
              </Button>
              {home.data && home.data.featured.length > 0 && (
                <div className="mt-6 w-full text-left">
                  <h2 className="mb-4 text-lg font-bold">Có thể bạn thích</h2>
                  <ProductGrid products={home.data.featured.slice(0, 8)} />
                </div>
              )}
            </div>
          ) : (
            <>
              <ProductGrid products={items} priorityCount={4} />
              {isMobile ? (
                <div ref={sentinel} className="flex h-20 items-center justify-center text-sm text-muted-foreground">
                  {data.hasNextPage ? <Loader2 className="size-5 animate-spin" /> : items.length > 8 ? 'Đã hết sản phẩm' : null}
                </div>
              ) : (
                <Pager
                  data={data}
                  go={(page) => {
                    apply({ ...query, page }, { scroll: true })
                  }}
                />
              )}
            </>
          )}
        </section>
      </div>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[90svh]">
          <DrawerHeader className="flex flex-row items-center justify-between">
            <DrawerTitle>Bộ lọc</DrawerTitle>
            <button
              type="button"
              className="h-11 px-2 text-sm font-medium text-primary"
              onClick={() => setDraft({ category: query.category, search: query.search, sort: query.sort })}
            >
              Xóa bộ lọc
            </button>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-4">
            {data && <ProductFilters facets={data.facets} value={draft} onChange={setDraft} />}
          </div>
          <DrawerFooter className="border-t">
            <Button
              size="lg"
              onClick={() => {
                apply({ ...draft, page: undefined }, { scroll: true })
                setDrawerOpen(false)
              }}
            >
              Áp dụng
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
