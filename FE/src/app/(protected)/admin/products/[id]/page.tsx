import type { Metadata } from 'next'
import { ProductEditPage } from '@/features/products/pages/ProductEditPage'

export const metadata: Metadata = { title: 'Sản phẩm' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ProductEditPage id={id} />
}
