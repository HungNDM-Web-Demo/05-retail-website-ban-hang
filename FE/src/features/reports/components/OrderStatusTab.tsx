'use client'

import { useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cancelReasonLabels, deliveryFailReasonLabels, paymentMethodShortLabels } from '@/config/shop-labels'
import { formatNumber } from '@/lib/format'
import type { OrderStatusReport, PaymentMethod } from '@/types/shop'
import { useOrderStatusReport } from '../hooks/use-reports'
import { displayDateKey } from '../lib/date-range'
import { excelSheet, reportFileName } from '../lib/export-excel'
import { ExportButton, Stat, TabLoading, TabToolbar, formatPercent, type ReportTabProps } from './ReportParts'

const ALL = '__all'

/** Tab Tình trạng đơn (FR-39): tỉ lệ hủy, hoàn, lý do hủy, lý do giao thất bại, theo phương thức */
export function OrderStatusTab({ range, enabled }: ReportTabProps) {
  const [method, setMethod] = useState<PaymentMethod>()
  const report = useOrderStatusReport({ ...range, ...(method ? { paymentMethod: method } : {}) }, { enabled })
  const data = report.data
  const title = `${displayDateKey(range.from)} - ${displayDateKey(range.to)}`

  return (
    <div className="space-y-4">
      <TabToolbar>
        <Select value={method ?? ALL} onValueChange={(v) => setMethod(v === ALL ? undefined : (v as PaymentMethod))}>
          <SelectTrigger className="w-48" aria-label="Phương thức thanh toán">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Mọi phương thức</SelectItem>
            <SelectItem value="Cod">COD</SelectItem>
            <SelectItem value="ChuyenKhoan">Chuyển khoản</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <ExportButton
            fileName={reportFileName('tinh-trang-don', range.from, range.to)}
            disabled={!data?.orderCount}
            build={() => [
              excelSheet('Lý do hủy', `Lý do hủy ${title}`, [
                { header: 'Lý do', value: (r: { reason: string; count: number }) => r.reason, width: 26 },
                { header: 'Số đơn', value: (r) => r.count, width: 10 },
              ], data!.cancelReasons.map((r) => ({ reason: cancelReasonLabels[r.reason], count: r.count }))),
              excelSheet('Giao thất bại', `Lý do giao thất bại ${title}`, [
                { header: 'Lý do', value: (r: { reason: string; count: number }) => r.reason, width: 26 },
                { header: 'Số đơn', value: (r) => r.count, width: 10 },
              ], data!.failReasons.map((r) => ({ reason: deliveryFailReasonLabels[r.reason], count: r.count }))),
              excelSheet('Theo phương thức', `Theo phương thức thanh toán ${title}`, [
                { header: 'Phương thức', value: (r: OrderStatusReport['byPaymentMethod'][number]) => paymentMethodShortLabels[r.paymentMethod], width: 16 },
                { header: 'Số đơn', value: (r) => r.orderCount, width: 10 },
                { header: 'Tỉ lệ hủy (%)', value: (r) => r.cancelRate, width: 14, format: '0.0' },
                { header: 'Tỉ lệ hoàn (%)', value: (r) => r.returnRate, width: 14, format: '0.0' },
              ], data!.byPaymentMethod),
            ]}
          />
        </div>
      </TabToolbar>
      {report.error && !data ? (
        <ErrorState error={report.error} onRetry={() => void report.refetch()} />
      ) : !data ? (
        <TabLoading />
      ) : !data.orderCount ? (
        <EmptyState icon={ClipboardList} title="Chưa có đơn trong khoảng ngày" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Đơn đặt" value={formatNumber(data.orderCount, 0)} />
            <Stat label="Đơn hủy" value={formatNumber(data.cancelledCount, 0)} sub={`Tỉ lệ hủy ${formatPercent(data.cancelRate)}`} />
            <Stat label="Đơn hoàn" value={formatNumber(data.returnCount, 0)} sub={`Tỉ lệ hoàn ${formatPercent(data.returnRate)}`} />
            <Stat label="Tỉ lệ hoàn" value={formatPercent(data.returnRate)} sub="Hoàn / (Đã giao + Đang hoàn + Đã hoàn)" tone={data.returnRate >= 10 ? 'destructive' : undefined} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <ReasonCard title="Lý do hủy" rows={data.cancelReasons.map((r) => ({ label: cancelReasonLabels[r.reason], count: r.count }))} />
            <ReasonCard title="Lý do giao thất bại" rows={data.failReasons.map((r) => ({ label: deliveryFailReasonLabels[r.reason], count: r.count }))} />
            <Card className="gap-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Theo phương thức thanh toán</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Phương thức</TableHead>
                      <TableHead className="text-right">Đơn</TableHead>
                      <TableHead className="text-right">Hủy</TableHead>
                      <TableHead className="pr-6 text-right">Hoàn</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.byPaymentMethod.map((r) => (
                      <TableRow key={r.paymentMethod}>
                        <TableCell className="pl-6">{paymentMethodShortLabels[r.paymentMethod]}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(r.orderCount, 0)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPercent(r.cancelRate)}</TableCell>
                        <TableCell className="pr-6 text-right tabular-nums">{formatPercent(r.returnRate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

/** Danh sách lý do với thanh tỉ lệ (có số, không chỉ dựa vào màu) */
function ReasonCard({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  const total = rows.reduce((s, r) => s + r.count, 0)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {!rows.length ? (
          <p className="text-muted-foreground text-sm">Không có.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.label} className="space-y-1">
                <div className="flex justify-between gap-2 text-sm">
                  <span>{r.label}</span>
                  <span className="font-medium tabular-nums">
                    {r.count} <span className="text-muted-foreground">({formatPercent(Math.round((r.count / total) * 1000) / 10)})</span>
                  </span>
                </div>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div className="bg-chart-1 h-full rounded-full" style={{ width: `${(r.count / total) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
