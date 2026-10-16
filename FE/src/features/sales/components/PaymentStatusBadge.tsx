import { StatusBadge, type StatusTone } from '@/components/shared/StatusBadge'
import { paymentStatusLabels } from '@/config/shop-labels'
import type { PaymentStatus } from '@/types/shop'

const TONE: Record<PaymentStatus, StatusTone> = {
  ChuaThanhToan: 'neutral',
  DaThanhToan: 'success',
  CanHoanTien: 'danger',
  DaHoanTien: 'info',
}

/** Huy hiệu trạng thái thanh toán */
export function PaymentStatusBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  return (
    <StatusBadge tone={TONE[status]} className={className}>
      {paymentStatusLabels[status]}
    </StatusBadge>
  )
}
