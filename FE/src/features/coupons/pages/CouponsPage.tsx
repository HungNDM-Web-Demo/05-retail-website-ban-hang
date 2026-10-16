'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { Pencil, Plus, TicketPercent, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { SearchInput } from '@/components/shared/SearchInput'
import { StatusBadge, type StatusTone } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import { couponStatusLabels, couponTypeLabels } from '@/config/shop-labels'
import { OrderStatusPill } from '@/features/orders/components/OrderBadges'
import { usePermissions } from '@/hooks/use-permissions'
import { useTableQuery } from '@/hooks/use-table-query'
import { getErrorMessage } from '@/lib/api-error'
import { formatDateTime, formatNumber, formatVnd } from '@/lib/format'
import type { CouponDto, CouponStatus } from '@/types/shop'
import { CouponFormDialog } from '../components/CouponFormDialog'
import { useCoupon, useCouponOrders, useCoupons, useDeleteCoupon, usePauseCoupon } from '../hooks/use-coupons'

const ALL = '__all'
const statusTone: Record<CouponStatus, StatusTone> = {
  SapChay: 'info',
  DangChay: 'success',
  TamDung: 'warning',
  HetLuot: 'neutral',
  HetHan: 'neutral',
}

/** "10% (tối đa 50.000 ₫)", "50.000 ₫", "Miễn phí vận chuyển" */
export const couponValueText = (c: Pick<CouponDto, 'type' | 'value' | 'maxDiscount'>) =>
  c.type === 'PhanTram'
    ? `${c.value}%${c.maxDiscount ? ` (tối đa ${formatVnd(c.maxDiscount)})` : ''}`
    : c.type === 'SoTien'
      ? formatVnd(c.value)
      : 'Miễn phí vận chuyển'

const conditionText = (c: CouponDto) =>
  [c.minOrder ? `Đơn từ ${formatVnd(c.minOrder)}` : 'Mọi đơn', c.categoryName ? `danh mục ${c.categoryName}` : 'toàn shop', `${c.perCustomerLimit} lượt/SĐT`].join(' · ')

/** SCR-14 Mã giảm giá (UC-13; FR-32, FR-33; TC-41) */
export function CouponsPage() {
  return (
    <PermissionGuard permission={permissions.coupons.view} redirect>
      <CouponsView />
    </PermissionGuard>
  )
}

function CouponsView() {
  const { can } = usePermissions()
  const table = useTableQuery<{ status: CouponStatus }>({ pageSize: 20 })
  const coupons = useCoupons(table.query)
  const pause = usePauseCoupon()
  const remove = useDeleteCoupon()
  const [editing, setEditing] = useState<CouponDto | 'new' | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<CouponDto | null>(null)

  const columns: ColumnDef<CouponDto>[] = [
    {
      id: 'code',
      header: 'Mã',
      enableSorting: true,
      cell: ({ row: { original: c } }) => (
        <div>
          <p className="font-mono font-semibold">{c.code}</p>
          <p className="text-muted-foreground max-w-60 truncate text-xs">{c.name}</p>
        </div>
      ),
    },
    {
      id: 'value',
      header: 'Giá trị',
      cell: ({ row: { original: c } }) => (
        <div>
          <p className="font-medium">{couponValueText(c)}</p>
          <p className="text-muted-foreground text-xs">{couponTypeLabels[c.type]}</p>
        </div>
      ),
    },
    { id: 'condition', header: 'Điều kiện', cell: ({ row }) => <span className="text-sm">{conditionText(row.original)}</span> },
    {
      id: 'usedCount',
      header: 'Đã dùng',
      enableSorting: true,
      cell: ({ row: { original: c } }) => (
        <span className="tabular-nums">
          {formatNumber(c.usedCount, 0)}
          <span className="text-muted-foreground"> / {c.totalLimit ? formatNumber(c.totalLimit, 0) : '∞'}</span>
        </span>
      ),
    },
    {
      id: 'startAt',
      header: 'Hiệu lực',
      enableSorting: true,
      cell: ({ row: { original: c } }) => (
        <span className="text-sm tabular-nums">
          {formatDateTime(c.startAt)}
          <br />→ {formatDateTime(c.endAt)}
        </span>
      ),
    },
    { id: 'status', header: 'Trạng thái', cell: ({ row }) => <StatusBadge tone={statusTone[row.original.status]}>{couponStatusLabels[row.original.status]}</StatusBadge> },
    {
      id: 'actions',
      header: '',
      cell: ({ row: { original: c } }) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {can(permissions.coupons.update) && c.status !== 'HetHan' && (
            <label className="mr-1 flex items-center gap-1.5 text-xs">
              <Switch
                size="sm"
                checked={!c.isPaused}
                aria-label={c.isPaused ? `Chạy lại mã ${c.code}` : `Tạm dừng mã ${c.code}`}
                onCheckedChange={(on) =>
                  pause.mutate(
                    { id: c.id, paused: !on },
                    {
                      onSuccess: () => toast.success(on ? `Đã chạy lại mã ${c.code}` : `Đã tạm dừng mã ${c.code}`),
                      onError: (e) => toast.error(getErrorMessage(e)),
                    }
                  )
                }
              />
              {c.isPaused ? 'Dừng' : 'Chạy'}
            </label>
          )}
          {can(permissions.coupons.update) && (
            <Button size="icon-sm" variant="ghost" aria-label={`Sửa mã ${c.code}`} onClick={() => setEditing(c)}>
              <Pencil aria-hidden="true" />
            </Button>
          )}
          {can(permissions.coupons.delete) && (
            <Button size="icon-sm" variant="ghost" aria-label={`Xóa mã ${c.code}`} onClick={() => setDeleting(c)}>
              <Trash2 aria-hidden="true" />
            </Button>
          )}
        </div>
      ),
      meta: { className: 'w-0 whitespace-nowrap' },
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Mã giảm giá"
        icon={TicketPercent}
        description="Mã phần trăm, số tiền, miễn phí vận chuyển. Lượt đã dùng tính trên đơn chưa hủy."
        actions={
          can(permissions.coupons.create) && (
            <Button onClick={() => setEditing('new')}>
              <Plus aria-hidden="true" />
              Thêm mã
            </Button>
          )
        }
      />
      <DataTable
        columns={columns}
        data={coupons.data?.items}
        isLoading={coupons.isLoading}
        isFetching={coupons.isFetching}
        error={coupons.error}
        onRetry={() => void coupons.refetch()}
        getRowId={(c) => c.id}
        onRowClick={(c) => setViewing(c.id)}
        minWidth={1080}
        sorting={{ sortBy: table.state.sortBy, sortDir: table.state.sortDir, onSortChange: table.setSort }}
        pagination={coupons.data && { ...coupons.data, onPageChange: table.setPage, onPageSizeChange: table.setPageSize }}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput onSearch={table.setSearch} placeholder="Mã hoặc tên…" aria-label="Tìm mã" className="w-full sm:w-64" />
            <Select value={table.state.status ?? ALL} onValueChange={(v) => table.setFilter('status', v === ALL ? undefined : (v as CouponStatus))}>
              <SelectTrigger className="w-40" aria-label="Trạng thái">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Mọi trạng thái</SelectItem>
                {(Object.keys(couponStatusLabels) as CouponStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {couponStatusLabels[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
        emptyState={<EmptyState icon={TicketPercent} title="Chưa có mã phù hợp" />}
      />
      {editing && <CouponFormDialog coupon={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      <CouponDetailSheet key={viewing ?? "none"} id={viewing} onClose={() => setViewing(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Xóa mã ${deleting?.code ?? ''}?`}
        description="Chỉ xóa được mã chưa có lượt dùng (kể cả đơn đã hủy). Mã đã dùng hãy tạm dừng."
        variant="destructive"
        confirmText="Xóa mã"
        loading={remove.isPending}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(deleting!.id)
            toast.success('Đã xóa mã')
          } catch (e) {
            toast.error(getErrorMessage(e))
            throw e
          }
        }}
      />
    </div>
  )
}

/** Chi tiết mã (FR-33): số lượt, tổng tiền giảm, giá trị đơn, danh sách đơn đã dùng */
function CouponDetailSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const coupon = useCoupon(id ?? undefined)
  const [page, setPage] = useState(1)
  const orders = useCouponOrders(id ?? undefined, { page, pageSize: 20 })
  const c = coupon.data
  return (
    <Sheet open={!!id} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="font-mono">{c?.code ?? '…'}</SheetTitle>
          <SheetDescription>{c?.name}</SheetDescription>
        </SheetHeader>
        {c && (
          <div className="space-y-5 px-4 pb-6">
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={statusTone[c.status]}>{couponStatusLabels[c.status]}</StatusBadge>
              <span className="text-sm">{couponValueText(c)}</span>
            </div>
            <p className="text-muted-foreground text-sm">
              {conditionText(c)} · {formatDateTime(c.startAt)} → {formatDateTime(c.endAt)}
            </p>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Lượt đã dùng" value={`${formatNumber(c.usedCount, 0)}${c.totalLimit ? ` / ${formatNumber(c.totalLimit, 0)}` : ''}`} />
              <Stat label="Tổng tiền giảm" value={formatVnd(c.discountTotal)} />
              <Stat label="Giá trị đơn" value={formatVnd(c.orderValueTotal)} />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Đơn đã dùng mã ({orders.data?.totalCount ?? '…'})</h3>
              <ul className="divide-y rounded-lg border">
                {(orders.data?.items ?? []).map((o) => (
                  <li key={o.id}>
                    <Link href={routePath.adminOrderDetail(o.id)} className="hover:bg-muted flex items-center gap-3 px-3 py-2.5 text-sm">
                      <span className="text-primary font-semibold tabular-nums">{o.code}</span>
                      <span className="text-muted-foreground flex-1 truncate">
                        {o.customerName} · {formatDateTime(o.placedAt)}
                      </span>
                      <span className="tabular-nums">{formatVnd(o.total)}</span>
                      <OrderStatusPill status={o.status} />
                    </Link>
                  </li>
                ))}
                {orders.data && !orders.data.items.length && <li className="text-muted-foreground p-3 text-sm">Chưa có đơn nào dùng mã.</li>}
              </ul>
              {orders.data && orders.data.totalPages > 1 && (
                <div className="flex items-center justify-between text-sm">
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
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/50 rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
    </div>
  )
}
