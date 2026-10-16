import { StatusBadge, type StatusTone } from '@/components/shared/StatusBadge'
import { stockStatusLabels } from '@/config/shop-labels'
import type { StockStatus } from '@/types/shop'
import { stockStatus as statusOf } from '../lib/stock'

const TONE: Record<StockStatus, StatusTone> = { ConHang: 'success', SapHet: 'warning', HetHang: 'danger' }

type StockBadgeProps = {
  /** Truyền `status` hoặc `stock` (tự suy ra theo BR-02) */
  status?: StockStatus
  stock?: number
  /** Sắp hết thì ghi "Chỉ còn {n} sản phẩm" thay cho "Sắp hết" (cửa hàng, UC-02) */
  showCount?: boolean
  className?: string
}

/** Huy hiệu tình trạng tồn (BR-02): Còn hàng, Sắp hết, Hết hàng */
export function StockBadge({ status, stock, showCount, className }: StockBadgeProps) {
  const s = status ?? statusOf(stock ?? 0)
  const label = showCount && s === 'SapHet' && stock !== undefined ? `Chỉ còn ${stock} sản phẩm` : stockStatusLabels[s]
  return (
    <StatusBadge tone={TONE[s]} className={className}>
      {label}
    </StatusBadge>
  )
}
