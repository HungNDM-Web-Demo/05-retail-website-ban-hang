import type { StatusTone } from '@/components/shared/StatusBadge'
import type { AuditAction } from './types/audit-log.types'

/** Nhãn hiển thị cho nhật ký. Dự án thêm tên entity và tên cột nghiệp vụ của mình vào đây. */

export const auditActionLabels: Record<AuditAction, { label: string; tone: StatusTone }> = {
  Create: { label: 'Thêm', tone: 'success' },
  Update: { label: 'Sửa', tone: 'info' },
  Delete: { label: 'Xóa', tone: 'danger' },
  Login: { label: 'Đăng nhập', tone: 'neutral' },
}

/** Tên entity (BE) → tên tiếng Việt; cũng là danh sách cho bộ lọc "Đối tượng". */
export const auditEntityLabels: Record<string, string> = {
  User: 'Tài khoản',
  Role: 'Vai trò',
  Setting: 'Cài đặt',
  // Website Bán hàng (07 §4.9)
  Product: 'Sản phẩm',
  Category: 'Danh mục',
  Color: 'Màu',
  Coupon: 'Mã giảm giá',
}

/** Tên cột (camelCase) → nhãn tiếng Việt trong bảng "trước / sau". */
export const auditFieldLabels: Record<string, string> = {
  username: 'Tên đăng nhập',
  fullName: 'Họ tên',
  email: 'Email',
  phone: 'Số điện thoại',
  avatarUrl: 'Ảnh đại diện',
  isActive: 'Đang hoạt động',
  isDemoAccount: 'Tài khoản demo',
  lastLoginAt: 'Đăng nhập gần nhất',
  roleIds: 'Vai trò',
  code: 'Mã',
  name: 'Tên',
  description: 'Mô tả',
  isSystem: 'Vai trò hệ thống',
  permissions: 'Quyền',
  key: 'Khóa',
  value: 'Giá trị',
  groupName: 'Nhóm',
  quickLogin: 'Đăng nhập nhanh',
  sortOrder: 'Thứ tự',
  status: 'Trạng thái',
  createdAt: 'Ngày tạo',
  updatedAt: 'Ngày sửa',
  // Website Bán hàng
  slug: 'Đường dẫn',
  categoryId: 'Danh mục',
  price: 'Giá bán',
  listPrice: 'Giá gốc',
  isFeatured: 'Nổi bật',
  isHidden: 'Ẩn',
  isVisible: 'Hiển thị',
  images: 'Ảnh',
  colorIds: 'Màu',
  sizes: 'Size',
  variants: 'Biến thể',
  sizeChart: 'Bảng size',
  hex: 'Mã màu',
  color: 'Màu nền',
  type: 'Kiểu mã',
  maxDiscount: 'Giảm tối đa',
  minOrder: 'Đơn tối thiểu',
  totalLimit: 'Tổng lượt',
  perCustomerLimit: 'Lượt mỗi khách',
  startAt: 'Bắt đầu',
  endAt: 'Kết thúc',
  isPaused: 'Tạm dừng',
}

export const entityLabel = (name: string) => auditEntityLabels[name] ?? name
export const fieldLabel = (name: string) => auditFieldLabels[name] ?? name
