import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type {
  CouponReportQuery,
  CouponReportRow,
  DashboardSales,
  DashboardTodo,
  DateRangeQuery,
  OrderStatusReport,
  OrderStatusReportQuery,
  ProvinceReportRow,
  RevenueReport,
  TopProductsQuery,
  TopProductsReport,
} from '@/types/shop'
import { reportMock } from '../mock/report.mock'

/** Tổng quan, báo cáo (07 §2.8, SCR-08, SCR-16) */
export const reportService = {
  dashboardTodo: (): Promise<DashboardTodo> =>
    isMockMode() ? reportMock.dashboardTodo() : apiCall.get(apiRoutes.reports.dashboardTodo),
  dashboardSales: (): Promise<DashboardSales> =>
    isMockMode() ? reportMock.dashboardSales() : apiCall.get(apiRoutes.reports.dashboardSales),
  revenue: (q: DateRangeQuery): Promise<RevenueReport> =>
    isMockMode() ? reportMock.revenue(q) : apiCall.get(apiRoutes.reports.revenue, { params: q }),
  topProducts: (q: TopProductsQuery): Promise<TopProductsReport> =>
    isMockMode() ? reportMock.topProducts(q) : apiCall.get(apiRoutes.reports.topProducts, { params: q }),
  orderStatus: (q: OrderStatusReportQuery): Promise<OrderStatusReport> =>
    isMockMode() ? reportMock.orderStatus(q) : apiCall.get(apiRoutes.reports.orderStatus, { params: q }),
  provinces: (q: DateRangeQuery): Promise<ProvinceReportRow[]> =>
    isMockMode() ? reportMock.provinces(q) : apiCall.get(apiRoutes.reports.provinces, { params: q }),
  coupons: (q: CouponReportQuery): Promise<CouponReportRow[]> =>
    isMockMode() ? reportMock.coupons(q) : apiCall.get(apiRoutes.reports.coupons, { params: q }),
}
