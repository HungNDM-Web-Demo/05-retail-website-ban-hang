import type { Metadata } from 'next'
import { ProductEditPage } from '@/features/products/pages/ProductEditPage'

export const metadata: Metadata = { title: 'Thêm sản phẩm' }

export default function Page() {
  return <ProductEditPage />
}
