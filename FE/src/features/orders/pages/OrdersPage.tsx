'use client'

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { CheckCheck, PackageX, Printer, ReceiptText, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import { paymentMethodShortLabels } from '@/config/shop-labels'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage } from '@/lib/api-error'
import { formatDateTime, formatPhone, formatVnd } from '@/lib/format'
import type { BulkResult, OrderListItem } from '@/types/shop'
import { BulkResultDialog } from '../components/BulkResultDialog'
import { BulkShipDialog } from '../components/BulkShipDialog'
import { OrderLabelPills, OrderStatusPill, PaymentStatusPill } from '../components/OrderBadges'
import { OrderFilterBar } from '../components/OrderFilterBar'
import { OrderStatusTabs } from '../components/OrderStatusTabs'
import { useBulkConfirm, useOrderStatusCounts, useOrders } from '../hooks/use-orders'
import { baseQuery, filtersToParams, hasExtraFilters, parseOrderFilters, type OrderFilters } from '../lib/order-ui'

const PAGE_SIZE = 50

/** SCR-11 Danh sách đơn (UC-07, FR-21; P3 FR-31 xử lý hàng loạt) */
export function OrdersPage() {
  return (
    <PermissionGuard permission={permissions.orders.view} redirect>
      <Suspense>
        <OrdersView />
      </Suspense>
    </PermissionGuard>
  )
}

function OrdersView() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const filters = useMemo(() => parseOrderFilters(new URLSearchParams(params.toString())), [params])
  const { can } = usePermissions()
  const [selected, setSelected] = useState<Record<string, OrderListItem>>({})
  const [resetKey, setResetKey] = useState(0)
  const [shipOpen, setShipOpen] = useState(false)
  const [bulkResult, setBulkResult] = useState<{ title: string; result: BulkResult } | null>(null)
  const bulkConfirm = useBulkConfirm()

  const counts = useOrderStatusCounts(baseQuery(filters))
  const listQuery = {
    ...baseQuery(filters),
    status: filters.tab === 'all' ? undefined : filters.tab,
    page: filters.page,
    pageSize: PAGE_SIZE,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
  }
  const orders = useOrders(Object.fromEntries(Object.entries(listQuery).filter(([, v]) => v !== undefined)))

  const update = (patch: Partial<OrderFilters>, keepPage = false) => {
    const next = { ...filters, ...patch, page: keepPage ? (patch.page ?? filters.page) : (patch.page ?? 1) }
    const qs = filtersToParams(next).toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    if (!keepPage) setSelected({})
  }
  const reset = () => {
    setResetKey((k) => k + 1)
    update({
      search: undefined,
      fromDate: undefined,
      toDate: undefined,
      paymentMethod: undefined,
      paymentStatus: undefined,
      provinceCode: undefined,
      label: undefined,
      customerId: undefined,
      couponId: undefined,
    })
  }

  const items = orders.data?.items ?? []
  const selectedList = Object.values(selected)
  const pageAllSelected = items.length > 0 && items.every((o) => selected[o.id])
  const toggle = (o: OrderListItem, on: boolean) =>
    setSelected((s) => {
      const next = { ...s }
      if (on) next[o.id] = o
      else delete next[o.id]
      return next
    })
  const togglePage = (on: boolean) =>
    setSelected((s) => {
      const next = { ...s }
      for (const o of items) {
        if (on) next[o.id] = o
        else delete next[o.id]
      }
      return next
    })

  const confirmables = selectedList.filter((o) => o.status === 'ChoXacNhan')
  const shippables = selectedList.filter((o) => o.status === 'DaXacNhan')
  const bulkEnabled = can(permissions.orders.confirm) || can(permissions.orders.ship)

  const runBulkConfirm = async () => {
    try {
      const result = await bulkConfirm.mutateAsync({
        items: confirmables.map((o) => ({ id: o.id, version: o.version })),
      })
      setSelected({})
      if (result.failed.length) setBulkResult({ title: 'Kết quả xác nhận hàng loạt', result })
      else toast.success(`Đã xác nhận ${result.succeeded.length} đơn`)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const columns: ColumnDef<OrderListItem>[] = [
    ...(bulkEnabled
      ? [
          {
            id: 'select',
            header: () => (
              <Checkbox
                aria-label="Chọn mọi đơn trong trang"
                checked={pageAllSelected}
                onCheckedChange={(v) => togglePage(v === true)}
              />
            ),
            cell: ({ row }) => (
              <span onClick={(e) => e.stopPropagation()} className="inline-flex">
                <Checkbox
                  aria-label={`Chọn đơn ${row.original.code}`}
                  checked={!!selected[row.original.id]}
                  onCheckedChange={(v) => toggle(row.original, v === true)}
                />
              </span>
            ),
            meta: { className: 'w-10', headerClassName: 'w-10' },
          } satisfies ColumnDef<OrderListItem>,
        ]
      : []),
    {
      id: 'code',
      header: 'Mã đơn',
      enableSorting: true,
      cell: ({ row }) => (
        <div className="space-y-1">
          <Link
            href={routePath.adminOrderDetail(row.original.id)}
            onClick={(e) => e.stopPropagation()}
            className="text-primary font-semibold tabular-nums hover:underline"
          >
            {row.original.code}
          </Link>
          <OrderLabelPills labels={row.original.labels} />
        </div>
      ),
    },
    {
      id: 'placedAt',
      header: 'Đặt lúc',
      enableSorting: true,
      cell: ({ row }) => <span className="tabular-nums">{formatDateTime(row.original.placedAt)}</span>,
    },
    {
      id: 'customer',
      header: 'Khách',
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.original.customerName}</p>
          <p className="text-muted-foreground text-xs tabular-nums">{formatPhone(row.original.phone)}</p>
        </div>
      ),
    },
    { id: 'province', header: 'Tỉnh/thành', cell: ({ row }) => row.original.provinceName },
    {
      id: 'itemCount',
      header: 'SL',
      cell: ({ row }) => <span className="tabular-nums">{row.original.itemCount}</span>,
      meta: { className: 'text-right', headerClassName: 'text-right' },
    },
    {
      id: 'total',
      header: 'Tổng',
      enableSorting: true,
      cell: ({ row }) => (
        <div className="text-right">
          <p className="font-semibold tabular-nums">{formatVnd(row.original.total)}</p>
          {row.original.couponCode && <p className="text-muted-foreground text-xs">{row.original.couponCode}</p>}
        </div>
      ),
      meta: { className: 'text-right', headerClassName: 'text-right' },
    },
    {
      id: 'payment',
      header: 'Thanh toán',
      cell: ({ row }) => (
        <div className="space-y-1">
          <p className="text-sm">{paymentMethodShortLabels[row.original.paymentMethod]}</p>
          {row.original.paymentStatus !== 'ChuaThanhToan' && <PaymentStatusPill status={row.original.paymentStatus} />}
        </div>
      ),
    },
    { id: 'status', header: 'Trạng thái', cell: ({ row }) => <OrderStatusPill status={row.original.status} /> },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Đơn hàng"
        icon={ReceiptText}
        description="Đơn chờ lâu nhất nằm trên cùng. Bấm một dòng để xem chi tiết và xử lý."
      />
      <OrderStatusTabs value={filters.tab} counts={counts.data} onChange={(tab) => update({ tab, sortBy: undefined, sortDir: undefined })} />

      {selectedList.length > 0 && (
        <div
          role="region"
          aria-label="Thao tác hàng loạt"
          className="border-primary/30 bg-primary/5 sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border p-3 shadow-sm"
        >
          <p className="mr-2 text-sm font-medium">Đã chọn {selectedList.length} đơn</p>
          {can(permissions.orders.confirm) && (
            <Button onClick={runBulkConfirm} disabled={!confirmables.length || bulkConfirm.isPending}>
              <CheckCheck aria-hidden="true" />
              Xác nhận ({confirmables.length})
            </Button>
          )}
          {can(permissions.orders.ship) && (
            <>
              <Button variant="outline" onClick={() => setShipOpen(true)} disabled={!shippables.length}>
                <Truck aria-hidden="true" />
                Bàn giao ({shippables.length})
              </Button>
              <Button variant="outline" asChild>
                <a
                  href={`${routePath.adminOrdersPrint}?ids=${selectedList.map((o) => o.id).join(',')}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Printer aria-hidden="true" />
                  In phiếu ({selectedList.length})
                </a>
              </Button>
            </>
          )}
          <Button variant="ghost" className="ml-auto" onClick={() => setSelected({})}>
            Bỏ chọn
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={orders.data?.items}
        isLoading={orders.isLoading}
        isFetching={orders.isFetching}
        error={orders.error}
        onRetry={() => void orders.refetch()}
        getRowId={(o) => o.id}
        onRowClick={(o) => router.push(routePath.adminOrderDetail(o.id))}
        minWidth={1080}
        toolbar={<OrderFilterBar filters={filters} onChange={(p) => update(p)} onReset={reset} resetKey={resetKey} />}
        sorting={{
          sortBy: filters.sortBy,
          sortDir: filters.sortDir,
          onSortChange: (sortBy, sortDir) => update({ sortBy, sortDir }),
        }}
        pagination={
          orders.data && {
            ...orders.data,
            onPageChange: (page) => update({ page }, true),
          }
        }
        emptyState={
          <EmptyState
            icon={PackageX}
            title={hasExtraFilters(filters) ? 'Không có đơn khớp bộ lọc' : 'Không có đơn ở trạng thái này'}
            action={
              hasExtraFilters(filters) ? (
                <Button variant="outline" onClick={reset}>
                  Xóa bộ lọc
                </Button>
              ) : undefined
            }
          />
        }
      />

      <BulkShipDialog
        open={shipOpen}
        onOpenChange={setShipOpen}
        orders={shippables}
        onDone={(result) => {
          setSelected({})
          if (result.failed.length) setBulkResult({ title: 'Kết quả bàn giao hàng loạt', result })
          else toast.success(`Đã bàn giao ${result.succeeded.length} đơn`)
        }}
      />
      <BulkResultDialog value={bulkResult} onClose={() => setBulkResult(null)} orders={items} />
    </div>
  )
}
