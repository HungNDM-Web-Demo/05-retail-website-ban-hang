import type { Metadata } from 'next'
import { ProductsPage } from '@/features/products/pages/ProductsPage'

export const metadata: Metadata = { title: 'Sản phẩm' }

export default function Page() {
  return <ProductsPage />
}
