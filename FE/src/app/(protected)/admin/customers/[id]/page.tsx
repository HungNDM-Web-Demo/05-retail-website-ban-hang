import type { Metadata } from 'next'
import { CustomerDetailPage } from '@/features/customers/pages/CustomerDetailPage'

export const metadata: Metadata = { title: 'Hồ sơ khách' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <CustomerDetailPage id={id} />
}
