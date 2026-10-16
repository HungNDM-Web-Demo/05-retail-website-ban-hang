import type { Metadata } from 'next'
import { OrderPrintPage } from '@/features/orders/pages/OrderPrintPage'

export const metadata: Metadata = { title: 'In phiếu giao' }

export default async function Page({ searchParams }: { searchParams: Promise<{ ids?: string; auto?: string }> }) {
  const { ids, auto } = await searchParams
  const list = (ids ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 100)
  return <OrderPrintPage ids={list} auto={auto === '1'} />
}
