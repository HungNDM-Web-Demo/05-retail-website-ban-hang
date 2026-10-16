/** Đường dẫn FE (kebab-case). Không gõ đường dẫn trực tiếp trong component. */
export const routePath = {
  /** Trang chủ cửa hàng (công khai, thay RootRedirect của nền; docs/07 §4.1) */
  root: '/',
  login: '/login',
  forbidden: '/forbidden',
  profile: '/profile',

  // ---------- Cửa hàng công khai (không AuthGuard; SCR-01…07) ----------
  shopHome: '/',
  products: '/products',
  productDetail: (slug: string) => `/products/${slug}`,
  cart: '/cart',
  checkout: '/checkout',
  /** Trang đặt hàng thành công: ?code=DH… (không đưa số điện thoại lên URL) */
  checkoutSuccess: '/checkout/success',
  orderLookup: '/tra-cuu-don',

  // ---------- Quản trị (AuthGuard; SCR-08…16) ----------
  dashboard: '/dashboard',
  adminProducts: '/admin/products',
  adminProductNew: '/admin/products/new',
  adminProductDetail: (id: string) => `/admin/products/${id}`,
  adminOrders: '/admin/orders',
  adminOrderDetail: (id: string) => `/admin/orders/${id}`,
  /** Phiếu giao A6 (route group app/(print), không sidebar) */
  adminOrderPrint: (id: string) => `/admin/orders/${id}/print`,
  /** In nhiều phiếu: ?ids=a,b,c (P3, FR-31) */
  adminOrdersPrint: '/admin/orders/print',
  adminCoupons: '/admin/coupons',
  adminCustomers: '/admin/customers',
  adminCustomerDetail: (id: string) => `/admin/customers/${id}`,
  adminReports: '/admin/reports',

  settingsUsers: '/settings/users',
  settingsRoles: '/settings/roles',
  settingsGeneral: '/settings/general',
  settingsAuditLogs: '/settings/audit-logs',
} as const

export type RoutePath = Extract<(typeof routePath)[keyof typeof routePath], string>
