'use client'

import { useState } from 'react'
import { Check, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { sizeOrder } from '@/config/shop-labels'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import type { ColorDto } from '@/types/shop'
import { useSaveColor } from '../hooks/use-products'

const SIZE_GROUPS: { label: string; sizes: string[] }[] = [
  { label: 'S–XL', sizes: ['S', 'M', 'L', 'XL'] },
  { label: '26–32', sizes: ['26', '27', '28', '29', '30', '31', '32'] },
  { label: 'Không có size', sizes: [] },
]

const sortSizes = (list: string[]) =>
  [...list].sort((a, b) => {
    const ia = sizeOrder.indexOf(a)
    const ib = sizeOrder.indexOf(b)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })

/** Chọn màu (từ /api/colors, có "Thêm màu") và size (nhóm nhanh) để sinh lưới biến thể (FR-18) */
export function ColorSizePicker({
  colors,
  colorIds,
  sizes,
  onColors,
  onSizes,
  readOnly,
  canAddColor,
  colorError,
}: {
  colors: ColorDto[]
  colorIds: string[]
  sizes: string[]
  onColors: (ids: string[]) => void
  onSizes: (sizes: string[]) => void
  readOnly?: boolean
  canAddColor?: boolean
  colorError?: string
}) {
  const [adding, setAdding] = useState(false)
  const toggleColor = (id: string) => {
    if (colorIds.includes(id)) onColors(colorIds.filter((c) => c !== id))
    // giữ thứ tự màu theo danh mục màu
    else onColors(colors.filter((c) => c.id === id || colorIds.includes(c.id)).map((c) => c.id))
  }
  const toggleSize = (s: string) => onSizes(sortSizes(sizes.includes(s) ? sizes.filter((x) => x !== s) : [...sizes, s]))

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-medium">
          Màu <span className="text-destructive">*</span>
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Màu của sản phẩm">
          {colors.map((c) => {
            const on = colorIds.includes(c.id)
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                disabled={readOnly}
                onClick={() => toggleColor(c.id)}
                className={cn(
                  'focus-visible:ring-ring/50 inline-flex h-10 items-center gap-2 rounded-full border px-3 text-sm transition-colors outline-none focus-visible:ring-3 disabled:cursor-default',
                  on ? 'border-primary bg-primary/10 text-primary font-medium' : 'hover:bg-muted',
                  readOnly && !on && 'hidden'
                )}
              >
                <span className="size-4 rounded-full border" style={{ backgroundColor: c.hex }} aria-hidden="true" />
                {c.name}
                <span className="text-muted-foreground text-xs">{c.code}</span>
                {on && <Check className="size-3.5" aria-hidden="true" />}
              </button>
            )
          })}
          {canAddColor && !readOnly && (
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setAdding(true)}>
              <Plus aria-hidden="true" />
              Thêm màu
            </Button>
          )}
        </div>
        {colorError && (
          <p role="alert" className="text-destructive text-[0.8125rem]">
            {colorError}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Size</p>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            {SIZE_GROUPS.map((g) => (
              <Button key={g.label} type="button" size="sm" variant="secondary" onClick={() => onSizes(g.sizes)}>
                {g.label}
              </Button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Size của sản phẩm">
          {sizeOrder.map((s) => {
            const on = sizes.includes(s)
            if (readOnly && !on) return null
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                disabled={readOnly}
                onClick={() => toggleSize(s)}
                className={cn(
                  'focus-visible:ring-ring/50 h-10 min-w-11 rounded-lg border px-3 text-sm font-medium tabular-nums transition-colors outline-none focus-visible:ring-3',
                  on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'
                )}
              >
                {s}
              </button>
            )
          })}
        </div>
        {!sizes.length && <p className="text-muted-foreground text-sm">Không có size: mỗi màu một biến thể.</p>}
      </div>
      {adding && <ColorFormDialog onClose={() => setAdding(false)} onCreated={(c) => onColors([...colorIds, c.id])} />}
    </div>
  )
}

/** Thêm màu dùng chung (mã 2 chữ in hoa dùng trong SKU; không đổi được sau khi tạo) */
export function ColorFormDialog({ onClose, onCreated, value }: { onClose: () => void; onCreated?: (c: ColorDto) => void; value?: ColorDto }) {
  const [form, setForm] = useState({ code: value?.code ?? '', name: value?.name ?? '', hex: value?.hex ?? '#808080' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useSaveColor()
  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: '' }))
  }
  const submit = async () => {
    const errs: Record<string, string> = {}
    if (!/^[A-Z]{2}$/.test(form.code)) errs.code = 'Mã màu gồm 2 chữ in hoa'
    if (form.name.trim().length < 2) errs.name = 'Tên màu từ 2 ký tự'
    if (!/^#[0-9A-Fa-f]{6}$/.test(form.hex)) errs.hex = 'Mã màu dạng #RRGGBB'
    if (Object.keys(errs).length) return setErrors(errs)
    try {
      const c = await save.mutateAsync({ id: value?.id, body: { code: form.code, name: form.name.trim(), hex: form.hex.toUpperCase() } })
      toast.success(value ? 'Đã lưu màu' : `Đã thêm màu ${c.name}`)
      onCreated?.(c)
      onClose()
    } catch (e) {
      const f = getFieldErrors(e)
      if (Object.keys(f).length) setErrors(f)
      else toast.error(getErrorMessage(e))
    }
  }
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{value ? `Sửa màu ${value.name}` : 'Thêm màu'}</DialogTitle>
          <DialogDescription>Mã màu dùng trong SKU, vd XR → SM010-XR-M.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <div className="grid grid-cols-[6rem_1fr] gap-3">
            <FormField label="Mã" required error={errors.code}>
              <Input value={form.code} maxLength={2} disabled={!!value} onChange={(e) => set('code', e.target.value.toUpperCase())} />
            </FormField>
            <FormField label="Tên màu" required error={errors.name}>
              <Input value={form.name} maxLength={50} onChange={(e) => set('name', e.target.value)} />
            </FormField>
          </div>
          <FormField label="Màu hiển thị" required error={errors.hex}>
            <div className="flex items-center gap-2">
              <input type="color" value={form.hex} onChange={(e) => set('hex', e.target.value)} aria-label="Chọn màu" className="h-10 w-14 rounded border" />
              <Input value={form.hex} onChange={(e) => set('hex', e.target.value)} className="w-32" />
            </div>
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Lưu màu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
