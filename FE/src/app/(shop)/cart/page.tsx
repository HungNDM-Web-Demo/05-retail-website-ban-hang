import type { Metadata } from 'next'
import { getStoreServer } from '@/features/shop/services/shop.server'
import { CartPage } from '@/features/shop/pages/CartPage'

export async function generateMetadata(): Promise<Metadata> {
  const store = await getStoreServer()
  return { title: { absolute: `Giỏ hàng | ${store.name}` }, robots: { index: false, follow: false } }
}

/** Giỏ hàng (SCR-04): render phía trình duyệt, noindex */
export default function CartRoute() {
  return <CartPage />
}
