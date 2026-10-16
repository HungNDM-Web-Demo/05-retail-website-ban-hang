'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import {
  cancelReasonLabels,
  carrierLabels,
  deliveryFailReasonLabels,
  staffCancelReasons,
} from '@/config/shop-labels'
import { getErrorMessage, getFieldErrors, isApiError } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import type { CancelReason, Carrier, DeliveryFailReason, OrderDetailDto } from '@/types/shop'
import { useOrderAction, type OrderActionKind } from '../hooks/use-orders'
import { lastCarrier, rememberCarrier, suggestWeightGrams, transactionRefError } from '../lib/order-ui'
import { CarrierPicker } from './CarrierPicker'

export type DialogKind = Exclude<OrderActionKind, 'edit' | 'addNote'>

type Props = { order: OrderDetailDto; kind: DialogKind | null; onClose: () => void; onShipped?: (o: OrderDetailDto) => void }

/** Hộp thoại thao tác đổi đơn (UC-08…11). Mọi thao tác gửi `version`; 409 thì đóng hộp, hiện câu lỗi */
export function OrderActionDialogs(props: Props) {
  const { kind } = props
  return (
    <>
      {kind === 'confirm' && <ConfirmDialogBox {...props} open />}
      {kind === 'confirmPayment' && <ConfirmPaymentBox {...props} open />}
      {kind === 'cancel' && <CancelBox {...props} open />}
      {kind === 'ship' && <ShipBox {...props} open />}
      {kind === 'deliver' && <DeliverBox {...props} open />}
      {kind === 'deliveryFailed' && <DeliveryFailedBox {...props} open />}
      {kind === 'receiveReturn' && <ReceiveReturnBox {...props} open />}
      {kind === 'refund' && <RefundBox {...props} open />}
    </>
  )
}

type BoxProps = Props & { open: boolean }

/** Chạy thao tác: thành công → toast + đóng; 409 → đóng (cache đã thay); lỗi trường → trả về để gắn dưới ô */
function useRunner<K extends DialogKind>(order: OrderDetailDto, kind: K, onClose: () => void) {
  const mutation = useOrderAction(order.id, kind)
  // Phiên bản lúc mở hộp thoại: tab khác đổi đơn trong lúc đang mở → 409 DonDaThayDoi (07 §3.6)
  const [version] = useState(order.version)
  const run = async (
    body: Parameters<typeof mutation.mutateAsync>[0],
    success: string
  ): Promise<{ ok: boolean; fields?: Record<string, string>; result?: OrderDetailDto }> => {
    try {
      const result = await mutation.mutateAsync({ ...body, version })
      toast.success(success)
      onClose()
      return { ok: true, result }
    } catch (error) {
      const fields = getFieldErrors(error)
      if (isApiError(error) && error.status === 409) {
        toast.error(getErrorMessage(error), { duration: 8000 })
        onClose()
      } else if (!Object.keys(fields).length) {
        toast.error(getErrorMessage(error))
      }
      return { ok: false, fields }
    }
  }
  return { run, pending: mutation.isPending }
}

function Shell({
  open,
  onClose,
  title,
  description,
  children,
  confirmText,
  disabled,
  pending,
  destructive,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: React.ReactNode
  children?: React.ReactNode
  confirmText: string
  disabled?: boolean
  pending: boolean
  destructive?: boolean
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && !pending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!disabled && !pending) onConfirm()
          }}
        >
          {children}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Đóng
            </Button>
            <Button type="submit" variant={destructive ? 'danger' : 'default'} disabled={disabled || pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {confirmText}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const MoneyLine = ({ label, value, strong }: { label: string; value: number; strong?: boolean }) => (
  <div className="bg-muted/60 flex items-center justify-between rounded-lg px-3 py-2.5">
    <span className="text-muted-foreground text-sm">{label}</span>
    <span className={strong ? 'text-lg font-bold tabular-nums' : 'font-semibold tabular-nums'}>{formatVnd(value)}</span>
  </div>
)

// ---------------------------------------------------------------- Xác nhận đơn (FR-24)

function ConfirmDialogBox({ order, open, onClose }: BoxProps) {
  const [note, setNote] = useState('')
  const { run, pending } = useRunner(order, 'confirm', onClose)
  return (
    <Shell
      open={open}
      onClose={onClose}
      title={`Xác nhận đơn ${order.code}`}
      description="Xác nhận sau khi đã gọi khách. Khách nhận tin nhắn đơn đã được xác nhận (giả lập)."
      confirmText="Xác nhận đơn"
      pending={pending}
      onConfirm={() => void run({ note: note.trim() || undefined }, `Đã xác nhận đơn ${order.code}`)}
    >
      <FormField label="Ghi chú (không bắt buộc)">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder="Vd: Đã gọi, khách xác nhận địa chỉ" />
      </FormField>
    </Shell>
  )
}

// ---------------------------------------------------------------- Xác nhận đã nhận tiền (FR-25, TC-28)

function ConfirmPaymentBox({ order, open, onClose }: BoxProps) {
  const [ref, setRef] = useState('')
  const [error, setError] = useState<string>()
  const { run, pending } = useRunner(order, 'confirmPayment', onClose)
  const submit = async () => {
    const e = transactionRefError(ref)
    if (e) return setError(e)
    const r = await run({ transactionRef: ref.trim() }, `Đã xác nhận nhận tiền đơn ${order.code}`)
    if (r.fields?.transactionRef) setError(r.fields.transactionRef)
  }
  return (
    <Shell
      open={open}
      onClose={onClose}
      title="Xác nhận đã nhận tiền"
      description={`Đối chiếu sao kê: số tiền và nội dung chuyển khoản là mã đơn ${order.code}.`}
      confirmText="Xác nhận đã nhận tiền"
      pending={pending}
      onConfirm={() => void submit()}
    >
      <MoneyLine label="Số tiền cần nhận" value={order.total} strong />
      <FormField label="Mã giao dịch ngân hàng" required error={error} hint="6–30 chữ và số, vd FT26285904127">
        <Input
          value={ref}
          autoFocus
          autoComplete="off"
          onChange={(e) => {
            setRef(e.target.value)
            setError(undefined)
          }}
        />
      </FormField>
    </Shell>
  )
}

// ---------------------------------------------------------------- Hủy đơn (FR-27, BR-16, TC-31, TC-32)

function ReasonPicker<T extends string>({
  name,
  options,
  labels,
  value,
  onChange,
}: {
  name: string
  options: T[]
  labels: Record<T, string>
  value?: T
  onChange: (v: T) => void
}) {
  return (
    <RadioGroup value={value ?? ''} onValueChange={(v) => onChange(v as T)} aria-label={name} className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => (
        <Label
          key={o}
          htmlFor={`${name}-${o}`}
          className="has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5 hover:bg-muted flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border px-3 font-normal"
        >
          <RadioGroupItem id={`${name}-${o}`} value={o} />
          {labels[o]}
        </Label>
      ))}
    </RadioGroup>
  )
}

function CancelBox({ order, open, onClose }: BoxProps) {
  const [reason, setReason] = useState<CancelReason>()
  const [note, setNote] = useState('')
  const [error, setError] = useState<string>()
  const { run, pending } = useRunner(order, 'cancel', onClose)
  const needNote = reason === 'Khac' && !note.trim()
  const paid = order.paymentStatus === 'DaThanhToan'
  const submit = async () => {
    if (!reason) return
    if (needNote) return setError('Nhập ghi chú cho lý do Khác')
    const r = await run({ reason, note: note.trim() || undefined }, `Đã hủy đơn ${order.code}`)
    if (r.fields?.note) setError(r.fields.note)
  }
  return (
    <Shell
      open={open}
      onClose={onClose}
      title={`Hủy đơn ${order.code}`}
      description="Tồn kho được cộng lại, lượt mã giảm giá được trả. Không hoàn tác được."
      confirmText="Hủy đơn"
      destructive
      disabled={!reason}
      pending={pending}
      onConfirm={() => void submit()}
    >
      {paid && (
        <Alert className="border-warning/40 bg-warning/10">
          <AlertDescription>
            Đơn đã thanh toán: sau khi hủy, đơn chuyển sang Cần hoàn tiền {formatVnd(order.total)}.
          </AlertDescription>
        </Alert>
      )}
      <ReasonPicker name="cancel-reason" options={staffCancelReasons} labels={cancelReasonLabels} value={reason} onChange={setReason} />
      <FormField label="Ghi chú" required={reason === 'Khac'} error={error}>
        <Textarea
          value={note}
          rows={2}
          maxLength={500}
          onChange={(e) => {
            setNote(e.target.value)
            setError(undefined)
          }}
        />
      </FormField>
    </Shell>
  )
}

// ---------------------------------------------------------------- Bàn giao vận chuyển (FR-28, BR-17, TC-35, TC-36)

function ShipBox({ order, open, onClose, onShipped }: BoxProps) {
  const [carrier, setCarrier] = useState<Carrier>(() => lastCarrier())
  const [weight, setWeight] = useState(() => String(suggestWeightGrams(order.lines)))
  const [note, setNote] = useState('')
  const [error, setError] = useState<string>()
  const { run, pending } = useRunner(order, 'ship', onClose)
  const submit = async () => {
    const w = Number(weight)
    if (!Number.isInteger(w) || w < 50 || w > 30000) return setError('Khối lượng từ 50 đến 30.000 g')
    const r = await run(
      { carrier, weightGrams: w, shipperNote: note.trim() || undefined },
      `Đã bàn giao ${carrierLabels[carrier]}`
    )
    if (r.ok) {
      rememberCarrier(carrier)
      if (r.result) onShipped?.(r.result)
    } else if (r.fields?.weightGrams) setError(r.fields.weightGrams)
  }
  return (
    <Shell
      open={open}
      onClose={onClose}
      title="Bàn giao vận chuyển"
      description="Hệ thống sinh mã vận đơn (giả lập), đơn chuyển sang Đang giao và mở phiếu giao để in."
      confirmText="Tạo vận đơn"
      pending={pending}
      onConfirm={() => void submit()}
    >
      <CarrierPicker value={carrier} onChange={setCarrier} />
      <FormField label="Khối lượng (g)" required error={error} hint={`Gợi ý ${suggestWeightGrams(order.lines)} g theo số sản phẩm`}>
        <Input
          type="number"
          inputMode="numeric"
          min={50}
          max={30000}
          step={50}
          value={weight}
          onChange={(e) => {
            setWeight(e.target.value)
            setError(undefined)
          }}
        />
      </FormField>
      <FormField label="Ghi chú cho shipper">
        <Input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Vd: Gọi trước khi giao" />
      </FormField>
      <MoneyLine label="Tiền thu hộ (COD)" value={order.codAmount} strong />
    </Shell>
  )
}

// ---------------------------------------------------------------- Kết quả giao (FR-30, BR-19)

function DeliverBox({ order, open, onClose }: BoxProps) {
  const { run, pending } = useRunner(order, 'deliver', onClose)
  return (
    <Shell
      open={open}
      onClose={onClose}
      title="Đã giao thành công?"
      description="Đơn chuyển sang Đã giao, được tính vào doanh thu thuần hôm nay."
      confirmText="Đã giao"
      pending={pending}
      onConfirm={() => void run({}, `Đơn ${order.code} đã giao`)}
    >
      <MoneyLine label="Tiền thu hộ shipper đã thu" value={order.codAmount} strong />
    </Shell>
  )
}

function DeliveryFailedBox({ order, open, onClose }: BoxProps) {
  const [reason, setReason] = useState<DeliveryFailReason>()
  const [note, setNote] = useState('')
  const [error, setError] = useState<string>()
  const { run, pending } = useRunner(order, 'deliveryFailed', onClose)
  const submit = async () => {
    if (!reason) return
    if (reason === 'Khac' && !note.trim()) return setError('Nhập ghi chú cho lý do Khác')
    const r = await run({ reason, note: note.trim() || undefined }, `Đơn ${order.code} chuyển Đang hoàn`)
    if (r.fields?.note) setError(r.fields.note)
  }
  return (
    <Shell
      open={open}
      onClose={onClose}
      title="Giao thất bại"
      description="Đơn chuyển sang Đang hoàn. Tồn kho được cộng lại khi bấm Đã nhận hàng hoàn."
      confirmText="Ghi nhận giao thất bại"
      destructive
      disabled={!reason}
      pending={pending}
      onConfirm={() => void submit()}
    >
      <ReasonPicker
        name="fail-reason"
        options={Object.keys(deliveryFailReasonLabels) as DeliveryFailReason[]}
        labels={deliveryFailReasonLabels}
        value={reason}
        onChange={setReason}
      />
      <FormField label="Ghi chú" required={reason === 'Khac'} error={error}>
        <Textarea
          value={note}
          rows={2}
          maxLength={500}
          onChange={(e) => {
            setNote(e.target.value)
            setError(undefined)
          }}
        />
      </FormField>
    </Shell>
  )
}

function ReceiveReturnBox({ order, open, onClose }: BoxProps) {
  const { run, pending } = useRunner(order, 'receiveReturn', onClose)
  const qty = order.lines.reduce((s, l) => s + l.quantity, 0)
  return (
    <Shell
      open={open}
      onClose={onClose}
      title="Đã nhận hàng hoàn về kho?"
      description={`Tồn kho được cộng lại ${qty} sản phẩm. Lượt mã giảm giá không được trả.`}
      confirmText="Đã nhận hàng hoàn"
      pending={pending}
      onConfirm={() => void run({}, `Đơn ${order.code} đã hoàn về kho`)}
    />
  )
}

// ---------------------------------------------------------------- Hoàn tiền (BR-16, TC-32)

function RefundBox({ order, open, onClose }: BoxProps) {
  const [ref, setRef] = useState('')
  const [error, setError] = useState<string>()
  const { run, pending } = useRunner(order, 'refund', onClose)
  const submit = async () => {
    const e = transactionRefError(ref)
    if (e) return setError(e)
    const r = await run({ refundRef: ref.trim() }, `Đã ghi nhận hoàn tiền đơn ${order.code}`)
    if (r.fields?.refundRef) setError(r.fields.refundRef)
  }
  return (
    <Shell
      open={open}
      onClose={onClose}
      title="Đã hoàn tiền cho khách"
      description="Chuyển khoản hoàn tiền ngoài hệ thống, rồi nhập mã giao dịch để ghi nhận."
      confirmText="Đã hoàn tiền"
      pending={pending}
      onConfirm={() => void submit()}
    >
      <MoneyLine label="Số tiền hoàn" value={order.refundAmount ?? order.total} strong />
      <FormField label="Mã giao dịch hoàn tiền" required error={error}>
        <Input
          value={ref}
          autoFocus
          autoComplete="off"
          onChange={(e) => {
            setRef(e.target.value)
            setError(undefined)
          }}
        />
      </FormField>
    </Shell>
  )
}
