'use client'

import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import { ChartColumn } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatNumber, formatVnd } from '@/lib/format'
import type { RevenueTotals } from '@/types/shop'
import { useRevenueReport } from '../hooks/use-reports'
import { displayDateKey, shortDateKey } from '../lib/date-range'
import { excelSheet, reportFileName, type ExcelColumn } from '../lib/export-excel'
import { ChangeText, ExportButton, Stat, TabLoading, TabToolbar, compactVnd, type ReportTabProps } from './ReportParts'

const config = {
  netRevenue: { label: 'Doanh thu thuần', color: 'var(--chart-1)' },
  orderValue: { label: 'Giá trị đặt hàng', color: 'var(--chart-2)' },
  previousNet: { label: 'Doanh thu thuần kỳ trước', color: 'var(--muted-foreground)' },
} satisfies ChartConfig

type Row = RevenueTotals & { date: string; previousNet?: number }

const COLUMNS: ExcelColumn<Row>[] = [
  { header: 'Ngày', value: (d) => (d.date ? displayDateKey(d.date) : 'Tổng'), width: 12 },
  { header: 'Doanh thu thuần', value: (d) => d.netRevenue, width: 18 },
  { header: 'Giá trị đặt hàng', value: (d) => d.orderValue, width: 18 },
  { header: 'Số đơn', value: (d) => d.orderCount, width: 10 },
  { header: 'Giá trị TB đơn', value: (d) => d.avgOrderValue, width: 16 },
  { header: 'Doanh thu thuần kỳ trước', value: (d) => d.previousNet, width: 22 },
]

/** % so với kỳ trước; kỳ trước bằng 0 → null ("—") */
const change = (cur: number, prev: number) => (prev ? ((cur - prev) / prev) * 100 : null)

/** Tab Doanh thu (FR-37, BR-22): theo ngày, đường kỳ trước cùng độ dài làm nền */
export function RevenueTab({ range, enabled }: ReportTabProps) {
  const report = useRevenueReport(range, { enabled })
  const data = report.data
  if (report.error && !data) return <ErrorState error={report.error} onRetry={() => void report.refetch()} />
  if (!data) return <TabLoading />
  const t = data.totals
  const p = data.previous
  const rows: Row[] = data.days.map((d, i) => ({ ...d, previousNet: data.previousDays[i]?.netRevenue ?? 0 }))
  const hasData = t.orderCount > 0 || t.netRevenue > 0 || p.netRevenue > 0

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Doanh thu thuần" value={formatVnd(t.netRevenue)} sub={<ChangeText value={change(t.netRevenue, p.netRevenue)} />} />
        <Stat label="Giá trị đặt hàng" value={formatVnd(t.orderValue)} sub={<ChangeText value={change(t.orderValue, p.orderValue)} />} />
        <Stat label="Số đơn (không tính đơn hủy)" value={formatNumber(t.orderCount, 0)} sub={`Kỳ trước ${formatNumber(p.orderCount, 0)}`} />
        <Stat label="Giá trị trung bình đơn" value={formatVnd(t.avgOrderValue)} sub={`Kỳ trước ${formatVnd(p.avgOrderValue)}`} />
      </div>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Doanh thu theo ngày</CardTitle>
            <CardDescription>Doanh thu thuần = tiền hàng − giảm giá của đơn Đã giao, theo ngày giao; không gồm phí vận chuyển.</CardDescription>
          </div>
          <TabToolbar>
            <ExportButton
              fileName={reportFileName('doanh-thu', range.from, range.to)}
              disabled={!rows.length}
              build={() => [
                excelSheet('Doanh thu', `Doanh thu ${displayDateKey(range.from)} - ${displayDateKey(range.to)}`, COLUMNS, [
                  ...rows,
                  { ...t, date: '', previousNet: p.netRevenue },
                ]),
              ]}
            />
          </TabToolbar>
        </CardHeader>
        <CardContent>
          {!hasData ? (
            <EmptyState icon={ChartColumn} title="Chưa có doanh thu" description="Khoảng ngày này và kỳ trước chưa có đơn." />
          ) : (
            <ChartContainer config={config} className="aspect-auto h-80 w-full" aria-label="Biểu đồ doanh thu theo ngày, so với kỳ trước">
              <ComposedChart data={rows} margin={{ left: 4, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDateKey} tickLine={false} axisLine={false} minTickGap={16} />
                <YAxis tickFormatter={compactVnd} tickLine={false} axisLine={false} width={56} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(v) => displayDateKey(String(v))}
                      formatter={(value, name) => (
                        <div className="flex w-full justify-between gap-4">
                          <span className="text-muted-foreground">{config[name as keyof typeof config]?.label}</span>
                          <span className="font-medium tabular-nums">{formatVnd(Number(value))}</span>
                        </div>
                      )}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="netRevenue" fill="var(--color-netRevenue)" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Line dataKey="orderValue" type="monotone" stroke="var(--color-orderValue)" strokeWidth={2} dot={false} />
                <Line dataKey="previousNet" type="monotone" stroke="var(--color-previousNet)" strokeDasharray="4 4" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
      {hasData && (
        <Card className="gap-0 py-0">
          <div className="max-h-[28rem] overflow-auto">
            <Table className="min-w-[720px]">
              <TableHeader className="bg-muted sticky top-0 z-10">
                <TableRow>
                  <TableHead>Ngày</TableHead>
                  <TableHead className="text-right">Doanh thu thuần</TableHead>
                  <TableHead className="text-right">Giá trị đặt hàng</TableHead>
                  <TableHead className="text-right">Số đơn</TableHead>
                  <TableHead className="text-right">TB đơn</TableHead>
                  <TableHead className="text-right">Kỳ trước</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...rows].reverse().map((d) => (
                  <RevenueRow key={d.date} label={displayDateKey(d.date)} row={d} previous={d.previousNet} />
                ))}
              </TableBody>
              <tfoot className="bg-muted sticky bottom-0 border-t font-semibold">
                <RevenueRow label="Tổng" row={t} previous={p.netRevenue} />
              </tfoot>
            </Table>
          </div>
        </Card>
      )}
    </div>
  )
}

function RevenueRow({ label, row, previous }: { label: string; row: RevenueTotals; previous?: number }) {
  return (
    <TableRow>
      <TableCell className="tabular-nums">{label}</TableCell>
      <TableCell className="text-right font-medium tabular-nums">{formatVnd(row.netRevenue)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatVnd(row.orderValue)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatNumber(row.orderCount, 0)}</TableCell>
      <TableCell className="text-right tabular-nums">{row.orderCount ? formatVnd(row.avgOrderValue) : '—'}</TableCell>
      <TableCell className="text-muted-foreground text-right tabular-nums">{formatVnd(previous ?? 0)}</TableCell>
    </TableRow>
  )
}
