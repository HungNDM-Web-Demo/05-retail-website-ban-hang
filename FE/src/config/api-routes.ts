/** Endpoint BE (QUY-UOC-API §3). Đường dẫn tương đối, lib/axios.ts ghép với NEXT_PUBLIC_API_URL. */
export const apiRoutes = {
  auth: {
    login: '/api/auth/login',
    refresh: '/api/auth/refresh',
    logout: '/api/auth/logout',
    me: '/api/auth/me',
    changePassword: '/api/auth/me/password',
  },
  demo: {
    accounts: '/api/demo/accounts',
    loginAs: '/api/demo/login-as',
    reset: '/api/demo/reset',
    /** Giả lập khách đặt đơn qua luồng công khai (07 §2.9) */
    simulateOrder: '/api/demo/simulate-order',
  },
  users: {
    list: '/api/users',
    detail: (id: string) => `/api/users/${id}`,
    lock: (id: string) => `/api/users/${id}/lock`,
    resetPassword: (id: string) => `/api/users/${id}/reset-password`,
  },
  roles: {
    list: '/api/roles',
    detail: (id: string) => `/api/roles/${id}`,
    permissions: (id: string) => `/api/roles/${id}/permissions`,
  },
  permissions: {
    list: '/api/permissions',
  },
  settings: {
    public: '/api/settings/public',
    list: '/api/settings',
  },
  uploads: {
    images: '/api/uploads/images',
  },
  auditLogs: {
    list: '/api/audit-logs',
  },

  // ---------- Nghiệp vụ Website Bán hàng (docs/07-DANH-SACH-API.md §2) ----------
  provinces: '/api/provinces',
  /** API công khai cho cửa hàng, không gửi Authorization (07 §2.2) */
  public: {
    store: '/api/public/store',
    home: '/api/public/home',
    categories: '/api/public/categories',
    products: '/api/public/products',
    suggest: '/api/public/products/suggest',
    product: (slug: string) => `/api/public/products/${slug}`,
    cartCheck: '/api/public/cart/check',
    checkoutQuote: '/api/public/checkout/quote',
    orders: '/api/public/orders',
    orderLookup: '/api/public/orders/lookup',
    orderCancel: (code: string) => `/api/public/orders/${code}/cancel`,
  },
  categories: {
    list: '/api/categories',
    detail: (id: string) => `/api/categories/${id}`,
    visibility: (id: string) => `/api/categories/${id}/visibility`,
    order: '/api/categories/order',
  },
  colors: {
    list: '/api/colors',
    detail: (id: string) => `/api/colors/${id}`,
  },
  products: {
    list: '/api/products',
    detail: (id: string) => `/api/products/${id}`,
    hidden: (id: string) => `/api/products/${id}/hidden`,
    images: '/api/products/images',
    stockAdjustments: (id: string) => `/api/products/${id}/stock-adjustments`,
    adjustStock: (id: string, variantId: string) =>
      `/api/products/${id}/variants/${variantId}/stock-adjustments`,
  },
  orders: {
    list: '/api/orders',
    statusCounts: '/api/orders/status-counts',
    detail: (id: string) => `/api/orders/${id}`,
    editPreview: (id: string) => `/api/orders/${id}/edit-preview`,
    notes: (id: string) => `/api/orders/${id}/notes`,
    confirm: (id: string) => `/api/orders/${id}/confirm`,
    confirmPayment: (id: string) => `/api/orders/${id}/confirm-payment`,
    cancel: (id: string) => `/api/orders/${id}/cancel`,
    ship: (id: string) => `/api/orders/${id}/ship`,
    deliver: (id: string) => `/api/orders/${id}/deliver`,
    deliveryFailed: (id: string) => `/api/orders/${id}/delivery-failed`,
    receiveReturn: (id: string) => `/api/orders/${id}/receive-return`,
    refund: (id: string) => `/api/orders/${id}/refund`,
    labelPrinted: (id: string) => `/api/orders/${id}/label-printed`,
    bulkConfirm: '/api/orders/bulk/confirm',
    bulkShip: '/api/orders/bulk/ship',
  },
  coupons: {
    list: '/api/coupons',
    detail: (id: string) => `/api/coupons/${id}`,
    pause: (id: string) => `/api/coupons/${id}/pause`,
    orders: (id: string) => `/api/coupons/${id}/orders`,
  },
  customers: {
    list: '/api/customers',
    detail: (id: string) => `/api/customers/${id}`,
    orders: (id: string) => `/api/customers/${id}/orders`,
    note: (id: string) => `/api/customers/${id}/note`,
  },
  reports: {
    dashboardTodo: '/api/reports/dashboard/todo',
    dashboardSales: '/api/reports/dashboard/sales',
    revenue: '/api/reports/revenue',
    topProducts: '/api/reports/top-products',
    orderStatus: '/api/reports/order-status',
    provinces: '/api/reports/provinces',
    coupons: '/api/reports/coupons',
  },
} as const
