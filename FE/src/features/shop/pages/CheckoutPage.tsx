'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Banknote, Landmark, Loader2, TicketPercent, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { paymentMethodLabels } from '@/config/shop-labels'
import { routePath } from '@/config/route-path'
import { getFieldErrors, getErrorMessage, isApiError } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CouponType, PaymentMethod, PlaceOrderRequest } from '@/types/shop'
import { ProductImage } from '@/features/sales/components/ProductImage'
import { ProvinceWardSelect } from '@/features/sales/components/ProvinceWardSelect'
import { useProvinces } from '@/features/sales/hooks/use-provinces'
import { normalizePhone } from '@/features/sales/lib/order-rules'
import { lineTotalOf, priceOrder } from '@/features/sales/lib/pricing'
import { SalesRules } from '@/features/sales/lib/rules'
import { FreeShipBar } from '../components/FreeShipBar'
import { useCartCheck, useCheckoutQuote, usePlaceOrder } from '../hooks/use-shop'
import { cartStore, useCart } from '../lib/cart-storage'
import { shopStorage } from '../lib/shop-storage'

type Form = {
  fullName: string
  phone: string
  email: string
  provinceCode: string
  wardCode: string
  addressLine: string
  note: string
}
type FieldKey = keyof Form | 'paymentMethod'

const EMPTY: Form = { fullName: '', phone: '', email: '', provinceCode: '', wardCode: '', addressLine: '', note: '' }

/** Kiểm tại chỗ theo BR-07 (BE kiểm lại cùng câu) */
function validate(f: Form): Partial<Record<FieldKey, string>> {
  const e: Partial<Record<FieldKey, string>> = {}
  const name = f.fullName.trim()
  if (name.length < 2 || name.length > 100) e.fullName = 'Họ tên từ 2 đến 100 ký tự'
  if (!SalesRules.phonePattern.test(normalizePhone(f.phone))) e.phone = 'Số điện thoại không hợp lệ'
  if (f.email.trim() && !SalesRules.emailPattern.test(f.email.trim())) e.email = 'Email chưa đúng định dạng'
  if (!f.provinceCode) e.provinceCode = 'Vui lòng chọn tỉnh/thành'
  if (!f.wardCode) e.wardCode = 'Vui lòng chọn phường/xã'
  const addr = f.addressLine.trim()
  if (addr.length < 5 || addr.length > 200) e.addressLine = 'Địa chỉ chi tiết từ 5 đến 200 ký tự'
  if (f.note.length > 500) e.note = 'Ghi chú tối đa 500 ký tự'
  return e
}

const newRequestId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)

type Applied = { code: string; type: CouponType; discount: number; description?: string }

/**
 * Thanh toán một trang (SCR-05, UC-04, NFR-03): thông tin giao hàng, phương thức, mã giảm giá, tóm tắt.
 * Tính tại chỗ bằng `pricing.ts`; "Áp dụng" mã gọi `checkout/quote`. Xử lý lỗi đặt hàng theo 07 §4.3.
 */
export function CheckoutPage() {
  const router = useRouter()
  const cart = useCart()
  const { data: provinces } = useProvinces()
  const inputs = useMemo(() => cart.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, price: l.price })), [cart.lines])
  const check = useCartCheck(inputs)
  const quote = useCheckoutQuote()
  const place = usePlaceOrder()

  const [form, setForm] = useState<Form>(EMPTY)
  const [method, setMethod] = useState<PaymentMethod>('Cod')
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [couponInput, setCouponInput] = useState('')
  const [couponError, setCouponError] = useState<string | null>(null)
  const [applied, setApplied] = useState<Applied | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const done = useRef(false)

  // Điền sẵn thông tin giao hàng lần trước
  useEffect(() => {
    const saved = shopStorage.shipping()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- đọc localStorage một lần sau khi gắn
    if (saved) setForm({ ...EMPTY, ...Object.fromEntries(Object.entries(saved).filter(([k]) => k in EMPTY)) } as Form)
    if (saved?.paymentMethod) setMethod(saved.paymentMethod)
  }, [])

  // Mã yêu cầu duy nhất (07 §3.7): đổi khi giỏ, thông tin giao hàng, phương thức hoặc mã đổi
  const fingerprint = JSON.stringify([inputs, form, method, applied?.code ?? ''])
  // Giữ trong ref (không chờ render lại): hai lần bấm liền nhau dùng chung mã, lần sau bị chặn khi đang gửi (TC-18)
  const requestId = useRef<{ fp: string; id: string }>({ fp: '', id: '' })
  const submitting = useRef(false)

  // Giỏ trống (và chưa đặt xong) → về giỏ; dòng có vấn đề chặn → về giỏ
  useEffect(() => {
    if (done.current) return
    // Đọc thẳng localStorage: lần render đầu (hydrate) giỏ còn rỗng
    if (cartStore.get().lines.length === 0) router.replace(routePath.cart)
    else if (check.data && !check.data.canCheckout) {
      toast.error('Giỏ hàng có sản phẩm cần xử lý trước khi đặt')
      router.replace(routePath.cart)
    }
  }, [cart.lines.length, check.data, router])

  const province = provinces?.find((p) => p.code === form.provinceCode)
  const lines = check.data?.lines ?? []
  const summary = priceOrder({
    lines: lines.map((l) => ({ lineTotal: lineTotalOf(l.price, l.quantity) })),
    zone: province?.zone,
    coupon: applied,
  })

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase()
    if (!code) return
    setCouponError(null)
    try {
      const res = await quote.mutateAsync({ lines: inputs, provinceCode: form.provinceCode || undefined, couponCode: code })
      if (res.coupon?.ok) {
        const type: CouponType = res.coupon.discount === 0 ? 'MienPhiVanChuyen' : 'SoTien'
        setApplied({ code: res.coupon.code, type, discount: res.coupon.discount, description: res.coupon.description })
        setCouponInput('')
      } else {
        setApplied(null)
        setCouponError(res.coupon?.message ?? 'Mã không dùng được')
      }
    } catch (error) {
      setCouponError(getErrorMessage(error))
    }
  }

  const submit = async () => {
    if (submitting.current) return
    setBanner(null)
    const local = validate(form)
    if (Object.keys(local).length) {
      setErrors(local)
      const first = Object.keys(local)[0]
      document.getElementById(`co-${first}`)?.focus()
      return
    }
    if (requestId.current.fp !== fingerprint || !requestId.current.id)
      requestId.current = { fp: fingerprint, id: newRequestId() }
    const id = requestId.current.id
    submitting.current = true
    const req: PlaceOrderRequest = {
      clientRequestId: id,
      lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, expectedPrice: l.price })),
      shipping: {
        fullName: form.fullName.trim(),
        phone: normalizePhone(form.phone),
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
        provinceCode: form.provinceCode,
        wardCode: form.wardCode,
        addressLine: form.addressLine.trim(),
        ...(form.note.trim() ? { note: form.note.trim() } : {}),
      },
      paymentMethod: method,
      ...(applied ? { couponCode: applied.code } : {}),
    }
    try {
      const result = await place.mutateAsync(req)
      done.current = true
      shopStorage.saveLastOrder(result)
      shopStorage.addMyOrder(result.order.code, req.shipping.phone)
      shopStorage.saveShipping({ ...req.shipping, paymentMethod: method })
      cartStore.clear()
      router.push(`${routePath.checkoutSuccess}?code=${result.order.code}`)
    } catch (error) {
      submitting.current = false
      // Lỗi nghiệp vụ: lần bấm sau dùng mã yêu cầu mới (07 §3.7)
      requestId.current = { fp: '', id: '' }
      if (!isApiError(error)) {
        toast.error(getErrorMessage(error))
        return
      }
      const code = error.problem.code as string | undefined
      const detail = error.problem.detail ?? getErrorMessage(error)
      if (code === 'KhongDuTon' || code === 'SanPhamNgungBan') {
        toast.error(detail)
        router.push(routePath.cart)
        return
      }
      if (code === 'GiaDaThayDoi') {
        const changes = (error.problem.priceChanges as { variantId: string; newPrice: number }[] | undefined) ?? []
        cartStore.updatePrices(changes.map((c) => ({ variantId: c.variantId, price: c.newPrice })))
        setBanner(detail)
        return
      }
      if (code && (code.startsWith('Ma') || code === 'SdtDaDungMa' || code === 'ChuaDatToiThieu' || code === 'DaMienPhiVanChuyen')) {
        // Gỡ mã, tính lại, chờ khách bấm lại (TC-14)
        setApplied(null)
        setCouponError(detail)
        setBanner(detail)
        return
      }
      const fields = getFieldErrors(error)
      const mapped: Partial<Record<FieldKey, string>> = {}
      for (const [k, v] of Object.entries(fields)) {
        const key = k.replace(/^shipping\./, '') as FieldKey
        // Chỉ gắn lỗi vào ô có trên form; khóa khác (dòng giỏ, khóa rỗng khi body sai) → toast
        if (key in form || key === 'paymentMethod') mapped[key] = v
      }
      if (Object.keys(mapped).length) setErrors(mapped)
      else toast.error(detail)
    }
  }

  const field = (key: keyof Form, label: string, props: React.ComponentProps<typeof Input> = {}, required = true) => (
    <div className="grid gap-1.5">
      <label htmlFor={`co-${key}`} className="text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <Input
        id={`co-${key}`}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        aria-invalid={!!errors[key] || undefined}
        className="h-11 text-base sm:text-sm"
        {...props}
      />
      {errors[key] && <p className="text-sm text-destructive">{errors[key]}</p>}
    </div>
  )

  const busy = place.isPending

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
      <h1 className="mb-4 text-2xl font-bold">Thanh toán</h1>
      {banner && (
        <div role="alert" className="mb-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm font-medium text-warning">
          {banner}. Vui lòng kiểm tra rồi bấm “Đặt hàng” lần nữa.
        </div>
      )}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className="grid gap-6 lg:grid-cols-[1fr_360px]"
      >
        <div className="space-y-6">
          <section className="space-y-4 rounded-xl border bg-card p-4" aria-labelledby="co-shipping">
            <h2 id="co-shipping" className="font-semibold">
              Thông tin giao hàng
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {field('fullName', 'Họ tên', { autoComplete: 'name' })}
              {field('phone', 'Số điện thoại', { type: 'tel', inputMode: 'tel', autoComplete: 'tel' })}
            </div>
            {field('email', 'Email (nhận xác nhận đơn)', { type: 'email', inputMode: 'email', autoComplete: 'email' }, false)}
            <ProvinceWardSelect
              provinceId="co-provinceCode"
              wardId="co-wardCode"
              provinceCode={form.provinceCode}
              wardCode={form.wardCode}
              provinceError={errors.provinceCode}
              wardError={errors.wardCode}
              onChange={(v) => {
                setForm((f) => ({ ...f, provinceCode: v.provinceCode, wardCode: v.wardCode }))
                setErrors((e) => ({ ...e, provinceCode: undefined, wardCode: undefined }))
              }}
            />
            {field('addressLine', 'Địa chỉ chi tiết', { autoComplete: 'street-address', placeholder: 'Số nhà, tên đường' })}
            <div className="grid gap-1.5">
              <label htmlFor="co-note" className="text-sm font-medium">
                Ghi chú cho shop
              </label>
              <Textarea id="co-note" value={form.note} onChange={(e) => set('note', e.target.value)} rows={2} maxLength={500} placeholder="Ví dụ: giao giờ hành chính" />
              {errors.note && <p className="text-sm text-destructive">{errors.note}</p>}
            </div>
          </section>

          <section className="space-y-3 rounded-xl border bg-card p-4" aria-labelledby="co-method">
            <h2 id="co-method" className="font-semibold">
              Phương thức thanh toán
            </h2>
            <div role="radiogroup" aria-labelledby="co-method" className="grid gap-2">
              {(['Cod', 'ChuyenKhoan'] as PaymentMethod[]).map((m) => {
                const Icon = m === 'Cod' ? Banknote : Landmark
                const on = method === m
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setMethod(m)}
                    className={cn('flex min-h-14 items-center gap-3 rounded-lg border p-3 text-left transition-colors', on ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-accent')}
                  >
                    <span className={cn('flex size-5 items-center justify-center rounded-full border-2', on ? 'border-primary' : 'border-input')}>
                      {on && <span className="size-2.5 rounded-full bg-primary" />}
                    </span>
                    <Icon className="size-5 text-muted-foreground" />
                    <span className="flex-1">
                      <span className="block text-sm font-medium">{paymentMethodLabels[m]}</span>
                      <span className="block text-xs text-muted-foreground">
                        {m === 'Cod' ? 'Kiểm tra hàng rồi trả tiền cho shipper' : 'Quét QR sau khi đặt, giữ đơn trong 24 giờ'}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        </div>

        <aside className="h-fit space-y-4 rounded-xl border bg-card p-4 lg:sticky lg:top-24" aria-labelledby="co-summary">
          <h2 id="co-summary" className="font-semibold">
            Đơn hàng ({lines.length} sản phẩm)
          </h2>
          <ul className="max-h-72 space-y-3 overflow-y-auto">
            {lines.map((l) => (
              <li key={l.variantId} className="flex gap-3">
                <div className="relative w-14 shrink-0">
                  <ProductImage src={l.imageUrl} alt={l.productName} className="rounded-md" />
                  <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">
                    {l.quantity}
                  </span>
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="line-clamp-1 font-medium">{l.productName}</p>
                  <p className="text-muted-foreground">
                    {l.colorName}
                    {l.size ? ` / ${l.size}` : ''}
                  </p>
                </div>
                <p className="text-sm font-medium tabular-nums">{formatVnd(l.lineTotal)}</p>
              </li>
            ))}
          </ul>

          <div className="space-y-2 border-t pt-4">
            {applied ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-success/40 bg-success/5 p-2.5 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <TicketPercent className="size-4 shrink-0 text-success" />
                  <span className="min-w-0">
                    <span className="font-semibold">{applied.code}</span>
                    {applied.description && <span className="block truncate text-xs text-muted-foreground">{applied.description}</span>}
                  </span>
                </span>
                <Button type="button" variant="ghost" size="sm" className="h-9" onClick={() => setApplied(null)}>
                  <X className="size-4" />
                  Gỡ
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <label htmlFor="co-coupon" className="sr-only">
                  Mã giảm giá
                </label>
                <Input
                  id="co-coupon"
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value.toUpperCase())
                    setCouponError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void applyCoupon()
                    }
                  }}
                  placeholder="Mã giảm giá"
                  autoCapitalize="characters"
                  className="h-11 uppercase"
                  aria-invalid={!!couponError || undefined}
                />
                <Button type="button" variant="outline" className="h-11" disabled={!couponInput.trim() || quote.isPending} onClick={() => void applyCoupon()}>
                  {quote.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Áp dụng'}
                </Button>
              </div>
            )}
            {couponError && <p className="text-sm text-destructive">{couponError}</p>}
          </div>

          <dl className="space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between">
              <dt>Tạm tính</dt>
              <dd className="tabular-nums">{formatVnd(summary.subtotal)}</dd>
            </div>
            {summary.discount > 0 && (
              <div className="flex justify-between text-success">
                <dt>Giảm giá ({summary.couponCode})</dt>
                <dd className="tabular-nums">−{formatVnd(summary.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt>Phí vận chuyển</dt>
              <dd className="tabular-nums">
                {!province ? (
                  <span className="text-muted-foreground">Chọn tỉnh/thành để tính phí</span>
                ) : summary.shippingDiscount > 0 ? (
                  <>
                    <span className="mr-1.5 text-muted-foreground line-through">{formatVnd(summary.shippingDiscount)}</span>
                    {formatVnd(0)}
                  </>
                ) : (
                  formatVnd(summary.shippingFee)
                )}
              </dd>
            </div>
            <div className="flex justify-between border-t pt-2 text-base font-bold">
              <dt>Tổng thanh toán</dt>
              <dd className="text-primary tabular-nums">{formatVnd(summary.total)}</dd>
            </div>
          </dl>
          <FreeShipBar remaining={summary.freeShipRemaining} />
          <Button type="submit" size="lg" className="hidden h-12 w-full lg:flex" disabled={busy || !check.data}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Đặt hàng
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Không cần tạo tài khoản. <Link href={routePath.cart} className="text-primary hover:underline">Sửa giỏ hàng</Link>
          </p>
        </aside>

        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Tổng thanh toán</p>
              <p className="text-lg font-bold text-primary tabular-nums">{formatVnd(summary.total)}</p>
            </div>
            <Button type="submit" size="lg" className="h-12 flex-1" disabled={busy || !check.data}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Đặt hàng
            </Button>
          </div>
        </div>
        <div className="h-16 lg:hidden" aria-hidden="true" />
      </form>
    </div>
  )
}
