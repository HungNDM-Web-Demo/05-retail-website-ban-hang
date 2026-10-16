'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Loader2, ShoppingCart, Store } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { routePath } from '@/config/route-path'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import { isMockMode } from '@/lib/data-source'
import { subscribeShopEvents } from '@/features/sales/mock/shop-events'
import { useSimulateOrder } from '../hooks/use-shop'

const openStore = () => window.open(routePath.shopHome, '_blank', 'noopener')

/**
 * Thẻ "Xem như khách mua hàng" ở trang đăng nhập (07 §4.2 bước 1): mở cửa hàng ở tab mới,
 * gợi ý đăng nhập Nhân viên ở tab này để nhận đơn. Hiện ở cả hai chế độ.
 */
export function StoreEntryCard() {
  return (
    <section className="space-y-3 rounded-xl border border-dashed bg-card p-4" aria-labelledby="store-entry">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Store className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="store-entry" className="font-semibold">
            Xem như khách mua hàng
          </h2>
          <p className="text-sm text-muted-foreground">Website bán hàng cho khách, không cần tài khoản</p>
        </div>
      </div>
      <Button type="button" variant="outline" className="h-11 w-full" onClick={openStore}>
        <ExternalLink className="size-4" aria-hidden="true" />
        Mở cửa hàng
      </Button>
      <p className="text-xs text-muted-foreground">Đăng nhập Nhân viên ở tab này để nhận đơn</p>
    </section>
  )
}

/** Nút "Xem cửa hàng" trên header khu quản trị (07 §4.2 bước 1) */
export function ViewStoreButton() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={openStore} aria-label="Xem cửa hàng (tab mới)">
          <Store className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Xem cửa hàng</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Mở website bán hàng ở tab mới</TooltipContent>
    </Tooltip>
  )
}

/**
 * Thông báo "Đơn mới {mã} · {tổng}" ở khu quản trị khi tab cửa hàng (hoặc giả lập) tạo đơn (07 §2.10, §4.2 bước 3).
 * Chỉ người có `orders.view`; chế độ mock qua BroadcastChannel.
 */
export function ShopEventToaster() {
  const router = useRouter()
  const { can } = usePermissions()
  const allowed = can('orders.view')
  useEffect(() => {
    if (!isMockMode() || !allowed) return
    return subscribeShopEvents((event) => {
      if (event.name !== 'order-created') return
      const { orderId, code, total } = event.payload
      toast.success(`Đơn mới ${code} · ${formatVnd(total)}`, {
        duration: 10_000,
        action: { label: 'Xem đơn', onClick: () => router.push(routePath.adminOrderDetail(orderId)) },
      })
    })
  }, [allowed, router])
  return null
}

/** Mục "Cửa hàng" của DemoToolbar (07 §4.2 bước 6): mở cửa hàng, giả lập khách đặt đơn */
export function ShopDemoSection({ onDone }: { onDone?: () => void }) {
  const simulate = useSimulateOrder()
  return (
    <div className="grid gap-2">
      <Button type="button" variant="outline" className="h-10 justify-start" onClick={openStore}>
        <ExternalLink className="size-4" aria-hidden="true" />
        Mở cửa hàng
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-10 justify-start"
        disabled={simulate.isPending}
        onClick={async () => {
          try {
            const result = await simulate.mutateAsync()
            if (!isMockMode()) toast.success(`Đã giả lập đơn ${result.code} · ${formatVnd(result.total)}`)
            onDone?.()
          } catch (error) {
            toast.error(getErrorMessage(error))
          }
        }}
      >
        {simulate.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShoppingCart className="size-4" aria-hidden="true" />}
        Giả lập khách đặt đơn
      </Button>
    </div>
  )
}
