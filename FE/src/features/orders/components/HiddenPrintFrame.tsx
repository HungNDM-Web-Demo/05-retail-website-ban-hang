'use client'

import { useEffect } from 'react'
import { routePath } from '@/config/route-path'

/**
 * Mở phiếu giao trong iframe ẩn sau "Tạo vận đơn" (07 §2.11): không mở tab mới để tránh chặn cửa sổ
 * bật lên. Trang in trong iframe tự gọi window.print() (`?auto=1`) và ghi đã in sau `afterprint`.
 */
export function HiddenPrintFrame({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 120_000)
    return () => window.clearTimeout(timer)
  }, [onDone])
  return (
    <iframe
      title="Phiếu giao hàng"
      src={`${routePath.adminOrderPrint(orderId)}?auto=1`}
      aria-hidden="true"
      tabIndex={-1}
      className="pointer-events-none fixed -top-[200vh] left-0 h-[148mm] w-[105mm] border-0 opacity-0"
    />
  )
}
