'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { isMockMode } from '@/lib/data-source'
import type {
  CouponReportQuery,
  DateRangeQuery,
  OrderStatusReportQuery,
  TopProductsQuery,
} from '@/types/shop'
import { reportService } from '../services/report.service'

/** Khóa ['dashboard', 'todo' | 'sales'], ['reports', loại, query] (07 §4.9) */
export const reportKeys = {
  todo: ['dashboard', 'todo'] as const,
  sales: ['dashboard', 'sales'] as const,
  report: (kind: string, q: object) => ['reports', kind, q] as const,
}

/** api: hỏi lại 30 giây (07 §2.10); mock tự làm mới khi tab khác ghi */
const polling = isMockMode() ? {} : { refetchInterval: 30_000, refetchOnWindowFocus: true }
const common = { placeholderData: keepPreviousData, staleTime: 30_000 }
type Opt = { enabled?: boolean }

export const useDashboardTodo = (enabled = true) =>
  useQuery({ queryKey: reportKeys.todo, queryFn: reportService.dashboardTodo, enabled, ...polling })
export const useDashboardSales = (enabled = true) =>
  useQuery({ queryKey: reportKeys.sales, queryFn: reportService.dashboardSales, enabled, ...polling })

export const useRevenueReport = (q: DateRangeQuery, o: Opt = {}) =>
  useQuery({ queryKey: reportKeys.report('revenue', q), queryFn: () => reportService.revenue(q), enabled: o.enabled ?? true, ...common })
export const useTopProductsReport = (q: TopProductsQuery, o: Opt = {}) =>
  useQuery({ queryKey: reportKeys.report('top-products', q), queryFn: () => reportService.topProducts(q), enabled: o.enabled ?? true, ...common })
export const useOrderStatusReport = (q: OrderStatusReportQuery, o: Opt = {}) =>
  useQuery({ queryKey: reportKeys.report('order-status', q), queryFn: () => reportService.orderStatus(q), enabled: o.enabled ?? true, ...common })
export const useProvinceReport = (q: DateRangeQuery, o: Opt = {}) =>
  useQuery({ queryKey: reportKeys.report('provinces', q), queryFn: () => reportService.provinces(q), enabled: o.enabled ?? true, ...common })
export const useCouponReport = (q: CouponReportQuery, o: Opt = {}) =>
  useQuery({ queryKey: reportKeys.report('coupons', q), queryFn: () => reportService.coupons(q), enabled: o.enabled ?? true, ...common })
