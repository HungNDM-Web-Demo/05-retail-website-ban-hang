import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { discountPercent } from '../lib/stock'

type PriceTagProps = {
  price: number
  listPrice?: number | null
  /** Hiện nhãn "−n%" (BR-01) */
  showPercent?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZES = {
  sm: { price: 'text-sm font-semibold', list: 'text-xs', badge: 'text-[11px] px-1.5' },
  md: { price: 'text-base font-semibold', list: 'text-sm', badge: 'text-xs px-1.5' },
  lg: { price: 'text-2xl font-bold', list: 'text-base', badge: 'text-sm px-2' },
}

/** Giá bán + giá gốc gạch ngang + "−n%" (BR-01, TC-03) */
export function PriceTag({ price, listPrice, showPercent = true, size = 'md', className }: PriceTagProps) {
  const percent = discountPercent(price, listPrice)
  const s = SIZES[size]
  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-0.5', className)}>
      <span className={cn('tabular-nums', s.price, percent ? 'text-destructive' : 'text-foreground')}>
        {formatVnd(price)}
      </span>
      {percent !== undefined && listPrice ? (
        <>
          <span className={cn('text-muted-foreground tabular-nums line-through', s.list)}>
            {formatVnd(listPrice)}
          </span>
          {showPercent && (
            <span className={cn('rounded bg-destructive/10 py-0.5 font-semibold text-destructive', s.badge)}>
              −{percent}%
            </span>
          )}
        </>
      ) : null}
    </div>
  )
}
