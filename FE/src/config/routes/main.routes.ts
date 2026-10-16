import {
  BarChart3,
  LayoutDashboard,
  Package,
  ReceiptText,
  Store,
  TicketPercent,
  Users,
} from 'lucide-react'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import type { NavGroup } from './index'

/**
 * Nhóm menu nghiệp vụ (docs/07-DANH-SACH-API.md §4.1). Mọi vai trò nghiệp vụ có `dashboard.view`
 * nên sau đăng nhập đều vào Tổng quan; thẻ doanh thu trong trang tự ẩn khi thiếu `reports.view` (UC-12 3a).
 */
export const mainRoutes: NavGroup = {
  id: 'main',
  items: [
    {
      title: 'Tổng quan',
      href: routePath.dashboard,
      icon: LayoutDashboard,
      permission: permissions.dashboard.view,
      description: 'Việc cần làm, doanh thu hôm nay, sản phẩm bán chạy, biến thể sắp hết',
    },
    {
      title: 'Đơn hàng',
      href: routePath.adminOrders,
      icon: ReceiptText,
      permission: permissions.orders.view,
      description: 'Xác nhận, bàn giao vận chuyển, in phiếu giao, hủy và hoàn hàng',
    },
    {
      title: 'Sản phẩm',
      href: routePath.adminProducts,
      icon: Package,
      permission: permissions.products.view,
      description: 'Danh mục, sản phẩm, biến thể màu và size, tồn kho',
    },
    {
      title: 'Mã giảm giá',
      href: routePath.adminCoupons,
      icon: TicketPercent,
      permission: permissions.coupons.view,
      description: 'Mã phần trăm, số tiền, miễn phí vận chuyển và hiệu quả',
    },
    {
      title: 'Khách hàng',
      href: routePath.adminCustomers,
      icon: Users,
      permission: permissions.customers.view,
      description: 'Hồ sơ theo số điện thoại, khách VIP, khách cần lưu ý',
    },
    {
      title: 'Báo cáo',
      href: routePath.adminReports,
      icon: BarChart3,
      permission: permissions.reports.view,
      description: 'Doanh thu, bán chạy, tình trạng đơn, tỉnh/thành, mã giảm giá',
    },
    {
      title: 'Xem cửa hàng',
      href: routePath.shopHome,
      icon: Store,
      newTab: true,
      description: 'Mở website bán hàng ở tab mới',
    },
  ],
}
