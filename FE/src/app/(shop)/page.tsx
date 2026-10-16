import type { Metadata } from 'next'
import { HomePage } from '@/features/shop/pages/HomePage'
import { getHomeServer, getStoreServer } from '@/features/shop/services/shop.server'
import { getSiteUrl } from '@/features/shop/services/site-url.server'

export async function generateMetadata(): Promise<Metadata> {
  const [store, siteUrl] = await Promise.all([getStoreServer(), getSiteUrl()])
  const description = `${store.tagline ?? ''}. Áo thun, sơ mi, quần jeans, váy đầm cotton, linen. Miễn phí vận chuyển đơn từ 499.000 ₫, COD toàn quốc.`.replace(/^\. /, '')
  return {
    title: { absolute: `${store.name} | ${store.tagline ?? 'Thời trang basic'}` },
    description,
    alternates: { canonical: `${siteUrl}/` },
    openGraph: { type: 'website', siteName: store.name, title: store.name, description, url: `${siteUrl}/`, locale: 'vi_VN' },
  }
}

/** Trang chủ cửa hàng (SCR-01): render phía máy chủ cho SEO, trình duyệt đọc lại dữ liệu (quyết định 25) */
export default async function ShopHomeRoute() {
  const [home, store] = await Promise.all([getHomeServer(), getStoreServer()])
  return <HomePage initialData={home} initialStore={store} />
}
