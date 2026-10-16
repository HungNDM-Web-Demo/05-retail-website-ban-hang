'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ExternalLink, Loader2, Save, SearchX, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { FormField } from '@/components/shared/FormField'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import { discountPercent, slugify } from '@/features/sales/lib/stock'
import { usePermissions } from '@/hooks/use-permissions'
import { applyFieldErrors, getErrorMessage, isApiError } from '@/lib/api-error'
import { formatNumber } from '@/lib/format'
import type { ProductDto } from '@/types/shop'
import { ColorSizePicker } from '../components/ColorSizePicker'
import { ImageManager } from '../components/ImageManager'
import { MoneyInput } from '../components/MoneyInput'
import { SizeChartEditor } from '../components/SizeChartEditor'
import { VariantGrid } from '../components/VariantGrid'
import { useCategories, useColors, useDeleteProduct, useProduct, useSaveProduct, useSetProductHidden } from '../hooks/use-products'
import {
  emptyProductForm,
  formToRequest,
  productSchema,
  productToForm,
  rebuildGrid,
  type ProductFormValues,
} from '../schemas/product.schema'

/** SCR-10 Thêm, sửa sản phẩm và biến thể (UC-06; FR-17, FR-18, FR-20; TC-21…24) */
export function ProductEditPage({ id }: { id?: string }) {
  return (
    <PermissionGuard permission={id ? permissions.products.view : permissions.products.create} redirect>
      {id ? <ExistingProduct id={id} /> : <ProductForm />}
    </PermissionGuard>
  )
}

function ExistingProduct({ id }: { id: string }) {
  const product = useProduct(id)
  if (product.error && !product.data) {
    if (isApiError(product.error) && product.error.status === 404)
      return (
        <EmptyState
          icon={SearchX}
          title="Không tìm thấy sản phẩm"
          action={
            <Button asChild variant="outline">
              <Link href={routePath.adminProducts}>Về danh sách sản phẩm</Link>
            </Button>
          }
        />
      )
    return <ErrorState error={product.error} onRetry={() => void product.refetch()} />
  }
  if (!product.data) return <Skeleton className="h-[40rem] rounded-xl" />
  return <ProductForm key={`${product.data.id}-${product.data.updatedAt ?? ''}`} product={product.data} />
}

function ProductForm({ product }: { product?: ProductDto }) {
  const router = useRouter()
  const { can } = usePermissions()
  const categories = useCategories()
  const colors = useColors()
  const save = useSaveProduct()
  const remove = useDeleteProduct()
  const hide = useSetProductHidden()
  const [deleting, setDeleting] = useState(false)
  const readOnly = product ? !can(permissions.products.update) : !can(permissions.products.create)

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: product ? productToForm(product) : emptyProductForm(),
  })
  const { control, register, formState, setValue, handleSubmit, setError } = form
  const errors = formState.errors
  const [code, name, price, listPrice, colorIds, sizes, variants] = useWatch({
    control,
    name: ['code', 'name', 'price', 'listPrice', 'colorIds', 'sizes', 'variants'],
  })
  const percent = price && listPrice ? discountPercent(price, listPrice) : undefined

  const setGrid = (nextColors: string[], nextSizes: string[]) => {
    setValue('colorIds', nextColors, { shouldDirty: true, shouldValidate: formState.isSubmitted })
    setValue('sizes', nextSizes, { shouldDirty: true })
    setValue('variants', rebuildGrid(nextColors, nextSizes, variants), { shouldDirty: true })
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({ id: product?.id, body: formToRequest(values) })
      toast.success(product ? 'Đã lưu sản phẩm' : `Đã thêm ${saved.name} với ${saved.variants.length} biến thể`)
      if (!product) router.replace(routePath.adminProductDetail(saved.id))
    } catch (e) {
      if (!applyFieldErrors(setError, e)) toast.error(getErrorMessage(e), { duration: 8000 })
    }
  })

  const hideProduct = async () => {
    if (!product) return
    try {
      await hide.mutateAsync({ id: product.id, body: { isHidden: true } })
      toast.success('Đã ẩn sản phẩm khỏi cửa hàng')
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Link href={routePath.adminProducts} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Sản phẩm
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{product ? product.name : 'Thêm sản phẩm'}</h1>
            {product && (
              <StatusBadge tone={product.status === 'DangBan' ? 'primary' : 'neutral'}>
                {product.status === 'DangBan' ? 'Đang bán' : 'Ẩn'}
              </StatusBadge>
            )}
          </div>
          {product && (
            <p className="text-muted-foreground text-sm">
              {product.code} · đã bán {formatNumber(product.soldCount, 0)} · tổng tồn {formatNumber(product.totalStock, 0)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {product && (
            <Button type="button" variant="ghost" asChild>
              <a href={routePath.productDetail(product.slug)} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden="true" />
                Xem ở cửa hàng
              </a>
            </Button>
          )}
          {product && can(permissions.products.delete) && (
            <Button type="button" variant="destructive" onClick={() => setDeleting(true)}>
              <Trash2 aria-hidden="true" />
              Xóa
            </Button>
          )}
          {!readOnly && (
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
              {product ? 'Lưu thay đổi' : 'Lưu sản phẩm'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Thông tin chung</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField label="Mã sản phẩm" required error={errors.code?.message} hint="2 chữ in hoa + 3 số, vd SM010">
                <Input
                  {...register('code', { setValueAs: (v: string) => v.toUpperCase() })}
                  maxLength={5}
                  disabled={readOnly || !!product?.everOrdered}
                  className="uppercase"
                />
              </FormField>
              <FormField label="Danh mục" htmlFor="product-category" required error={errors.categoryId?.message}>
                <Controller
                  control={control}
                  name="categoryId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                      <SelectTrigger id="product-category">
                        <SelectValue placeholder="Chọn danh mục" />
                      </SelectTrigger>
                      <SelectContent>
                        {(categories.data ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
              <FormField label="Tên sản phẩm" required error={errors.name?.message} className="sm:col-span-2">
                <Input {...register('name')} maxLength={200} disabled={readOnly} />
              </FormField>
              <FormField
                label="Đường dẫn"
                error={errors.slug?.message}
                hint={`Để trống thì tự sinh: /products/${slugify(name ?? '') || '…'}`}
                className="sm:col-span-2"
              >
                <Input {...register('slug')} placeholder={slugify(name ?? '')} disabled={readOnly} />
              </FormField>
              <label className="flex items-center gap-2 text-sm">
                <Controller
                  control={control}
                  name="isFeatured"
                  render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} disabled={readOnly} />}
                />
                Nổi bật trên trang chủ
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Controller
                  control={control}
                  name="isHidden"
                  render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} disabled={readOnly} />}
                />
                Ẩn khỏi cửa hàng
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ảnh</CardTitle>
              <CardDescription>Tối đa 8 ảnh, tỉ lệ 4:5. Ảnh gắn màu sẽ hiện khi khách chọn màu đó.</CardDescription>
            </CardHeader>
            <CardContent>
              <Controller
                control={control}
                name="images"
                render={({ field }) => (
                  <ImageManager
                    value={field.value}
                    onChange={field.onChange}
                    colors={(colors.data ?? []).filter((c) => colorIds.includes(c.id))}
                    readOnly={readOnly}
                    error={errors.images?.message}
                  />
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Màu, size và biến thể</CardTitle>
              <CardDescription>Mỗi màu × size là một biến thể có SKU và tồn riêng. Biến thể đã bán không xóa được, chỉ tắt.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ColorSizePicker
                colors={colors.data ?? []}
                colorIds={colorIds}
                sizes={sizes}
                onColors={(ids) => setGrid(ids, sizes)}
                onSizes={(s) => setGrid(colorIds, s)}
                readOnly={readOnly}
                canAddColor={can(permissions.products.create)}
                colorError={errors.colorIds?.message}
              />
              <VariantGrid
                code={code}
                colors={colors.data ?? []}
                variants={variants}
                onChange={(v) => setValue('variants', v, { shouldDirty: true })}
                product={product}
                readOnly={readOnly}
                canAdjust={!!product && can(permissions.products.adjustStock)}
                error={errors.variants?.message ?? errors.variants?.root?.message}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Giá</CardTitle>
              <CardDescription>Mọi biến thể dùng chung giá bán.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <FormField label="Giá bán" htmlFor="product-price" required error={errors.price?.message}>
                <Controller
                  control={control}
                  name="price"
                  render={({ field }) => <MoneyInput id="product-price" value={field.value} onChange={(v) => field.onChange(v)} disabled={readOnly} />}
                />
              </FormField>
              <FormField
                label="Giá gốc (gạch ngang)"
                htmlFor="product-list-price"
                error={errors.listPrice?.message}
                hint={percent ? `Cửa hàng hiện nhãn −${percent}%` : 'Để trống nếu không giảm giá'}
              >
                <Controller
                  control={control}
                  name="listPrice"
                  render={({ field }) => <MoneyInput id="product-list-price" value={field.value} onChange={(v) => field.onChange(v)} disabled={readOnly} />}
                />
              </FormField>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mô tả</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField label="Mô tả sản phẩm" error={errors.description?.message}>
                <Textarea {...register('description')} rows={6} disabled={readOnly} placeholder="Chất liệu, kiểu dáng, cách giặt…" />
              </FormField>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bảng size</CardTitle>
            </CardHeader>
            <CardContent>
              <Controller
                control={control}
                name="sizeChart"
                render={({ field }) => <SizeChartEditor value={field.value} onChange={field.onChange} sizes={sizes} readOnly={readOnly} />}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {product && (
        <ConfirmDialog
          open={deleting}
          onOpenChange={setDeleting}
          title={`Xóa ${product.name}?`}
          description="Chỉ xóa được sản phẩm chưa có trong đơn hàng. Sản phẩm đã bán hãy dùng Ẩn."
          variant="destructive"
          confirmText="Xóa sản phẩm"
          loading={remove.isPending}
          onConfirm={async () => {
            try {
              await remove.mutateAsync(product.id)
              toast.success('Đã xóa sản phẩm')
              router.replace(routePath.adminProducts)
            } catch (e) {
              toast.error(getErrorMessage(e), {
                duration: 10000,
                action: can(permissions.products.update) && product.status !== 'An' ? { label: 'Ẩn sản phẩm', onClick: () => void hideProduct() } : undefined,
              })
            }
          }}
        />
      )}
    </form>
  )
}
