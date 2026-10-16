'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Package, Pencil, Plus } from 'lucide-react'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import { usePermissions } from '@/hooks/use-permissions'
import type { ColorDto } from '@/types/shop'
import { CategoriesTab } from '../components/CategoriesTab'
import { ColorFormDialog } from '../components/ColorSizePicker'
import { ProductsTab } from '../components/ProductsTab'
import { useColors } from '../hooks/use-products'

const TABS = ['products', 'categories', 'colors'] as const
type Tab = (typeof TABS)[number]

/** SCR-09 Sản phẩm (UC-06, FR-16, FR-19): tab Sản phẩm, Danh mục, Màu */
export function ProductsPage() {
  return (
    <PermissionGuard permission={permissions.products.view} redirect>
      <Suspense>
        <ProductsView />
      </Suspense>
    </PermissionGuard>
  )
}

function ProductsView() {
  const { can } = usePermissions()
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const raw = params.get('tab')
  const tab: Tab = TABS.includes(raw as Tab) ? (raw as Tab) : 'products'
  return (
    <div className="space-y-5">
      <PageHeader
        title="Sản phẩm"
        icon={Package}
        description="Danh mục, sản phẩm, biến thể màu × size và tồn kho."
        actions={
          can(permissions.products.create) && (
            <Button asChild>
              <Link href={routePath.adminProductNew}>
                <Plus aria-hidden="true" />
                Thêm sản phẩm
              </Link>
            </Button>
          )
        }
      />
      <Tabs value={tab} onValueChange={(v) => router.replace(v === 'products' ? pathname : `${pathname}?tab=${v}`, { scroll: false })} className="gap-4">
        <TabsList className="group-data-horizontal/tabs:h-11">
          <TabsTrigger value="products" className="px-4">
            Sản phẩm
          </TabsTrigger>
          <TabsTrigger value="categories" className="px-4">
            Danh mục
          </TabsTrigger>
          <TabsTrigger value="colors" className="px-4">
            Màu
          </TabsTrigger>
        </TabsList>
        <TabsContent value="products">
          <ProductsTab />
        </TabsContent>
        <TabsContent value="categories">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="colors">
          <ColorsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ColorsTab() {
  const { can } = usePermissions()
  const colors = useColors()
  const [editing, setEditing] = useState<ColorDto | 'new' | null>(null)
  if (colors.error) return <ErrorState error={colors.error} onRetry={() => void colors.refetch()} />
  if (!colors.data) return <Skeleton className="h-64 rounded-xl" />
  return (
    <div className="bg-card rounded-xl border shadow-xs">
      <div className="flex items-center justify-between gap-3 border-b p-4">
        <p className="text-muted-foreground text-sm">Màu dùng chung cho mọi sản phẩm; mã màu nằm trong SKU nên không đổi được.</p>
        {can(permissions.products.create) && (
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden="true" />
            Thêm màu
          </Button>
        )}
      </div>
      <ul className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-4">
        {colors.data.map((c) => (
          <li key={c.id} className="flex items-center gap-3 rounded-lg border p-3">
            <span className="size-8 shrink-0 rounded-full border" style={{ backgroundColor: c.hex }} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{c.name}</p>
              <p className="text-muted-foreground text-xs">
                {c.code} · {c.hex}
              </p>
            </div>
            {can(permissions.products.update) && (
              <Button size="icon-sm" variant="ghost" aria-label={`Sửa màu ${c.name}`} onClick={() => setEditing(c)}>
                <Pencil aria-hidden="true" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {editing && <ColorFormDialog value={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
