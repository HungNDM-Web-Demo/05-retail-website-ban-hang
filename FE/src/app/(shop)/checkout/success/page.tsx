import { Suspense } from 'react'
import type { Metadata } from 'next'
import { getStoreServer } from '@/features/shop/services/shop.server'
import { CheckoutSuccessPage } from '@/features/shop/pages/CheckoutSuccessPage'

export async function generateMetadata(): Promise<Metadata> {
  const store = await getStoreServer()
  return { title: { absolute: `Đặt hàng thành công | ${store.name}` }, robots: { index: false, follow: false } }
}

/** Đặt hàng thành công (SCR-06): ?code=DH…, noindex */
export default function CheckoutSuccessRoute() {
  return (
    <Suspense>
      <CheckoutSuccessPage />
    </Suspense>
  )
}
