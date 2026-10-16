import { AppShell } from '@/components/shared/AppShell'
import { AuthGuard } from '@/features/auth/components/AuthGuard'
import { ShopEventToaster, ViewStoreButton } from '@/features/shop/components/StoreEntry'

/**
 * Khu vực cần đăng nhập: sidebar + header + thanh công cụ demo (KIEN-TRUC-HE-THONG §6.4).
 * Website Bán hàng thêm nút "Xem cửa hàng" trên header và thông báo "Đơn mới" (07 §4.2).
 */
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShell headerActions={<ViewStoreButton />}>
        <ShopEventToaster />
        {children}
      </AppShell>
    </AuthGuard>
  )
}
