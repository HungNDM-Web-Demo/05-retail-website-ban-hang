'use client'

import { useState } from 'react'
import { History, Loader2, PackagePlus, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { stockAdjustReasonLabels, stockStatusLabels } from '@/config/shop-labels'
import { skuOf } from '@/features/sales/lib/stock'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { formatDateTime } from '@/lib/format'
import type { ColorDto, ProductDto, ProductVariantDto, StockAdjustReason, StockStatus } from '@/types/shop'
import { useAdjustStock, useStockAdjustments } from '../hooks/use-products'
import type { ProductFormValues } from '../schemas/product.schema'

const tone: Record<StockStatus, 'success' | 'warning' | 'danger'> = { ConHang: 'success', SapHet: 'warning', HetHang: 'danger' }

/**
 * Lưới biến thể màu × size (FR-18, 07 §3.12): SKU, tồn (ô nhập cho biến thể mới, "Điền cùng số tồn"),
 * công tắc bật/tắt; biến thể đã có: "Điều chỉnh tồn" (FR-20, BR-27) và lịch sử tồn.
 */
export function VariantGrid({
  code,
  colors,
  variants,
  onChange,
  product,
  readOnly,
  canAdjust,
  error,
}: {
  code: string
  colors: ColorDto[]
  variants: ProductFormValues['variants']
  onChange: (v: ProductFormValues['variants']) => void
  product?: ProductDto
  readOnly?: boolean
  canAdjust?: boolean
  error?: string
}) {
  const [fill, setFill] = useState('')
  const [adjusting, setAdjusting] = useState<ProductVariantDto | null>(null)
  const [history, setHistory] = useState(false)
  const colorOf = (id: string) => colors.find((c) => c.id === id)
  const existing = (colorId: string, size?: string) =>
    product?.variants.find((v) => v.colorId === colorId && (v.size ?? '') === (size ?? ''))
  const hasNew = variants.some((v) => !existing(v.colorId, v.size))

  const update = (i: number, patch: Partial<ProductFormValues['variants'][number]>) =>
    onChange(variants.map((v, idx) => (idx === i ? { ...v, ...patch } : v)))

  if (!variants.length) return <p className="text-muted-foreground text-sm">Chọn màu (và size) để sinh biến thể.</p>

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-muted-foreground mr-auto text-sm">
          {variants.length} biến thể · {variants.filter((v) => v.isActive).length} đang bật
        </p>
        {!readOnly && hasNew && (
          <div className="flex items-center gap-2">
            <Input
              aria-label="Số tồn điền cho biến thể mới"
              inputMode="numeric"
              value={fill}
              onChange={(e) => setFill(e.target.value.replace(/\D/g, ''))}
              placeholder="Tồn"
              className="w-24"
            />
            <Button
              type="button"
              variant="outline"
              disabled={!fill}
              onClick={() => onChange(variants.map((v) => (existing(v.colorId, v.size) ? v : { ...v, initialStock: Number(fill) })))}
            >
              <PackagePlus aria-hidden="true" />
              Điền cùng số tồn
            </Button>
          </div>
        )}
        {product && (
          <Button type="button" variant="outline" onClick={() => setHistory(true)}>
            <History aria-hidden="true" />
            Lịch sử tồn
          </Button>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table className="min-w-[640px]">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Màu</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Tồn</TableHead>
              <TableHead>Bán</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {variants.map((v, i) => {
              const color = colorOf(v.colorId)
              const old = existing(v.colorId, v.size)
              return (
                <TableRow key={`${v.colorId}|${v.size ?? ''}`} className={v.isActive ? '' : 'text-muted-foreground'}>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <span className="size-3.5 rounded-full border" style={{ backgroundColor: color?.hex }} aria-hidden="true" />
                      {color?.name ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums">{v.size ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {old?.sku ?? (code && color ? skuOf(code, color.code, v.size) : '—')}
                    {!old && <span className="text-primary ml-1.5 font-sans text-[0.6875rem] font-semibold">MỚI</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {old ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="font-semibold tabular-nums">{old.stock}</span>
                        <StatusBadge tone={tone[old.stockStatus]} dot={false} className="h-5 px-2 text-[0.6875rem]">
                          {stockStatusLabels[old.stockStatus]}
                        </StatusBadge>
                      </span>
                    ) : readOnly ? (
                      '—'
                    ) : (
                      <Input
                        aria-label={`Tồn ban đầu ${color?.name ?? ''} ${v.size ?? ''}`}
                        inputMode="numeric"
                        value={v.initialStock ?? ''}
                        onChange={(e) => {
                          const d = e.target.value.replace(/\D/g, '')
                          update(i, { initialStock: d ? Number(d) : undefined })
                        }}
                        placeholder="0"
                        className="ml-auto h-8 w-20 text-right tabular-nums"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <Switch
                        size="sm"
                        checked={v.isActive}
                        disabled={readOnly}
                        onCheckedChange={(on) => update(i, { isActive: on })}
                        aria-label={`Bật bán ${color?.name ?? ''} ${v.size ?? ''}`}
                      />
                      {v.isActive ? 'Bật' : 'Tắt'}
                    </label>
                  </TableCell>
                  <TableCell>
                    {old && canAdjust && (
                      <Button type="button" size="sm" variant="ghost" onClick={() => setAdjusting(old)}>
                        <SlidersHorizontal aria-hidden="true" />
                        Điều chỉnh tồn
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-[0.8125rem]">
          {error}
        </p>
      )}
      {adjusting && product && <StockAdjustDialog productId={product.id} variant={adjusting} onClose={() => setAdjusting(null)} />}
      {history && product && <StockHistoryDialog productId={product.id} onClose={() => setHistory(false)} />}
    </div>
  )
}

/** Điều chỉnh tồn (FR-20, BR-27, TC-24): tồn mới nguyên ≥ 0, lý do bắt buộc */
function StockAdjustDialog({ productId, variant, onClose }: { productId: string; variant: ProductVariantDto; onClose: () => void }) {
  const [stock, setStock] = useState(String(variant.stock))
  const [reason, setReason] = useState<StockAdjustReason>()
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const adjust = useAdjustStock()
  const label = variant.size ? `${variant.colorName} / ${variant.size}` : variant.colorName
  const submit = async () => {
    const errs: Record<string, string> = {}
    const n = Number(stock)
    if (stock.trim() === '' || !Number.isInteger(n) || n < 0) errs.newStock = 'Tồn mới là số nguyên từ 0'
    if (!reason) errs.reason = 'Chọn lý do'
    if (reason === 'Khac' && !note.trim()) errs.note = 'Nhập ghi chú cho lý do Khác'
    if (Object.keys(errs).length) return setErrors(errs)
    try {
      await adjust.mutateAsync({ id: productId, variantId: variant.id, body: { newStock: n, reason: reason!, note: note.trim() || undefined } })
      toast.success(`Đã chỉnh tồn ${variant.sku}: ${variant.stock} → ${n}`)
      onClose()
    } catch (e) {
      const f = getFieldErrors(e)
      if (Object.keys(f).length) setErrors(f)
      else toast.error(getErrorMessage(e))
    }
  }
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Điều chỉnh tồn {label}</DialogTitle>
          <DialogDescription>
            {variant.sku} · tồn hiện tại {variant.stock}. Lịch sử ghi lại người chỉnh và lý do.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <FormField label="Tồn mới" required error={errors.newStock}>
            <Input
              value={stock}
              inputMode="numeric"
              autoFocus
              onChange={(e) => {
                setStock(e.target.value)
                setErrors((x) => ({ ...x, newStock: '' }))
              }}
              className="w-32 tabular-nums"
            />
          </FormField>
          <div className="grid gap-1.5">
            <p className="text-sm font-medium">
              Lý do <span className="text-destructive">*</span>
            </p>
            <RadioGroup value={reason ?? ''} onValueChange={(v) => setReason(v as StockAdjustReason)} className="grid grid-cols-2 gap-2" aria-label="Lý do điều chỉnh">
              {(Object.keys(stockAdjustReasonLabels) as StockAdjustReason[]).map((r) => (
                <Label key={r} htmlFor={`adj-${r}`} className="has-[[data-state=checked]]:border-primary hover:bg-muted flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 font-normal">
                  <RadioGroupItem id={`adj-${r}`} value={r} />
                  {stockAdjustReasonLabels[r]}
                </Label>
              ))}
            </RadioGroup>
            {errors.reason && (
              <p role="alert" className="text-destructive text-[0.8125rem]">
                {errors.reason}
              </p>
            )}
          </div>
          <FormField label="Ghi chú" required={reason === 'Khac'} error={errors.note}>
            <Textarea value={note} rows={2} maxLength={500} onChange={(e) => setNote(e.target.value)} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={adjust.isPending}>
              {adjust.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Lưu tồn
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function StockHistoryDialog({ productId, onClose }: { productId: string; onClose: () => void }) {
  const list = useStockAdjustments(productId)
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Lịch sử điều chỉnh tồn</DialogTitle>
          <DialogDescription>Mới nhất trên cùng.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto">
          {!list.data ? (
            <Skeleton className="h-40" />
          ) : !list.data.length ? (
            <p className="text-muted-foreground py-6 text-center text-sm">Chưa có lần điều chỉnh nào.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời điểm</TableHead>
                  <TableHead>Biến thể</TableHead>
                  <TableHead className="text-right">Tồn</TableHead>
                  <TableHead>Lý do</TableHead>
                  <TableHead>Người chỉnh</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="tabular-nums">{formatDateTime(a.at)}</TableCell>
                    <TableCell className="font-mono text-xs">{a.sku}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {a.before} → <b>{a.after}</b>
                    </TableCell>
                    <TableCell>
                      {stockAdjustReasonLabels[a.reason]}
                      {a.note && <span className="text-muted-foreground block text-xs">{a.note}</span>}
                    </TableCell>
                    <TableCell>{a.byName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
