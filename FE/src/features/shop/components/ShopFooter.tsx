'use client'

import Link from 'next/link'
import { Clock, Mail, MapPin, Phone, Truck } from 'lucide-react'
import { routePath } from '@/config/route-path'
import { useBrand } from '@/features/settings/hooks/use-settings'
import { formatVnd } from '@/lib/format'
import type { PublicStoreInfo } from '@/types/shop'
import { useStoreInfo } from '../hooks/use-shop'

/**
 * Chân trang (07 §4.3): hotline, email, địa chỉ, giờ làm việc, liên kết tra cứu, phí vận chuyển;
 * dòng "Website demo do {Company.Name} thực hiện" lấy từ cài đặt công khai của nền.
 */
export function ShopFooter({ initialStore }: { initialStore?: PublicStoreInfo }) {
  const { data: store } = useStoreInfo(initialStore)
  const { company } = useBrand()
  if (!store) return null
  return (
    <footer className="mt-16 border-t bg-card">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div className="space-y-2">
          <p className="text-lg font-bold">{store.name}</p>
          {store.tagline && <p className="text-sm text-muted-foreground">{store.tagline}</p>}
          <Link
            href={routePath.orderLookup}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Tra cứu đơn hàng
          </Link>
        </div>
        <ul className="space-y-3 text-sm">
          <li className="flex gap-2.5">
            <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <a href={`tel:${store.hotline.replace(/\s/g, '')}`} className="hover:text-primary">
              Hotline {store.hotline}
            </a>
          </li>
          {store.email && (
            <li className="flex gap-2.5">
              <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <a href={`mailto:${store.email}`} className="hover:text-primary">
                {store.email}
              </a>
            </li>
          )}
          <li className="flex gap-2.5">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>{store.address}</span>
          </li>
          <li className="flex gap-2.5">
            <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>{store.workingHours}</span>
          </li>
        </ul>
        <div className="space-y-2 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <Truck className="size-4 text-muted-foreground" />
            Phí vận chuyển
          </p>
          <ul className="space-y-1 text-muted-foreground">
            <li>TP. Hồ Chí Minh: {formatVnd(store.shippingFees.TpHcm)}</li>
            <li>Tỉnh/thành khác: {formatVnd(store.shippingFees.TinhKhac)}</li>
            <li className="font-medium text-foreground">Miễn phí cho đơn từ {formatVnd(store.freeShipThreshold)}</li>
          </ul>
          <p className="text-muted-foreground">Thanh toán khi nhận hàng (COD) hoặc chuyển khoản.</p>
        </div>
      </div>
      {company.name && (
        <div className="border-t py-4 text-center text-xs text-muted-foreground">
          Website demo do {company.name} thực hiện
        </div>
      )}
    </footer>
  )
}
