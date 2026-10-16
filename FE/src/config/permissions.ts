/**
 * Mã quyền, khai báo giống hệt BE `Application/Constants/Permissions.cs`
 * và danh sách seed `src/mock/seed/system.json` (+ project.json).
 * Định dạng `{resource}.{action}`. Không gõ chuỗi mã quyền trực tiếp trong component.
 */
export const permissions = {
  dashboard: {
    view: 'dashboard.view',
  },
  users: {
    view: 'users.view',
    create: 'users.create',
    update: 'users.update',
    delete: 'users.delete',
  },
  roles: {
    view: 'roles.view',
    create: 'roles.create',
    update: 'roles.update',
    delete: 'roles.delete',
  },
  settings: {
    view: 'settings.view',
    update: 'settings.update',
  },
  auditLogs: {
    view: 'audit-logs.view',
  },
  // Quyền nghiệp vụ (docs/07-DANH-SACH-API.md §1, project.json, 02-SRS §7)
  products: {
    view: 'products.view',
    create: 'products.create',
    update: 'products.update',
    delete: 'products.delete',
    adjustStock: 'products.adjust-stock',
  },
  orders: {
    view: 'orders.view',
    confirm: 'orders.confirm',
    confirmPayment: 'orders.confirm-payment',
    update: 'orders.update',
    cancel: 'orders.cancel',
    ship: 'orders.ship',
    refund: 'orders.refund',
  },
  coupons: {
    view: 'coupons.view',
    create: 'coupons.create',
    update: 'coupons.update',
    delete: 'coupons.delete',
  },
  customers: {
    view: 'customers.view',
    update: 'customers.update',
  },
  reports: {
    view: 'reports.view',
  },
} as const

/** Mã vai trò hệ thống (BR-SYS-06). */
export const roleCodes = {
  admin: 'ADMIN',
  manager: 'MANAGER',
  staff: 'STAFF',
} as const

type Leaves<T> = T extends string ? T : { [K in keyof T]: Leaves<T[K]> }[keyof T]
export type PermissionCode = Leaves<typeof permissions>
