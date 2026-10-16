import type { Metadata } from 'next'
import { OrdersPage } from '@/features/orders/pages/OrdersPage'

export const metadata: Metadata = { title: 'Đơn hàng' }

export default function Page() {
  return <OrdersPage />
}
