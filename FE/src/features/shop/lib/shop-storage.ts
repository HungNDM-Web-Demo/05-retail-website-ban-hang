import { readJson, storageKey, writeJson } from '@/lib/storage'
import type { PaymentMethod, PlaceOrderResult, ShippingAddressInput } from '@/types/shop'
import { identityKey } from './shop-identity'

/**
 * Lưu tạm của cửa hàng trên trình duyệt (07 §4.2 bước 4, §4.3): thông tin giao hàng nhớ lần sau,
 * đơn đã đặt (tự điền số điện thoại ở tra cứu), kết quả đặt hàng cho trang thành công.
 */

type SavedShipping = ShippingAddressInput & { paymentMethod?: PaymentMethod }
type MyOrder = { code: string; phone: string; at: string }

export const shopStorage = {
  shipping: (): Partial<SavedShipping> | null => readJson<SavedShipping>('local', identityKey('shipping')),
  saveShipping: (value: SavedShipping) => writeJson('local', identityKey('shipping'), value),

  myOrders: (): MyOrder[] => readJson<MyOrder[]>('local', identityKey('my-orders')) ?? [],
  addMyOrder(code: string, phone: string) {
    const list = this.myOrders().filter((o) => o.code !== code)
    list.unshift({ code, phone, at: new Date().toISOString() })
    writeJson('local', identityKey('my-orders'), list.slice(0, 10))
  },
  phoneForOrder(code: string): string | undefined {
    const up = code.trim().toUpperCase()
    return this.myOrders().find((o) => o.code === up)?.phone
  },

  lastOrder: (): PlaceOrderResult | null => readJson<PlaceOrderResult>('session', storageKey('last-order')),
  saveLastOrder: (value: PlaceOrderResult) => writeJson('session', storageKey('last-order'), value),
}
