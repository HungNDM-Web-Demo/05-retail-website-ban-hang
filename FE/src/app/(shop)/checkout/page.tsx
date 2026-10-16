import type { Metadata } from 'next'
import { getStoreServer } from '@/features/shop/services/shop.server'
import { CheckoutPage } from '@/features/shop/pages/CheckoutPage'

export async function generateMetadata(): Promise<Metadata> {
  const store = await getStoreServer()
  return { title: { absolute: `Thanh toán | ${store.name}` }, robots: { index: false, follow: false } }
}

/** Thanh toán một trang (SCR-05): render phía trình duyệt, noindex */
export default function CheckoutRoute() {
  return <CheckoutPage />
}
