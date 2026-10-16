import type { Metadata } from 'next'
import { OrderDetailPage } from '@/features/orders/pages/OrderDetailPage'

export const metadata: Metadata = { title: 'Chi tiết đơn' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <OrderDetailPage id={id} />
}
