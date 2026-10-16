'use client'

import { useState } from 'react'
import { Loader2, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getErrorMessage } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import type { BulkResult, Carrier, OrderListItem } from '@/types/shop'
import { useBulkShip } from '../hooks/use-orders'
import { lastCarrier, rememberCarrier } from '../lib/order-ui'
import { CarrierPicker } from './CarrierPicker'

/** Bàn giao nhiều đơn Đã xác nhận cho một đơn vị; khối lượng lấy theo gợi ý (07 §3.9, FR-31) */
export function BulkShipDialog({
  open,
  onOpenChange,
  orders,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orders: OrderListItem[]
  onDone: (result: BulkResult) => void
}) {
  const [carrier, setCarrier] = useState<Carrier>(() => lastCarrier())
  const bulk = useBulkShip()
  const submit = async () => {
    try {
      const result = await bulk.mutateAsync({ carrier, items: orders.map((o) => ({ id: o.id, version: o.version })) })
      rememberCarrier(carrier)
      onOpenChange(false)
      onDone(result)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }
  return (
    <Dialog open={open} onOpenChange={(v) => !bulk.isPending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bàn giao {orders.length} đơn</DialogTitle>
          <DialogDescription>
            Khối lượng mỗi đơn lấy theo gợi ý (300 g mỗi sản phẩm + 100 g). Tổng tiền thu hộ{' '}
            {formatVnd(orders.filter((o) => o.paymentMethod === 'Cod').reduce((s, o) => s + o.total, 0))}.
          </DialogDescription>
        </DialogHeader>
        <CarrierPicker value={carrier} onChange={setCarrier} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={bulk.isPending}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={bulk.isPending || !orders.length}>
            {bulk.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Truck aria-hidden="true" />}
            Tạo vận đơn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
