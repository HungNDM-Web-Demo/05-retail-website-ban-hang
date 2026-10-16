import { PackagePlus, Printer, UserRound } from 'lucide-react'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import type { NavItem } from './index'

/** Trang không nằm trong menu nhưng cần tiêu đề trên Header và kiểm tra quyền. */
export const hiddenRoutes: NavItem[] = [
  {
    title: 'Hồ sơ cá nhân',
    href: routePath.profile,
    icon: UserRound,
  },
  {
    title: 'Thêm sản phẩm',
    href: routePath.adminProductNew,
    icon: PackagePlus,
    permission: permissions.products.create,
  },
  // In nhiều phiếu giao (P3); phiếu một đơn /admin/orders/{id}/print khớp mục "Đơn hàng" (orders.view)
  {
    title: 'In phiếu giao',
    href: routePath.adminOrdersPrint,
    icon: Printer,
    permission: permissions.orders.ship,
  },
]
