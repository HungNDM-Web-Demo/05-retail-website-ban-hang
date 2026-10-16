'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, FolderTree, GripVertical, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { permissions } from '@/config/permissions'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import type { CategoryDto } from '@/types/shop'
import { useCategories, useCategoryVisibility, useDeleteCategory, useReorderCategories, useSaveCategory } from '../hooks/use-products'
import { slugify } from '@/features/sales/lib/stock'
import { ProductThumb } from './ProductThumb'

/** Tab Danh mục (FR-16): thêm, đổi tên, kéo thả thứ tự, bật tắt hiển thị, xóa danh mục trống */
export function CategoriesTab() {
  const { can } = usePermissions()
  const categories = useCategories()
  const reorder = useReorderCategories()
  const visibility = useCategoryVisibility()
  const remove = useDeleteCategory()
  const [editing, setEditing] = useState<CategoryDto | 'new' | null>(null)
  const [deleting, setDeleting] = useState<CategoryDto | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const canEdit = can(permissions.products.update)

  if (categories.error) return <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
  if (!categories.data) return <Skeleton className="h-96 rounded-xl" />
  const list = categories.data

  const move = async (ids: string[]) => {
    try {
      await reorder.mutateAsync(ids)
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }
  const moveBy = (index: number, delta: number) => {
    const ids = list.map((c) => c.id)
    const [item] = ids.splice(index, 1)
    ids.splice(index + delta, 0, item)
    void move(ids)
  }
  const drop = (targetId: string) => {
    if (!dragId || dragId === targetId) return
    const ids = list.map((c) => c.id).filter((id) => id !== dragId)
    ids.splice(ids.indexOf(targetId), 0, dragId)
    setDragId(null)
    void move(ids)
  }

  return (
    <div className="bg-card overflow-hidden rounded-xl border shadow-xs">
      <div className="flex items-center justify-between gap-3 border-b p-4">
        <p className="text-muted-foreground text-sm">
          {list.length} danh mục. {canEdit && 'Kéo thả hoặc bấm mũi tên để đổi thứ tự hiển thị ở cửa hàng.'}
        </p>
        {can(permissions.products.create) && (
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden="true" />
            Thêm danh mục
          </Button>
        )}
      </div>
      {!list.length ? (
        <EmptyState icon={FolderTree} title="Chưa có danh mục" />
      ) : (
        <ul className={cn('divide-y', reorder.isPending && 'opacity-60')}>
          {list.map((c, i) => (
            <li
              key={c.id}
              draggable={canEdit}
              onDragStart={() => setDragId(c.id)}
              onDragOver={(e) => canEdit && e.preventDefault()}
              onDrop={() => drop(c.id)}
              className={cn('flex items-center gap-3 px-4 py-2.5', dragId === c.id && 'bg-muted')}
            >
              {canEdit && <GripVertical className="text-muted-foreground size-4 cursor-grab" aria-hidden="true" />}
              <span className="size-4 shrink-0 rounded-full border" style={{ backgroundColor: c.color }} aria-hidden="true" />
              <ProductThumb url={c.imageUrl} alt={c.name} className="w-9" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{c.name}</p>
                <p className="text-muted-foreground text-xs">
                  {c.code} · /{c.slug} · {c.productCount} sản phẩm
                </p>
              </div>
              {canEdit && (
                <div className="flex items-center gap-1">
                  <Button size="icon-sm" variant="ghost" aria-label={`Đưa ${c.name} lên`} disabled={i === 0} onClick={() => moveBy(i, -1)}>
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Đưa ${c.name} xuống`} disabled={i === list.length - 1} onClick={() => moveBy(i, 1)}>
                    <ArrowDown aria-hidden="true" />
                  </Button>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={c.isVisible}
                  disabled={!canEdit}
                  onCheckedChange={(v) =>
                    visibility.mutate({ id: c.id, isVisible: v }, { onError: (e) => toast.error(getErrorMessage(e)) })
                  }
                  aria-label={`Hiển thị ${c.name}`}
                />
                <span className="w-20">{c.isVisible ? 'Đang hiện' : 'Đang ẩn'}</span>
              </label>
              {canEdit && (
                <Button size="icon-sm" variant="ghost" aria-label={`Sửa ${c.name}`} onClick={() => setEditing(c)}>
                  <Pencil aria-hidden="true" />
                </Button>
              )}
              {can(permissions.products.delete) && (
                <Button size="icon-sm" variant="ghost" aria-label={`Xóa ${c.name}`} onClick={() => setDeleting(c)}>
                  <Trash2 aria-hidden="true" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && <CategoryFormDialog value={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Xóa danh mục ${deleting?.name ?? ''}?`}
        description="Chỉ xóa được danh mục không còn sản phẩm."
        variant="destructive"
        confirmText="Xóa"
        loading={remove.isPending}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(deleting!.id)
            toast.success('Đã xóa danh mục')
          } catch (e) {
            toast.error(getErrorMessage(e))
            throw e
          }
        }}
      />
    </div>
  )
}

function CategoryFormDialog({ value, onClose }: { value: CategoryDto | null; onClose: () => void }) {
  const [form, setForm] = useState({
    code: value?.code ?? '',
    name: value?.name ?? '',
    slug: value?.slug ?? '',
    color: value?.color ?? '#E5E7EB',
    isVisible: value?.isVisible ?? true,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useSaveCategory()
  const set = (k: keyof typeof form, v: string | boolean) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: '' }))
  }
  const submit = async () => {
    const errs: Record<string, string> = {}
    if (!/^[A-Z]{2}$/.test(form.code.trim().toUpperCase())) errs.code = 'Mã danh mục gồm 2 chữ in hoa'
    if (form.name.trim().length < 2) errs.name = 'Tên từ 2 ký tự'
    if (Object.keys(errs).length) return setErrors(errs)
    try {
      await save.mutateAsync({
        id: value?.id,
        body: {
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          slug: form.slug.trim() || undefined,
          color: form.color,
          isVisible: form.isVisible,
          imageUrl: value?.imageUrl,
        },
      })
      toast.success(value ? 'Đã lưu danh mục' : 'Đã thêm danh mục')
      onClose()
    } catch (e) {
      const f = getFieldErrors(e)
      if (Object.keys(f).length) setErrors(f)
      else toast.error(getErrorMessage(e))
    }
  }
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{value ? `Sửa danh mục ${value.name}` : 'Thêm danh mục'}</DialogTitle>
          <DialogDescription>Đường dẫn để trống thì tự sinh từ tên.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <div className="grid grid-cols-[8rem_1fr] gap-3">
            <FormField label="Mã" required error={errors.code}>
              <Input value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} maxLength={2} />
            </FormField>
            <FormField label="Tên" required error={errors.name}>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={100} />
            </FormField>
          </div>
          <FormField label="Đường dẫn" error={errors.slug} hint={`Gợi ý: ${slugify(form.name) || '…'}`}>
            <Input value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder={slugify(form.name)} />
          </FormField>
          <FormField label="Màu nền ô ảnh" error={errors.color}>
            <div className="flex items-center gap-2">
              <input type="color" value={form.color} onChange={(e) => set('color', e.target.value)} aria-label="Chọn màu" className="h-10 w-14 rounded border" />
              <Input value={form.color} onChange={(e) => set('color', e.target.value)} className="w-32" />
            </div>
          </FormField>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={form.isVisible} onCheckedChange={(v) => set('isVisible', v)} />
            Hiển thị ở cửa hàng
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Lưu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
