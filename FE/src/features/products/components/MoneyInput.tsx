'use client'

import { Input } from '@/components/ui/input'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Ô nhập tiền: hiện "299.000", trả số nguyên đồng; để trống → undefined */
export function MoneyInput({
  value,
  onChange,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & {
  value: number | undefined | null
  onChange: (value: number | undefined) => void
}) {
  return (
    <div className="relative">
      <Input
        {...props}
        inputMode="numeric"
        value={value === undefined || value === null || Number.isNaN(value) ? '' : formatNumber(value, 0)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '')
          onChange(digits ? Number(digits) : undefined)
        }}
        className={cn('pr-8 text-right tabular-nums', className)}
      />
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">₫</span>
    </div>
  )
}
