'use client'

import { orderStatusLabels, orderStatusTabs } from '@/config/shop-labels'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { OrderStatusCounts } from '@/types/shop'
import type { OrderTab } from '../lib/order-ui'

const TABS: { value: OrderTab; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  ...orderStatusTabs.map((s) => ({ value: s as OrderTab, label: orderStatusLabels[s] })),
]

/** Thanh tab trạng thái kèm số đơn (FR-21, UC-07 bước 1); số từ status-counts theo cùng bộ lọc */
export function OrderStatusTabs({
  value,
  counts,
  onChange,
}: {
  value: OrderTab
  counts?: OrderStatusCounts
  onChange: (tab: OrderTab) => void
}) {
  return (
    <div role="tablist" aria-label="Trạng thái đơn">
      <div className="bg-muted flex w-fit max-w-full flex-wrap gap-1 rounded-xl p-1">
        {TABS.map((t) => {
          const active = t.value === value
          const n = counts ? counts[t.value === 'all' ? 'TatCa' : t.value] : undefined
          const attention = (t.value === 'ChoXacNhan' || t.value === 'ChoThanhToan') && !!n
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(t.value)}
              className={cn(
                'focus-visible:ring-ring/50 inline-flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3',
                active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
              <span
                className={cn(
                  'min-w-6 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums',
                  active ? 'bg-primary text-primary-foreground' : attention ? 'bg-warning/15 text-warning' : 'bg-background/70'
                )}
              >
                {n === undefined ? '…' : formatNumber(n, 0)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
