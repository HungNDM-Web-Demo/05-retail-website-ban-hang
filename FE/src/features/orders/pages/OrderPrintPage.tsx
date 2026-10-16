'use client'

import { useEffect, useRef } from 'react'
import { useQueries } from '@tanstack/react-query'
import { Printer, X } from 'lucide-react'
import { ErrorState } from '@/components/shared/ErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { permissions } from '@/config/permissions'
import { usePermissions } from '@/hooks/use-permissions'
import { readJson } from '@/lib/storage'
import type { OrderDetailDto } from '@/types/shop'
import { ShippingLabel } from '../components/ShippingLabel'
import '../components/shipping-label.css'
import { orderKeys, useLabelPrinted } from '../hooks/use-orders'
import { useStoreInfo } from '../hooks/use-store-info'
import { NO_AUTO_PRINT_KEY } from '../lib/order-ui'
import { orderService } from '../services/order.service'

/**
 * SCR-13 Phiếu giao A6 (UC-10, FR-29; 07 §2.11). Một đơn `/admin/orders/{id}/print` hoặc nhiều đơn
 * `/admin/orders/print?ids=a,b` (P3), mỗi phiếu một trang. `?auto=1` (iframe ẩn sau "Tạo vận đơn")
 * tự gọi window.print(); in xong (`afterprint`) ghi đã in phiếu (UC-10 5a).
 */
export function OrderPrintPage({ ids, auto }: { ids: string[]; auto: boolean }) {
  const { can } = usePermissions()
  const store = useStoreInfo()
  const results = useQueries({
    queries: ids.map((id) => ({ queryKey: orderKeys.detail(id), queryFn: () => orderService.detail(id) })),
  })
  const orders = results.map((r) => r.data).filter((o): o is OrderDetailDto => !!o)
  const error = results.find((r) => r.error)?.error ?? store.error
  const ready = !!store.data && orders.length === ids.length && ids.length > 0

  // "IN LẠI" khi phiếu đã in trước đó (07 §5 quyết định 30)
  const labelPrinted = useLabelPrinted()
  // Chỉ ghi đã in cho đơn được in phiếu (từ Đã xác nhận trở đi, 07 §3.5)
  const printable = orders.filter((o) => o.allowedActions.includes('PrintLabel')).map((o) => o.id).join(',')
  const idsRef = useRef<string[]>([])
  useEffect(() => {
    idsRef.current = printable ? printable.split(',') : []
  }, [printable])
  useEffect(() => {
    if (!can(permissions.orders.ship)) return
    const onAfterPrint = () => {
      for (const id of idsRef.current) labelPrinted.mutate(id)
    }
    window.addEventListener('afterprint', onAfterPrint)
    return () => window.removeEventListener('afterprint', onAfterPrint)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gắn một lần
  }, [can])

  const printed = useRef(false)
  useEffect(() => {
    if (!auto || !ready || printed.current) return
    if (readJson<string | number>('local', NO_AUTO_PRINT_KEY)?.toString() === '1') return
    printed.current = true
    const timer = window.setTimeout(() => window.print(), 500)
    return () => window.clearTimeout(timer)
  }, [auto, ready])

  return (
    <div className="label-sheet bg-muted min-h-svh print:bg-white">
      <div className="print-hidden bg-card sticky top-0 z-10 flex h-14 items-center gap-2 border-b px-4">
        <span className="flex-1 truncate text-sm font-medium">
          Phiếu giao hàng A6 · {ids.length} phiếu
          {orders.some((o) => !o.shipment) && <span className="text-warning ml-2">Có đơn chưa bàn giao</span>}
        </span>
        <Button variant="outline" onClick={() => window.close()}>
          <X aria-hidden="true" />
          Đóng
        </Button>
        <Button onClick={() => window.print()} disabled={!ready}>
          <Printer aria-hidden="true" />
          In phiếu
        </Button>
      </div>
      <div className="label-sheet flex flex-col items-center gap-6 px-4 py-6">
        {!ids.length ? (
          <p className="text-muted-foreground">Chưa chọn đơn nào để in.</p>
        ) : error ? (
          <div className="bg-card rounded-xl">
            <ErrorState error={error} />
          </div>
        ) : !ready ? (
          <Skeleton className="h-[148mm] w-[105mm]" />
        ) : (
          orders.map((o) => (
            <div key={o.id} className="bg-white p-[4mm] shadow-md print:p-0 print:shadow-none">
              <ShippingLabel order={o} store={store.data!} reprint={(o.shipment?.labelPrintCount ?? 0) > 0} />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
