import { readJson, storageKey, writeJson } from '@/lib/storage'

/**
 * Danh tính khách theo tab (07 §4.2 bước 5, quyết định 24): `?khach=N` gán cho tab một khách riêng,
 * lưu sessionStorage `retail-website-ban-hang:shop-identity`; giỏ, mã thiết bị, danh sách đơn của tab
 * dùng khóa có hậu tố `:k{N}`. Không có tham số = khách 1 (khóa không hậu tố).
 */

const IDENTITY_KEY = storageKey('shop-identity')

/** Số khách của tab (1, 2, 3…) */
export function shopIdentity(): number {
  if (typeof window === 'undefined') return 1
  const fromUrl = Number(new URLSearchParams(window.location.search).get('khach'))
  if (Number.isInteger(fromUrl) && fromUrl >= 1 && fromUrl <= 99) {
    writeJson('session', IDENTITY_KEY, fromUrl)
    return fromUrl
  }
  const stored = readJson<number>('session', IDENTITY_KEY)
  return stored && stored >= 1 ? stored : 1
}

/** Khóa localStorage theo danh tính: khách 1 → `{prefix}:{name}`, khách N → `{prefix}:{name}:k{N}` */
export function identityKey(name: string): string {
  const n = shopIdentity()
  return n > 1 ? storageKey(`${name}:k${n}`) : storageKey(name)
}

/** Mã trình duyệt ẩn danh `X-Device-Id` (07 §4.3) */
export function deviceId(): string {
  if (typeof window === 'undefined') return ''
  const key = identityKey('device')
  const stored = readJson<string>('local', key)
  if (stored) return stored
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
  writeJson('local', key, id)
  return id
}
