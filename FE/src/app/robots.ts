import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/features/shop/services/site-url.server'

/** Cho máy tìm kiếm đọc cửa hàng; chặn quản trị, đăng nhập, giỏ, thanh toán, tra cứu (07 §4.1) */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const siteUrl = await getSiteUrl()
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/dashboard', '/login', '/settings/', '/profile', '/forbidden', '/cart', '/checkout', '/tra-cuu-don'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
