'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { FilterX, PackageSearch, Plus } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { SearchInput } from '@/components/shared/SearchInput'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import { productStatusLabels, stockStatusLabels } from '@/config/shop-labels'
import { usePermissions } from '@/hooks/use-permissions'
import { useTableQuery } from '@/hooks/use-table-query'
import { formatNumber, formatVnd } from '@/lib/format'
import type { ProductListItem, ProductStatus, StockStatus } from '@/types/shop'
import { useCategories, useProducts } from '../hooks/use-products'
import { ProductThumb } from './ProductThumb'

const ALL = '__all'
const stockTone: Record<StockStatus, 'success' | 'warning' | 'danger'> = { ConHang: 'success', SapHet: 'warning', HetHang: 'danger' }

type Filters = { categoryId: string; status: ProductStatus; stockStatus: StockStatus }

/** Tab Sản phẩm (SCR-09, FR-19): tìm tên, mã, SKU; lọc danh mục, trạng thái, tình trạng tồn */
export function ProductsTab() {
  const router = useRouter()
  const { can } = usePermissions()
  const table = useTableQuery<Filters>({ pageSize: 20 })
  const products = useProducts(table.query)
  const categories = useCategories()
  const filtered = !!(table.state.search || table.state.categoryId || table.state.status || table.state.stockStatus)

  const columns: ColumnDef<ProductListItem>[] = [
    {
      id: 'name',
      header: 'Sản phẩm',
      enableSorting: true,
      cell: ({ row: { original: p } }) => (
        <div className="flex items-center gap-3">
          <ProductThumb url={p.coverUrl} alt={p.name} />
          <div className="min-w-0">
            <Link href={routePath.adminProductDetail(p.id)} onClick={(e) => e.stopPropagation()} className="block truncate font-medium hover:underline">
              {p.name}
            </Link>
            <p className="text-muted-foreground text-xs tabular-nums">
              {p.code}
              {p.isFeatured && ' · Nổi bật'}
            </p>
          </div>
        </div>
      ),
    },
    { id: 'categoryName', header: 'Danh mục', cell: ({ row }) => row.original.categoryName },
    {
      id: 'price',
      header: 'Giá bán',
      enableSorting: true,
      cell: ({ row: { original: p } }) => (
        <div className="text-right tabular-nums">
          <p className="font-medium">{formatVnd(p.price)}</p>
          {p.listPrice && <p className="text-muted-foreground text-xs line-through">{formatVnd(p.listPrice)}</p>}
        </div>
      ),
      meta: { className: 'text-right', headerClassName: 'text-right' },
    },
    {
      id: 'totalStock',
      header: 'Tổng tồn',
      enableSorting: true,
      cell: ({ row }) => <span className="tabular-nums">{formatNumber(row.original.totalStock, 0)}</span>,
      meta: { className: 'text-right', headerClassName: 'text-right' },
    },
    {
      id: 'variants',
      header: 'Biến thể hết / sắp hết',
      cell: ({ row: { original: p } }) => (
        <span className="tabular-nums">
          <span className={p.outOfStockCount ? 'text-destructive font-semibold' : ''}>{p.outOfStockCount}</span>
          {' / '}
          <span className={p.lowStockCount ? 'text-warning font-semibold' : ''}>{p.lowStockCount}</span>
          <span className="text-muted-foreground"> trên {p.variantCount}</span>
        </span>
      ),
    },
    {
      id: 'soldCount',
      header: 'Đã bán',
      enableSorting: true,
      cell: ({ row }) => <span className="tabular-nums">{formatNumber(row.original.soldCount, 0)}</span>,
      meta: { className: 'text-right', headerClassName: 'text-right' },
    },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: ({ row: { original: p } }) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge tone={p.status === 'DangBan' ? 'primary' : 'neutral'}>{productStatusLabels[p.status]}</StatusBadge>
          <StatusBadge tone={stockTone[p.stockStatus]} dot={false}>
            {stockStatusLabels[p.stockStatus]}
          </StatusBadge>
        </div>
      ),
    },
  ]

  const select = <K extends keyof Filters>(key: K, value: string) => table.setFilter(key, value === ALL ? undefined : (value as Filters[K]))

  return (
    <DataTable
      columns={columns}
      data={products.data?.items}
      isLoading={products.isLoading}
      isFetching={products.isFetching}
      error={products.error}
      onRetry={() => void products.refetch()}
      getRowId={(p) => p.id}
      onRowClick={(p) => router.push(routePath.adminProductDetail(p.id))}
      minWidth={1000}
      sorting={{ sortBy: table.state.sortBy, sortDir: table.state.sortDir, onSortChange: table.setSort }}
      pagination={products.data && { ...products.data, onPageChange: table.setPage, onPageSizeChange: table.setPageSize, pageSizeOptions: [20, 50, 100] }}
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput onSearch={table.setSearch} placeholder="Tên, mã, SKU…" aria-label="Tìm sản phẩm" className="w-full sm:w-64" />
          <Select value={table.state.categoryId ?? ALL} onValueChange={(v) => select('categoryId', v)}>
            <SelectTrigger className="w-44" aria-label="Danh mục">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Mọi danh mục</SelectItem>
              {(categories.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={table.state.status ?? ALL} onValueChange={(v) => select('status', v)}>
            <SelectTrigger className="w-36" aria-label="Trạng thái">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Mọi trạng thái</SelectItem>
              {(Object.keys(productStatusLabels) as ProductStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {productStatusLabels[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={table.state.stockStatus ?? ALL} onValueChange={(v) => select('stockStatus', v)}>
            <SelectTrigger className="w-36" aria-label="Tình trạng tồn">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Mọi tình trạng tồn</SelectItem>
              {(Object.keys(stockStatusLabels) as StockStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {stockStatusLabels[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filtered && (
            <Button variant="ghost" onClick={table.resetFilters}>
              <FilterX aria-hidden="true" />
              Xóa bộ lọc
            </Button>
          )}
        </div>
      }
      emptyState={
        <EmptyState
          icon={PackageSearch}
          title={filtered ? 'Không có sản phẩm phù hợp' : 'Chưa có sản phẩm'}
          action={
            !filtered && can(permissions.products.create) ? (
              <Button asChild>
                <Link href={routePath.adminProductNew}>
                  <Plus aria-hidden="true" />
                  Thêm sản phẩm
                </Link>
              </Button>
            ) : undefined
          }
        />
      }
    />
  )
}
