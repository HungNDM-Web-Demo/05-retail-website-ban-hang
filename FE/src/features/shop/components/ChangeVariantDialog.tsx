'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { CartLine } from '@/types/shop'
import { useShopProduct } from '../hooks/use-shop'
import { cartStore } from '../lib/cart-storage'

/** Đổi màu, size của một dòng giỏ; trùng biến thể với dòng khác thì gộp (UC-03 4a) */
export function ChangeVariantDialog({ line, open, onOpenChange }: { line: CartLine; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data, isLoading } = useShopProduct(line.slug)
  const product = data?.product
  const current = product?.variants.find((v) => v.id === line.variantId)
  const [color, setColor] = useState<string | undefined>(undefined)
  const [size, setSize] = useState<string | undefined>(undefined)
  const c = color ?? current?.colorCode
  const s = size ?? current?.size
  const chosen = product?.variants.find((v) => v.colorCode === c && (product.sizes.length ? v.size === s : true))

  const save = () => {
    if (!product || !chosen || chosen.stock <= 0) return
    const colorObj = product.colors.find((x) => x.code === chosen.colorCode)
    const image = product.images.find((i) => i.colorCode === chosen.colorCode)?.url ?? product.coverUrl
    cartStore.replaceVariant(
      line.variantId,
      {
        variantId: chosen.id,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        sku: chosen.sku,
        colorName: colorObj?.name ?? '',
        ...(chosen.size ? { size: chosen.size } : {}),
        imageUrl: image,
        price: product.price,
      },
      chosen.stock
    )
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Đổi màu, size</DialogTitle>
        </DialogHeader>
        {isLoading || !product ? (
          <Skeleton className="h-32" />
        ) : (
          <div className="space-y-4">
            <p className="font-medium">{product.name}</p>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((x) => (
                <button
                  key={x.code}
                  type="button"
                  aria-pressed={x.code === c}
                  onClick={() => setColor(x.code)}
                  className={cn('flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm', x.code === c ? 'border-primary ring-2 ring-primary/30' : 'hover:bg-accent')}
                >
                  <span className="size-5 rounded-full ring-1 ring-border ring-inset" style={{ backgroundColor: x.hex }} />
                  {x.name}
                </button>
              ))}
            </div>
            {product.sizes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((sz) => {
                  const v = product.variants.find((x) => x.colorCode === c && x.size === sz)
                  const off = !v || v.stock <= 0
                  return (
                    <button
                      key={sz}
                      type="button"
                      disabled={off}
                      aria-pressed={sz === s}
                      onClick={() => setSize(sz)}
                      className={cn(
                        'h-11 min-w-12 rounded-lg border px-3 text-sm font-medium',
                        sz === s ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent',
                        off && 'cursor-not-allowed bg-muted text-muted-foreground line-through'
                      )}
                    >
                      {sz}
                    </button>
                  )
                })}
              </div>
            )}
            {chosen && chosen.stock <= 0 && <p className="text-sm text-destructive">Mẫu này đã hết hàng</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button disabled={!chosen || chosen.stock <= 0 || chosen.id === line.variantId} onClick={save}>
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
