import type { Metadata } from 'next'
import { CouponsPage } from '@/features/coupons/pages/CouponsPage'

export const metadata: Metadata = { title: 'Mã giảm giá' }

export default function Page() {
  return <CouponsPage />
}
