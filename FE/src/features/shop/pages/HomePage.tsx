'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, RotateCcw, ShieldCheck, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel'
import { routePath } from '@/config/route-path'
import { useAssetUrl } from '@/hooks/use-asset-url'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Banner, PublicCategory, PublicHome, PublicProductCard, PublicStoreInfo } from '@/types/shop'
import { ProductImage } from '@/features/sales/components/ProductImage'
import { ProductGrid, ProductGridSkeleton } from '../components/ProductCard'
import { useShopHome, useStoreInfo } from '../hooks/use-shop'

function BannerSlide({ banner, priority }: { banner: Banner; priority?: boolean }) {
  const src = useAssetUrl(banner.imageUrl)
  return (
    <div className="relative overflow-hidden rounded-xl bg-muted">
      {src && (
        // eslint-disable-next-line @next/next/no-img-element -- ảnh banner WebP tĩnh
        <img
          src={src}
          alt=""
          loading={priority ? 'eager' : 'lazy'}
          className="aspect-[4/5] w-full object-cover sm:aspect-[16/7]"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent sm:bg-gradient-to-r sm:from-black/60 sm:via-black/25" />
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-5 text-white sm:inset-y-0 sm:left-0 sm:max-w-md sm:justify-center sm:p-10">
        <h2 className="text-2xl leading-tight font-bold sm:text-4xl">{banner.title}</h2>
        {banner.subtitle && <p className="text-sm text-white/90 sm:text-base">{banner.subtitle}</p>}
        <Button asChild size="lg" className="w-fit bg-white text-foreground hover:bg-white/90">
          <Link href={banner.link}>
            {banner.buttonText}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}

function Hero({ banners }: { banners: Banner[] }) {
  const [api, setApi] = useState<CarouselApi>()
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (!api) return
    const onSelect = () => setIndex(api.selectedScrollSnap())
    api.on('select', onSelect)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = reduce ? undefined : setInterval(() => api.scrollNext(), 6000)
    return () => {
      api.off('select', onSelect)
      if (timer) clearInterval(timer)
    }
  }, [api])
  if (banners.length === 0) return null
  return (
    <section aria-label="Khuyến mãi" className="relative">
      <Carousel setApi={setApi} opts={{ loop: true }}>
        <CarouselContent>
          {banners.map((b, i) => (
            <CarouselItem key={b.imageUrl}>
              <BannerSlide banner={b} priority={i === 0} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      {banners.length > 1 && (
        <div className="mt-3 flex justify-center gap-1">
          {banners.map((b, i) => (
            <button
              key={b.imageUrl}
              type="button"
              aria-label={`Banner ${i + 1}`}
              aria-current={i === index}
              onClick={() => api?.scrollTo(i)}
              className="flex size-6 items-center justify-center"
            >
              <span className={cn('h-1.5 rounded-full transition-all', i === index ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/40')} />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function CategoryTiles({ categories }: { categories: PublicCategory[] }) {
  return (
    <section aria-labelledby="home-categories">
      <h2 id="home-categories" className="mb-4 text-xl font-bold">
        Danh mục
      </h2>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-8">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`${routePath.products}?category=${c.slug}`}
            className="group flex w-24 shrink-0 snap-start flex-col items-center gap-2 text-center sm:w-auto"
          >
            <ProductImage
              src={c.imageUrl}
              alt={c.name}
              fallbackColor={c.color}
              aspect={false}
              className="aspect-square w-full rounded-full ring-2 ring-transparent transition group-hover:ring-primary"
            />
            <span className="text-sm leading-tight font-medium">{c.name}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

function Section({ id, title, href, products }: { id: string; title: string; href: string; products: PublicProductCard[] }) {
  if (products.length === 0) return null
  return (
    <section aria-labelledby={id}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 id={id} className="text-xl font-bold">
          {title}
        </h2>
        <Link href={href} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary hover:underline">
          Xem tất cả <ArrowRight className="size-4" />
        </Link>
      </div>
      <ProductGrid products={products} />
    </section>
  )
}

function Perks({ store }: { store?: PublicStoreInfo }) {
  const items = [
    { icon: Truck, title: 'Miễn phí vận chuyển', text: `Đơn từ ${formatVnd(store?.freeShipThreshold ?? 499000)}` },
    { icon: ShieldCheck, title: 'Kiểm tra khi nhận', text: 'Thanh toán khi nhận hàng (COD)' },
    { icon: RotateCcw, title: 'Tra cứu đơn dễ dàng', text: 'Chỉ cần mã đơn và số điện thoại' },
  ]
  return (
    <section className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3">
      {items.map(({ icon: Icon, title, text }) => (
        <div key={title} className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-sm text-muted-foreground">{text}</p>
          </div>
        </div>
      ))}
    </section>
  )
}

/** Trang chủ cửa hàng (SCR-01, FR-04): banner, danh mục, nổi bật, đang giảm giá, mới về */
export function HomePage({ initialData, initialStore }: { initialData?: PublicHome; initialStore?: PublicStoreInfo }) {
  const { data } = useShopHome(initialData)
  const { data: store } = useStoreInfo(initialStore)
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-4 sm:px-6 sm:py-6">
      {data ? (
        <>
          <Hero banners={data.banners} />
          <Perks store={store} />
          <CategoryTiles categories={data.categories} />
          <Section id="home-featured" title="Nổi bật" href={routePath.products} products={data.featured} />
          <Section id="home-sale" title="Đang giảm giá" href={routePath.products} products={data.onSale} />
          <Section id="home-new" title="Mới về" href={`${routePath.products}?sort=newest`} products={data.newest} />
        </>
      ) : (
        <ProductGridSkeleton />
      )}
    </div>
  )
}
