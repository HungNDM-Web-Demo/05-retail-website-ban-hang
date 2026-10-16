import { StatusBadge } from '@/components/shared/StatusBadge'
import { orderStatusLabels, orderStatusTone } from '@/config/shop-labels'
import type { OrderStatus } from '@/types/shop'

/** Huy hiệu trạng thái đơn (màu theo `orderStatusTone`) */
export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <StatusBadge tone={orderStatusTone[status]} className={className}>
      {orderStatusLabels[status]}
    </StatusBadge>
  )
}
