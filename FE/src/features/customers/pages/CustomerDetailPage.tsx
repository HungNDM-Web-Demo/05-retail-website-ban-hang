'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Phone, Save, SearchX } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import { paymentMethodShortLabels } from '@/config/shop-labels'
import { OrderLabelPills, OrderStatusPill } from '@/features/orders/components/OrderBadges'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage, isApiError } from '@/lib/api-error'
import { formatDate, formatDateTime, formatNumber, formatPhone, formatVnd } from '@/lib/format'
import type { CustomerDetail } from '@/types/shop'
import { CustomerTags } from '../components/CustomerTags'
import { useCustomer, useCustomerOrders, useUpdateCustomerNote } from '../hooks/use-customers'

/** Hồ sơ khách (UC-14): thông tin, thống kê, ghi chú (FR-36), lịch sử đơn */
export function CustomerDetailPage({ id }: { id: string }) {
  return (
    <PermissionGuard permission={permissions.customers.view} redirect>
      <CustomerDetailView id={id} />
    </PermissionGuard>
  )
}

function CustomerDetailView({ id }: { id: string }) {
  const customer = useCustomer(id)
  if (customer.error && !customer.data) {
    if (isApiError(customer.error) && customer.error.status === 404)
      return (
        <EmptyState
          icon={SearchX}
          title="Không tìm thấy khách hàng"
          action={
            <Button asChild variant="outline">
              <Link href={routePath.adminCustomers}>Về danh sách khách</Link>
            </Button>
          }
        />
      )
    return <ErrorState error={customer.error} onRetry={() => void customer.refetch()} />
  }
  if (!customer.data) return <Skeleton className="h-96 rounded-xl" />
  const c = customer.data
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Link href={routePath.adminCustomers} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Khách hàng
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
          <CustomerTags tags={c.tags} />
        </div>
        <a href={`tel:${c.phone}`} className="text-primary inline-flex min-h-11 items-center gap-1.5 font-medium tabular-nums hover:underline">
          <Phone className="size-4" aria-hidden="true" />
          {formatPhone(c.phone)}
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Stat label="Số đơn" value={formatNumber(c.orderCount, 0)} />
        <Stat label="Đã giao" value={formatNumber(c.deliveredCount, 0)} />
        <Stat label="Hoàn" value={formatNumber(c.returnCount, 0)} warn={c.returnCount >= 2} />
        <Stat label="Đã hủy" value={formatNumber(c.cancelledCount, 0)} />
        <Stat label="Tổng chi tiêu" value={formatVnd(c.totalSpent)} />
        <Stat label="Khách từ" value={formatDate(c.firstOrderAt)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Thông tin</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              {c.email && <p>{c.email}</p>}
              <p>
                {c.addressLine}, {c.wardName}, {c.provinceName}
              </p>
              <p className="text-muted-foreground">Đặt gần nhất {formatDateTime(c.lastOrderAt)}</p>
            </CardContent>
          </Card>
          <NoteCard customer={c} />
        </div>
        <div className="lg:col-span-2">
          <OrderHistory id={c.id} />
        </div>
      </div>
    </div>
  )
}

function NoteCard({ customer }: { customer: CustomerDetail }) {
  const { can } = usePermissions()
  const [note, setNote] = useState(customer.note ?? '')
  const update = useUpdateCustomerNote(customer.id)
  const editable = can(permissions.customers.update)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ghi chú về khách</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {editable ? (
          <>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} maxLength={1000} aria-label="Ghi chú về khách" placeholder="Vd: Khách quen, thích size M" />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs tabular-nums">{note.length}/1.000</span>
              <Button
                size="sm"
                disabled={update.isPending || note === (customer.note ?? '')}
                onClick={() =>
                  update.mutate(note.trim() || undefined, {
                    onSuccess: () => toast.success('Đã lưu ghi chú'),
                    onError: (e) => toast.error(getErrorMessage(e)),
                  })
                }
              >
                {update.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
                Lưu ghi chú
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm">{customer.note || <span className="text-muted-foreground">Chưa có ghi chú.</span>}</p>
        )}
      </CardContent>
    </Card>
  )
}

function OrderHistory({ id }: { id: string }) {
  const [page, setPage] = useState(1)
  const orders = useCustomerOrders(id, { page, pageSize: 20 })
  return (
    <Card className="gap-0">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Lịch sử đơn ({orders.data?.totalCount ?? '…'})</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {orders.error ? (
          <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
        ) : (
          <ul className="divide-y border-y">
            {(orders.data?.items ?? []).map((o) => (
              <li key={o.id}>
                <Link href={routePath.adminOrderDetail(o.id)} className="hover:bg-muted/50 flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-3 text-sm">
                  <span className="text-primary w-32 font-semibold tabular-nums">{o.code}</span>
                  <span className="text-muted-foreground w-32 tabular-nums">{formatDateTime(o.placedAt)}</span>
                  <span className="text-muted-foreground w-24">{paymentMethodShortLabels[o.paymentMethod]}</span>
                  <span className="w-28 text-right font-medium tabular-nums">{formatVnd(o.total)}</span>
                  <OrderStatusPill status={o.status} />
                  <OrderLabelPills labels={o.labels} />
                </Link>
              </li>
            ))}
            {!orders.data && <Skeleton className="m-6 h-40" />}
          </ul>
        )}
        {orders.data && orders.data.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 pt-3 text-sm">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Trước
            </Button>
            <span className="text-muted-foreground">
              Trang {page}/{orders.data.totalPages}
            </span>
            <Button size="sm" variant="outline" disabled={!orders.data.hasNextPage} onClick={() => setPage((p) => p + 1)}>
              Sau
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={warn ? 'border-warning/40 bg-warning/10 rounded-xl border p-3' : 'bg-card rounded-xl border p-3 shadow-xs'}>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={warn ? 'text-warning mt-1 text-lg font-semibold tabular-nums' : 'mt-1 text-lg font-semibold tabular-nums'}>{value}</p>
    </div>
  )
}
