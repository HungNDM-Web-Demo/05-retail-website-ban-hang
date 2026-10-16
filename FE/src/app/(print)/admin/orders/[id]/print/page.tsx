import type { Metadata } from 'next'
import { OrderPrintPage } from '@/features/orders/pages/OrderPrintPage'

export const metadata: Metadata = { title: 'Phiếu giao hàng' }

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ auto?: string }>
}) {
  const { id } = await params
  const { auto } = await searchParams
  return <OrderPrintPage ids={[id]} auto={auto === '1'} />
}
