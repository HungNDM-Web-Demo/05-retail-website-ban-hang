import Link from 'next/link'
import { routePath } from '@/config/route-path'
import { cn } from '@/lib/utils'
import type { PublicProductCard } from '@/types/shop'
import { PriceTag } from '@/features/sales/components/PriceTag'
import { ProductImage } from '@/features/sales/components/ProductImage'

type ProductCardProps = {
  product: PublicProductCard
  /** Ảnh đầu màn hình (tải ngay) */
  priority?: boolean
  className?: string
}

/** Thẻ sản phẩm (SCR-01, SCR-02): ảnh 4:5 (ảnh thứ hai khi rê chuột), nhãn −n%, hết hàng, giá, chấm màu */
export function ProductCard({ product, priority, className }: ProductCardProps) {
  const maxDots = 5
  return (
    <Link
      href={routePath.productDetail(product.slug)}
      className={cn(
        'group flex flex-col gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className
      )}
    >
      <div className="relative overflow-hidden rounded-lg">
        <ProductImage
          src={product.coverUrl}
          alt={product.name}
          priority={priority}
          imgClassName="transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
        />
        {product.hoverUrl && (
          <ProductImage
            src={product.hoverUrl}
            alt=""
            aspect={false}
            className="pointer-events-none absolute inset-0 hidden opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none md:block"
          />
        )}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.discountPercent ? (
            <span className="rounded bg-destructive px-1.5 py-0.5 text-xs font-semibold text-destructive-foreground">
              −{product.discountPercent}%
            </span>
          ) : null}
        </div>
        {product.isOutOfStock && (
          <div className="absolute inset-x-0 bottom-0 bg-foreground/70 py-1.5 text-center text-xs font-semibold text-background">
            Hết hàng
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 px-0.5">
        {product.colors.length > 0 && (
          <div className="flex items-center gap-1" aria-label={`${product.colors.length} màu`}>
            {product.colors.slice(0, maxDots).map((c) => (
              <span
                key={c.code}
                title={c.name}
                className="size-3.5 rounded-full ring-1 ring-border ring-inset"
                style={{ backgroundColor: c.hex }}
              />
            ))}
            {product.colors.length > maxDots && (
              <span className="text-xs text-muted-foreground">+{product.colors.length - maxDots}</span>
            )}
          </div>
        )}
        <h3 className="line-clamp-2 text-sm leading-snug font-medium text-foreground group-hover:text-primary">
          {product.name}
        </h3>
        <PriceTag price={product.price} listPrice={product.listPrice} showPercent={false} size="sm" />
      </div>
    </Link>
  )
}

/** Lưới sản phẩm: 2 cột điện thoại, 3 cột máy tính bảng, 4 cột máy tính (07 §4.3) */
export function ProductGrid({
  products,
  priorityCount = 0,
  className,
}: {
  products: PublicProductCard[]
  priorityCount?: number
  className?: string
}) {
  return (
    <div className={cn('grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-5', className)}>
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < priorityCount} />
      ))}
    </div>
  )
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="aspect-[4/5] animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}
