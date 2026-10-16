import Link from 'next/link'
import { routePath } from '@/config/route-path'
import { formatVnd } from '@/lib/format'
import type { OrderLineView, PricingSummary } from '@/types/shop'
import { ProductImage } from '@/features/sales/components/ProductImage'

/** Dòng sản phẩm + tiền của một đơn (trang thành công, tra cứu) */
export function OrderLinesSummary({ lines, summary }: { lines: OrderLineView[]; summary: PricingSummary }) {
  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {lines.map((l) => (
          <li key={l.sku} className="flex gap-3">
            <div className="w-14 shrink-0">
              <ProductImage src={l.imageUrl} alt={l.productName} className="rounded-md" />
            </div>
            <div className="min-w-0 flex-1 text-sm">
              {l.slug ? (
                <Link href={routePath.productDetail(l.slug)} className="line-clamp-1 font-medium hover:text-primary">
                  {l.productName}
                </Link>
              ) : (
                <p className="line-clamp-1 font-medium">{l.productName}</p>
              )}
              <p className="text-muted-foreground">
                {l.colorName}
                {l.size ? ` / ${l.size}` : ''} · {formatVnd(l.unitPrice)} × {l.quantity}
              </p>
            </div>
            <p className="text-sm font-medium tabular-nums">{formatVnd(l.lineTotal)}</p>
          </li>
        ))}
      </ul>
      <dl className="space-y-1.5 border-t pt-3 text-sm">
        <div className="flex justify-between">
          <dt>Tạm tính</dt>
          <dd className="tabular-nums">{formatVnd(summary.subtotal)}</dd>
        </div>
        {summary.discount > 0 && (
          <div className="flex justify-between text-success">
            <dt>Giảm giá{summary.couponCode ? ` (${summary.couponCode})` : ''}</dt>
            <dd className="tabular-nums">−{formatVnd(summary.discount)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt>Phí vận chuyển{summary.shippingDiscount > 0 && summary.couponCode ? ` (${summary.couponCode})` : ''}</dt>
          <dd className="tabular-nums">{formatVnd(summary.shippingFee)}</dd>
        </div>
        <div className="flex justify-between border-t pt-2 text-base font-bold">
          <dt>Tổng thanh toán</dt>
          <dd className="text-primary tabular-nums">{formatVnd(summary.total)}</dd>
        </div>
      </dl>
    </div>
  )
}
