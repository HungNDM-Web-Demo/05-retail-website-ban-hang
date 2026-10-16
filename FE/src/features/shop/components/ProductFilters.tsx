'use client'

import { Check } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { priceRangeOptions } from '@/config/shop-labels'
import { cn } from '@/lib/utils'
import type { PublicProductFacets, PublicProductQuery } from '@/types/shop'
import { joinCsv, splitCsv } from '../lib/product-query'

type ProductFiltersProps = {
  facets: PublicProductFacets
  value: PublicProductQuery
  onChange: (next: PublicProductQuery) => void
}

function toggle(list: string[], item: string) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
}

/** Bộ lọc màu, size, khoảng giá, còn hàng (FR-05, UC-01 bước 4). Đổi giá trị gọi onChange, trang về 1. */
export function ProductFilters({ facets, value, onChange }: ProductFiltersProps) {
  const colors = splitCsv(value.colors)
  const sizes = splitCsv(value.sizes)
  const set = (patch: Partial<PublicProductQuery>) => onChange({ ...value, ...patch, page: undefined })
  return (
    <div className="flex flex-col gap-6">
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border px-3">
        <span className="text-sm font-medium">Chỉ hiện còn hàng</span>
        <Switch checked={!!value.inStock} onCheckedChange={(v) => set({ inStock: v || undefined })} />
      </label>

      {facets.colors.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Màu sắc</legend>
          <div className="grid grid-cols-2 gap-1.5">
            {facets.colors.map((c) => {
              const on = colors.includes(c.code)
              return (
                <button
                  key={c.code}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ colors: joinCsv(toggle(colors, c.code)) })}
                  className={cn(
                    'flex min-h-11 items-center gap-2 rounded-lg border px-2.5 text-left text-sm transition-colors',
                    on ? 'border-primary bg-primary/5 font-medium text-primary' : 'hover:bg-accent'
                  )}
                >
                  <span
                    className="relative flex size-5 shrink-0 items-center justify-center rounded-full ring-1 ring-border ring-inset"
                    style={{ backgroundColor: c.hex }}
                  >
                    {on && <Check className="size-3 text-white mix-blend-difference" />}
                  </span>
                  <span className="truncate">{c.name}</span>
                </button>
              )
            })}
          </div>
        </fieldset>
      )}

      {facets.sizes.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Size</legend>
          <div className="flex flex-wrap gap-1.5">
            {facets.sizes.map((s) => {
              const on = sizes.includes(s)
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ sizes: joinCsv(toggle(sizes, s)) })}
                  className={cn(
                    'flex h-11 min-w-12 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors',
                    on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent'
                  )}
                >
                  {s}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Khoảng giá</legend>
        <div className="flex flex-col gap-1.5">
          {priceRangeOptions.map((r) => {
            const on = value.minPrice === r.minPrice && value.maxPrice === r.maxPrice
            return (
              <button
                key={r.label}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  set(on ? { minPrice: undefined, maxPrice: undefined } : { minPrice: r.minPrice, maxPrice: r.maxPrice })
                }
                className={cn(
                  'flex min-h-11 items-center justify-between rounded-lg border px-3 text-left text-sm transition-colors',
                  on ? 'border-primary bg-primary/5 font-medium text-primary' : 'hover:bg-accent'
                )}
              >
                {r.label}
                {on && <Check className="size-4" />}
              </button>
            )
          })}
        </div>
      </fieldset>
    </div>
  )
}
