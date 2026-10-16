import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isMockMode } from '@/lib/data-source'
import { ProductDetailPage } from '@/features/shop/pages/ProductDetailPage'
import { getProductServer, getStoreServer } from '@/features/shop/services/shop.server'
import { getSiteUrl } from '@/features/shop/services/site-url.server'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const [lookup, store, siteUrl] = await Promise.all([getProductServer(slug), getStoreServer(), getSiteUrl()])
  const canonical = `${siteUrl}/products/${slug}`
  const product = lookup?.product
  if (!product) {
    const name = lookup?.discontinued?.name ?? 'Sản phẩm'
    return { title: { absolute: `${name} | ${store.name}` }, robots: { index: false }, alternates: { canonical } }
  }
  const description = (product.description ?? product.name).replace(/\s+/g, ' ').slice(0, 160)
  const image = product.coverUrl ? `${siteUrl}${product.coverUrl}` : undefined
  return {
    title: { absolute: `${product.name} | ${store.name}` },
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      title: `${product.name} | ${store.name}`,
      description,
      url: canonical,
      siteName: store.name,
      locale: 'vi_VN',
      ...(image ? { images: [{ url: image, width: 800, height: 1000, alt: product.name }] } : {}),
    },
  }
}

/**
 * Chi tiết sản phẩm (SCR-03): render phía máy chủ cho SEO. Ở chế độ mock, slug không có trong seed không
 * trả 404 phía máy chủ mà để trình duyệt tra mock-db (quyết định 25, TC-21 sản phẩm thêm trong phiên demo).
 */
export default async function ProductDetailRoute({ params }: Props) {
  const { slug } = await params
  const lookup = await getProductServer(slug)
  if (!lookup && !isMockMode()) notFound()
  return <ProductDetailPage slug={slug} initialData={lookup} />
}
