import { Suspense } from 'react'
import type { Metadata } from 'next'
import { getStoreServer } from '@/features/shop/services/shop.server'
import { OrderLookupPage } from '@/features/shop/pages/OrderLookupPage'

export async function generateMetadata(): Promise<Metadata> {
  const store = await getStoreServer()
  return { title: { absolute: `Tra cứu đơn hàng | ${store.name}` }, robots: { index: false, follow: true } }
}

/** Tra cứu đơn (SCR-07): render phía trình duyệt, noindex */
export default function OrderLookupRoute() {
  return (
    <Suspense>
      <OrderLookupPage />
    </Suspense>
  )
}
