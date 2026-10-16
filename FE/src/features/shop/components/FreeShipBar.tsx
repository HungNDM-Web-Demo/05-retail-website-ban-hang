import { Truck } from 'lucide-react'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { SalesRules } from '@/features/sales/lib/rules'

/** Dải miễn phí vận chuyển (07 §3.3, TC-05): "Mua thêm X ₫…" hoặc "Đơn được miễn phí vận chuyển" */
export function FreeShipBar({ remaining, className }: { remaining: number; className?: string }) {
  const done = remaining <= 0
  const percent = Math.min(100, Math.round(((SalesRules.freeShipThreshold - remaining) / SalesRules.freeShipThreshold) * 100))
  return (
    <div className={cn('rounded-lg border p-3', done ? 'border-success/30 bg-success/5' : 'bg-card', className)}>
      <p className={cn('flex items-center gap-2 text-sm', done && 'font-medium text-success')}>
        <Truck className="size-4 shrink-0" />
        {done ? (
          'Đơn được miễn phí vận chuyển'
        ) : (
          <span>
            Mua thêm <strong className="tabular-nums">{formatVnd(remaining)}</strong> để được miễn phí vận chuyển
          </span>
        )}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className={cn('h-full rounded-full transition-all', done ? 'bg-success' : 'bg-primary')} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
