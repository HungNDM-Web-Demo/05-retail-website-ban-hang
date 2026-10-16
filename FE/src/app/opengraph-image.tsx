import { renderOgImage, OG_SIZE } from '@/features/shop/services/og-image.server'
import { getStoreServer } from '@/features/shop/services/shop.server'
import { getPublicSettingsServer } from '@/features/settings/services/setting.server'

export const alt = 'Cửa hàng thời trang'
export const size = OG_SIZE
export const contentType = 'image/png'

/** Ảnh chia sẻ chung theo tên, màu cửa hàng (07 §4.1) */
export default async function Image() {
  const [store, settings] = await Promise.all([getStoreServer(), getPublicSettingsServer()])
  return renderOgImage({
    title: store.name,
    description: `${store.tagline ?? ''}. Miễn phí vận chuyển đơn từ 499.000 ₫, COD toàn quốc.`.replace(/^\. /, ''),
    tag: 'Thời trang basic',
    color: store.primaryColor || '#1E40AF',
    coverUrl: '/seed/banners/hero-1.webp',
    footer: settings['Company.Name'] ? `Website demo do ${settings['Company.Name']} thực hiện` : store.name,
  })
}
