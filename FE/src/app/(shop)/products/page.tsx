import { Suspense } from 'react'
import type { Metadata } from 'next'
import { ProductGridSkeleton } from '@/features/shop/components/ProductCard'
import { ProductListPage } from '@/features/shop/pages/ProductListPage'
import { parseProductQuery } from '@/features/shop/lib/product-query'
import { getCategoriesServer, getProductsServer, getStoreServer } from '@/features/shop/services/shop.server'
import { getSiteUrl } from '@/features/shop/services/site-url.server'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const query = parseProductQuery(await searchParams)
  const [store, categories, siteUrl] = await Promise.all([getStoreServer(), getCategoriesServer(), getSiteUrl()])
  const category = categories.find((c) => c.slug === query.category)
  const name = category?.name ?? (query.search ? `Tìm “${query.search}”` : 'Tất cả sản phẩm')
  const canonical = category ? `${siteUrl}/products?category=${category.slug}` : `${siteUrl}/products`
  return {
    title: { absolute: `${name} | ${store.name}` },
    description: `${name} tại ${store.name}: cotton, linen mặc mỗi ngày, đủ màu và size. Miễn phí vận chuyển đơn từ 499.000 ₫.`,
    alternates: { canonical },
    robots: query.search ? { index: false, follow: true } : undefined,
    openGraph: { title: `${name} | ${store.name}`, url: canonical, siteName: store.name, locale: 'vi_VN', type: 'website' },
  }
}

/** Danh sách sản phẩm (SCR-02): render phía máy chủ cho SEO (NFR-04) */
export default async function ProductsRoute({ searchParams }: Props) {
  const query = parseProductQuery(await searchParams)
  const initial = await getProductsServer(query)
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-5"><ProductGridSkeleton /></div>}>
      <ProductListPage initialData={initial} />
    </Suspense>
  )
}
