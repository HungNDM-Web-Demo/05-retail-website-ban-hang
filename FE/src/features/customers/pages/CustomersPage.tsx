'use client'

import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { Users } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { SearchInput } from '@/components/shared/SearchInput'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import { customerTagLabels } from '@/config/shop-labels'
import { useProvinces } from '@/features/sales/hooks/use-provinces'
import { useTableQuery } from '@/hooks/use-table-query'
import { formatDate, formatNumber, formatPhone, formatVnd } from '@/lib/format'
import type { CustomerListItem, CustomerTag } from '@/types/shop'
import { CustomerTags } from '../components/CustomerTags'
import { useCustomers } from '../hooks/use-customers'

const ALL = '__all'

/** SCR-15 Khách hàng (UC-14; FR-35, FR-36): lọc nhãn Khách VIP, Cần lưu ý; mở hồ sơ */
export function CustomersPage() {
  return (
    <PermissionGuard permission={permissions.customers.view} redirect>
      <CustomersView />
    </PermissionGuard>
  )
}

function CustomersView() {
  const router = useRouter()
  const provinces = useProvinces()
  const table = useTableQuery<{ tag: CustomerTag; provinceCode: string }>({ pageSize: 20 })
  const customers = useCustomers(table.query)

  const columns: ColumnDef<CustomerListItem>[] = [
    {
      id: 'name',
      header: 'Khách',
      enableSorting: true,
      cell: ({ row: { original: c } }) => (
        <div className="space-y-1">
          <p className="font-medium">{c.name}</p>
          <CustomerTags tags={c.tags} />
        </div>
      ),
    },
    { id: 'phone', header: 'Số điện thoại', cell: ({ row }) => <span className="tabular-nums">{formatPhone(row.original.phone)}</span> },
    { id: 'provinceName', header: 'Tỉnh/thành', cell: ({ row }) => row.original.provinceName },
    { id: 'orderCount', header: 'Số đơn', enableSorting: true, cell: ({ row }) => <span className="tabular-nums">{row.original.orderCount}</span>, meta: { className: 'text-right', headerClassName: 'text-right' } },
    { id: 'deliveredCount', header: 'Đã giao', enableSorting: true, cell: ({ row }) => <span className="tabular-nums">{row.original.deliveredCount}</span>, meta: { className: 'text-right', headerClassName: 'text-right' } },
    {
      id: 'returnCount',
      header: 'Hoàn',
      enableSorting: true,
      cell: ({ row }) => <span className={row.original.returnCount >= 2 ? 'text-warning font-semibold tabular-nums' : 'tabular-nums'}>{row.original.returnCount}</span>,
      meta: { className: 'text-right', headerClassName: 'text-right' },
    },
    { id: 'totalSpent', header: 'Tổng chi tiêu', enableSorting: true, cell: ({ row }) => <span className="font-medium tabular-nums">{formatVnd(row.original.totalSpent)}</span>, meta: { className: 'text-right', headerClassName: 'text-right' } },
    { id: 'lastOrderAt', header: 'Đặt gần nhất', enableSorting: true, cell: ({ row }) => <span className="tabular-nums">{formatDate(row.original.lastOrderAt)}</span> },
  ]

  return (
    <div className="space-y-5">
      <PageHeader title="Khách hàng" icon={Users} description="Hồ sơ tự tạo theo số điện thoại khi khách đặt đơn. Tổng chi tiêu tính đơn đã giao." />
      <DataTable
        columns={columns}
        data={customers.data?.items}
        isLoading={customers.isLoading}
        isFetching={customers.isFetching}
        error={customers.error}
        onRetry={() => void customers.refetch()}
        getRowId={(c) => c.id}
        onRowClick={(c) => router.push(routePath.adminCustomerDetail(c.id))}
        minWidth={960}
        sorting={{ sortBy: table.state.sortBy, sortDir: table.state.sortDir, onSortChange: table.setSort }}
        pagination={customers.data && { ...customers.data, onPageChange: table.setPage, onPageSizeChange: table.setPageSize }}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput onSearch={table.setSearch} placeholder="Tên hoặc số điện thoại…" aria-label="Tìm khách" className="w-full sm:w-64" />
            <Select value={table.state.tag ?? ALL} onValueChange={(v) => table.setFilter('tag', v === ALL ? undefined : (v as CustomerTag))}>
              <SelectTrigger className="w-40" aria-label="Nhãn">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Mọi nhãn</SelectItem>
                {(Object.keys(customerTagLabels) as CustomerTag[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {customerTagLabels[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={table.state.provinceCode ?? ALL} onValueChange={(v) => table.setFilter('provinceCode', v === ALL ? undefined : v)}>
              <SelectTrigger className="w-44" aria-label="Tỉnh/thành">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                <SelectItem value={ALL}>Mọi tỉnh/thành</SelectItem>
                {(provinces.data ?? []).map((p) => (
                  <SelectItem key={p.code} value={p.code}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground ml-auto text-sm">{customers.data ? `${formatNumber(customers.data.totalCount, 0)} khách` : ''}</span>
          </div>
        }
        emptyState={<EmptyState icon={Users} title="Không có khách phù hợp" />}
      />
    </div>
  )
}
