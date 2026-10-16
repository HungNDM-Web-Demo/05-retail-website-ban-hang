'use client'

import { ImageOff } from 'lucide-react'
import { useAssetUrl } from '@/hooks/use-asset-url'
import { cn } from '@/lib/utils'

/** Ảnh nhỏ tỉ lệ 4:5 cho bảng quản trị; không có ảnh thì ô nền nhạt có biểu tượng */
export function ProductThumb({ url, alt, className }: { url?: string | null; alt: string; className?: string }) {
  const src = useAssetUrl(url)
  return (
    <span className={cn('bg-muted flex aspect-[4/5] w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border', className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- ảnh có thể là idb:// (mock) hoặc URL BE
        <img src={src} alt={alt} loading="lazy" className="size-full object-cover" />
      ) : (
        <ImageOff className="text-muted-foreground size-4" aria-hidden="true" />
      )}
    </span>
  )
}
