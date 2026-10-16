'use client'

import { useState } from 'react'
import { useAssetUrl } from '@/hooks/use-asset-url'
import { cn } from '@/lib/utils'

type ProductImageProps = {
  src?: string | null
  alt: string
  /** Màu nền ô dự phòng (màu danh mục hoặc màu biến thể) */
  fallbackColor?: string
  /** Chữ viết tắt trên ô dự phòng; mặc định 2 chữ đầu của tên */
  fallbackText?: string
  /** Khung tỉ lệ 4:5 (ảnh sản phẩm 800×1000); false khi người gọi tự đặt kích thước */
  aspect?: boolean
  className?: string
  imgClassName?: string
  /** Ảnh đầu màn hình: tải ngay, không lười */
  priority?: boolean
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')

/**
 * Ảnh sản phẩm (06 §3): ảnh thật WebP 4:5, tải lười (NFR-02); chưa có hoặc lỗi ảnh thì ô màu kèm
 * chữ viết tắt. Dùng ở cửa hàng, danh sách sản phẩm, dòng đơn quản trị.
 */
export function ProductImage({
  src,
  alt,
  fallbackColor,
  fallbackText,
  aspect = true,
  className,
  imgClassName,
  priority,
}: ProductImageProps) {
  const url = useAssetUrl(src ?? undefined)
  const [failed, setFailed] = useState<string | null>(null)
  const showImage = !!url && failed !== url
  return (
    <div
      className={cn('relative overflow-hidden bg-muted', aspect && 'aspect-[4/5]', className)}
      style={!showImage && fallbackColor ? { backgroundColor: fallbackColor } : undefined}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh WebP đã nén, cần onError để hiện ô dự phòng
        <img
          src={url}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed(url)}
          className={cn('size-full object-cover', imgClassName)}
        />
      ) : (
        <div
          role="img"
          aria-label={alt}
          className={cn(
            'flex size-full items-center justify-center text-lg font-semibold tracking-wide',
            fallbackColor ? 'text-white/90' : 'text-muted-foreground'
          )}
        >
          {fallbackText ?? initials(alt)}
        </div>
      )}
    </div>
  )
}
