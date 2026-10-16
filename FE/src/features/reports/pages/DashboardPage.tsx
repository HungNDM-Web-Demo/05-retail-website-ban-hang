'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import {
  AlertTriangle,
  Banknote,
  ClipboardCheck,
  Clock,
  PackageX,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Truck,
  Undo2,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import { ProductThumb } from '@/features/products/components/ProductThumb'
import { usePermissions } from '@/hooks/use-permissions'
import { formatNumber, formatTime, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DashboardTodo, LowStockItem } from '@/types/shop'
import { compactVnd, formatPercent } from '../components/ReportParts'
import { useDashboardSales, useDashboardTodo } from '../hooks/use-reports'
import { displayDateKey, shortDateKey } from '../lib/date-range'

const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

const chartConfig = {
  netRevenue: { label: 'Doanh thu thuần', color: 'var(--chart-1)' },
  orderValue: { label: 'Giá trị đặt hàng', color: 'var(--chart-2)' },
} satisfies ChartConfig

type TodoCard = { key: keyof Omit<DashboardTodo, 'asOf'>; label: string; icon: LucideIcon; href: string; tone: 'warning' | 'danger' | 'info' }
const TODO: TodoCard[] = [
  { key: 'choXacNhan', label: 'Chờ xác nhận', icon: ClipboardCheck, href: `${routePath.adminOrders}?status=ChoXacNhan`, tone: 'warning' },
  { key: 'choThanhToan', label: 'Chờ thanh toán', icon: Wallet, href: `${routePath.adminOrders}?status=ChoThanhToan`, tone: 'warning' },
  { key: 'choBanGiao', label: 'Chờ bàn giao', icon: Truck, href: `${routePath.adminOrders}?status=DaXacNhan`, tone: 'info' },
  { key: 'dangHoan', label: 'Đang hoàn', icon: Undo2, href: `${routePath.adminOrders}?status=DangHoan`, tone: 'danger' },
  { key: 'giaoCham', label: 'Giao chậm', icon: Clock, href: `${routePath.adminOrders}?status=DangGiao&label=GiaoCham`, tone: 'danger' },
  { key: 'canHoanTien', label: 'Cần hoàn tiền', icon: RotateCcw, href: `${routePath.adminOrders}?status=DaHuy&paymentStatus=CanHoanTien`, tone: 'danger' },
]
const TONE: Record<TodoCard['tone'], string> = {
  warning: 'border-warning/50 bg-warning/8 text-warning',
  danger: 'border-destructive/40 bg-destructive/5 text-destructive',
  info: 'border-info/40 bg-info/8 text-info',
}

/**
 * SCR-08 Tổng quan (UC-12; FR-01…03; TC-39, TC-40): thẻ việc cần làm cho người có `orders.view`;
 * số liệu doanh thu chỉ khi có `reports.view` (Nhân viên không thấy, UC-12 3a).
 */
export function DashboardPage() {
  const { can } = usePermissions()
  const canTodo = can(permissions.orders.view)
  const canSales = can(permissions.reports.view)
  const todo = useDashboardTodo(canTodo)
  const sales = useDashboardSales(canSales)
  const refreshing = todo.isFetching || sales.isFetching

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-muted-foreground text-sm">{capitalize(format(new Date(), "EEEE, 'ngày' dd/MM/yyyy", { locale: vi }))}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Tổng quan</h1>
        </div>
        <div className="flex items-center gap-3">
          {(todo.data ?? sales.data) && <p className="text-muted-foreground text-sm">Cập nhật lúc {formatTime((sales.data ?? todo.data)!.asOf)}</p>}
          <Button
            variant="outline"
            size="lg"
            disabled={refreshing}
            onClick={() => {
              if (canTodo) void todo.refetch()
              if (canSales) void sales.refetch()
            }}
          >
            <RefreshCw className={cn(refreshing && 'animate-spin')} aria-hidden="true" />
            Làm mới
          </Button>
        </div>
      </div>

      {canTodo && (
        <section aria-label="Việc cần làm" className="space-y-3">
          <h2 className="text-base font-semibold">Việc cần làm</h2>
          {todo.error && !todo.data ? (
            <ErrorState error={todo.error} onRetry={() => void todo.refetch()} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {TODO.map((c) => {
                const n = todo.data?.[c.key]
                const active = !!n
                return (
                  <Link
                    key={c.key}
                    href={c.href}
                    className={cn(
                      'group focus-visible:ring-ring/50 bg-card flex min-h-24 flex-col justify-between rounded-xl border p-4 shadow-xs transition-[border-color,box-shadow] outline-none hover:shadow-sm focus-visible:ring-3',
                      active && TONE[c.tone]
                    )}
                  >
                    <span className="text-foreground flex items-center justify-between gap-2 text-sm font-medium">
                      {c.label}
                      <c.icon className={cn('size-4', active ? '' : 'text-muted-foreground')} aria-hidden="true" />
                    </span>
                    {n === undefined ? (
                      <Skeleton className="h-8 w-12" />
                    ) : (
                      <span className={cn('text-3xl font-semibold tabular-nums', !active && 'text-muted-foreground')}>{formatNumber(n, 0)}</span>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      )}

      {canSales && <SalesSection query={sales} />}
    </div>
  )
}

function SalesSection({ query }: { query: ReturnType<typeof useDashboardSales> }) {
  const data = query.data
  if (query.error && !data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  const hasChart = data?.series30d.some((d) => d.orderValue > 0 || d.netRevenue > 0)
  return (
    <>
      <section aria-label="Hôm nay" className="space-y-3">
        <h2 className="text-base font-semibold">Hôm nay</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Figure label="Doanh thu thuần" icon={Banknote} value={data?.today.netRevenue} prev={data?.yesterdaySamePeriod.netRevenue} money />
          <Figure label="Giá trị đặt hàng" icon={Wallet} value={data?.today.orderValue} prev={data?.yesterdaySamePeriod.orderValue} money />
          <Figure label="Số đơn mới" icon={ShoppingBag} value={data?.today.newOrders} prev={data?.yesterdaySamePeriod.newOrders} />
          <RateCard label="Tỉ lệ hủy 30 ngày" value={data?.cancelRate30d} />
          <RateCard label="Tỉ lệ hoàn 30 ngày" value={data?.returnRate30d} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">30 ngày gần nhất</CardTitle>
            <CardDescription>Cột: doanh thu thuần (đơn đã giao, theo ngày giao). Đường: giá trị đặt hàng (không tính đơn hủy).</CardDescription>
          </CardHeader>
          <CardContent>
            {!data ? (
              <Skeleton className="h-72" />
            ) : !hasChart ? (
              <EmptyState compact title="Chưa có số liệu 30 ngày" />
            ) : (
              <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full" aria-label="Biểu đồ doanh thu 30 ngày">
                <ComposedChart data={data.series30d} margin={{ left: 4, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDateKey} tickLine={false} axisLine={false} minTickGap={16} />
                  <YAxis tickFormatter={compactVnd} tickLine={false} axisLine={false} width={56} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(v) => displayDateKey(String(v))}
                        formatter={(value, name) => (
                          <div className="flex w-full justify-between gap-4">
                            <span className="text-muted-foreground">{chartConfig[name as keyof typeof chartConfig]?.label}</span>
                            <span className="font-medium tabular-nums">{formatVnd(Number(value))}</span>
                          </div>
                        )}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="netRevenue" fill="var(--color-netRevenue)" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Line dataKey="orderValue" type="monotone" stroke="var(--color-orderValue)" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bán chạy 30 ngày</CardTitle>
            <CardDescription>Theo số lượng, đơn đã giao.</CardDescription>
          </CardHeader>
          <CardContent>
            {!data ? (
              <Skeleton className="h-64" />
            ) : !data.topProducts30d.length ? (
              <EmptyState compact title="Chưa có sản phẩm bán ra" />
            ) : (
              <ol className="space-y-3">
                {data.topProducts30d.map((p, i) => (
                  <li key={p.productId}>
                    <Link href={routePath.adminProductDetail(p.productId)} className="hover:bg-muted -mx-2 flex items-center gap-3 rounded-lg p-2">
                      <span className="text-muted-foreground w-4 text-sm font-semibold tabular-nums">{i + 1}</span>
                      <ProductThumb url={p.coverUrl} alt={p.name} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{p.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {p.code} · {formatVnd(p.netRevenue)}
                        </span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums">{formatNumber(p.quantity, 0)} cái</span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <StockList title="Sắp hết hàng (tồn 1–5)" icon={AlertTriangle} items={data?.lowStock} tone="warning" />
        <StockList title="Hết hàng" icon={PackageX} items={data?.outOfStock} tone="danger" />
      </div>
    </>
  )
}

/** Thẻ số hôm nay kèm tăng giảm so với cùng giờ hôm qua; hôm qua bằng 0 → "—" (UC-12 E1) */
function Figure({ label, icon: Icon, value, prev, money }: { label: string; icon: LucideIcon; value?: number; prev?: number; money?: boolean }) {
  const fmt = (v: number) => (money ? formatVnd(v) : formatNumber(v, 0))
  const pct = value !== undefined && prev ? ((value - prev) / prev) * 100 : null
  const up = (pct ?? 0) >= 0
  return (
    <div className="bg-card rounded-xl border p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground text-sm font-medium">{label}</p>
        <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Icon className="size-[1.125rem]" aria-hidden="true" />
        </span>
      </div>
      {value === undefined ? <Skeleton className="mt-2 h-8 w-32" /> : <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{fmt(value)}</p>}
      {value !== undefined && (
        <p className="mt-2 flex items-center gap-1.5 text-xs">
          {pct === null ? (
            <span className="font-semibold">—</span>
          ) : (
            <span className={cn('inline-flex items-center gap-0.5 font-semibold', up ? 'text-success' : 'text-destructive')}>
              {up ? <TrendingUp className="size-3.5" aria-hidden="true" /> : <TrendingDown className="size-3.5" aria-hidden="true" />}
              {up ? '+' : '−'}
              {formatNumber(Math.abs(pct), 1)}%
            </span>
          )}
          <span className="text-muted-foreground">so với cùng giờ hôm qua ({fmt(prev ?? 0)})</span>
        </p>
      )}
    </div>
  )
}

function RateCard({ label, value }: { label: string; value?: number }) {
  return (
    <div className="bg-card rounded-xl border p-5 shadow-xs">
      <p className="text-muted-foreground text-sm font-medium">{label}</p>
      {value === undefined ? <Skeleton className="mt-2 h-8 w-20" /> : <p className="mt-1 text-2xl font-semibold tabular-nums">{formatPercent(value)}</p>}
      <p className="text-muted-foreground mt-2 text-xs">Trên đơn đặt 30 ngày gần nhất</p>
    </div>
  )
}

function StockList({ title, icon: Icon, items, tone }: { title: string; icon: LucideIcon; items?: LowStockItem[]; tone: 'warning' | 'danger' }) {
  return (
    <Card className="gap-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className={cn('size-4', tone === 'warning' ? 'text-warning' : 'text-destructive')} aria-hidden="true" />
          {title}
          {items && <span className="text-muted-foreground font-normal">({items.length})</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {!items ? (
          <Skeleton className="mx-6 h-40" />
        ) : !items.length ? (
          <p className="text-muted-foreground px-6 pb-2 text-sm">Không có biến thể nào.</p>
        ) : (
          <ul className="max-h-80 divide-y overflow-auto border-t">
            {items.map((v) => (
              <li key={v.variantId}>
                <Link href={routePath.adminProductDetail(v.productId)} className="hover:bg-muted/50 flex items-center gap-3 px-6 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{v.productName}</span>
                    <span className="text-muted-foreground text-xs">
                      {v.size ? `${v.colorName} / ${v.size}` : v.colorName} · {v.sku}
                    </span>
                  </span>
                  <span className={cn('font-semibold tabular-nums', tone === 'warning' ? 'text-warning' : 'text-destructive')}>{v.stock}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
