'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Banknote,
  CheckCircle2,
  CircleCheckBig,
  ExternalLink,
  PackageCheck,
  PackageX,
  PenLine,
  Phone,
  Printer,
  RotateCcw,
  SearchX,
  Truck,
  Undo2,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { permissions, type PermissionCode } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import {
  cancelReasonLabels,
  carrierLabels,
  customerTagLabels,
  deliveryFailReasonLabels,
  orderStatusLabels,
  paymentMethodLabels,
} from '@/config/shop-labels'
import { ProductThumb } from '@/features/products/components/ProductThumb'
import { usePermissions } from '@/hooks/use-permissions'
import { isApiError } from '@/lib/api-error'
import { formatDateTime, formatNumber, formatPhone, formatVnd } from '@/lib/format'
import type { OrderAction, OrderDetailDto } from '@/types/shop'
import { EditOrderDialog } from '../components/EditOrderDialog'
import { HiddenPrintFrame } from '../components/HiddenPrintFrame'
import { InternalNoteBox } from '../components/InternalNoteBox'
import { OrderActionDialogs, type DialogKind } from '../components/OrderActionDialogs'
import { OrderLabelPills, OrderStatusPill, PaymentStatusPill } from '../components/OrderBadges'
import { OrderTimeline } from '../components/OrderTimeline'
import { useOrder } from '../hooks/use-orders'
import { variantText } from '../lib/order-ui'

type ActionButton = {
  action: OrderAction
  kind: DialogKind | 'edit' | 'print'
  label: string
  icon: LucideIcon
  permission: PermissionCode
  variant: 'default' | 'outline' | 'destructive'
}

/** Thứ tự nút: thao tác chính trước, hủy cuối (07 §4.4) */
const ACTIONS: ActionButton[] = [
  { action: 'Confirm', kind: 'confirm', label: 'Xác nhận đơn', icon: CheckCircle2, permission: permissions.orders.confirm, variant: 'default' },
  { action: 'ConfirmPayment', kind: 'confirmPayment', label: 'Xác nhận đã nhận tiền', icon: Wallet, permission: permissions.orders.confirmPayment, variant: 'default' },
  { action: 'Ship', kind: 'ship', label: 'Bàn giao vận chuyển', icon: Truck, permission: permissions.orders.ship, variant: 'default' },
  { action: 'Deliver', kind: 'deliver', label: 'Đã giao', icon: CircleCheckBig, permission: permissions.orders.ship, variant: 'default' },
  { action: 'DeliveryFailed', kind: 'deliveryFailed', label: 'Giao thất bại', icon: PackageX, permission: permissions.orders.ship, variant: 'outline' },
  { action: 'ReceiveReturn', kind: 'receiveReturn', label: 'Đã nhận hàng hoàn', icon: Undo2, permission: permissions.orders.ship, variant: 'default' },
  { action: 'Refund', kind: 'refund', label: 'Đã hoàn tiền', icon: Banknote, permission: permissions.orders.refund, variant: 'default' },
  { action: 'Edit', kind: 'edit', label: 'Sửa đơn', icon: PenLine, permission: permissions.orders.update, variant: 'outline' },
  { action: 'PrintLabel', kind: 'print', label: 'In phiếu giao', icon: Printer, permission: permissions.orders.ship, variant: 'outline' },
  { action: 'Cancel', kind: 'cancel', label: 'Hủy đơn', icon: Ban, permission: permissions.orders.cancel, variant: 'destructive' },
]

/** SCR-12 Chi tiết đơn (UC-07…11; FR-22…30) */
export function OrderDetailPage({ id }: { id: string }) {
  return (
    <PermissionGuard permission={permissions.orders.view} redirect>
      <OrderDetailView id={id} />
    </PermissionGuard>
  )
}

function OrderDetailView({ id }: { id: string }) {
  const query = useOrder(id)
  const order = query.data

  if (query.error && !order) {
    if (isApiError(query.error) && query.error.status === 404) {
      return (
        <EmptyState
          icon={SearchX}
          title="Không tìm thấy đơn hàng"
          description="Mã đơn không tồn tại hoặc đường dẫn bị sai."
          action={
            <Button asChild variant="outline">
              <Link href={routePath.adminOrders}>Về danh sách đơn</Link>
            </Button>
          }
        />
      )
    }
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  }
  if (!order) return <DetailSkeleton />
  return <OrderDetailBody order={order} />
}

function OrderDetailBody({ order }: { order: OrderDetailDto }) {
  const { can } = usePermissions()
  const [dialog, setDialog] = useState<DialogKind | null>(null)
  const [editing, setEditing] = useState(false)
  const [printId, setPrintId] = useState<string | null>(null)
  const clearPrint = useCallback(() => setPrintId(null), [])

  const buttons = ACTIONS.filter((a) => order.allowedActions.includes(a.action) && can(a.permission))
  const onAction = (b: ActionButton) => {
    if (b.kind === 'print') window.open(routePath.adminOrderPrint(order.id), '_blank', 'noopener')
    else if (b.kind === 'edit') setEditing(true)
    else setDialog(b.kind)
  }
  const c = order.customer
  const itemCount = order.lines.reduce((s, l) => s + l.quantity, 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-2">
          <Link href={routePath.adminOrders} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Đơn hàng
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight tabular-nums">{order.code}</h1>
            <OrderStatusPill status={order.status} />
            {order.paymentStatus !== 'ChuaThanhToan' && (
              <PaymentStatusPill
                status={order.paymentStatus}
                amount={order.paymentStatus === 'CanHoanTien' ? formatVnd(order.refundAmount ?? order.total) : undefined}
              />
            )}
            <OrderLabelPills labels={order.labels} />
          </div>
          <p className="text-muted-foreground text-sm">
            Đặt lúc {formatDateTime(order.placedAt)} · {paymentMethodLabels[order.paymentMethod]}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {buttons.map((b) => (
            <Button key={b.action} variant={b.variant} onClick={() => onAction(b)}>
              <b.icon aria-hidden="true" />
              {b.label}
            </Button>
          ))}
          <Button variant="ghost" asChild>
            <a href={`${routePath.orderLookup}?code=${order.code}`} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden="true" />
              Xem như khách
            </a>
          </Button>
        </div>
      </div>

      <OrderAlerts order={order} />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Khách và giao hàng</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5 text-sm">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Người nhận</p>
                <p className="font-medium">{order.recipientName}</p>
                <a href={`tel:${order.phone}`} className="text-primary inline-flex min-h-11 items-center gap-1.5 font-medium tabular-nums hover:underline">
                  <Phone className="size-4" aria-hidden="true" />
                  {formatPhone(order.phone)}
                </a>
                {order.email && <p className="text-muted-foreground">{order.email}</p>}
                <p>
                  {order.addressLine}, {order.wardName}, {order.provinceName}
                </p>
              </div>
              <div className="space-y-1.5 text-sm">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Hồ sơ khách</p>
                {can(permissions.customers.view) ? (
                  <Link href={routePath.adminCustomerDetail(c.id)} className="text-primary font-medium hover:underline">
                    {c.name}
                  </Link>
                ) : (
                  <p className="font-medium">{c.name}</p>
                )}
                <p className="text-muted-foreground">
                  {formatNumber(c.orderCount, 0)} đơn · {formatNumber(c.returnCount, 0)} đơn hoàn
                </p>
                {c.tags.length > 0 && <p>{c.tags.map((t) => customerTagLabels[t]).join(' · ')}</p>}
                {c.note && <p className="bg-muted rounded-md px-2.5 py-1.5">{c.note}</p>}
              </div>
              {order.customerNote && (
                <div className="bg-info/8 border-info/25 rounded-lg border px-3 py-2 text-sm sm:col-span-2">
                  <span className="font-medium">Ghi chú của khách: </span>
                  {order.customerNote}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Sản phẩm ({itemCount})</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <ul className="divide-y border-y">
                {order.lines.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 px-6 py-3">
                    <ProductThumb url={l.imageUrl} alt={l.productName} className="w-12" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{l.productName}</p>
                      <p className="text-muted-foreground text-sm">
                        {variantText(l)} · <span className="tabular-nums">{l.sku}</span>
                      </p>
                    </div>
                    <p className="text-muted-foreground text-sm tabular-nums">
                      {l.quantity} × {formatVnd(l.unitPrice)}
                    </p>
                    <p className="w-28 text-right font-semibold tabular-nums">{formatVnd(l.lineTotal)}</p>
                  </li>
                ))}
              </ul>
              <dl className="ml-auto max-w-sm space-y-1.5 px-6 pt-4 text-sm">
                <Row label="Tạm tính" value={formatVnd(order.subtotal)} />
                {order.discount > 0 && <Row label={`Giảm giá${order.couponCode ? ` (${order.couponCode})` : ''}`} value={`−${formatVnd(order.discount)}`} />}
                <Row
                  label={order.shippingDiscount > 0 ? `Phí vận chuyển (${order.couponCode} miễn ${formatVnd(order.shippingDiscount)})` : 'Phí vận chuyển'}
                  value={formatVnd(order.shippingFee)}
                />
                <Row label="Tổng thanh toán" value={formatVnd(order.total)} strong />
                <Row label="Tiền thu hộ (COD)" value={formatVnd(order.codAmount)} />
              </dl>
            </CardContent>
          </Card>

          <div className="grid gap-5 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Thanh toán</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <Row label="Phương thức" value={paymentMethodLabels[order.paymentMethod]} />
                <Row label="Trạng thái" value={<PaymentStatusPill status={order.paymentStatus} />} />
                {order.paymentDueAt && order.status === 'ChoThanhToan' && <Row label="Hạn thanh toán" value={formatDateTime(order.paymentDueAt)} />}
                {order.transactionRef && <Row label="Mã giao dịch" value={order.transactionRef} />}
                {order.paidAt && <Row label="Thanh toán lúc" value={formatDateTime(order.paidAt)} />}
                {order.refundAmount !== undefined && order.refundAmount !== null && <Row label="Số tiền hoàn" value={formatVnd(order.refundAmount)} />}
                {order.refundRef && <Row label="Mã giao dịch hoàn" value={order.refundRef} />}
                {order.refundedAt && <Row label="Hoàn tiền lúc" value={formatDateTime(order.refundedAt)} />}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Vận chuyển</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {order.shipment ? (
                  <>
                    <Row label="Đơn vị" value={carrierLabels[order.shipment.carrier]} />
                    <Row label="Mã vận đơn" value={<span className="font-semibold tabular-nums">{order.shipment.trackingCode}</span>} />
                    <Row label="Khối lượng" value={`${formatNumber(order.shipment.weightGrams, 0)} g`} />
                    <Row label="Bàn giao" value={`${formatDateTime(order.shipment.handedOverAt)} · ${order.shipment.handedOverByName}`} />
                    {order.shipment.shipperNote && <Row label="Ghi chú shipper" value={order.shipment.shipperNote} />}
                    {order.shipment.deliveredAt && <Row label="Giao xong" value={formatDateTime(order.shipment.deliveredAt)} />}
                    {order.shipment.failReason && (
                      <Row
                        label="Giao thất bại"
                        value={`${deliveryFailReasonLabels[order.shipment.failReason]}${order.shipment.failNote ? `: ${order.shipment.failNote}` : ''}`}
                      />
                    )}
                    {order.shipment.returnedAt && <Row label="Hàng hoàn về" value={formatDateTime(order.shipment.returnedAt)} />}
                    <Row label="Đã in phiếu" value={`${order.shipment.labelPrintCount} lần`} />
                  </>
                ) : (
                  <p className="text-muted-foreground">Chưa bàn giao vận chuyển.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-5">
          {can(permissions.orders.update) && (
            <Card>
              <CardContent>
                <InternalNoteBox orderId={order.id} />
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dòng thời gian</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderTimeline events={order.events} />
            </CardContent>
          </Card>
        </div>
      </div>

      <OrderActionDialogs order={order} kind={dialog} onClose={() => setDialog(null)} onShipped={(o) => setPrintId(o.id)} />
      {editing && <EditOrderDialog order={order} onClose={() => setEditing(false)} />}
      {printId && <HiddenPrintFrame orderId={printId} onDone={clearPrint} />}
    </div>
  )
}

function OrderAlerts({ order }: { order: OrderDetailDto }) {
  const c = order.customer
  const alerts: React.ReactNode[] = []
  if (c.returnCount >= 2) {
    alerts.push(
      <Alert key="return" className="border-warning/40 bg-warning/10 text-foreground">
        <AlertTriangle className="text-warning" aria-hidden="true" />
        <AlertTitle>Khách có {c.returnCount} đơn hoàn hàng</AlertTitle>
        <AlertDescription>
          <span>
            Gọi kỹ trước khi gửi.{' '}
            <Link href={`${routePath.adminOrders}?status=all&customerId=${c.id}`} className="text-primary font-medium underline-offset-4 hover:underline">
              Xem lịch sử đơn
            </Link>
          </span>
        </AlertDescription>
      </Alert>
    )
  }
  if (order.duplicateOrders.length > 0) {
    alerts.push(
      <Alert key="dup" className="border-warning/40 bg-warning/10 text-foreground">
        <AlertTriangle className="text-warning" aria-hidden="true" />
        <AlertTitle>Trùng số điện thoại trong 24 giờ</AlertTitle>
        <AlertDescription>
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            {order.duplicateOrders.map((d) => (
              <Link key={d.id} href={routePath.adminOrderDetail(d.id)} className="text-primary font-medium tabular-nums hover:underline">
                {d.code} · {orderStatusLabels[d.status]} · {formatDateTime(d.placedAt)}
              </Link>
            ))}
          </span>
        </AlertDescription>
      </Alert>
    )
  }
  if (order.status === 'DaHuy') {
    alerts.push(
      <Alert key="cancel" className="border-destructive/30 bg-destructive/5">
        <RotateCcw className="text-destructive" aria-hidden="true" />
        <AlertTitle>
          Đã hủy{order.cancelledAt ? ` lúc ${formatDateTime(order.cancelledAt)}` : ''}
          {order.cancelledByName ? ` · ${order.cancelledByName}` : ''}
        </AlertTitle>
        <AlertDescription>
          {order.cancelReason ? cancelReasonLabels[order.cancelReason] : ''}
          {order.cancelNote ? `: ${order.cancelNote}` : ''}
          {order.paymentStatus === 'CanHoanTien' && ` · Cần hoàn tiền ${formatVnd(order.refundAmount ?? order.total)}`}
        </AlertDescription>
      </Alert>
    )
  }
  if (order.status === 'ChoThanhToan' && order.paymentDueAt) {
    alerts.push(
      <Alert key="due">
        <PackageCheck aria-hidden="true" />
        <AlertTitle>Chờ khách chuyển khoản {formatVnd(order.total)}</AlertTitle>
        <AlertDescription>
          Nội dung chuyển khoản: {order.code}. Quá {formatDateTime(order.paymentDueAt)} chưa nhận tiền thì đơn tự hủy.
        </AlertDescription>
      </Alert>
    )
  }
  return alerts.length ? <div className="grid gap-3">{alerts}</div> : null
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={strong ? 'flex items-center justify-between gap-4 border-t pt-2 text-base font-bold' : 'flex items-center justify-between gap-4'}>
      <dt className={strong ? '' : 'text-muted-foreground'}>{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Đang tải đơn">
      <Skeleton className="h-16 w-80" />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  )
}
