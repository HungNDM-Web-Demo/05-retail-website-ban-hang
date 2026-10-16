'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { matchesSearch } from '@/lib/normalize'
import { cn } from '@/lib/utils'
import type { ProvinceDto } from '@/types/shop'
import { useProvinces } from '../hooks/use-provinces'
import { sortProvincesForPicker } from '../services/province.service'

type Option = { value: string; label: string }

type ComboProps = {
  id?: string
  value?: string
  options: Option[]
  placeholder: string
  searchPlaceholder: string
  emptyText: string
  disabled?: boolean
  invalid?: boolean
  onChange: (value: string) => void
}

/** Combobox có tìm không dấu (cmdk + normalizeVi) */
function SearchCombo({ id, value, options, placeholder, searchPlaceholder, emptyText, disabled, invalid, onChange }: ComboProps) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className={cn(
            'h-11 w-full justify-between px-3 font-normal',
            !selected && 'text-muted-foreground',
            invalid && 'border-destructive'
          )}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command filter={(itemValue, search) => (matchesSearch(itemValue, search) ? 1 : 0)}>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-72">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.value}`}
                  onSelect={() => {
                    onChange(o.value)
                    setOpen(false)
                  }}
                  className="min-h-10"
                >
                  <Check className={cn('size-4', o.value === value ? 'opacity-100' : 'opacity-0')} />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

type ProvinceWardSelectProps = {
  provinceCode?: string
  wardCode?: string
  onChange: (value: { provinceCode: string; wardCode: string; province?: ProvinceDto }) => void
  provinceError?: string
  wardError?: string
  disabled?: boolean
  /** id cho nhãn `<label htmlFor>` */
  provinceId?: string
  wardId?: string
}

/**
 * Chọn tỉnh/thành, phường/xã (07 §4.3): combobox tìm không dấu, TP.HCM và Hà Nội đầu danh sách.
 * Đổi tỉnh thì xóa phường. Dùng ở thanh toán (cửa hàng) và sửa đơn (quản trị).
 */
export function ProvinceWardSelect({
  provinceCode,
  wardCode,
  onChange,
  provinceError,
  wardError,
  disabled,
  provinceId = 'provinceCode',
  wardId = 'wardCode',
}: ProvinceWardSelectProps) {
  const { data } = useProvinces()
  const provinces = useMemo(() => sortProvincesForPicker(data ?? []), [data])
  const province = provinces.find((p) => p.code === provinceCode)
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="grid gap-1.5">
        <label htmlFor={provinceId} className="text-sm font-medium">
          Tỉnh/thành <span className="text-destructive">*</span>
        </label>
        <SearchCombo
          id={provinceId}
          value={provinceCode}
          options={provinces.map((p) => ({ value: p.code, label: p.name }))}
          placeholder="Chọn tỉnh/thành"
          searchPlaceholder="Tìm tỉnh/thành"
          emptyText="Không có tỉnh/thành phù hợp"
          disabled={disabled || !data}
          invalid={!!provinceError}
          onChange={(code) =>
            onChange({ provinceCode: code, wardCode: '', province: provinces.find((p) => p.code === code) })
          }
        />
        {provinceError && <p className="text-sm text-destructive">{provinceError}</p>}
      </div>
      <div className="grid gap-1.5">
        <label htmlFor={wardId} className="text-sm font-medium">
          Phường/xã <span className="text-destructive">*</span>
        </label>
        <SearchCombo
          id={wardId}
          value={wardCode}
          options={(province?.wards ?? []).map((w) => ({ value: w.code, label: w.name }))}
          placeholder={province ? 'Chọn phường/xã' : 'Chọn tỉnh/thành trước'}
          searchPlaceholder="Tìm phường/xã"
          emptyText="Không có phường/xã phù hợp"
          disabled={disabled || !province}
          invalid={!!wardError}
          onChange={(code) => onChange({ provinceCode: provinceCode ?? '', wardCode: code, province })}
        />
        {wardError && <p className="text-sm text-destructive">{wardError}</p>}
      </div>
    </div>
  )
}
