import { storageKey } from '@/lib/storage'
import type { ShopEventMap, ShopEventName } from '@/types/shop'

/**
 * Sự kiện giữa các tab ở chế độ mock (07 §2.10): BroadcastChannel `retail-website-ban-hang:shop-events`.
 * Handler gọi `publishShopEvent` sau khi ghi mock-db. Người nghe trong cùng tab cũng nhận (vd giả lập
 * khách đặt đơn từ DemoToolbar của chính tab quản trị).
 */

export type ShopEvent = {
  [K in ShopEventName]: { name: K; payload: ShopEventMap[K]; remote: boolean }
}[ShopEventName]

const CHANNEL = storageKey('shop-events')
const listeners = new Set<(event: ShopEvent) => void>()
let channel: BroadcastChannel | null = null

function connect() {
  if (channel || typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return
  channel = new BroadcastChannel(CHANNEL)
  channel.onmessage = (e: MessageEvent<{ name: ShopEventName; payload: unknown }>) => {
    if (!e.data?.name) return
    emit({ name: e.data.name, payload: e.data.payload, remote: true } as ShopEvent)
  }
}

function emit(event: ShopEvent) {
  listeners.forEach((fn) => {
    try {
      fn(event)
    } catch (error) {
      console.error('[shop-events]', error)
    }
  })
}

export function publishShopEvent<K extends ShopEventName>(name: K, payload: ShopEventMap[K]): void {
  if (typeof window === 'undefined') return
  connect()
  try {
    channel?.postMessage({ name, payload })
  } catch {
    // bỏ qua
  }
  emit({ name, payload, remote: false } as ShopEvent)
}

export function subscribeShopEvents(fn: (event: ShopEvent) => void): () => void {
  connect()
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
