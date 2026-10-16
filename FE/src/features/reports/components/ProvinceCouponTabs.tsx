'use client'

import { MapPinned, TicketPercent } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CouponReportRow, ProvinceReportRow } from '@/types/shop'
import { useCouponReport, useProvinceReport } from '../hooks/use-reports'
import { displayDateKey } from '../lib/date-range'
import { excelSheet, reportFileName, type ExcelColumn } from '../lib/export-excel'
import { ExportButton, Stat, TabLoading, TabToolbar, formatPercent, type ReportTabProps } from './ReportParts'

const PROVINCE_COLUMNS: ExcelColumn<ProvinceReportRow>[] = [
  { header: 'Tỉnh/thành', value: (r) => r.provinceName, width: 22 },
  { header: 'Số đơn đặt', value: (r) => r.orderCount, width: 12 },
  { header: 'Doanh thu thuần', value: (r) => r.netRevenue, width: 18 },
  { header: 'Tỉ lệ hoàn (%)', value: (r) => r.returnRate, width: 14, format: '0.0' },
]

/** Tab Theo tỉnh/thành (FR-39): đơn đặt, doanh thu thuần, tỉ lệ hoàn — tỉnh hay hoàn tô đậm */
export function ProvincesTab({ range, enabled }: ReportTabProps) {
  const report = useProvinceReport(range, { enabled })
  const rows = report.data
  if (report.error && !rows) return <ErrorState error={report.error} onRetry={() => void report.refetch()} />
  if (!rows) return <TabLoading cards={0} />
  const maxOrders = Math.max(1, ...rows.map((r) => r.orderCount))
  return (
    <div className="space-y-4">
      <TabToolbar>
        <p className="text-muted-foreground text-sm">Đơn đặt trong kỳ; doanh thu thuần của đơn giao trong kỳ.</p>
        <div className="ml-auto">
          <ExportButton
            fileName={reportFileName('tinh-thanh', range.from, range.to)}
            disabled={!rows.length}
            build={() => [excelSheet('Tỉnh thành', `Theo tỉnh/thành ${displayDateKey(range.from)} - ${displayDateKey(range.to)}`, PROVINCE_COLUMNS, rows)]}
          />
        </div>
      </TabToolbar>
      {!rows.length ? (
        <EmptyState icon={MapPinned} title="Chưa có đơn trong khoảng ngày" />
      ) : (
        <Card className="gap-0 py-0">
          <div className="max-h-[36rem] overflow-auto">
            <Table className="min-w-[720px]">
              <TableHeader className="bg-muted sticky top-0 z-10">
                <TableRow>
                  <TableHead>Tỉnh/thành</TableHead>
                  <TableHead className="w-[30%]">Số đơn đặt</TableHead>
                  <TableHead className="text-right">Doanh thu thuần</TableHead>
                  <TableHead className="text-right">Tỉ lệ hoàn</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.provinceCode}>
                    <TableCell className="font-medium">{r.provinceName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                          <div className="bg-chart-1 h-full rounded-full" style={{ width: `${(r.orderCount / maxOrders) * 100}%` }} />
                        </div>
                        <span className="w-10 text-right tabular-nums">{formatNumber(r.orderCount, 0)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatVnd(r.netRevenue)}</TableCell>
                    <TableCell className={cn('text-right tabular-nums', r.returnRate >= 15 && 'text-destructive font-semibold')}>{formatPercent(r.returnRate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  )
}

const COUPON_COLUMNS: ExcelColumn<CouponReportRow>[] = [
  { header: 'Mã', value: (r) => r.code, width: 14 },
  { header: 'Lượt dùng', value: (r) => r.usedCount, width: 10 },
  { header: 'Tiền đã giảm', value: (r) => r.discountTotal, width: 16 },
  { header: 'Giá trị đơn', value: (r) => r.orderValue, width: 16 },
]

/** Tab Mã giảm giá: lượt dùng, tiền đã giảm (gồm phí vận chuyển được miễn), giá trị đơn — đơn chưa hủy */
export function CouponsReportTab({ range, enabled }: ReportTabProps) {
  const report = useCouponReport(range, { enabled })
  const rows = report.data
  if (report.error && !rows) return <ErrorState error={report.error} onRetry={() => void report.refetch()} />
  if (!rows) return <TabLoading cards={3} />
  const sum = (k: 'usedCount' | 'discountTotal' | 'orderValue') => rows.reduce((s, r) => s + r[k], 0)
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Lượt dùng mã" value={formatNumber(sum('usedCount'), 0)} />
        <Stat label="Tiền đã giảm" value={formatVnd(sum('discountTotal'))} />
        <Stat label="Giá trị đơn có mã" value={formatVnd(sum('orderValue'))} />
      </div>
      <TabToolbar>
        <p className="text-muted-foreground text-sm">Đơn đặt trong kỳ có mã, không tính đơn đã hủy.</p>
        <div className="ml-auto">
          <ExportButton
            fileName={reportFileName('ma-giam-gia', range.from, range.to)}
            disabled={!rows.length}
            build={() => [excelSheet('Mã giảm giá', `Mã giảm giá ${displayDateKey(range.from)} - ${displayDateKey(range.to)}`, COUPON_COLUMNS, rows)]}
          />
        </div>
      </TabToolbar>
      {!rows.length ? (
        <EmptyState icon={TicketPercent} title="Chưa có đơn dùng mã trong khoảng ngày" />
      ) : (
        <Card className="gap-0 py-0">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead>Mã</TableHead>
                <TableHead className="text-right">Lượt dùng</TableHead>
                <TableHead className="text-right">Tiền đã giảm</TableHead>
                <TableHead className="text-right">Giá trị đơn</TableHead>
                <TableHead className="text-right">Giảm / giá trị đơn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.couponId}>
                  <TableCell className="font-mono font-semibold">{r.code}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(r.usedCount, 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatVnd(r.discountTotal)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatVnd(r.orderValue)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPercent(r.orderValue ? Math.round((r.discountTotal / r.orderValue) * 1000) / 10 : 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
