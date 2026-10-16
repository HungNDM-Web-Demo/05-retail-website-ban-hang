'use client'

import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Star, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAssetUrl } from '@/hooks/use-asset-url'
import { getErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import type { ColorDto } from '@/types/shop'
import { useUploadProductImage } from '../hooks/use-products'

export type FormImage = { url: string; colorId?: string; isCover: boolean }
const MAX = 8
const NONE = '__none'

/**
 * Bộ ảnh sản phẩm (FR-17, 07 §4.5): tối đa 8, tải lên JPG/PNG/WebP ≤ 2 MB, kéo thả hoặc mũi tên để đổi
 * thứ tự, chọn ảnh đại diện, gắn màu (chọn màu ở cửa hàng chuyển tới ảnh của màu, UC-02 bước 2).
 */
export function ImageManager({
  value,
  onChange,
  colors,
  readOnly,
  error,
}: {
  value: FormImage[]
  onChange: (v: FormImage[]) => void
  colors: ColorDto[]
  readOnly?: boolean
  error?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const upload = useUploadProductImage()
  const [busy, setBusy] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const withCover = (list: FormImage[]) =>
    list.length && !list.some((i) => i.isCover) ? list.map((i, idx) => ({ ...i, isCover: idx === 0 })) : list

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const room = MAX - value.length
    if (room <= 0) return toast.error('Tối đa 8 ảnh')
    const list = Array.from(files).slice(0, room)
    if (files.length > room) toast.warning(`Chỉ thêm được ${room} ảnh nữa (tối đa 8)`)
    setBusy(true)
    const added: FormImage[] = []
    for (const file of list) {
      try {
        const r = await upload.mutateAsync(file)
        added.push({ url: r.url, isCover: false })
      } catch (e) {
        toast.error(`${file.name}: ${getErrorMessage(e)}`)
      }
    }
    setBusy(false)
    onChange(withCover([...value, ...added]))
    if (input.current) input.current.value = ''
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length || from === to) return
    const next = [...value]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-5">
        {value.map((img, i) => (
          <div
            key={`${img.url}-${i}`}
            draggable={!readOnly}
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => !readOnly && e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null) move(dragIndex, i)
              setDragIndex(null)
            }}
            className={cn('bg-card space-y-1.5 rounded-lg border p-1.5', img.isCover && 'border-primary ring-primary/30 ring-2')}
          >
            <Thumb url={img.url} index={i} />
            {!readOnly && (
              <>
                <div className="flex items-center justify-between gap-1">
                  <Button type="button" size="icon-xs" variant="ghost" aria-label="Đưa ảnh sang trái" onClick={() => move(i, i - 1)} disabled={i === 0}>
                    <ChevronLeft aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant={img.isCover ? 'default' : 'ghost'}
                    onClick={() => onChange(value.map((x, idx) => ({ ...x, isCover: idx === i })))}
                    aria-pressed={img.isCover}
                  >
                    <Star aria-hidden="true" />
                    {img.isCover ? 'Đại diện' : 'Chọn'}
                  </Button>
                  <Button type="button" size="icon-xs" variant="ghost" aria-label="Đưa ảnh sang phải" onClick={() => move(i, i + 1)} disabled={i === value.length - 1}>
                    <ChevronRight aria-hidden="true" />
                  </Button>
                  <Button type="button" size="icon-xs" variant="ghost" aria-label={`Bỏ ảnh ${i + 1}`} onClick={() => onChange(withCover(value.filter((_, idx) => idx !== i)))}>
                    <X aria-hidden="true" />
                  </Button>
                </div>
                <Select
                  value={img.colorId ?? NONE}
                  onValueChange={(v) => onChange(value.map((x, idx) => (idx === i ? { ...x, colorId: v === NONE ? undefined : v } : x)))}
                >
                  <SelectTrigger className="h-8 w-full text-xs" aria-label={`Màu của ảnh ${i + 1}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Mọi màu</SelectItem>
                    {colors.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
            {readOnly && img.colorId && <p className="text-muted-foreground px-1 text-xs">{colors.find((c) => c.id === img.colorId)?.name}</p>}
          </div>
        ))}
        {!readOnly && value.length < MAX && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="text-muted-foreground hover:border-primary hover:text-primary focus-visible:ring-ring/50 flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-sm transition-colors outline-none focus-visible:ring-3"
          >
            {busy ? <Loader2 className="size-6 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-6" aria-hidden="true" />}
            {busy ? 'Đang tải…' : 'Thêm ảnh'}
            <span className="text-xs">{value.length}/8 · ≤ 2 MB</span>
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => void addFiles(e.target.files)}
      />
      {error && (
        <p role="alert" className="text-destructive text-[0.8125rem]">
          {error}
        </p>
      )}
    </div>
  )
}

function Thumb({ url, index }: { url: string; index: number }) {
  const src = useAssetUrl(url)
  return (
    <div className="bg-muted aspect-[4/5] overflow-hidden rounded-md">
      {/* eslint-disable-next-line @next/next/no-img-element -- ảnh idb:// hoặc URL BE */}
      {src && <img src={src} alt={`Ảnh ${index + 1}`} className="size-full object-cover" />}
    </div>
  )
}
