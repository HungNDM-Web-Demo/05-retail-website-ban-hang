'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, PackageSearch, Truck, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { carrierLabels, paymentMethodShortLabels, publicCancelReasonLabels } from '@/config/shop-labels'
import { getErrorMessage, isApiError } from '@/lib/api-error'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CancelReason, OrderLookupRequest, PublicOrderView } from '@/types/shop'
import { OrderStatusBadge } from '@/features/sales/components/OrderStatusBadge'
import { PaymentStatusBadge } from '@/features/sales/components/PaymentStatusBadge'
import { TransferQr } from '@/features/sales/components/TransferQr'
import { normalizePhone } from '@/features/sales/lib/order-rules'
import { OrderLinesSummary } from '../components/OrderLinesSummary'
import { useCancelOrder, useLookupOrder, useStoreInfo, useTrackedOrder } from '../hooks/use-shop'
import { shopStorage } from '../lib/shop-storage'

const REASONS = Object.entries(publicCancelReasonLabels) as [CancelReason, string][]

function CancelDialog({ view, phone, open, onOpenChange }: { view: PublicOrderView; phone: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const cancel = useCancelOrder()
  const [reason, setReason] = useState<CancelReason | null>(null)
  const [note, setNote] = useState('')
  const needNote = reason === 'Khac' && !note.trim()
  const submit = async () => {
    if (!reason || needNote) return
    try {
      await cancel.mutateAsync({ code: view.code, req: { phone, reason, ...(note.trim() ? { note: note.trim() } : {}) } })
      toast.success(`Đã hủy đơn ${view.code}`)
      onOpenChange(false)
    } catch (error) {
      toast.error(getErrorMessage(error))
      onOpenChange(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Hủy đơn {view.code}?</DialogTitle>
          <DialogDescription>Chọn lý do để shop phục vụ tốt hơn. Đơn đã hủy không khôi phục được.</DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="Lý do hủy" className="grid gap-2">
          {REASONS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={reason === value}
              onClick={() => setReason(value)}
              className={cn('flex min-h-11 items-center gap-3 rounded-lg border px-3 text-left text-sm', reason === value ? 'border-primary bg-primary/5 font-medium' : 'hover:bg-accent')}
            >
              <span className={cn('flex size-5 items-center justify-center rounded-full border-2', reason === value ? 'border-primary' : 'border-input')}>
                {reason === value && <span className="size-2.5 rounded-full bg-primary" />}
              </span>
              {label}
            </button>
          ))}
        </div>
        {reason === 'Khac' && (
          <div className="grid gap-1.5">
            <label htmlFor="cancel-note" className="text-sm font-medium">
              Ghi chú <span className="text-destructive">*</span>
            </label>
            <Textarea id="cancel-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} />
            {needNote && <p className="text-sm text-muted-foreground">Nhập ghi chú cho lý do Khác</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Giữ đơn
          </Button>
          <Button variant="destructive" disabled={!reason || needNote || cancel.isPending} onClick={() => void submit()}>
            {cancel.isPending && <Loader2 className="size-4 animate-spin" />}
            Hủy đơn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function OrderView({ view, phone }: { view: PublicOrderView; phone: string }) {
  const { data: store } = useStoreInfo()
  const [cancelOpen, setCancelOpen] = useState(false)
  const timeline = [...view.timeline].reverse()
  return (
    <div className="mt-6 space-y-4">
      <section className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm text-muted-foreground">Đơn hàng</p>
            <p className="text-xl font-bold tracking-wide">{view.code}</p>
          </div>
          <OrderStatusBadge status={view.status} className="h-8 px-3 text-sm" />
        </div>
        <div className="grid gap-1 text-sm">
          <p>
            <span className="text-muted-foreground">Đặt lúc:</span> {formatDateTime(view.placedAt)}
          </p>
          <p>
            <span className="text-muted-foreground">Người nhận:</span> {view.recipientName} · {view.maskedPhone}
          </p>
          <p>
            <span className="text-muted-foreground">Giao tới:</span> {view.wardName}, {view.provinceName}
          </p>
          <p className="flex items-center gap-2">
            <span className="text-muted-foreground">Thanh toán:</span> {paymentMethodShortLabels[view.paymentMethod]}
            <PaymentStatusBadge status={view.paymentStatus} />
          </p>
        </div>
        {view.shipment && (
          <div className="flex items-start gap-3 rounded-lg bg-primary/5 p-3 text-sm">
            <Truck className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">{carrierLabels[view.shipment.carrier]}</p>
              <p>
                Mã vận đơn: <strong className="tracking-wide">{view.shipment.trackingCode}</strong>
              </p>
              <p className="text-muted-foreground">Bàn giao lúc {formatDateTime(view.shipment.handedOverAt)}</p>
            </div>
          </div>
        )}
        {view.canCancel && (
          <Button variant="outline" className="h-11 w-full text-destructive hover:text-destructive sm:w-auto" onClick={() => setCancelOpen(true)}>
            <XCircle className="size-4" />
            Hủy đơn
          </Button>
        )}
        {!view.canCancel && view.status !== 'DaHuy' && store?.hotline && (
          <p className="text-sm text-muted-foreground">Cần đổi thông tin đơn? Gọi hotline {store.hotline}.</p>
        )}
      </section>

      {view.transfer && (
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 font-semibold">Chuyển khoản để hoàn tất đơn</h2>
          <TransferQr transfer={view.transfer} />
        </section>
      )}

      <section className="rounded-xl border bg-card p-4" aria-labelledby="timeline">
        <h2 id="timeline" className="mb-3 font-semibold">
          Hành trình đơn hàng
        </h2>
        <ol className="relative space-y-4 border-l-2 border-border pl-5">
          {timeline.map((t, i) => (
            <li key={`${t.at}-${i}`} className="relative">
              <span className={cn('absolute top-1 -left-[27px] size-3 rounded-full ring-4 ring-card', i === 0 ? 'bg-primary' : 'bg-muted-foreground/40')} />
              <p className={cn('text-sm', i === 0 ? 'font-semibold' : 'text-foreground')}>{t.text}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(t.at)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 font-semibold">Sản phẩm</h2>
        <OrderLinesSummary lines={view.lines} summary={view.summary} />
      </section>
      {cancelOpen && <CancelDialog view={view} phone={phone} open={cancelOpen} onOpenChange={setCancelOpen} />}
    </div>
  )
}

/**
 * Tra cứu đơn (SCR-07, UC-05): mã đơn + số điện thoại; trạng thái, dòng thời gian, vận đơn, QR khi chờ
 * chuyển khoản; tự hủy khi Chờ thanh toán / Chờ xác nhận (TC-20). Sai 5 lần → khóa tới hết giờ (BR-28).
 * `?code=` tự điền số điện thoại nếu đơn đặt từ trình duyệt này (07 §4.2 bước 4).
 */
export function OrderLookupPage() {
  const params = useSearchParams()
  const lookup = useLookupOrder()
  const [code, setCode] = useState('')
  const [phone, setPhone] = useState('')
  const [tracked, setTracked] = useState<OrderLookupRequest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)
  const [, setTick] = useState(0)
  const { data: view } = useTrackedOrder(tracked)

  // ?code= → điền mã, tự điền số điện thoại đã lưu, tự tra cứu
  useEffect(() => {
    const c = (params.get('code') ?? '').trim().toUpperCase()
    if (!c) return
    const saved = shopStorage.phoneForOrder(c)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- điền form từ URL
    setCode(c)
    if (saved) {
      setPhone(saved)
      void run(c, saved)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  useEffect(() => {
    if (!lockedUntil) return
    const timer = setInterval(() => {
      if (Date.now() >= lockedUntil) setLockedUntil(null)
      setTick((t) => t + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [lockedUntil])

  async function run(c: string, p: string) {
    setError(null)
    const req = { code: c.trim().toUpperCase(), phone: normalizePhone(p) }
    try {
      const result = await lookup.mutateAsync(req)
      setTracked(req)
      void result
    } catch (err) {
      setTracked(null)
      if (isApiError(err) && err.problem.code === 'TraCuuTamKhoa') {
        const seconds = Number(err.problem.retryAfterSeconds) || 600
        setLockedUntil(Date.now() + seconds * 1000)
      }
      setError(getErrorMessage(err))
    }
  }

  const locked = !!lockedUntil && Date.now() < lockedUntil
  const remaining = locked ? Math.ceil((lockedUntil! - Date.now()) / 1000) : 0

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <PackageSearch className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold">Tra cứu đơn hàng</h1>
          <p className="text-sm text-muted-foreground">Nhập mã đơn và số điện thoại đặt hàng</p>
        </div>
      </div>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (!code.trim() || !phone.trim() || locked) return
          void run(code, phone)
        }}
        className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <div className="grid gap-1.5">
          <label htmlFor="lk-code" className="text-sm font-medium">
            Mã đơn
          </label>
          <Input
            id="lk-code"
            value={code}
            onChange={(e) => {
              const v = e.target.value.toUpperCase()
              setCode(v)
              const saved = shopStorage.phoneForOrder(v)
              if (saved && !phone) setPhone(saved)
            }}
            placeholder="DH2610150001"
            autoCapitalize="characters"
            className="h-11 uppercase"
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="lk-phone" className="text-sm font-medium">
            Số điện thoại
          </label>
          <Input id="lk-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xxxxxxxx" className="h-11" />
        </div>
        <Button type="submit" size="lg" className="h-11" disabled={lookup.isPending || locked || !code.trim() || !phone.trim()}>
          {lookup.isPending && <Loader2 className="size-4 animate-spin" />}
          {locked ? `Thử lại sau ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : 'Tra cứu'}
        </Button>
      </form>
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {tracked && view && <OrderView view={view} phone={tracked.phone} />}
    </div>
  )
}
