import { useSyncExternalStore } from 'react'
import { readJson, removeKey, writeJson } from '@/lib/storage'
import type { CartLine, CartStorage } from '@/types/shop'
import { SalesRules } from '@/features/sales/lib/rules'
import { identityKey } from './shop-identity'

/**
 * Giỏ hàng trên trình duyệt (BR-03, BR-04, 07 §4.3): localStorage `retail-website-ban-hang:cart`
 * (hậu tố `:k{N}` theo danh tính tab), bỏ khi `updatedAt` quá 30 ngày; cùng biến thể cộng dồn tới 10;
 * tối đa 20 dòng.
 */

const EMPTY: CartStorage = { updatedAt: '', lines: [] }
const EVENT = 'shop-cart-changed'

let cached: { key: string; raw: string | null; value: CartStorage } | null = null

function read(): CartStorage {
  if (typeof window === 'undefined') return EMPTY
  const key = identityKey('cart')
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(key)
  } catch {
    raw = null
  }
  if (cached && cached.key === key && cached.raw === raw) return cached.value
  let value = raw ? (readJson<CartStorage>('local', key) ?? EMPTY) : EMPTY
  if (value.updatedAt && Date.now() - new Date(value.updatedAt).getTime() > SalesRules.cartKeepDays * 86_400_000) {
    removeKey('local', key)
    value = EMPTY
  }
  cached = { key, raw, value }
  return value
}

function write(lines: CartLine[]) {
  const key = identityKey('cart')
  if (lines.length === 0) removeKey('local', key)
  else writeJson('local', key, { updatedAt: new Date().toISOString(), lines } satisfies CartStorage)
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(fn: () => void) {
  window.addEventListener(EVENT, fn)
  window.addEventListener('storage', fn)
  return () => {
    window.removeEventListener(EVENT, fn)
    window.removeEventListener('storage', fn)
  }
}

/** Giỏ hiện tại (tự cập nhật khi tab này hoặc tab khác cùng danh tính đổi giỏ) */
export function useCart(): CartStorage {
  return useSyncExternalStore(subscribe, read, () => EMPTY)
}

export type AddResult = { ok: true; quantity: number } | { ok: false; message: string }

export const cartStore = {
  get: read,
  /** Thêm biến thể: cộng dồn tới min(10, tồn); quá 20 dòng báo lỗi (UC-03 E3) */
  add(line: Omit<CartLine, 'addedAt'>, stock: number): AddResult {
    const lines = [...read().lines]
    const index = lines.findIndex((l) => l.variantId === line.variantId)
    const max = Math.min(SalesRules.maxQuantityPerLine, stock)
    if (index >= 0) {
      const quantity = Math.min(max, lines[index].quantity + line.quantity)
      lines[index] = { ...lines[index], ...line, quantity }
      write(lines)
      return { ok: true, quantity }
    }
    if (lines.length >= SalesRules.maxCartLines) return { ok: false, message: 'Giỏ hàng tối đa 20 sản phẩm' }
    const quantity = Math.min(max, line.quantity)
    lines.push({ ...line, quantity, addedAt: new Date().toISOString() })
    write(lines)
    return { ok: true, quantity }
  },
  setQuantity(variantId: string, quantity: number) {
    write(read().lines.map((l) => (l.variantId === variantId ? { ...l, quantity } : l)))
  },
  remove(variantId: string) {
    write(read().lines.filter((l) => l.variantId !== variantId))
  },
  /** Đổi biến thể của một dòng; trùng biến thể với dòng khác thì gộp (UC-03 4a) */
  replaceVariant(oldVariantId: string, next: Omit<CartLine, 'addedAt' | 'quantity'>, stock: number) {
    const lines = read().lines
    const current = lines.find((l) => l.variantId === oldVariantId)
    if (!current) return
    const other = lines.find((l) => l.variantId === next.variantId && l.variantId !== oldVariantId)
    const max = Math.min(SalesRules.maxQuantityPerLine, stock)
    if (other) {
      write(
        lines
          .filter((l) => l.variantId !== oldVariantId)
          .map((l) => (l.variantId === next.variantId ? { ...l, quantity: Math.min(max, l.quantity + current.quantity) } : l))
      )
      return
    }
    write(
      lines.map((l) =>
        l.variantId === oldVariantId ? { ...current, ...next, quantity: Math.min(Math.max(1, max), current.quantity) } : l
      )
    )
  },
  /** Cập nhật giá đã lưu theo giá hiện tại (dòng GiaDaDoi, TC-06) */
  updatePrices(prices: { variantId: string; price: number }[]) {
    const map = new Map(prices.map((p) => [p.variantId, p.price]))
    const lines = read().lines
    if (!lines.some((l) => map.has(l.variantId) && map.get(l.variantId) !== l.price)) return
    write(lines.map((l) => (map.has(l.variantId) ? { ...l, price: map.get(l.variantId)! } : l)))
  },
  clear() {
    write([])
  },
}
