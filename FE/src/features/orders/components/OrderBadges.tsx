import { StatusBadge } from '@/components/shared/StatusBadge'
import {
  orderLabelLabels,
  orderStatusLabels,
  orderStatusTone,
  paymentStatusLabels,
} from '@/config/shop-labels'
import type { OrderLabel, OrderStatus, PaymentStatus } from '@/types/shop'
import { orderLabelTone, paymentStatusTone } from '../lib/order-ui'

export const OrderStatusPill = ({ status }: { status: OrderStatus }) => (
  <StatusBadge tone={orderStatusTone[status]}>{orderStatusLabels[status]}</StatusBadge>
)

export const PaymentStatusPill = ({ status, amount }: { status: PaymentStatus; amount?: string }) => (
  <StatusBadge tone={paymentStatusTone[status]}>
    {paymentStatusLabels[status]}
    {amount ? ` ${amount}` : ''}
  </StatusBadge>
)

export const OrderLabelPills = ({ labels }: { labels: OrderLabel[] }) =>
  labels.length ? (
    <span className="flex flex-wrap gap-1">
      {labels.map((l) => (
        <StatusBadge key={l} tone={orderLabelTone[l]} dot={false} className="h-5 px-2 text-[0.6875rem]">
          {orderLabelLabels[l]}
        </StatusBadge>
      ))}
    </span>
  ) : null
