'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Loader2, Minus, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ProductThumb } from '@/features/products/components/ProductThumb'
import { useProduct, useProducts } from '@/features/products/hooks/use-products'
import { useProvinces } from '@/features/sales/hooks/use-provinces'
import { useDebounce } from '@/hooks/use-debounce'
import { getErrorMessage, getFieldErrors, isApiError } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { EditOrderPreview, EditOrderRequest, OrderDetailDto } from '@/types/shop'
import { useEditPreview, useOrderAction } from '../hooks/use-orders'

type EditLine = {
  variantId: string
  quantity: number
  productName: string
  label: string
  sku: string
  imageUrl?: string
  unitPrice: number
}

const MAX_QTY = 10

/**
 * Sửa đơn COD Chờ xác nhận (FR-26, BR-15, UC-08; TC-29, TC-30): đổi số lượng, thêm/bỏ biến thể, sửa người
 * nhận và địa chỉ. Mỗi thay đổi gọi `edit-preview` để hiện tổng mới, mã bị gỡ, danh sách thay đổi.
 */
export function EditOrderDialog({ order, onClose }: { order: OrderDetailDto; onClose: () => void }) {
  const [lines, setLines] = useState<EditLine[]>(() =>
    order.lines.map((l) => ({
      variantId: l.variantId,
      quantity: l.quantity,
      productName: l.productName,
      label: l.size ? `${l.colorName} / ${l.size}` : l.colorName,
      sku: l.sku,
      imageUrl: l.imageUrl,
      unitPrice: l.unitPrice,
    }))
  )
  const [info, setInfo] = useState({
    recipientName: order.recipientName,
    phone: order.phone,
    email: order.email ?? '',
    provinceCode: order.provinceCode,
    wardCode: order.wardCode,
    addressLine: order.addressLine,
  })
  // Phiên bản lúc mở hộp thoại (07 §3.6)
  const [version] = useState(order.version)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [preview, setPreview] = useState<EditOrderPreview | null>(null)
  const provinces = useProvinces()
  const wards = provinces.data?.find((p) => p.code === info.provinceCode)?.wards ?? []

  const request: EditOrderRequest = useMemo(
    () => ({
      version,
      lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
      recipientName: info.recipientName.trim(),
      phone: info.phone.trim(),
      email: info.email.trim() || undefined,
      provinceCode: info.provinceCode,
      wardCode: info.wardCode,
      addressLine: info.addressLine.trim(),
    }),
    [lines, info, version]
  )
  const debounced = useDebounce(request, 400)
  const previewMutation = useEditPreview(order.id)
  const save = useOrderAction(order.id, 'edit')
  const previewSeq = useRef(0)

  useEffect(() => {
    if (!debounced.lines.length) return
    const seq = ++previewSeq.current
    previewMutation
      .mutateAsync(debounced)
      .then((p) => {
        if (seq !== previewSeq.current) return
        setPreview(p)
        setPreviewError(null)
      })
      .catch((e) => {
        if (seq !== previewSeq.current) return
        setPreviewError(Object.keys(getFieldErrors(e)).length ? null : getErrorMessage(e))
        setFieldErrors(getFieldErrors(e))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ gọi lại khi dữ liệu sửa đổi
  }, [debounced])

  const setQty = (variantId: string, q: number) =>
    setLines((ls) => ls.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.min(MAX_QTY, Math.max(1, q)) } : l)))
  const removeLine = (variantId: string) => setLines((ls) => ls.filter((l) => l.variantId !== variantId))
  const addLine = (line: EditLine) =>
    setLines((ls) =>
      ls.some((l) => l.variantId === line.variantId)
        ? ls.map((l) => (l.variantId === line.variantId ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + 1) } : l))
        : [...ls, line]
    )
  const setField = (k: keyof typeof info, v: string) => {
    setInfo((s) => ({ ...s, [k]: v, ...(k === 'provinceCode' ? { wardCode: '' } : {}) }))
    setFieldErrors((e) => ({ ...e, [k]: '' }))
  }

  const submit = async () => {
    if (!lines.length) return setPreviewError('Đơn cần ít nhất một sản phẩm')
    try {
      await save.mutateAsync(request)
      toast.success(`Đã sửa đơn ${order.code}`)
      onClose()
    } catch (e) {
      const fields = getFieldErrors(e)
      setFieldErrors(fields)
      if (isApiError(e) && e.status === 409 && e.problem.order) {
        toast.error(getErrorMessage(e), { duration: 8000 })
        onClose()
      } else if (!Object.keys(fields).length || Object.keys(fields).some((k) => k.startsWith('lines'))) {
        setPreviewError(getErrorMessage(e))
      }
    }
  }

  const summary = preview?.summary
  return (
    <Dialog open onOpenChange={(v) => !v && !save.isPending && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Sửa đơn {order.code}</DialogTitle>
          <DialogDescription>Chỉ sửa được đơn COD đang Chờ xác nhận. Tồn kho và tiền được tính lại khi lưu.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
          <div className="space-y-5">
            <section aria-label="Sản phẩm" className="space-y-3">
              <h3 className="text-sm font-semibold">Sản phẩm</h3>
              <ul className="divide-y rounded-lg border">
                {lines.map((l) => (
                  <li key={l.variantId} className="flex items-center gap-3 p-2.5">
                    <ProductThumb url={l.imageUrl} alt={l.productName} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.productName}</p>
                      <p className="text-muted-foreground text-xs">
                        {l.label} · {l.sku} · {formatVnd(l.unitPrice)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon-sm" variant="outline" aria-label={`Giảm số lượng ${l.label}`} onClick={() => setQty(l.variantId, l.quantity - 1)} disabled={l.quantity <= 1}>
                        <Minus aria-hidden="true" />
                      </Button>
                      <Input
                        aria-label={`Số lượng ${l.label}`}
                        className="h-8 w-12 text-center tabular-nums"
                        inputMode="numeric"
                        value={l.quantity}
                        onChange={(e) => setQty(l.variantId, Number(e.target.value.replace(/\D/g, '')) || 1)}
                      />
                      <Button size="icon-sm" variant="outline" aria-label={`Tăng số lượng ${l.label}`} onClick={() => setQty(l.variantId, l.quantity + 1)} disabled={l.quantity >= MAX_QTY}>
                        <Plus aria-hidden="true" />
                      </Button>
                    </div>
                    <Button size="icon-sm" variant="ghost" aria-label={`Bỏ ${l.productName} ${l.label}`} onClick={() => removeLine(l.variantId)}>
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </li>
                ))}
                {!lines.length && <li className="text-muted-foreground p-3 text-sm">Chưa có sản phẩm.</li>}
              </ul>
              <VariantAdder onAdd={addLine} />
            </section>

            <section aria-label="Người nhận" className="grid gap-3 sm:grid-cols-2">
              <h3 className="text-sm font-semibold sm:col-span-2">Người nhận</h3>
              <FormField label="Họ tên" required error={fieldErrors.recipientName}>
                <Input value={info.recipientName} onChange={(e) => setField('recipientName', e.target.value)} />
              </FormField>
              <FormField label="Số điện thoại" required error={fieldErrors.phone}>
                <Input inputMode="tel" value={info.phone} onChange={(e) => setField('phone', e.target.value)} />
              </FormField>
              <FormField label="Email" error={fieldErrors.email} className="sm:col-span-2">
                <Input type="email" value={info.email} onChange={(e) => setField('email', e.target.value)} />
              </FormField>
              <FormField label="Tỉnh/thành" required error={fieldErrors.provinceCode}>
                <Select value={info.provinceCode} onValueChange={(v) => setField('provinceCode', v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn tỉnh/thành" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {(provinces.data ?? []).map((p) => (
                      <SelectItem key={p.code} value={p.code}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Phường/xã" required error={fieldErrors.wardCode}>
                <Select value={info.wardCode} onValueChange={(v) => setField('wardCode', v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn phường/xã" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {wards.map((w) => (
                      <SelectItem key={w.code} value={w.code}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Địa chỉ chi tiết" required error={fieldErrors.addressLine} className="sm:col-span-2">
                <Input value={info.addressLine} onChange={(e) => setField('addressLine', e.target.value)} />
              </FormField>
            </section>
          </div>

          <aside className="bg-muted/50 h-fit space-y-3 rounded-xl border p-4 text-sm" aria-live="polite">
            <h3 className="flex items-center gap-2 font-semibold">
              Xem trước
              {previewMutation.isPending && <Loader2 className="size-4 animate-spin" aria-label="Đang tính" />}
            </h3>
            {summary ? (
              <dl className="space-y-1.5">
                <SumRow label="Tạm tính" value={formatVnd(summary.subtotal)} />
                {summary.discount > 0 && <SumRow label={`Giảm giá${summary.couponCode ? ` (${summary.couponCode})` : ''}`} value={`−${formatVnd(summary.discount)}`} />}
                <SumRow label="Phí vận chuyển" value={formatVnd(summary.shippingFee)} />
                <SumRow label="Tổng" value={formatVnd(summary.total)} strong />
                <SumRow label="Trước khi sửa" value={formatVnd(order.total)} muted />
              </dl>
            ) : (
              <p className="text-muted-foreground">Đang tính…</p>
            )}
            {preview?.couponRemoved && (
              <Alert className="border-warning/40 bg-warning/10">
                <AlertDescription>{preview.couponMessage ?? 'Mã giảm giá bị gỡ'}</AlertDescription>
              </Alert>
            )}
            {preview && preview.changes.length > 0 && (
              <div>
                <p className="mb-1 font-medium">Thay đổi</p>
                <ul className="list-disc space-y-0.5 pl-4">
                  {preview.changes.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            {previewError && (
              <p role="alert" className="text-destructive flex items-start gap-1.5">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {previewError}
              </p>
            )}
          </aside>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Đóng
          </Button>
          <Button onClick={submit} disabled={save.isPending || !lines.length}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SumRow({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-3', strong && 'border-t pt-1.5 text-base font-bold', muted && 'text-muted-foreground')}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}

/** Tìm sản phẩm theo tên, mã, SKU rồi chọn biến thể đang bật còn hàng */
function VariantAdder({ onAdd }: { onAdd: (l: EditLine) => void }) {
  const [text, setText] = useState('')
  const [productId, setProductId] = useState<string>()
  const search = useDebounce(text.trim(), 300)
  const products = useProducts({ search, pageSize: 6, page: 1 }, search.length >= 2)
  const product = useProduct(productId)

  return (
    <div className="space-y-2 rounded-lg border border-dashed p-3">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden="true" />
        <Input
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setProductId(undefined)
          }}
          placeholder="Thêm sản phẩm: gõ tên, mã hoặc SKU"
          aria-label="Tìm sản phẩm để thêm"
          className="pl-9"
        />
      </div>
      {search.length >= 2 && !productId && (
        <ul className="max-h-52 overflow-auto">
          {(products.data?.items ?? []).map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setProductId(p.id)}
                className="hover:bg-muted flex w-full items-center gap-2 rounded-md p-1.5 text-left text-sm"
              >
                <ProductThumb url={p.coverUrl} alt={p.name} className="w-8" />
                <span className="flex-1 truncate">
                  {p.name} <span className="text-muted-foreground">· {p.code}</span>
                </span>
                <span className="tabular-nums">{formatVnd(p.price)}</span>
              </button>
            </li>
          ))}
          {products.data && !products.data.items.length && <li className="text-muted-foreground p-1.5 text-sm">Không có sản phẩm phù hợp</li>}
        </ul>
      )}
      {productId && product.data && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{product.data.name} — chọn mẫu:</p>
          <div className="flex flex-wrap gap-1.5">
            {product.data.variants
              .filter((v) => v.isActive)
              .map((v) => (
                <Button
                  key={v.id}
                  size="sm"
                  variant="outline"
                  className={cn(v.stock <= 0 && 'text-muted-foreground')}
                  onClick={() => {
                    onAdd({
                      variantId: v.id,
                      quantity: 1,
                      productName: product.data!.name,
                      label: v.size ? `${v.colorName} / ${v.size}` : v.colorName,
                      sku: v.sku,
                      imageUrl: product.data!.coverUrl,
                      unitPrice: product.data!.price,
                    })
                    setText('')
                    setProductId(undefined)
                  }}
                >
                  {v.size ? `${v.colorName} / ${v.size}` : v.colorName}
                  <span className="text-muted-foreground text-xs">{v.stock > 0 ? `(còn ${v.stock})` : '(hết)'}</span>
                </Button>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
