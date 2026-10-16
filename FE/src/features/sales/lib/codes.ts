import { carrierPrefixes } from '@/config/shop-labels'
import type { Carrier } from '@/types/shop'
import { SalesRules } from './rules'
import { vnYyMMdd } from './vn-time'

/**
 * Mã đơn, mã vận đơn, khối lượng gợi ý (BR-10, BR-17, 07 §3.9). BE `SalesCodes.cs` cùng quy tắc.
 */

/** `DH` + yyMMdd (ngày đặt giờ Việt Nam) + 4 số = số lớn nhất đã có trong ngày + 1 */
export function nextOrderCode(orders: { code: string }[], now: number | string): string {
  const prefix = `DH${vnYyMMdd(now)}`
  let max = 0
  for (const o of orders) {
    if (!o.code.startsWith(prefix)) continue
    const n = Number(o.code.slice(prefix.length))
    if (Number.isFinite(n) && n > max) max = n
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`
}

/** Tiền tố đơn vị + yyMMdd (ngày bàn giao) + 4 số thứ tự trong ngày của đơn vị đó, vd `GHTK2610150003` */
export function nextTrackingCode(
  orders: { shipment?: { trackingCode: string } | null }[],
  carrier: Carrier,
  now: number | string
): string {
  const prefix = `${carrierPrefixes[carrier]}${vnYyMMdd(now)}`
  let max = 0
  for (const o of orders) {
    const code = o.shipment?.trackingCode
    if (!code || !code.startsWith(prefix)) continue
    const n = Number(code.slice(prefix.length))
    if (Number.isFinite(n) && n > max) max = n
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`
}

/** Khối lượng gợi ý (UC-10 bước 2): 300 g × tổng số lượng + 100 g, làm tròn tới 50 g, trong 50–30.000 */
export function suggestWeight(lines: { quantity: number }[]): number {
  const qty = lines.reduce((s, l) => s + l.quantity, 0)
  const raw = SalesRules.weightPerItemGrams * qty + SalesRules.weightPackageGrams
  const rounded = Math.round(raw / 50) * 50
  return Math.min(SalesRules.maxWeightGrams, Math.max(SalesRules.minWeightGrams, rounded))
}

/** Đơn vị vận chuyển theo tiền tố trong seed ("GHTK" → "Ghtk") */
export function carrierFromPrefix(prefix: string): Carrier {
  const found = (Object.entries(carrierPrefixes) as [Carrier, string][]).find(([, p]) => p === prefix)
  if (!found) throw new Error(`Đơn vị vận chuyển không hợp lệ: ${prefix}`)
  return found[0]
}
