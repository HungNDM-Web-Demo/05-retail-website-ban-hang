'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Ruler, ShoppingBag, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { routePath } from '@/config/route-path'
import { isApiError } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PublicProductDetail, PublicProductLookup } from '@/types/shop'
import { PriceTag } from '@/features/sales/components/PriceTag'
import { ProductImage } from '@/features/sales/components/ProductImage'
import { SalesRules } from '@/features/sales/lib/rules'
import { ImageGallery } from '../components/ImageGallery'
import { ProductGrid } from '../components/ProductCard'
import { QuantityStepper } from '../components/QuantityStepper'
import { useShopProduct } from '../hooks/use-shop'
import { cartStore, useCart } from '../lib/cart-storage'

function SizeChartDialog({ product }: { product: PublicProductDetail }) {
  const [open, setOpen] = useState(false)
  if (!product.sizeChart) return null
  const chart = product.sizeChart
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        <Ruler className="size-4" />
        Bảng size
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{chart.title}</DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {chart.columns.map((c) => (
                    <th key={c} className="px-2 py-2 text-left font-semibold whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chart.rows.map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {r.map((cell, j) => (
                      <td key={j} className={cn('px-2 py-2 whitespace-nowrap', j === 0 && 'font-semibold')}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ProductView({ product }: { product: PublicProductDetail }) {
  const router = useRouter()
  const cart = useCart()
  const single = product.variants.length === 1 ? product.variants[0] : undefined
  const hasSizes = product.sizes.length > 0
  const [color, setColor] = useState<string | undefined>(
    single?.colorCode ?? (product.colors.length === 1 ? product.colors[0].code : undefined)
  )
  const [size, setSize] = useState<string | undefined>(single?.size)
  const [quantity, setQuantity] = useState(1)
  const [limitHint, setLimitHint] = useState<string | null>(null)

  const variantOf = (c?: string, s?: string) =>
    product.variants.find((v) => v.colorCode === c && (hasSizes ? v.size === s : true))
  const variant = color && (!hasSizes || size) ? variantOf(color, size) : undefined
  const inCart = variant ? (cart.lines.find((l) => l.variantId === variant.id)?.quantity ?? 0) : 0
  const max = variant ? Math.max(0, Math.min(SalesRules.maxQuantityPerLine, variant.stock, SalesRules.maxQuantityPerLine - inCart)) : 1
  const qty = Math.max(1, Math.min(quantity, Math.max(1, max)))
  const colorObj = product.colors.find((c) => c.code === color)

  const images = product.images
  const imageIndex = useMemo(() => {
    const i = images.findIndex((img) => img.colorCode === color)
    return i < 0 ? 0 : i
  }, [images, color])

  const missing = !color ? 'Vui lòng chọn màu' : hasSizes && !size ? 'Vui lòng chọn size' : null
  const soldOut = variant && variant.stock <= 0
  const cartFull = variant && variant.stock > 0 && max <= 0
  const canAdd = !missing && variant && !soldOut && !cartFull

  const stockText = !variant
    ? null
    : variant.stock <= 0
      ? 'Hết hàng'
      : variant.stock <= SalesRules.lowStockMax
        ? `Chỉ còn ${variant.stock} sản phẩm`
        : 'Còn hàng'

  const add = (buyNow: boolean) => {
    if (!variant || !canAdd) return
    const result = cartStore.add(
      {
        variantId: variant.id,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        sku: variant.sku,
        colorName: colorObj?.name ?? '',
        ...(variant.size ? { size: variant.size } : {}),
        imageUrl: images[imageIndex]?.url ?? product.coverUrl,
        price: product.price,
        quantity: qty,
      },
      variant.stock
    )
    if (!result.ok) {
      toast.error(result.message)
      return
    }
    setQuantity(1)
    setLimitHint(null)
    if (buyNow) router.push(routePath.checkout)
    else
      toast.success('Đã thêm vào giỏ', {
        description: `${product.name} – ${colorObj?.name ?? ''}${variant.size ? ` / ${variant.size}` : ''} × ${qty}`,
        action: { label: 'Xem giỏ', onClick: () => router.push(routePath.cart) },
      })
  }

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 md:gap-10">
        <ImageGallery images={images} alt={product.name} activeIndex={imageIndex} />
        <div className="flex flex-col gap-5">
          <div className="space-y-2">
            <Link href={`${routePath.products}?category=${product.categorySlug}`} className="text-sm text-muted-foreground hover:text-primary">
              {product.categoryName}
            </Link>
            <h1 className="text-2xl leading-tight font-bold sm:text-3xl">{product.name}</h1>
            <p className="text-sm text-muted-foreground">
              Mã {product.code}
              {product.soldCount > 0 ? ` · Đã bán ${product.soldCount}` : ''}
            </p>
            <PriceTag price={product.price} listPrice={product.listPrice} size="lg" />
          </div>

          <fieldset>
            <legend className="mb-2 text-sm">
              Màu: <span className="font-semibold">{colorObj?.name ?? 'chưa chọn'}</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((c) => {
                const all = product.variants.filter((v) => v.colorCode === c.code)
                const out = all.every((v) => v.stock <= 0)
                const on = c.code === color
                return (
                  <button
                    key={c.code}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setColor(c.code)
                      setQuantity(1)
                      setLimitHint(null)
                    }}
                    className={cn(
                      'flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm transition-colors',
                      on ? 'border-primary ring-2 ring-primary/30' : 'hover:bg-accent',
                      out && 'text-muted-foreground'
                    )}
                  >
                    <span className="size-6 rounded-full ring-1 ring-border ring-inset" style={{ backgroundColor: c.hex }} />
                    {c.name}
                    {out && <span className="text-xs">(hết)</span>}
                  </button>
                )
              })}
            </div>
          </fieldset>

          {hasSizes && (
            <fieldset>
              <div className="mb-2 flex items-center justify-between">
                <legend className="text-sm">
                  Size: <span className="font-semibold">{size ?? 'chưa chọn'}</span>
                </legend>
                <SizeChartDialog product={product} />
              </div>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((s) => {
                  const v = color ? variantOf(color, s) : undefined
                  const unavailable = color
                    ? !v || v.stock <= 0
                    : product.variants.filter((x) => x.size === s).every((x) => x.stock <= 0)
                  const on = s === size
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={unavailable}
                      aria-pressed={on}
                      aria-label={unavailable ? `Size ${s} hết hàng` : `Size ${s}`}
                      onClick={() => {
                        setSize(s)
                        setQuantity(1)
                        setLimitHint(null)
                      }}
                      className={cn(
                        'relative flex h-11 min-w-14 items-center justify-center overflow-hidden rounded-lg border px-3 text-sm font-medium transition-colors',
                        on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent',
                        unavailable && 'cursor-not-allowed bg-muted text-muted-foreground hover:bg-muted'
                      )}
                    >
                      {s}
                      {unavailable && (
                        <span aria-hidden="true" className="pointer-events-none absolute inset-0">
                          <span className="absolute top-1/2 left-1/2 h-px w-[140%] -translate-x-1/2 -translate-y-1/2 -rotate-[32deg] bg-muted-foreground/60" />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <QuantityStepper
              value={qty}
              max={Math.max(1, max)}
              disabled={!canAdd}
              onChange={(v) => {
                setQuantity(v)
                setLimitHint(null)
              }}
              onLimit={() =>
                setLimitHint(
                  variant && variant.stock <= SalesRules.maxQuantityPerLine - inCart
                    ? `Chỉ còn ${variant.stock} sản phẩm`
                    : inCart > 0
                      ? `Giỏ đã có ${inCart}, mỗi sản phẩm tối đa ${SalesRules.maxQuantityPerLine}`
                      : `Tối đa ${SalesRules.maxQuantityPerLine} sản phẩm mỗi lần`
                )
              }
            />
            <p
              className={cn(
                'text-sm font-medium',
                variant && variant.stock <= 0 ? 'text-destructive' : variant && variant.stock <= SalesRules.lowStockMax ? 'text-warning' : 'text-success'
              )}
              aria-live="polite"
            >
              {limitHint ?? stockText}
            </p>
          </div>
          {cartFull && <p className="text-sm text-muted-foreground">Giỏ đã có {inCart} sản phẩm này (tối đa 10).</p>}

          <div className="hidden gap-3 md:flex">
            <Button size="lg" variant="outline" className="h-12 flex-1" disabled={!canAdd} onClick={() => add(false)}>
              <ShoppingBag className="size-4" />
              Thêm vào giỏ
            </Button>
            <Button size="lg" className="h-12 flex-1" disabled={!canAdd} onClick={() => add(true)}>
              Mua ngay
            </Button>
          </div>
          {missing && <p className="text-sm font-medium text-muted-foreground md:-mt-2">{missing}</p>}

          <div className="flex items-start gap-3 rounded-lg bg-muted/60 p-3 text-sm">
            <Truck className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              Miễn phí vận chuyển cho đơn từ {formatVnd(SalesRules.freeShipThreshold)}. Phí TP.HCM {formatVnd(SalesRules.shippingFeeHcm)}, tỉnh khác{' '}
              {formatVnd(SalesRules.shippingFeeOther)}.
            </span>
          </div>

          {product.description && (
            <section>
              <h2 className="mb-2 font-semibold">Mô tả</h2>
              <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                {product.description.split('\n').map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {product.related.length > 0 && (
        <section className="mt-12" aria-labelledby="related">
          <h2 id="related" className="mb-4 text-xl font-bold">
            Sản phẩm cùng danh mục
          </h2>
          <ProductGrid products={product.related} />
        </section>
      )}

      {/* Thanh cố định cuối màn hình trên điện thoại (NFR-01) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        {missing && <p className="mb-1.5 text-center text-xs font-medium text-muted-foreground">{missing}</p>}
        <div className="flex gap-2">
          <Button size="lg" variant="outline" className="h-12 flex-1" disabled={!canAdd} onClick={() => add(false)}>
            <ShoppingBag className="size-4" />
            Thêm vào giỏ
          </Button>
          <Button size="lg" className="h-12 flex-1" disabled={!canAdd} onClick={() => add(true)}>
            Mua ngay
          </Button>
        </div>
      </div>
      <div className="h-24 md:hidden" aria-hidden="true" />
    </>
  )
}

/** Chi tiết sản phẩm (SCR-03, UC-02); sản phẩm ẩn → "Sản phẩm ngừng kinh doanh" + gợi ý (BR-23) */
export function ProductDetailPage({ slug, initialData }: { slug: string; initialData?: PublicProductLookup | null }) {
  const { data, error, isLoading } = useShopProduct(slug, initialData)

  if (isLoading && !data)
    return (
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-5 sm:px-6 md:grid-cols-2">
        <Skeleton className="aspect-[4/5] rounded-xl" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    )

  if (!data || (isApiError(error) && error.status === 404))
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
        <h1 className="text-xl font-bold">Không tìm thấy sản phẩm</h1>
        <p className="text-muted-foreground">Đường dẫn có thể đã thay đổi. Mời bạn xem các sản phẩm khác.</p>
        <Button asChild>
          <Link href={routePath.products}>Xem tất cả sản phẩm</Link>
        </Button>
      </div>
    )

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
      <nav aria-label="Đường dẫn" className="mb-4 truncate text-sm text-muted-foreground">
        <Link href={routePath.shopHome} className="hover:text-primary">
          Trang chủ
        </Link>
        <span className="mx-1.5">/</span>
        {data.product ? (
          <>
            <Link href={`${routePath.products}?category=${data.product.categorySlug}`} className="hover:text-primary">
              {data.product.categoryName}
            </Link>
            <span className="mx-1.5">/</span>
            <span className="text-foreground">{data.product.name}</span>
          </>
        ) : (
          <span className="text-foreground">{data.discontinued?.name}</span>
        )}
      </nav>
      {data.product ? (
        <ProductView key={data.product.id} product={data.product} />
      ) : (
        <>
          <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-6 text-center sm:flex-row sm:text-left">
            <ProductImage src={data.discontinued?.coverUrl} alt={data.discontinued?.name ?? ''} className="w-32 shrink-0 rounded-lg opacity-60 grayscale" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-destructive">Sản phẩm ngừng kinh doanh</p>
              <h1 className="text-xl font-bold">{data.discontinued?.name}</h1>
              <p className="text-muted-foreground">Mẫu này không còn bán. Bạn tham khảo các sản phẩm tương tự bên dưới nhé.</p>
              {data.discontinued?.categorySlug && (
                <Button asChild variant="outline">
                  <Link href={`${routePath.products}?category=${data.discontinued.categorySlug}`}>Xem {data.discontinued.categoryName}</Link>
                </Button>
              )}
            </div>
          </div>
          {data.related.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-4 text-xl font-bold">Sản phẩm tương tự</h2>
              <ProductGrid products={data.related} />
            </section>
          )}
        </>
      )}
    </div>
  )
}
