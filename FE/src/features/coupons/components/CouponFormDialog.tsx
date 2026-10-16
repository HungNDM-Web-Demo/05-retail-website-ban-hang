'use client'

import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { couponTypeLabels } from '@/config/shop-labels'
import { MoneyInput } from '@/features/products/components/MoneyInput'
import { useCategories } from '@/features/products/hooks/use-products'
import { applyFieldErrors, getErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import type { CouponDto, CouponType } from '@/types/shop'
import { useSaveCoupon } from '../hooks/use-coupons'
import { couponSchema, couponToForm, formToCouponRequest, type CouponFormInput, type CouponFormOutput } from '../schemas/coupon.schema'

const ALL = '__all'
const intOrUndef = (v: string) => (v.replace(/\D/g, '') ? Number(v.replace(/\D/g, '')) : undefined)

/** Thêm, sửa mã (FR-32, BR-26; TC-41). Mã đã có lượt dùng thì khóa mã, kiểu, phạm vi */
export function CouponFormDialog({ coupon, onClose }: { coupon?: CouponDto; onClose: () => void }) {
  const categories = useCategories()
  const save = useSaveCoupon()
  const locked = !!coupon && !coupon.canDelete
  const form = useForm<CouponFormInput, unknown, CouponFormOutput>({
    resolver: zodResolver(couponSchema),
    defaultValues: couponToForm(coupon),
  })
  const { control, register, handleSubmit, formState, setError } = form
  const errors = formState.errors
  const type = useWatch({ control, name: 'type' })

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({ id: coupon?.id, body: formToCouponRequest(values) })
      toast.success(coupon ? `Đã lưu mã ${saved.code}` : `Đã thêm mã ${saved.code}`)
      onClose()
    } catch (e) {
      if (!applyFieldErrors(setError, e)) toast.error(getErrorMessage(e))
    }
  })

  return (
    <Dialog open onOpenChange={(v) => !v && !save.isPending && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{coupon ? `Sửa mã ${coupon.code}` : 'Thêm mã giảm giá'}</DialogTitle>
          <DialogDescription>
            {locked ? 'Mã đã có lượt dùng: không đổi được mã, kiểu và phạm vi.' : 'Khách nhập mã không phân biệt hoa thường.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <FormField label="Mã" required error={errors.code?.message} hint="4–20 chữ in hoa và số, vd SALE1111">
            <Input {...register('code')} className="uppercase" maxLength={20} disabled={locked} autoFocus={!coupon} />
          </FormField>
          <FormField label="Tên hiển thị" required error={errors.name?.message}>
            <Input {...register('name')} maxLength={200} placeholder="Giảm 15% đợt sale 11.11" />
          </FormField>

          <div className="grid gap-1.5 sm:col-span-2">
            <p className="text-sm font-medium">
              Kiểu mã <span className="text-destructive">*</span>
            </p>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <div role="radiogroup" aria-label="Kiểu mã" className="grid gap-2 sm:grid-cols-3">
                  {(Object.keys(couponTypeLabels) as CouponType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={field.value === t}
                      disabled={locked}
                      onClick={() => field.onChange(t)}
                      className={cn(
                        'focus-visible:ring-ring/50 min-h-11 rounded-lg border px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 disabled:opacity-60',
                        field.value === t ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'
                      )}
                    >
                      {couponTypeLabels[t]}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          {type === 'PhanTram' && (
            <>
              <FormField label="Phần trăm giảm" htmlFor="coupon-value" required error={errors.value?.message} hint="1–50%">
                <Controller
                  control={control}
                  name="value"
                  render={({ field }) => (
                    <div className="relative">
                      <Input id="coupon-value" inputMode="numeric" value={field.value ?? ''} onChange={(e) => field.onChange(intOrUndef(e.target.value))} className="pr-8 text-right tabular-nums" />
                      <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-sm">%</span>
                    </div>
                  )}
                />
              </FormField>
              <FormField label="Giảm tối đa" htmlFor="coupon-max" required error={errors.maxDiscount?.message}>
                <Controller control={control} name="maxDiscount" render={({ field }) => <MoneyInput id="coupon-max" value={field.value} onChange={field.onChange} />} />
              </FormField>
            </>
          )}
          {type === 'SoTien' && (
            <FormField label="Số tiền giảm" htmlFor="coupon-amount" required error={errors.value?.message}>
              <Controller control={control} name="value" render={({ field }) => <MoneyInput id="coupon-amount" value={field.value} onChange={field.onChange} />} />
            </FormField>
          )}

          <FormField label="Đơn tối thiểu" htmlFor="coupon-min" required error={errors.minOrder?.message} hint="Tính trên tiền hàng thuộc phạm vi mã">
            <Controller control={control} name="minOrder" render={({ field }) => <MoneyInput id="coupon-min" value={field.value} onChange={(v) => field.onChange(v ?? 0)} />} />
          </FormField>
          <FormField label="Phạm vi" htmlFor="coupon-scope" error={errors.categoryId?.message}>
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Select value={field.value ?? ALL} onValueChange={(v) => field.onChange(v === ALL ? undefined : v)} disabled={locked}>
                  <SelectTrigger id="coupon-scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Toàn shop</SelectItem>
                    {(categories.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        Danh mục {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField label="Tổng lượt" htmlFor="coupon-total" error={errors.totalLimit?.message} hint="Để trống: không giới hạn">
            <Controller
              control={control}
              name="totalLimit"
              render={({ field }) => <Input id="coupon-total" inputMode="numeric" value={field.value ?? ''} onChange={(e) => field.onChange(intOrUndef(e.target.value))} />}
            />
          </FormField>
          <FormField label="Lượt mỗi số điện thoại" htmlFor="coupon-per" required error={errors.perCustomerLimit?.message}>
            <Controller
              control={control}
              name="perCustomerLimit"
              render={({ field }) => <Input id="coupon-per" inputMode="numeric" value={field.value ?? ''} onChange={(e) => field.onChange(intOrUndef(e.target.value))} />}
            />
          </FormField>
          <FormField label="Bắt đầu" required error={errors.startAt?.message}>
            <Input type="datetime-local" {...register('startAt')} />
          </FormField>
          <FormField label="Kết thúc" required error={errors.endAt?.message}>
            <Input type="datetime-local" {...register('endAt')} />
          </FormField>

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
              Hủy
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Lưu mã
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
