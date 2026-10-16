import { ArrowRightLeft, Banknote, MessageSquareText, PenLine, StickyNote, type LucideIcon } from 'lucide-react'
import { actorTypeLabels, orderStatusLabels } from '@/config/shop-labels'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { OrderEventDto, OrderEventType } from '@/types/shop'

const ICONS: Record<OrderEventType, { icon: LucideIcon; className: string }> = {
  DoiTrangThai: { icon: ArrowRightLeft, className: 'bg-primary/10 text-primary' },
  GhiChuNoiBo: { icon: StickyNote, className: 'bg-warning/12 text-warning' },
  TinGuiKhach: { icon: MessageSquareText, className: 'bg-muted text-muted-foreground' },
  SuaDon: { icon: PenLine, className: 'bg-info/10 text-info' },
  HoanTien: { icon: Banknote, className: 'bg-success/12 text-success' },
}

/** Dòng thời gian đơn (FR-23, 07 §3.10): mới nhất trên cùng, kèm người làm và thời điểm */
export function OrderTimeline({ events }: { events: OrderEventDto[] }) {
  const list = [...events].reverse()
  return (
    <ol className="relative space-y-4" aria-label="Dòng thời gian">
      {list.map((e, i) => {
        const { icon: Icon, className } = ICONS[e.type]
        const title =
          e.type === 'DoiTrangThai' && e.toStatus
            ? e.fromStatus
              ? `${orderStatusLabels[e.fromStatus]} → ${orderStatusLabels[e.toStatus]}`
              : orderStatusLabels[e.toStatus]
            : e.type === 'GhiChuNoiBo'
              ? 'Ghi chú nội bộ'
              : e.type === 'TinGuiKhach'
                ? 'Tin gửi khách'
                : e.type === 'SuaDon'
                  ? 'Sửa đơn'
                  : 'Hoàn tiền'
        return (
          <li key={e.id} className="relative flex gap-3">
            {i < list.length - 1 && <span className="bg-border absolute top-9 bottom-[-1rem] left-4 w-px" aria-hidden="true" />}
            <span className={cn('relative flex size-8 shrink-0 items-center justify-center rounded-full', className)}>
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 pb-1">
              <p className={cn('text-sm font-medium', e.type === 'TinGuiKhach' && 'text-muted-foreground font-normal')}>
                {title}
              </p>
              {e.content && e.type !== 'TinGuiKhach' && <p className="mt-0.5 text-sm break-words whitespace-pre-line">{e.content}</p>}
              {e.type === 'TinGuiKhach' && <p className="text-muted-foreground mt-0.5 text-sm">{e.content}</p>}
              <p className="text-muted-foreground mt-1 text-xs">
                {e.actorType === 'NhanVien' ? e.actorName : actorTypeLabels[e.actorType]} · {formatDateTime(e.at)}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
