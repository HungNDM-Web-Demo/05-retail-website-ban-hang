'use client'

import { Suspense, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChartColumn } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { permissions } from '@/config/permissions'
import { DateRangeFilter } from '../components/DateRangeFilter'
import { OrderStatusTab } from '../components/OrderStatusTab'
import { CouponsReportTab, ProvincesTab } from '../components/ProvinceCouponTabs'
import { RevenueTab } from '../components/RevenueTab'
import { TopProductsTab } from '../components/TopProductsTab'
import { DEFAULT_PRESET, presetRange, type DateRange, type RangePreset } from '../lib/date-range'

const TABS = [
  { value: 'revenue', label: 'Doanh thu' },
  { value: 'top-products', label: 'Sản phẩm bán chạy' },
  { value: 'order-status', label: 'Tình trạng đơn' },
  { value: 'provinces', label: 'Theo tỉnh/thành' },
  { value: 'coupons', label: 'Mã giảm giá' },
] as const
type TabValue = (typeof TABS)[number]['value']
const isTab = (v: string | null): v is TabValue => TABS.some((t) => t.value === v)

/**
 * SCR-16 Báo cáo (UC-15; FR-37…40; BR-22): mặc định tab Doanh thu, 30 ngày gần nhất; chặn khoảng > 366
 * ngày trước khi gọi API; mỗi tab xuất Excel từ dữ liệu đang xem.
 */
export function ReportsPage() {
  return (
    <PermissionGuard permission={permissions.reports.view} redirect>
      <Suspense>
        <ReportsView />
      </Suspense>
    </PermissionGuard>
  )
}

function ReportsView() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const raw = params.get('tab')
  const tab: TabValue = isTab(raw) ? raw : 'revenue'
  const [preset, setPreset] = useState<RangePreset>(DEFAULT_PRESET)
  const [range, setRange] = useState<DateRange>(() => presetRange(DEFAULT_PRESET))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Báo cáo"
        icon={ChartColumn}
        description="Doanh thu thuần tính đơn Đã giao theo ngày giao, không gồm phí vận chuyển; đơn hủy không tính."
      />
      <DateRangeFilter
        preset={preset}
        value={range}
        onChange={(p, r) => {
          setPreset(p)
          setRange(r)
        }}
      />
      <Tabs value={tab} onValueChange={(v) => isTab(v) && router.replace(v === 'revenue' ? pathname : `${pathname}?tab=${v}`, { scroll: false })} className="gap-4">
        <div className="overflow-x-auto overflow-y-hidden">
          <TabsList className="w-max group-data-horizontal/tabs:h-12">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="min-h-10 px-4">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="revenue">
          <RevenueTab range={range} enabled={tab === 'revenue'} />
        </TabsContent>
        <TabsContent value="top-products">
          <TopProductsTab range={range} enabled={tab === 'top-products'} />
        </TabsContent>
        <TabsContent value="order-status">
          <OrderStatusTab range={range} enabled={tab === 'order-status'} />
        </TabsContent>
        <TabsContent value="provinces">
          <ProvincesTab range={range} enabled={tab === 'provinces'} />
        </TabsContent>
        <TabsContent value="coupons">
          <CouponsReportTab range={range} enabled={tab === 'coupons'} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
