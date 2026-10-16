'use client'

import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

type QuantityStepperProps = {
  value: number
  max: number
  min?: number
  onChange: (value: number) => void
  /** Bấm tăng khi đã chạm tối đa (để hiện lý do, TC-04) */
  onLimit?: () => void
  disabled?: boolean
  size?: 'sm' | 'md'
  label?: string
}

/** Ô số lượng có nút −/+ vùng chạm ≥ 44 px (NFR-01); dừng ở `max` (BR-03) */
export function QuantityStepper({ value, max, min = 1, onChange, onLimit, disabled, size = 'md', label = 'Số lượng' }: QuantityStepperProps) {
  const h = size === 'sm' ? 'h-10' : 'h-11'
  const w = size === 'sm' ? 'w-10' : 'w-11'
  return (
    <div className={cn('inline-flex items-center rounded-lg border', disabled && 'opacity-50')} role="group" aria-label={label}>
      <button
        type="button"
        aria-label="Giảm"
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className={cn('flex items-center justify-center rounded-l-lg hover:bg-accent disabled:opacity-40', h, w)}
      >
        <Minus className="size-4" />
      </button>
      <span className={cn('flex min-w-9 items-center justify-center text-sm font-semibold tabular-nums', h)} aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label="Tăng"
        disabled={disabled}
        onClick={() => (value >= max ? onLimit?.() : onChange(Math.min(max, value + 1)))}
        className={cn('flex items-center justify-center rounded-r-lg hover:bg-accent disabled:opacity-40', h, w, value >= max && 'text-muted-foreground')}
      >
        <Plus className="size-4" />
      </button>
    </div>
  )
}
