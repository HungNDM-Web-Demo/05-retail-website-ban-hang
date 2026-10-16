'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, ShoppingBag, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { routePath } from '@/config/route-path'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CartCheckLine, CartLine } from '@/types/shop'
import { ProductImage } from '@/features/sales/components/ProductImage'
import { SalesRules } from '@/features/sales/lib/rules'
import { ChangeVariantDialog } from '../components/ChangeVariantDialog'
import { FreeShipBar } from '../components/FreeShipBar'
import { QuantityStepper } from '../components/QuantityStepper'
import { useCartCheck } from '../hooks/use-shop'
import { cartStore, useCart } from '../lib/cart-storage'

function CartRow({ line, check, notice }: { line: CartLine; check?: CartCheckLine; notice?: string }) {
  const [changing, setChanging] = useState(false)
  const blocked = check?.issue && check.issue !== 'GiaDaDoi'
  const price = check?.price ?? line.price
  const max = Math.max(1, check?.maxQuantity ?? 10)
  // Dòng hết hàng, ngừng bán: khóa ô số lượng, vẫn hiện đúng số khách đã chọn (khớp thành tiền)
  const stepperLocked = check?.issue === 'HetHang' || check?.issue === 'BienTheDaTat' || check?.issue === 'NgungKinhDoanh'
  return (
    <li className={cn('flex gap-3 py-4', blocked && 'rounded-lg bg-destructive/5 px-2 ring-1 ring-destructive/30')}>
      <Link href={routePath.productDetail(line.slug)} className="w-20 shrink-0 sm:w-24">
        <ProductImage src={line.imageUrl} alt={line.name} className="rounded-md" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <Link href={routePath.productDetail(line.slug)} className="line-clamp-2 text-sm font-medium hover:text-primary">
            {check?.productName || line.name}
          </Link>
          <button
            type="button"
            aria-label={`Xóa ${line.name} khỏi giỏ`}
            onClick={() => cartStore.remove(line.variantId)}
            className="-mt-2 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setChanging(true)}
          className="w-fit text-left text-sm text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
          aria-label="Đổi màu, size"
        >
          {line.colorName}
          {line.size ? ` / ${line.size}` : ''} · Đổi
        </button>
        {(notice || check?.issueText) && (
          <p className={cn('flex items-start gap-1 text-sm', blocked ? 'font-medium text-destructive' : 'text-warning')}>
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {blocked ? check?.issueText : (notice ?? check?.issueText)}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          <QuantityStepper
            size="sm"
            value={stepperLocked ? line.quantity : Math.min(line.quantity, max)}
            max={max}
            disabled={stepperLocked}
            onChange={(v) => cartStore.setQuantity(line.variantId, v)}
          />
          <div className="text-right">
            <p className="text-sm font-semibold tabular-nums">{formatVnd(price * line.quantity)}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{formatVnd(price)} / cái</p>
          </div>
        </div>
      </div>
      {changing && <ChangeVariantDialog line={line} open={changing} onOpenChange={setChanging} />}
    </li>
  )
}

/** Giỏ hàng (SCR-04, UC-03): kiểm lại giá, tồn khi mở (BR-04); dòng chặn đánh dấu đỏ, nút Đặt hàng khóa (TC-07) */
export function CartPage() {
  const router = useRouter()
  const cart = useCart()
  const inputs = useMemo(
    () => cart.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, price: l.price })),
    [cart.lines]
  )
  const { data: check, isLoading } = useCartCheck(inputs)
  const [notices, setNotices] = useState<Record<string, string>>({})

  // Giá đổi: giữ câu "Giá đã đổi từ … thành …" trên trang, cập nhật giá lưu trong giỏ (TC-06)
  useEffect(() => {
    if (!check) return
    const changed = check.lines.filter((l) => l.issue === 'GiaDaDoi' && l.issueText)
    if (changed.length === 0) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ghi nhận câu báo trước khi cập nhật giá
    setNotices((prev) => ({ ...prev, ...Object.fromEntries(changed.map((l) => [l.variantId, l.issueText!])) }))
    cartStore.updatePrices(changed.map((l) => ({ variantId: l.variantId, price: l.price })))
  }, [check])

  const checkOf = (variantId: string) => check?.lines.find((l) => l.variantId === variantId)
  const subtotal = check?.subtotal ?? cart.lines.reduce((s, l) => s + l.price * l.quantity, 0)
  const remaining = check?.freeShipRemaining ?? Math.max(0, SalesRules.freeShipThreshold - subtotal)
  const canCheckout = !!check?.canCheckout && cart.lines.length > 0

  if (cart.lines.length === 0)
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-muted">
          <ShoppingBag className="size-7 text-muted-foreground" />
        </span>
        <h1 className="text-xl font-bold">Giỏ hàng trống</h1>
        <p className="text-muted-foreground">Chọn vài món cotton, linen mặc mỗi ngày nhé.</p>
        <Button asChild size="lg">
          <Link href={routePath.products}>Mua sắm ngay</Link>
        </Button>
      </div>
    )

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
      <h1 className="mb-4 text-2xl font-bold">Giỏ hàng ({cart.lines.length})</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <FreeShipBar remaining={remaining} />
          <ul className="divide-y rounded-xl border bg-card px-3">
            {cart.lines.map((l) => (
              <CartRow key={l.variantId} line={l} check={checkOf(l.variantId)} notice={notices[l.variantId]} />
            ))}
          </ul>
          <Link href={routePath.products} className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">
            ← Tiếp tục mua sắm
          </Link>
        </div>
        <aside className="h-fit space-y-3 rounded-xl border bg-card p-4 lg:sticky lg:top-24">
          <h2 className="font-semibold">Tóm tắt</h2>
          <div className="flex justify-between text-sm">
            <span>Tạm tính</span>
            {isLoading ? <Skeleton className="h-5 w-24" /> : <span className="font-semibold tabular-nums">{formatVnd(subtotal)}</span>}
          </div>
          <p className="text-sm text-muted-foreground">Phí vận chuyển, mã giảm giá tính ở bước thanh toán.</p>
          {check && !check.canCheckout && (
            <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">Xóa hoặc sửa các dòng báo đỏ để đặt hàng.</p>
          )}
          <Button size="lg" className="hidden h-12 w-full lg:flex" disabled={!canCheckout} onClick={() => router.push(routePath.checkout)}>
            Đặt hàng
          </Button>
        </aside>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Tạm tính</p>
            <p className="text-lg font-bold tabular-nums">{formatVnd(subtotal)}</p>
          </div>
          <Button size="lg" className="h-12 flex-1" disabled={!canCheckout} onClick={() => router.push(routePath.checkout)}>
            Đặt hàng
          </Button>
        </div>
      </div>
      <div className="h-20 lg:hidden" aria-hidden="true" />
    </div>
  )
}
