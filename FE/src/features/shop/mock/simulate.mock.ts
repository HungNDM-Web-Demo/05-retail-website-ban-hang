import { customersDb } from '@/features/sales/mock/customer.store'
import { expandedSeed, liveProducts } from '@/features/sales/mock/catalog.store'
import type { SimulateOrderResult } from '@/types/shop'
import { publicMock } from './public.mock'

/**
 * `POST /api/demo/simulate-order` ở chế độ mock (07 §2.9): một khách đặt đơn qua **đúng luồng đặt hàng
 * công khai** (`publicMock.placeOrder`). Khách mẫu ngẫu nhiên hoặc khách mới; 1–3 biến thể còn hàng
 * (bỏ hẳn sản phẩm dùng trong test AT001, QJ003, TX001, VD002 như BE, 06 §5.6); COD 70% / chuyển khoản 30%; không mã giảm giá.
 */

const TEST_PRODUCT_CODES = new Set(['AT001', 'QJ003', 'TX001', 'VD002'])
const isTestPhone = (p: string) => /^09010000(0\d|1\d|88)$/.test(p)

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Huỳnh']
const DEM = ['Thị', 'Văn', 'Minh', 'Ngọc', 'Thanh', 'Hoài', 'Gia', 'Bảo']
const TEN = ['An', 'Bình', 'Chi', 'Dung', 'Giang', 'Hà', 'Khánh', 'Linh', 'My', 'Nhi', 'Phương', 'Quỳnh', 'Tâm', 'Vy']
const STREETS = ['Lê Lợi', 'Nguyễn Huệ', 'Hai Bà Trưng', 'Trần Hưng Đạo', 'Lý Thường Kiệt', 'Pasteur', 'Điện Biên Phủ']

function newPhone(): string {
  const prefixes = ['032', '033', '035', '037', '038', '070', '077', '079', '086', '088', '090', '093', '097', '098']
  for (;;) {
    const phone = pick(prefixes) + String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0')
    if (!isTestPhone(phone) && !customersDb.find((c) => c.phone === phone)) return phone
  }
}

export async function simulateOrderMock(): Promise<SimulateOrderResult> {
  const provinces = expandedSeed().provinces
  const useExisting = Math.random() < 0.6
  const existing = useExisting ? pick(customersDb.all().filter((c) => !isTestPhone(c.phone))) : undefined
  const province = existing ? provinces.find((p) => p.code === existing.provinceCode) : pick(provinces)
  const ward = existing ? province?.wards.find((w) => w.code === existing.wardCode) : pick(province!.wards)

  const candidates = liveProducts()
    .filter((p) => !p.isHidden && !TEST_PRODUCT_CODES.has(p.code))
    .flatMap((p) => p.variants.filter((v) => v.isActive && v.stock >= 3).map((v) => ({ p, v })))
  const count = 1 + Math.floor(Math.random() * 3)
  const chosen = new Map<string, { p: (typeof candidates)[number]['p']; v: (typeof candidates)[number]['v'] }>()
  while (chosen.size < count && chosen.size < candidates.length) {
    const c = pick(candidates)
    chosen.set(c.v.id, c)
  }

  const result = await publicMock.placeOrder({
    clientRequestId: crypto.randomUUID(),
    lines: [...chosen.values()].map(({ p, v }) => ({ variantId: v.id, quantity: 1, expectedPrice: p.price })),
    shipping: {
      fullName: existing?.name ?? `${pick(HO)} ${pick(DEM)} ${pick(TEN)}`,
      phone: existing?.phone ?? newPhone(),
      provinceCode: province!.code,
      wardCode: ward?.code ?? province!.wards[0].code,
      addressLine: existing?.addressLine ?? `${10 + Math.floor(Math.random() * 400)} ${pick(STREETS)}`,
    },
    paymentMethod: Math.random() < 0.7 ? 'Cod' : 'ChuyenKhoan',
  })
  return { code: result.order.code, total: result.order.summary.total }
}
