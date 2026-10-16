'use client'

import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { PackageSearch } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useCategories } from '@/features/products/hooks/use-products'
import { formatNumber, formatVnd } from '@/lib/format'
import type { TopProductGroupBy, TopProductRow } from '@/types/shop'
import { useTopProductsReport } from '../hooks/use-reports'
import { displayDateKey } from '../lib/date-range'
import { excelSheet, reportFileName, type ExcelColumn } from '../lib/export-excel'
import { ExportButton, Stat, TabLoading, TabToolbar, compactVnd, formatPercent, type ReportTabProps } from './ReportParts'

const ALL = '__all'
const config = { netRevenue: { label: 'Doanh thu thuần', color: 'var(--chart-1)' } } satisfies ChartConfig
const labelOf = (r: TopProductRow) => (r.sku ? `${r.name} – ${r.size ? `${r.colorName} / ${r.size}` : r.colorName}` : r.name)

/** Tab Sản phẩm bán chạy (FR-38): theo sản phẩm hoặc theo biến thể (màu × size), lọc danh mục */
export function TopProductsTab({ range, enabled }: ReportTabProps) {
  const [groupBy, setGroupBy] = useState<TopProductGroupBy>('product')
  const [categoryId, setCategoryId] = useState<string>()
  const categories = useCategories()
  const report = useTopProductsReport({ ...range, groupBy, ...(categoryId ? { categoryId } : {}) }, { enabled })
  const data = report.data

  const columns: ExcelColumn<TopProductRow>[] = [
    { header: 'Mã', value: (r) => r.code, width: 10 },
    { header: 'Sản phẩm', value: (r) => r.name, width: 32 },
    ...(groupBy === 'variant'
      ? [
          { header: 'SKU', value: (r: TopProductRow) => r.sku, width: 16 },
          { header: 'Màu', value: (r: TopProductRow) => r.colorName, width: 12 },
          { header: 'Size', value: (r: TopProductRow) => r.size, width: 8 },
        ]
      : []),
    { header: 'Số lượng', value: (r) => r.quantity, width: 10 },
    { header: 'Doanh thu thuần', value: (r) => r.netRevenue, width: 18 },
    { header: 'Tỉ trọng (%)', value: (r) => r.share, width: 12, format: '0.0' },
  ]

  return (
    <div className="space-y-4">
      <TabToolbar>
        <ToggleGroup type="single" variant="outline" value={groupBy} onValueChange={(v) => v && setGroupBy(v as TopProductGroupBy)} aria-label="Gộp theo">
          <ToggleGroupItem value="product" className="h-10 px-4">
            Theo sản phẩm
          </ToggleGroupItem>
          <ToggleGroupItem value="variant" className="h-10 px-4">
            Theo màu, size
          </ToggleGroupItem>
        </ToggleGroup>
        <Select value={categoryId ?? ALL} onValueChange={(v) => setCategoryId(v === ALL ? undefined : v)}>
          <SelectTrigger className="w-48" aria-label="Danh mục">
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
        <div className="ml-auto">
          <ExportButton
            fileName={reportFileName(groupBy === 'variant' ? 'ban-chay-bien-the' : 'ban-chay', range.from, range.to)}
            disabled={!data?.rows.length}
            build={() => [excelSheet('Bán chạy', `Sản phẩm bán chạy ${displayDateKey(range.from)} - ${displayDateKey(range.to)}`, columns, data!.rows)]}
          />
        </div>
      </TabToolbar>
      {report.error && !data ? (
        <ErrorState error={report.error} onRetry={() => void report.refetch()} />
      ) : !data ? (
        <TabLoading cards={2} />
      ) : !data.rows.length ? (
        <EmptyState icon={PackageSearch} title="Chưa có sản phẩm bán ra" description="Tính trên đơn Đã giao trong khoảng ngày." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Số lượng bán" value={formatNumber(data.totalQuantity, 0)} />
            <Stat label="Doanh thu thuần" value={formatVnd(data.totalNetRevenue)} />
            <Stat label={groupBy === 'variant' ? 'Số biến thể có bán' : 'Số sản phẩm có bán'} value={formatNumber(data.rows.length, 0)} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top 10 theo doanh thu thuần</CardTitle>
              <CardDescription>Giảm giá phân bổ cho từng dòng theo tỉ lệ thành tiền.</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={config} className="aspect-auto h-80 w-full" aria-label="Biểu đồ top 10 sản phẩm bán chạy">
                <BarChart data={data.rows.slice(0, 10).map((r) => ({ ...r, label: labelOf(r) }))} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" tickFormatter={compactVnd} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="label" width={220} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, _n, item) => (
                          <div className="flex w-full justify-between gap-4">
                            <span className="text-muted-foreground">{formatNumber(Number(item.payload.quantity), 0)} cái</span>
                            <span className="font-medium tabular-nums">{formatVnd(Number(value))}</span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar dataKey="netRevenue" fill="var(--color-netRevenue)" radius={[0, 4, 4, 0]} maxBarSize={22} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card className="gap-0 py-0">
            <div className="max-h-[32rem] overflow-auto">
              <Table className="min-w-[720px]">
                <TableHeader className="bg-muted sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Sản phẩm</TableHead>
                    {groupBy === 'variant' && <TableHead>SKU</TableHead>}
                    <TableHead className="text-right">Số lượng</TableHead>
                    <TableHead className="text-right">Doanh thu thuần</TableHead>
                    <TableHead className="text-right">Tỉ trọng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r, i) => (
                    <TableRow key={r.key}>
                      <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                      <TableCell>
                        <span className="font-medium">{r.name}</span>
                        <span className="text-muted-foreground"> · {r.code}</span>
                        {r.sku && <span className="block text-sm">{r.size ? `${r.colorName} / ${r.size}` : r.colorName}</span>}
                      </TableCell>
                      {groupBy === 'variant' && <TableCell className="font-mono text-xs">{r.sku}</TableCell>}
                      <TableCell className="text-right tabular-nums">{formatNumber(r.quantity, 0)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatVnd(r.netRevenue)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPercent(r.share)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
