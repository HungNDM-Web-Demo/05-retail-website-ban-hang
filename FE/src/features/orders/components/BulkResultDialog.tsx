'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { BulkResult, OrderListItem } from '@/types/shop'

/** Kết quả thao tác hàng loạt: số đơn thành công và từng đơn lỗi kèm câu lỗi */
export function BulkResultDialog({
  value,
  onClose,
  orders,
}: {
  value: { title: string; result: BulkResult } | null
  onClose: () => void
  orders: OrderListItem[]
}) {
  const codeOf = (id: string) => orders.find((o) => o.id === id)?.code ?? id
  return (
    <Dialog open={!!value} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{value?.title}</DialogTitle>
          <DialogDescription>
            Thành công {value?.result.succeeded.length ?? 0} đơn, không xử lý được {value?.result.failed.length ?? 0} đơn.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-72 space-y-2 overflow-auto text-sm">
          {value?.result.failed.map((f) => (
            <li key={f.id} className="border-destructive/30 bg-destructive/5 rounded-lg border p-2.5">
              <span className="font-semibold">{codeOf(f.id)}</span>: {f.message}
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button onClick={onClose}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
