import { AuthGuard } from '@/features/auth/components/AuthGuard'

/** Bản in phiếu giao (07 §2.11): cần đăng nhập và quyền theo config/routes, không sidebar, header */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>
}
