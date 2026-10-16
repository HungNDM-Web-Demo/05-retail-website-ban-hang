'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ArrowLeft, Menu, PackageSearch, Search, ShoppingBag, X } from 'lucide-react'
import { useAssetUrl } from '@/hooks/use-asset-url'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { routePath } from '@/config/route-path'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import type { PublicCategory, PublicStoreInfo } from '@/types/shop'
import { useCart } from '../lib/cart-storage'
import { useShopCategories, useStoreInfo } from '../hooks/use-shop'
import { SearchBox } from './SearchBox'

/** Logo cửa hàng theo Brand.LogoUrl (máy chủ truyền sẵn nên không lệch khi hydrate) */
function StoreLogo({ url, name }: { url?: string; name: string }) {
  const src = useAssetUrl(url)
  if (!src)
    return (
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
        {name.slice(0, 1)}
      </span>
    )
  // eslint-disable-next-line @next/next/no-img-element -- logo SVG/ảnh tải lên
  return <img src={src} alt="" className="size-9 shrink-0 rounded-lg object-contain" />
}

/** Dải "đang xem như khách" khi trình duyệt có phiên quản trị (07 §4.2 bước 2) */
function AdminStrip() {
  const session = useAuthStore((s) => s.session)
  const hydrated = useAuthStore((s) => s.hydrated)
  if (!hydrated || !session) return null
  return (
    <div className="bg-foreground text-background">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-1.5 text-xs sm:text-sm">
        <span>Bạn đang xem cửa hàng như khách</span>
        <span aria-hidden="true">·</span>
        <Link href={routePath.dashboard} className="inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline">
          <ArrowLeft className="size-3.5" />
          Về trang quản trị
        </Link>
      </div>
    </div>
  )
}

function CartButton() {
  const cart = useCart()
  const count = cart.lines.length
  return (
    <Link
      href={routePath.cart}
      aria-label={count ? `Giỏ hàng, ${count} sản phẩm` : 'Giỏ hàng'}
      className="relative flex size-11 items-center justify-center rounded-full text-foreground hover:bg-accent"
    >
      <ShoppingBag className="size-5" />
      {count > 0 && (
        <span className="absolute top-1 right-0.5 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] leading-5 font-semibold text-primary-foreground">
          {count}
        </span>
      )}
    </Link>
  )
}

function CategoryLinks({ categories, onNavigate, vertical }: { categories: PublicCategory[]; onNavigate?: () => void; vertical?: boolean }) {
  const pathname = usePathname()
  const params = useSearchParams()
  const current = pathname === routePath.products ? params.get('category') : null
  const linkClass = (active: boolean) =>
    cn(
      vertical
        ? 'flex min-h-11 items-center rounded-md px-3 text-base hover:bg-accent'
        : 'flex h-11 items-center border-b-2 px-1 text-sm font-medium whitespace-nowrap transition-colors hover:text-primary',
      active ? (vertical ? 'bg-accent font-semibold text-primary' : 'border-primary text-primary') : vertical ? '' : 'border-transparent text-muted-foreground'
    )
  return (
    <>
      <Link href={routePath.products} onClick={onNavigate} className={linkClass(pathname === routePath.products && !current)}>
        Tất cả sản phẩm
      </Link>
      {categories.map((c) => (
        <Link
          key={c.id}
          href={`${routePath.products}?category=${c.slug}`}
          onClick={onNavigate}
          className={linkClass(current === c.slug)}
        >
          {c.name}
        </Link>
      ))}
    </>
  )
}

/**
 * Đầu trang cửa hàng (07 §4.3): logo, tên cửa hàng, ô tìm có gợi ý, giỏ có số dòng, menu danh mục.
 * Điện thoại: nút menu mở danh mục trong Sheet, nút tìm mở hàng tìm kiếm.
 */
export function ShopHeader({ initialStore }: { initialStore?: PublicStoreInfo }) {
  const { data: store } = useStoreInfo(initialStore)
  const { data: categories = [] } = useShopCategories()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const name = store?.name ?? 'Nhà Sợi'

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <AdminStrip />
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:px-6">
        <button
          type="button"
          aria-label="Mở danh mục"
          onClick={() => setMenuOpen(true)}
          className="flex size-11 items-center justify-center rounded-full hover:bg-accent lg:hidden"
        >
          <Menu className="size-5" />
        </button>
        <Link href={routePath.shopHome} className="flex min-w-0 items-center gap-2.5" aria-label={`${name} – Trang chủ`}>
          <StoreLogo url={store?.logoUrl} name={name} />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-lg font-bold tracking-tight">{name}</span>
            {store?.tagline && <span className="hidden truncate text-xs text-muted-foreground sm:block">{store.tagline}</span>}
          </span>
        </Link>
        <SearchBox className="mx-auto hidden w-full max-w-md md:block" />
        <div className="ml-auto flex items-center md:ml-0">
          <button
            type="button"
            aria-label={searchOpen ? 'Đóng tìm kiếm' : 'Tìm kiếm'}
            onClick={() => setSearchOpen((v) => !v)}
            className="flex size-11 items-center justify-center rounded-full hover:bg-accent md:hidden"
          >
            {searchOpen ? <X className="size-5" /> : <Search className="size-5" />}
          </button>
          <Link
            href={routePath.orderLookup}
            className="hidden h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium hover:bg-accent sm:flex"
          >
            <PackageSearch className="size-5" />
            <span className="hidden lg:inline">Tra cứu đơn</span>
          </Link>
          <CartButton />
        </div>
      </div>
      {searchOpen && (
        <div className="border-t px-3 py-2 md:hidden">
          <SearchBox autoFocus onDone={() => setSearchOpen(false)} />
        </div>
      )}
      <nav aria-label="Danh mục" className="hidden border-t lg:block">
        <div className="mx-auto flex max-w-7xl items-center gap-6 overflow-x-auto px-6">
          <CategoryLinks categories={categories} />
        </div>
      </nav>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[85vw] max-w-sm p-0">
          <SheetHeader className="border-b">
            <SheetTitle>Danh mục</SheetTitle>
          </SheetHeader>
          <nav aria-label="Danh mục" className="flex flex-col gap-0.5 overflow-y-auto p-2">
            <CategoryLinks categories={categories} vertical onNavigate={() => setMenuOpen(false)} />
            <div className="my-2 border-t" />
            <Link
              href={routePath.orderLookup}
              onClick={() => setMenuOpen(false)}
              className="flex min-h-11 items-center gap-2 rounded-md px-3 text-base hover:bg-accent"
            >
              <PackageSearch className="size-5" />
              Tra cứu đơn hàng
            </Link>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  )
}
