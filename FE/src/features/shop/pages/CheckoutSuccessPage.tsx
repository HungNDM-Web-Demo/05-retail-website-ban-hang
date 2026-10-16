'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, PackageSearch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { routePath } from '@/config/route-path'
import { formatDateTime } from '@/lib/format'
import type { PlaceOrderResult } from '@/types/shop'
import { TransferQr } from '@/features/sales/components/TransferQr'
import { OrderLinesSummary } from '../components/OrderLinesSummary'
import { useStoreInfo } from '../hooks/use-shop'
import { shopStorage } from '../lib/shop-storage'

/**
 * Đặt hàng thành công (SCR-06, UC-04 bước 6): đọc `PlaceOrderResult` từ sessionStorage; mở link trực tiếp
 * thì chỉ có mã đơn và nút Tra cứu. Chuyển khoản: QR, ngân hàng, số tài khoản, nội dung, hạn (TC-16).
 */
export function CheckoutSuccessPage() {
  const params = useSearchParams()
  const code = (params.get('code') ?? '').toUpperCase()
  const { data: store } = useStoreInfo()
  const [result, setResult] = useState<PlaceOrderResult | null | undefined>(undefined)
  useEffect(() => {
    const last = shopStorage.lastOrder()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- đọc sessionStorage sau khi gắn
    setResult(last && last.order.code === code ? last : null)
  }, [code])

  const order = result?.order
  const lookupHref = `${routePath.orderLookup}?code=${code}`

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="size-14 text-success" />
        <h1 className="text-2xl font-bold">Đặt hàng thành công</h1>
        <p className="text-muted-foreground">
          Mã đơn của bạn: <strong className="text-lg tracking-wide text-foreground">{code || '—'}</strong>
        </p>
        {order?.paymentMethod === 'Cod' && (
          <p className="max-w-md text-sm">
            Shop sẽ gọi xác nhận trong giờ làm việc {store?.workingHours ?? ''}. Bạn thanh toán khi nhận hàng.
          </p>
        )}
      </div>

      {order?.transfer && (
        <section className="mt-8 rounded-xl border bg-card p-4" aria-labelledby="transfer">
          <h2 id="transfer" className="mb-1 font-semibold">
            Chuyển khoản để hoàn tất đơn
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">Quét QR bằng ứng dụng ngân hàng hoặc chuyển đúng số tiền, đúng nội dung bên dưới.</p>
          <TransferQr transfer={order.transfer} />
        </section>
      )}

      {order && (
        <section className="mt-6 space-y-4 rounded-xl border bg-card p-4">
          <div className="grid gap-1 text-sm">
            <p>
              <span className="text-muted-foreground">Người nhận:</span> <strong>{order.recipientName}</strong> · {order.phone}
            </p>
            <p>
              <span className="text-muted-foreground">Giao tới:</span> {order.addressLine}, {order.wardName}, {order.provinceName}
            </p>
            <p>
              <span className="text-muted-foreground">Đặt lúc:</span> {formatDateTime(order.placedAt)}
            </p>
            {order.customerNote && (
              <p>
                <span className="text-muted-foreground">Ghi chú:</span> {order.customerNote}
              </p>
            )}
          </div>
          <OrderLinesSummary lines={order.lines} summary={order.summary} />
        </section>
      )}

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button asChild size="lg" variant={order ? 'outline' : 'default'}>
          <Link href={lookupHref}>
            <PackageSearch className="size-4" />
            Tra cứu đơn
          </Link>
        </Button>
        <Button asChild size="lg" variant={order ? 'default' : 'outline'}>
          <Link href={routePath.products}>Tiếp tục mua sắm</Link>
        </Button>
      </div>
    </div>
  )
}
