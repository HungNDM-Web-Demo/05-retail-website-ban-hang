'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { TransferInfo } from '@/types/shop'
import { vnDateTime } from '../lib/vn-time'

/** Vẽ QR tại máy bằng gói `qrcode`, mức sửa lỗi M (07 §3.9); không gọi dịch vụ ngoài */
export function QrCanvasImage({ value, size = 220, className }: { value: string; size?: number; className?: string }) {
  const key = `${size}:${value}`
  const [rendered, setRendered] = useState<{ key: string; url: string | null } | null>(null)
  const src = rendered?.key === key ? rendered.url : null
  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(value, { width: size, margin: 2, errorCorrectionLevel: 'M' })
      .then((url) => !cancelled && setRendered({ key, url }))
      .catch(() => !cancelled && setRendered({ key, url: null }))
    return () => {
      cancelled = true
    }
  }, [key, value, size])
  if (!src) return <Skeleton className={cn('rounded-md', className)} style={{ width: size, height: size }} />
  return (
    // eslint-disable-next-line @next/next/no-img-element -- data URL sinh tại máy
    <img src={src} alt="Mã QR chuyển khoản" width={size} height={size} className={cn('rounded-md bg-white', className)} />
  )
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-9 shrink-0"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          toast.success(`Đã sao chép ${label}`)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          toast.error('Trình duyệt chặn sao chép, vui lòng chép tay')
        }
      }}
      aria-label={`Sao chép ${label}`}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      Sao chép
    </Button>
  )
}

/**
 * Khối chuyển khoản (BR-12, TC-16): QR giả lập, ngân hàng, số tài khoản, chủ tài khoản, số tiền,
 * nội dung = mã đơn (nút Sao chép), hạn thanh toán. Dùng ở trang thành công, tra cứu đơn.
 */
export function TransferQr({ transfer, className }: { transfer: TransferInfo; className?: string }) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start', className)}>
      <div className="mx-auto rounded-lg border bg-white p-2">
        <QrCanvasImage value={transfer.qrPayload} size={200} />
      </div>
      <dl className="grid gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Ngân hàng</dt>
          <dd className="font-medium">{transfer.bankName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Số tài khoản</dt>
          <dd className="flex items-center justify-between gap-2">
            <span className="font-semibold tracking-wide tabular-nums">{transfer.bankAccount}</span>
            <CopyButton value={transfer.bankAccount} label="số tài khoản" />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Chủ tài khoản</dt>
          <dd className="font-medium">{transfer.bankAccountName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Số tiền</dt>
          <dd className="text-lg font-bold text-primary tabular-nums">{formatVnd(transfer.amount)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Nội dung chuyển khoản</dt>
          <dd className="flex items-center justify-between gap-2">
            <span className="font-semibold tracking-wide">{transfer.content}</span>
            <CopyButton value={transfer.content} label="nội dung" />
          </dd>
        </div>
        {transfer.dueAt && (
          <div className="rounded-md bg-warning/10 px-3 py-2 text-warning">
            Hạn thanh toán: <strong>{vnDateTime(transfer.dueAt)}</strong>. Quá hạn đơn tự hủy.
          </div>
        )}
      </dl>
    </div>
  )
}
