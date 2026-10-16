import { Suspense } from 'react'
import { ShopFooter } from '@/features/shop/components/ShopFooter'
import { ShopHeader } from '@/features/shop/components/ShopHeader'
import { getStoreServer } from '@/features/shop/services/shop.server'

/**
 * Cửa hàng công khai (07 §4.1): không AuthGuard, không sidebar, không DemoToolbar mặc định.
 * Màu chủ đạo theo Brand.PrimaryColor qua BrandThemeSync của nền.
 */
export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const store = await getStoreServer()
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <a
        href="#noi-dung"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Bỏ qua menu, tới nội dung
      </a>
      <Suspense fallback={<div className="h-16 border-b" />}>
        <ShopHeader initialStore={store} />
      </Suspense>
      <main id="noi-dung" className="flex-1">
        {children}
      </main>
      <ShopFooter initialStore={store} />
    </div>
  )
}
