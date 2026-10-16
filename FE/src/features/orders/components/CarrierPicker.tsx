'use client'

import { carrierLabels } from '@/config/shop-labels'
import { cn } from '@/lib/utils'
import type { Carrier } from '@/types/shop'
import { carrierOptions } from '../lib/order-ui'

/** Chọn đơn vị vận chuyển giả lập (BR-17), nút lớn dễ bấm */
export function CarrierPicker({ value, onChange }: { value: Carrier; onChange: (c: Carrier) => void }) {
  return (
    <div role="radiogroup" aria-label="Đơn vị vận chuyển" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {carrierOptions.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          onClick={() => onChange(c)}
          className={cn(
            'focus-visible:ring-ring/50 h-12 rounded-lg border px-2 text-sm font-semibold transition-colors outline-none focus-visible:ring-3',
            value === c ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'
          )}
        >
          {carrierLabels[c]}
        </button>
      ))}
    </div>
  )
}
