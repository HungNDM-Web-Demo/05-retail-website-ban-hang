'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react'
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ProductImage } from '@/features/sales/components/ProductImage'

type GalleryImage = { url: string; colorCode?: string }

type ImageGalleryProps = {
  images: GalleryImage[]
  alt: string
  /** Chỉ số ảnh cần hiện (đổi màu → ảnh đầu tiên của màu, UC-02 bước 2) */
  activeIndex?: number
}

/**
 * Bộ ảnh sản phẩm (07 §4.3): vuốt bằng embla, ảnh nhỏ bên dưới, chạm phóng to trong Dialog.
 * Chưa có ảnh thì ô màu dự phòng.
 */
export function ImageGallery({ images, alt, activeIndex = 0 }: ImageGalleryProps) {
  const [api, setApi] = useState<CarouselApi>()
  const [zoomApi, setZoomApi] = useState<CarouselApi>()
  const [index, setIndex] = useState(0)
  const [zoom, setZoom] = useState(false)

  useEffect(() => {
    if (!api) return
    const onSelect = () => setIndex(api.selectedScrollSnap())
    api.on('select', onSelect)
    return () => {
      api.off('select', onSelect)
    }
  }, [api])

  useEffect(() => {
    api?.scrollTo(activeIndex)
  }, [api, activeIndex])

  useEffect(() => {
    if (zoom) zoomApi?.scrollTo(index, true)
  }, [zoom, zoomApi, index])

  if (images.length === 0) return <ProductImage src={null} alt={alt} className="rounded-xl" />

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Carousel setApi={setApi} opts={{ loop: images.length > 1 }}>
          <CarouselContent className="ml-0">
            {images.map((img, i) => (
              <CarouselItem key={img.url} className="pl-0">
                <button
                  type="button"
                  onClick={() => setZoom(true)}
                  className="block w-full cursor-zoom-in overflow-hidden rounded-xl"
                  aria-label={`Phóng to ảnh ${i + 1}`}
                >
                  <ProductImage src={img.url} alt={`${alt} – ảnh ${i + 1}`} priority={i === 0} />
                </button>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        <span className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-1 rounded-full bg-background/85 px-2 py-1 text-xs font-medium">
          <ZoomIn className="size-3.5" />
          {index + 1}/{images.length}
        </span>
        {images.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Ảnh trước"
              onClick={() => api?.scrollPrev()}
              className="absolute top-1/2 left-2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/85 shadow md:flex"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Ảnh sau"
              onClick={() => api?.scrollNext()}
              className="absolute top-1/2 right-2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/85 shadow md:flex"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              onClick={() => api?.scrollTo(i)}
              aria-label={`Xem ảnh ${i + 1}`}
              aria-current={i === index}
              className={cn(
                'w-16 shrink-0 overflow-hidden rounded-md ring-2 transition sm:w-20',
                i === index ? 'ring-primary' : 'ring-transparent opacity-70 hover:opacity-100'
              )}
            >
              <ProductImage src={img.url} alt="" />
            </button>
          ))}
        </div>
      )}
      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="max-w-[min(92vw,640px)] p-2 sm:p-3">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <Carousel setApi={setZoomApi} opts={{ loop: images.length > 1, startIndex: index }}>
            <CarouselContent className="ml-0">
              {images.map((img, i) => (
                <CarouselItem key={img.url} className="pl-0">
                  <ProductImage src={img.url} alt={`${alt} – ảnh ${i + 1}`} className="rounded-lg" />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
          {images.length > 1 && (
            <div className="flex justify-center gap-2 pt-1">
              <button type="button" className="flex size-11 items-center justify-center rounded-full border" aria-label="Ảnh trước" onClick={() => zoomApi?.scrollPrev()}>
                <ChevronLeft className="size-5" />
              </button>
              <button type="button" className="flex size-11 items-center justify-center rounded-full border" aria-label="Ảnh sau" onClick={() => zoomApi?.scrollNext()}>
                <ChevronRight className="size-5" />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
