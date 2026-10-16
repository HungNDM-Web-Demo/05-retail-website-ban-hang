'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Search, X } from 'lucide-react'
import { routePath } from '@/config/route-path'
import { useDebounce } from '@/hooks/use-debounce'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ProductImage } from '@/features/sales/components/ProductImage'
import { useSuggest } from '../hooks/use-shop'

type SearchBoxProps = {
  className?: string
  autoFocus?: boolean
  onDone?: () => void
  defaultValue?: string
}

/**
 * Ô tìm sản phẩm (FR-06, 07 §4.3): gợi ý từ 2 ký tự, debounce 250 ms, tối đa 5 kèm ảnh, giá;
 * Enter mở `/products?search=`. Tìm không dấu theo tên, mã, SKU.
 */
export function SearchBox({ className, autoFocus, onDone, defaultValue = '' }: SearchBoxProps) {
  const router = useRouter()
  const [value, setValue] = useState(defaultValue)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const debounced = useDebounce(value, 250)
  const { data, isFetching } = useSuggest(debounced)
  const boxRef = useRef<HTMLDivElement>(null)
  const suggestions = debounced.trim().length >= 2 ? (data ?? []) : []

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const go = (href: string) => {
    setOpen(false)
    onDone?.()
    router.push(href)
  }

  const submit = () => {
    const q = value.trim()
    if (active >= 0 && suggestions[active]) return go(routePath.productDetail(suggestions[active].slug))
    go(q ? `${routePath.products}?search=${encodeURIComponent(q)}` : routePath.products)
  }

  return (
    <div ref={boxRef} className={cn('relative', className)}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <label htmlFor="shop-search" className="sr-only">
          Tìm sản phẩm
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id="shop-search"
          type="search"
          inputMode="search"
          autoComplete="off"
          autoFocus={autoFocus}
          value={value}
          placeholder="Tìm áo, quần, mã sản phẩm…"
          onChange={(e) => {
            setValue(e.target.value)
            setOpen(true)
            setActive(-1)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((i) => Math.min(i + 1, suggestions.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((i) => Math.max(i - 1, -1))
            } else if (e.key === 'Escape') setOpen(false)
          }}
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-controls="shop-search-list"
          className="h-11 w-full rounded-full border border-input bg-background pr-10 pl-9 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 md:h-10 md:text-sm [&::-webkit-search-cancel-button]:hidden"
        />
        {isFetching && debounced.trim().length >= 2 ? (
          <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : value ? (
          <button
            type="button"
            aria-label="Xóa từ khóa"
            onClick={() => setValue('')}
            className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </form>
      {open && suggestions.length > 0 && (
        <ul
          id="shop-search-list"
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li key={s.slug} role="option" aria-selected={i === active}>
              <Link
                href={routePath.productDetail(s.slug)}
                onClick={() => {
                  setOpen(false)
                  onDone?.()
                }}
                className={cn('flex items-center gap-3 px-3 py-2 hover:bg-accent', i === active && 'bg-accent')}
              >
                <ProductImage src={s.coverUrl} alt={s.name} className="w-10 shrink-0 rounded" />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 text-sm font-medium">{s.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatVnd(s.price)}
                    {s.listPrice ? <span className="ml-2 line-through">{formatVnd(s.listPrice)}</span> : null}
                  </span>
                </span>
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={submit}
              className="w-full border-t px-3 py-2.5 text-left text-sm font-medium text-primary hover:bg-accent"
            >
              Xem tất cả kết quả cho “{value.trim()}”
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}
