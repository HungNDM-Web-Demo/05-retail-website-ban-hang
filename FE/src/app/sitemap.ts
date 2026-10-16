import type { MetadataRoute } from 'next'
import { getSitemapDataServer } from '@/features/shop/services/shop.server'
import { getSiteUrl } from '@/features/shop/services/site-url.server'

/** Sitemap (NFR-04, 07 §4.1): trang chủ, /products, từng danh mục, mọi sản phẩm đang bán */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [siteUrl, data] = await Promise.all([getSiteUrl(), getSitemapDataServer()])
  const now = new Date()
  return [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${siteUrl}/products`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    ...data.categories.map((slug) => ({
      url: `${siteUrl}/products?category=${slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...data.products.map((p) => ({
      url: `${siteUrl}/products/${p.slug}`,
      lastModified: new Date(p.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ]
}
