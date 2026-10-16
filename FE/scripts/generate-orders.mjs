// Sinh khách hàng (customers) và đơn hàng 90 ngày (orders) cho src/mock/seed/demo-data.json.
// Xác định: bộ sinh số ngẫu nhiên có hạt giống cố định, chạy lại ra đúng file cũ.
// Giữ nguyên phần viết tay (colors, sizeCharts, categories, products, coupons, banners, provinces,
// stockAdjustments), chỉ ghi đè customers và orders.
// Khóa gọn của đơn, cách suy ra trường: docs/06-THIET-KE-CSDL.md §5. Tiền không ghi vào file: seeder và
// FE mock tính lại theo docs/07-DANH-SACH-API.md §3; script tính cùng công thức để kiểm ràng buộc và in số đối chiếu.
// Chạy: pnpm seed:orders  (hoặc node scripts/generate-orders.mjs)
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const file = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'mock',
  'seed',
  'demo-data.json'
)
const data = JSON.parse(readFileSync(file, 'utf8'))

// ---------- Ngẫu nhiên xác định ----------
function mulberry32(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20261015)
const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1))
const chance = (p) => rand() < p
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
function weighted(entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let r = rand() * total
  for (const [value, w] of entries) {
    r -= w
    if (r < 0) return value
  }
  return entries[entries.length - 1][0]
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
const hhmm = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
const vnd = (n) => n.toLocaleString('vi-VN') + ' ₫'
const fail = (msg) => {
  console.error('LỖI: ' + msg)
  process.exit(1)
}

// ---------- Quy tắc (docs/07 §3, SalesRules) ----------
const FREE_SHIP_THRESHOLD = 499000
const FEE_HCM = 20000
const FEE_OTHER = 35000
const PAYMENT_HOURS = 24
const TEST_PHONES = new Set([
  ...Array.from({ length: 19 }, (_, i) => `09010000${String(i + 1).padStart(2, '0')}`),
  '0901000088',
])
const HOA_PHONE = '0987654321'
const TEST_SKUS = new Set(['AT001-TR-M', 'AT001-DE-L', 'AT001-BE-XL', 'QJ003-XN-28', 'TX001-KE'])

// ---------- Danh mục ----------
const provinceByCode = new Map(data.provinces.map((p) => [p.code, p]))
const couponByCode = new Map(data.coupons.map((c) => [c.code, c]))
const skuInfo = new Map()
for (const p of data.products) {
  for (const key of Object.keys(p.stock)) {
    const [color, size] = key.split('-')
    skuInfo.set(`${p.code}-${key}`, {
      product: p,
      color,
      size: size ?? null,
      active: !(p.off ?? []).includes(key),
    })
  }
}
const relDay = (s) => {
  const m = /^dayOffset:(-?\d+)@(\d\d):(\d\d)$/.exec(s)
  if (!m) fail('ngày tương đối sai ' + s)
  return Number(m[1]) * 1440 + Number(m[2]) * 60 + Number(m[3])
}

/** Tạm tính, giảm giá, phí vận chuyển, tổng (BR-05, BR-06, BR-08) — giống features/sales/lib/pricing.ts */
function price(lines, provinceCode, couponCode) {
  const subtotal = lines.reduce((s, [sku, q]) => s + skuInfo.get(sku).product.price * q, 0)
  const fee = provinceByCode.get(provinceCode).zone === 'TpHcm' ? FEE_HCM : FEE_OTHER
  let discount = 0
  let shippingDiscount = 0
  if (couponCode) {
    const c = couponByCode.get(couponCode)
    const eligible = lines
      .filter(([sku]) => !c.scope || skuInfo.get(sku).product.category === c.scope)
      .reduce((s, [sku, q]) => s + skuInfo.get(sku).product.price * q, 0)
    if (c.type === 'PhanTram')
      discount = Math.min(Math.floor((eligible * c.value) / 100 / 1000) * 1000, c.maxDiscount)
    else if (c.type === 'SoTien') discount = Math.min(c.value, eligible)
    discount = Math.min(discount, subtotal)
  }
  const after = subtotal - discount
  let shippingFee = after >= FREE_SHIP_THRESHOLD ? 0 : fee
  if (couponCode && couponByCode.get(couponCode).type === 'MienPhiVanChuyen') {
    shippingDiscount = shippingFee
    shippingFee = 0
  }
  return { subtotal, discount, shippingFee, shippingDiscount, total: after + shippingFee }
}

/** Mã có dùng được cho đơn lúc placed (phút so với 00:00 hôm nay) không (BR-09, không xét lượt) */
function couponUsable(c, lines, placed, provinceCode) {
  if (placed < relDay(c.start) || placed > relDay(c.end)) return false
  const eligible = lines
    .filter(([sku]) => !c.scope || skuInfo.get(sku).product.category === c.scope)
    .reduce((s, [sku, q]) => s + skuInfo.get(sku).product.price * q, 0)
  if (eligible === 0 || eligible < c.minOrder) return false
  if (c.type === 'MienPhiVanChuyen') {
    const p = price(lines, provinceCode, null)
    if (p.shippingFee === 0) return false // đơn đã được miễn phí vận chuyển
  }
  return true
}

// ---------- Khách hàng ----------
const HO = [
  ['Nguyễn', 30],
  ['Trần', 14],
  ['Lê', 10],
  ['Phạm', 8],
  ['Hoàng', 5],
  ['Huỳnh', 5],
  ['Phan', 4],
  ['Vũ', 4],
  ['Võ', 5],
  ['Đặng', 3],
  ['Bùi', 3],
  ['Đỗ', 3],
  ['Hồ', 2],
  ['Ngô', 2],
  ['Dương', 2],
  ['Lý', 1],
  ['Trương', 2],
  ['Đinh', 1],
  ['Mai', 1],
  ['Tạ', 1],
]
const DEM_NU = [
  'Thị',
  'Ngọc',
  'Thu',
  'Thanh',
  'Minh',
  'Phương',
  'Hoài',
  'Mỹ',
  'Bảo',
  'Khánh',
  'Diệu',
  'Hồng',
  'Kim',
  'Thùy',
  'Quỳnh',
]
const TEN_NU = [
  'Anh',
  'Trang',
  'Linh',
  'Ngân',
  'Hương',
  'Lan',
  'Mai',
  'Hà',
  'Vy',
  'Thảo',
  'Trâm',
  'Nhi',
  'Uyên',
  'Yến',
  'Hạnh',
  'Phương',
  'Quyên',
  'Tâm',
  'Châu',
  'Giang',
  'My',
  'Ngọc',
  'Dung',
  'Loan',
  'Tiên',
  'Hiền',
  'Nhung',
  'Thư',
  'Duyên',
  'Oanh',
]
const DEM_NAM = [
  'Văn',
  'Minh',
  'Đức',
  'Quốc',
  'Hoàng',
  'Thanh',
  'Gia',
  'Hữu',
  'Công',
  'Tuấn',
  'Anh',
  'Trọng',
  'Bảo',
  'Nhật',
]
const TEN_NAM = [
  'Huy',
  'Nam',
  'Long',
  'Khoa',
  'Phúc',
  'Tú',
  'Dũng',
  'Hiếu',
  'Tâm',
  'Quân',
  'Thắng',
  'Đạt',
  'Khang',
  'Bình',
  'Sơn',
  'Toàn',
  'Vinh',
  'Hải',
  'Trung',
  'Lộc',
]
const STREETS = {
  79: [
    'Nguyễn Trãi',
    'Lê Văn Sỹ',
    'Phan Xích Long',
    'Cách Mạng Tháng Tám',
    'Nguyễn Thị Minh Khai',
    'Võ Văn Tần',
    'Hoàng Văn Thụ',
    'Điện Biên Phủ',
    'Nguyễn Đình Chiểu',
    'Lê Quang Định',
    'Phan Văn Trị',
    'Quang Trung',
    'Lũy Bán Bích',
    'Kha Vạn Cân',
    'Huỳnh Tấn Phát',
  ],
  '01': [
    'Trần Duy Hưng',
    'Xuân Thủy',
    'Kim Mã',
    'Láng Hạ',
    'Tây Sơn',
    'Bạch Mai',
    'Nguyễn Trãi',
    'Hoàng Quốc Việt',
    'Lạc Long Quân',
    'Giải Phóng',
    'Minh Khai',
    'Nguyễn Văn Cừ',
  ],
  48: [
    'Nguyễn Văn Linh',
    'Lê Duẩn',
    'Hùng Vương',
    'Ngô Quyền',
    'Tôn Đức Thắng',
    'Núi Thành',
    'Hoàng Diệu',
  ],
  _: [
    'Lê Lợi',
    'Trần Hưng Đạo',
    'Nguyễn Huệ',
    'Hai Bà Trưng',
    'Lý Thường Kiệt',
    'Quang Trung',
    'Nguyễn Trãi',
    'Phan Chu Trinh',
    'Hùng Vương',
    'Lê Duẩn',
    'Trần Phú',
    'Nguyễn Văn Cừ',
  ],
}
const PROVINCE_WEIGHTS = [
  ['79', 34],
  ['01', 20],
  ['48', 6],
  ['75', 5],
  ['92', 4],
  ['31', 4],
  ['24', 3],
  ['56', 3],
  ['68', 3],
  ['46', 2],
  ['22', 2],
  ['80', 2],
  ['86', 2],
  ['91', 2],
  ['37', 2],
  ['38', 2],
  ['40', 2],
  ['33', 1],
  ['19', 1],
  ['25', 1],
  ['52', 1],
  ['66', 1],
  ['82', 1],
  ['96', 1],
  ['44', 1],
  ['42', 1],
  ['51', 1],
  ['15', 1],
  ['08', 1],
  ['20', 1],
]
const PREFIXES = [
  '032',
  '033',
  '034',
  '035',
  '036',
  '037',
  '038',
  '039',
  '056',
  '058',
  '070',
  '076',
  '077',
  '078',
  '079',
  '081',
  '082',
  '083',
  '084',
  '085',
  '086',
  '088',
  '089',
  '090',
  '091',
  '093',
  '094',
  '096',
  '097',
  '098',
]
const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

const usedPhones = new Set([HOA_PHONE])
const usedNames = new Set(['Lê Thị Hoa', 'Nguyễn Minh Anh'])
function newPhone() {
  for (;;) {
    const p = pick(PREFIXES) + String(randInt(0, 9999999)).padStart(7, '0')
    if (
      !/^0(3|5|7|8|9)\d{8}$/.test(p) ||
      usedPhones.has(p) ||
      TEST_PHONES.has(p) ||
      p.startsWith('0901000')
    )
      continue
    usedPhones.add(p)
    return p
  }
}
function newName(female) {
  for (;;) {
    const n = `${weighted(HO)} ${female ? pick(DEM_NU) : pick(DEM_NAM)} ${female ? pick(TEN_NU) : pick(TEN_NAM)}`
    if (usedNames.has(n)) continue
    usedNames.add(n)
    return n
  }
}
function newAddress(province) {
  const streets = STREETS[province] ?? STREETS._
  const street = pick(streets)
  if (province === '79' && chance(0.3)) return `${randInt(5, 90)}/${randInt(2, 40)} ${street}`
  if (province === '01' && chance(0.35))
    return `Số ${randInt(3, 60)} ngõ ${randInt(12, 280)} ${street}`
  return `${randInt(1, 450)} ${street}`
}

const customers = []
function makeCustomer(target) {
  const female = chance(0.78)
  const name = newName(female)
  const province = weighted(PROVINCE_WEIGHTS)
  const ward = pick(provinceByCode.get(province).wards)[0]
  const c = { phone: newPhone(), name, province, ward, address: newAddress(province) }
  if (chance(0.3))
    c.email = `${slug(name.split(' ').slice(-2).join(''))}${randInt(80, 99)}@example.com`
  c._target = target
  customers.push(c)
  return c
}
for (let i = 0; i < 12; i++) makeCustomer(randInt(9, 15))
for (let i = 0; i < 50; i++) makeCustomer(randInt(4, 7))
for (let i = 0; i < 100; i++) makeCustomer(randInt(2, 3))
for (let i = 0; i < 137; i++) makeCustomer(1)
const hoa = {
  phone: HOA_PHONE,
  name: 'Lê Thị Hoa',
  province: '75',
  ward: '75-02',
  address: '27 Phạm Văn Thuận',
  note: 'Đã có 2 đơn hoàn hàng, gọi xác nhận kỹ trước khi gửi',
  _target: 0,
}
customers.push(hoa)
const ghiChuKhach = [
  'Khách quen, thích form rộng, thường mặc size L',
  'Hay đổi size, tư vấn kỹ trước khi xác nhận',
  'Chỉ nhận hàng giờ hành chính',
  'Mua làm quà tặng, gói kỹ giúp khách',
]
customers
  .filter((c) => c._target >= 9)
  .slice(0, 4)
  .forEach((c, i) => (c.note = ghiChuKhach[i]))
const customerByPhone = new Map(customers.map((c) => [c.phone, c]))

// ---------- Thời điểm đặt (phút so với 00:00 hôm nay, giờ Việt Nam) ----------
const pool = shuffle(customers.flatMap((c) => Array(c._target).fill(c)))
const TODAY_COUNT = 22
const histCount = pool.length - TODAY_COUNT
// Đơn mỗi ngày: tăng dần từ ~7 tới ~11, dao động ngẫu nhiên; tổng đúng histCount
const dayW = Array.from({ length: 89 }, (_, i) => (0.75 + (i / 88) * 0.45) * (0.8 + rand() * 0.4))
const wSum = dayW.reduce((s, w) => s + w, 0)
const perDay = dayW.map((w) => Math.floor((w / wSum) * histCount))
for (let i = 0; perDay.reduce((s, n) => s + n, 0) < histCount; i = (i + 7) % 89)
  perDay[88 - (i % 89)]++
const HOUR_W = [
  [0, 1],
  [1, 0.4],
  [6, 0.4],
  [7, 1.5],
  [8, 2.5],
  [9, 3],
  [10, 3.5],
  [11, 4],
  [12, 5],
  [13, 4],
  [14, 3],
  [15, 3],
  [16, 3],
  [17, 3.5],
  [18, 4],
  [19, 7],
  [20, 14],
  [21, 16],
  [22, 9],
  [23, 3],
]
const slots = []
perDay.forEach((n, i) => {
  const d = i - 89 // -89 … -1
  for (let k = 0; k < n; k++) slots.push({ d, tod: weighted(HOUR_W) * 60 + randInt(0, 59) })
})
slots.sort((a, b) => a.d - b.d || a.tod - b.tod)

// ---------- Chọn hàng ----------
const PRODUCT_W = new Map(
  data.products.map((p) => [p.code, p.featured ? 6 : p.listPrice ? 3.5 : 2])
)
PRODUCT_W.set('AT001', 10)
PRODUCT_W.set('VD002', 6)
PRODUCT_W.set('PK004', 0.6)
const SIZE_W = {
  S: 2,
  M: 4,
  L: 3.5,
  XL: 1.5,
  26: 1.5,
  27: 2.5,
  28: 3.5,
  29: 3,
  30: 2.5,
  31: 1.5,
  32: 1,
}
function pickLines(placed, exclude = new Set()) {
  const day = Math.floor(placed / 1440)
  const products = data.products.filter((p) => -p.createdDaysAgo <= day && !(p.hidden && day > -20))
  const nLines = weighted([
    [1, 55],
    [2, 30],
    [3, 12],
    [4, 3],
  ])
  const lines = []
  let guard = 0
  while (lines.length < nLines && guard++ < 50) {
    const p = weighted(products.map((x) => [x, PRODUCT_W.get(x.code)]))
    const color = weighted(p.colors.map((c, i) => [c, i === 0 ? 2 : 1]))
    const size = p.sizes.length ? weighted(p.sizes.map((s) => [s, SIZE_W[s]])) : null
    const sku = size ? `${p.code}-${color}-${size}` : `${p.code}-${color}`
    const info = skuInfo.get(sku)
    if (!info.active || exclude.has(sku) || lines.some(([s]) => s === sku)) continue
    lines.push([
      sku,
      weighted([
        [1, 86],
        [2, 12],
        [3, 2],
      ]),
    ])
  }
  return lines
}

// ---------- Mô phỏng vòng đời ----------
const STAFF_DAY = 'nhanvien'
const STAFF_NIGHT = 'nhanvien2'
const staffAt = (t) => {
  const tod = ((t % 1440) + 1440) % 1440
  if (chance(0.06)) return 'quanly'
  return tod >= 17 * 60 ? STAFF_NIGHT : STAFF_DAY
}
/** Thời điểm làm việc gần nhất ≥ t (8:00–21:30), cộng thêm độ trễ */
function workTime(t, delayMin, delayMax) {
  let x = t + randInt(delayMin, delayMax)
  const tod = ((x % 1440) + 1440) % 1440
  const dayStart = x - tod
  if (tod < 8 * 60) x = dayStart + 8 * 60 + randInt(0, 90)
  else if (tod > 21 * 60 + 30) x = dayStart + 1440 + 8 * 60 + randInt(0, 90)
  return x
}
const atHour = (t, fromH, toH, plusDays) => {
  const dayStart = Math.floor(t / 1440) * 1440 + plusDays * 1440
  return dayStart + fromH * 60 + randInt(0, (toH - fromH) * 60)
}
const CARRIERS_HCM = [
  ['GHN', 40],
  ['GHTK', 35],
  ['JT', 15],
  ['VTP', 10],
]
const CARRIERS_OTHER = [
  ['GHTK', 35],
  ['VTP', 25],
  ['GHN', 25],
  ['JT', 15],
]
const NOTES_KHACH = [
  'Giao giờ hành chính giúp em',
  'Gọi trước khi giao',
  'Cho em xem hàng trước khi nhận',
  'Giao sau 17h',
  'Gói quà giúp em nhé',
  'Để hàng ở bảo vệ tòa nhà nếu em không nghe máy',
]
const NOTES_NOI_BO = [
  'Gọi lần 1 không nghe máy, gọi lại sau',
  'Khách xác nhận lại địa chỉ qua điện thoại',
  'Khách hẹn giao sau 17h',
  'Khách hỏi thêm bảng size, đã tư vấn',
  'Đóng gói kỹ, khách mua làm quà',
]

/**
 * Sinh sự kiện cho đơn đặt lúc `placed` (phút so với 00:00 hôm nay). Sự kiện rơi vào hôm nay được bỏ,
 * trừ một lần giao xong/giao thất bại đổi sang giờ tương đối "n-N" (đã giao hôm nay, 06 §5.3).
 * Trả về { ev, final, paid, cancelledAfterPaid }.
 */
let todayDeliveries = 0
function simulate(o, placed, province) {
  const ev = []
  const hcm = provinceByCode.get(province).zone === 'TpHcm'
  const cutoff = -1 // mọi sự kiện của đơn ngày trước phải trước 00:00 hôm nay
  let t = placed
  const push = (e, at) => {
    ev.push([e[0], at - placed, ...e.slice(1)])
    t = at
  }
  const tryToday = (kind, at, rest) => {
    // Sự kiện cuối rơi vào hôm nay: đổi sang "n-N" nếu sự kiện trước đủ sớm
    if (at <= cutoff) return push([kind, ...rest], at) || true
    if (todayDeliveries < 12 && t < -330 && (kind === 'dv' || kind === 'fl')) {
      todayDeliveries++
      ev.push([kind, `n-${randInt(30, 300)}`, ...rest])
      return 'today'
    }
    return false
  }
  if (chance(0.05)) push(['nt', staffAt(placed), pick(NOTES_NOI_BO)], workTime(placed, 3, 40))

  // 1. Xác nhận / thanh toán / hủy trước xác nhận
  if (o.pm === 'B') {
    const r = rand()
    if (r < 0.07) {
      // Không chuyển tiền: hệ thống tự hủy sau 24 giờ (BR-11)
      const at = placed + PAYMENT_HOURS * 60
      if (at > cutoff) return null
      push(['cx', 'S', 'QuaHanThanhToan'], at)
      return { ev, final: 'DaHuy' }
    }
    if (r < 0.1) {
      const at = t + randInt(15, 240)
      if (at > cutoff) return null
      push(['cx', 'K', pick(['KhachDoiY', 'DatTrung'])], at)
      return { ev, final: 'DaHuy' }
    }
    const at = workTime(t, 8, 150)
    if (at > cutoff) return null
    push(['pd', staffAt(at), `FT${String(randInt(1e10, 9.99e10)).slice(0, 11)}`], at)
  } else {
    const r = rand()
    if (r < 0.025) {
      const at = t + randInt(10, 180)
      if (at > cutoff) return null
      push(['cx', 'K', pick(['KhachDoiY', 'KhachDoiY', 'DatTrung'])], at)
      return { ev, final: 'DaHuy' }
    }
    const at = workTime(t, 5, 120)
    if (r < 0.065) {
      if (at > cutoff) return null
      const reason = weighted([
        ['KhachDoiY', 35],
        ['KhongLienLacDuoc', 40],
        ['DatTrung', 12],
        ['HetHang', 6],
        ['Khac', 7],
      ])
      push(
        [
          'cx',
          staffAt(at),
          reason,
          ...(reason === 'Khac' ? ['Khách muốn đổi sang mẫu khác, sẽ đặt lại sau'] : []),
        ],
        at
      )
      return { ev, final: 'DaHuy' }
    }
    if (at > cutoff) return { ev, final: 'ChoXacNhan' }
    push(['cf', staffAt(at)], at)
  }
  // 2. Bàn giao vận chuyển: chiều cùng ngày nếu xác nhận trước 11h, không thì chiều hôm sau
  const tod = ((t % 1440) + 1440) % 1440
  const shipAt = atHour(t, 14, 17, tod < 11 * 60 ? 0 : 1)
  if (shipAt > cutoff) return { ev, final: 'DaXacNhan' }
  if (o.pm === 'B' && chance(0.012)) {
    // Đã nhận tiền nhưng hết hàng: hủy, cần hoàn tiền rồi quản lý hoàn
    const at = workTime(t, 30, 300)
    if (at > cutoff) return { ev, final: 'DaXacNhan' }
    push(['cx', staffAt(at), 'HetHang'], at)
    const rf = atHour(at, 9, 16, 1)
    if (rf <= cutoff) push(['rf', 'quanly', `FT${String(randInt(1e10, 9.99e10)).slice(0, 11)}`], rf)
    return { ev, final: 'DaHuy' }
  }
  const carrier = weighted(hcm ? CARRIERS_HCM : CARRIERS_OTHER)
  const items = o.it.reduce((s, [, q]) => s + q, 0)
  push(['sh', STAFF_DAY, carrier, Math.round((items * 300 + 100) / 50) * 50], shipAt)
  // 3. Kết quả giao
  const returnP = hcm ? 0.06 : 0.11
  const resultAt = atHour(t, 9, 18, hcm ? randInt(1, 2) : randInt(2, 5))
  // Giao chậm (BR-18): vài đơn tỉnh xa chưa có kết quả
  if (!hcm && placed < -6 * 1440 && placed > -9 * 1440 && chance(0.15))
    return { ev, final: 'DangGiao' }
  if (chance(returnP)) {
    const reason = weighted([
      ['KhachKhongNgheMay', 40],
      ['KhachTuChoiNhan', 35],
      ['SaiDiaChi', 15],
      ['Khac', 10],
    ])
    const rest = [
      STAFF_DAY,
      reason,
      ...(reason === 'Khac' ? ['Shipper báo khách hẹn lại nhiều lần'] : []),
    ]
    const ok = tryToday('fl', resultAt, rest)
    if (!ok) return { ev, final: 'DangGiao' }
    if (ok === 'today') return { ev, final: 'DangHoan' }
    const back = atHour(resultAt, 9, 16, randInt(3, 6))
    if (back > cutoff) return { ev, final: 'DangHoan' }
    push(['rt', STAFF_DAY], back)
    return { ev, final: 'DaHoan' }
  }
  const ok = tryToday('dv', resultAt, [staffAt(resultAt)])
  if (!ok) return { ev, final: 'DangGiao' }
  return { ev, final: 'DaGiao' }
}

// ---------- Sinh đơn ----------
const orders = []
const usage = [] // { phone, code, placed, cancelledAt }
function couponFor(o, placed, cust) {
  if (!chance(0.2)) return null
  const options = data.coupons.filter((c) => {
    if (!couponUsable(c, o.it, placed, cust.province)) return false
    const used = usage.filter(
      (u) => u.code === c.code && (u.cancelledAt == null || u.cancelledAt > placed)
    )
    if (c.totalLimit != null && used.length >= c.totalLimit) return false
    return used.filter((u) => u.phone === cust.phone).length < (c.perCustomer ?? 1)
  })
  return options.length ? pick(options).code : null
}
function addOrder(o, placed, cust, sim) {
  const order = {
    ...(o.d != null ? { d: o.d, t: o.t } : { t: o.t }),
    c: cust.phone,
    pm: o.pm,
    it: o.it,
  }
  if (o.cp) order.cp = o.cp
  if (o.n) order.n = o.n
  if (sim.ev.length) order.ev = sim.ev
  orders.push(order)
  const cx = sim.ev.find((e) => e[0] === 'cx')
  if (o.cp)
    usage.push({ phone: cust.phone, code: o.cp, placed, cancelledAt: cx ? placed + cx[1] : null })
  order._placed = placed
  order._final = sim.final
  return order
}

// Lịch sử 89 ngày
const pendingByPhone = new Map()
for (const [i, slot] of slots.entries()) {
  const cust = pool[i]
  const placed = slot.d * 1440 + slot.tod
  const o = { d: slot.d, t: hhmm(slot.tod), pm: chance(0.3) ? 'B' : 'C', it: pickLines(placed) }
  if (chance(0.08)) o.n = pick(NOTES_KHACH)
  let sim = simulate(o, placed, cust.province)
  if (!sim) {
    // Chuyển khoản chưa xử lý xong trước 00:00: coi như đã nhận tiền trong tối (chỉ đơn hôm nay được Chờ thanh toán)
    o.pm = 'C'
    sim = { ev: [], final: 'ChoXacNhan' }
  }
  if (sim.final === 'ChoXacNhan' && pendingByPhone.has(cust.phone)) {
    // Khách đã có đơn chờ khác: nhân viên ca tối xác nhận luôn để không sinh cặp Trùng SĐT ngoài dự kiến
    const last = sim.ev.length ? sim.ev[sim.ev.length - 1][1] : 0
    const off = Math.max(last + 1, Math.min(-placed - 2, 25))
    if (placed + off > -1) fail('không xác nhận kịp đơn trùng khách ' + cust.phone)
    sim.ev.push(['cf', off, STAFF_NIGHT])
    sim.final = 'DaXacNhan'
  }
  o.cp = couponFor(o, placed, cust)
  addOrder(o, placed, cust, sim)
  if (sim.final === 'ChoXacNhan') pendingByPhone.set(cust.phone, placed)
}

// Đơn của Lê Thị Hoa: 2 đơn Đã hoàn trong lịch sử (05-KICH-BAN-KIEM-THU §1)
for (const [d, tod, sku, reason] of [
  [-50, 20 * 60 + 35, 'VD001-DE-M', 'KhachTuChoiNhan'],
  [-21, 21 * 60 + 10, 'QK004-DE-M', 'KhachKhongNgheMay'],
]) {
  const placed = d * 1440 + tod
  const cf = 8 * 60 + 40 + 1440 - tod
  const sh = cf + 6 * 60
  const fl = sh + 3 * 1440 - 3 * 60
  const rt = fl + 4 * 1440 + 60
  const o = { d, t: hhmm(tod), pm: 'C', it: [[sku, 1]] }
  addOrder(o, placed, hoa, {
    ev: [
      ['cf', cf, 'nhanvien'],
      ['sh', sh, 'nhanvien', 'GHTK', 400],
      ['fl', fl, 'nhanvien', reason],
      ['rt', rt, 'nhanvien'],
    ],
    final: 'DaHoan',
  })
}

// Hôm nay: giờ là số phút trước lúc nạp (06 §5.3). Mọi đơn hôm nay trong 8 giờ gần nhất, trừ đơn quá hạn 25 giờ.
const todayCusts = pool.slice(histCount).filter((c) => !pendingByPhone.has(c.phone))
while (todayCusts.length < TODAY_COUNT)
  todayCusts.push(
    customers.find(
      (c) => c._target === 1 && !pendingByPhone.has(c.phone) && !todayCusts.includes(c)
    )
  )
const dupCust = todayCusts[5]
const todayPlan = [
  // [phút trước lúc nạp, pm, kết quả, người, độ trễ]
  [-1500, 'B', 'QuaHan'], // chuyển khoản đặt 25 giờ trước, hệ thống tự hủy khi nạp (TC-34)
  [-120, 'B', 'Cho'], // chuyển khoản đặt 2 giờ trước, còn Chờ thanh toán (TC-34)
  [-35, 'B', 'Cho'],
  [-470, 'C', 'cf', 'nhanvien', 18],
  [-440, 'C', 'cf', 'nhanvien', 25],
  [-260, 'C', 'Cho', 'dup'], // cặp Trùng SĐT (BR-20)
  [-230, 'C', 'Cho', 'dup'],
  [-410, 'B', 'pd', 'nhanvien', 40],
  [-385, 'C', 'cxK', 'KhachDoiY', 35],
  [-360, 'C', 'cf', 'quanly', 12],
  [-330, 'C', 'cxS', 'KhongLienLacDuoc', 95],
  [-300, 'C', 'Cho'],
  [-275, 'C', 'cf', 'nhanvien', 20],
  [-210, 'C', 'Cho'],
  [-180, 'C', 'Cho'],
  [-150, 'C', 'Cho'],
  [-95, 'C', 'Cho'],
  [-70, 'C', 'Cho'],
  [-50, 'C', 'Hoa'],
  [-25, 'C', 'Cho'],
  [-12, 'C', 'Cho'],
]
let ti = 0
for (const [t, pm, kind, a, b] of todayPlan) {
  let cust
  if (kind === 'Hoa') cust = hoa
  else if (a === 'dup') cust = dupCust
  else {
    cust = todayCusts[ti++]
    if (cust === dupCust) cust = todayCusts[ti++]
  }
  const placed = 16 * 60 + t // chỉ để kiểm hạn mã: coi như nạp lúc 16:00
  const exclude = kind === 'QuaHan' ? TEST_SKUS : new Set()
  const o = {
    t,
    pm,
    it:
      kind === 'Hoa'
        ? [
            ['VD006-KE-M', 1],
            ['TX004-DE', 1],
          ]
        : pickLines(placed, exclude),
  }
  if (kind === 'QuaHan') o.it = o.it.filter(([s]) => !TEST_SKUS.has(s))
  if (!o.it.length) o.it = [['AK003-XA-L', 1]]
  if (chance(0.15)) o.n = pick(NOTES_KHACH)
  let sim
  if (kind === 'Cho' || kind === 'Hoa' || kind === 'QuaHan')
    sim = { ev: [], final: pm === 'B' ? 'ChoThanhToan' : 'ChoXacNhan' }
  else if (kind === 'cf') sim = { ev: [['cf', b, a]], final: 'DaXacNhan' }
  else if (kind === 'pd')
    sim = { ev: [['pd', b, a, 'FT26' + String(randInt(1e8, 9.99e8))]], final: 'DaXacNhan' }
  else if (kind === 'cxK') sim = { ev: [['cx', b, 'K', a]], final: 'DaHuy' }
  else sim = { ev: [['cx', b, 'nhanvien', a]], final: 'DaHuy' }
  if (kind !== 'Hoa' && kind !== 'QuaHan') o.cp = couponFor(o, placed, cust)
  addOrder(o, placed, cust, sim)
}

// ---------- Kiểm ràng buộc ----------
const nowNominal = 16 * 60
const atAbs = (o, at) =>
  typeof at === 'string' ? nowNominal - Number(at.slice(2)) : o._placed + at
const finalOf = (o) => (o._final === 'ChoThanhToan' && o.t === -1500 ? 'DaHuy' : o._final)
const stats = {}
for (const o of orders) {
  const st = finalOf(o)
  stats[st] = (stats[st] ?? 0) + 1
  let prev = o._placed
  for (const e of o.ev ?? []) {
    const at = atAbs(o, e[1])
    if (at < prev) fail(`sự kiện lùi thời gian ở đơn ${o.c} ${o.d}/${o.t}: ${JSON.stringify(e)}`)
    prev = at
    if (o.d != null && typeof e[1] === 'number' && at > -1)
      fail(`sự kiện của đơn ngày trước rơi vào hôm nay: ${JSON.stringify(o)}`)
  }
  for (const [sku, q] of o.it) {
    const info = skuInfo.get(sku)
    if (!info) fail('SKU lạ ' + sku)
    if (!info.active) fail('biến thể đã tắt ' + sku)
    if (q < 1 || q > 10) fail('số lượng ' + sku)
    if (o.d != null && o.d < -info.product.createdDaysAgo)
      fail(`${sku} bán trước ngày tạo sản phẩm`)
  }
  if (o.it.length > 20) fail('quá 20 dòng')
  if (TEST_PHONES.has(o.c)) fail('dùng số điện thoại dành cho test ' + o.c)
  if (
    o.cp &&
    !couponUsable(couponByCode.get(o.cp), o.it, o._placed, customerByPhone.get(o.c).province)
  )
    fail('mã không hợp lệ ' + JSON.stringify(o))
}
const all8 = [
  'ChoThanhToan',
  'ChoXacNhan',
  'DaXacNhan',
  'DangGiao',
  'DaGiao',
  'DangHoan',
  'DaHoan',
  'DaHuy',
]
for (const s of all8) if (!stats[s]) fail('thiếu trạng thái ' + s)
// Mỗi khách ít nhất một đơn; lượt mã mỗi khách
const ordersByPhone = new Map()
for (const o of orders) ordersByPhone.set(o.c, [...(ordersByPhone.get(o.c) ?? []), o])
for (const c of customers)
  if (!ordersByPhone.get(c.phone)?.length) fail('khách không có đơn ' + c.phone)
for (const c of data.coupons) {
  const live = orders.filter((o) => o.cp === c.code && finalOf(o) !== 'DaHuy')
  if (c.totalLimit != null && live.length > c.totalLimit) fail('quá tổng lượt ' + c.code)
  for (const [phone, list] of ordersByPhone) {
    const n = list.filter((o) => o.cp === c.code && finalOf(o) !== 'DaHuy').length
    if (n > (c.perCustomer ?? 1)) fail(`${phone} dùng ${c.code} ${n} lần`)
  }
}
// Trùng SĐT chỉ có một cặp dự kiến (BR-20, tính lúc nạp)
const pend = orders.filter((o) => ['ChoThanhToan', 'ChoXacNhan'].includes(finalOf(o)))
const dupPairs = []
for (let i = 0; i < pend.length; i++)
  for (let j = i + 1; j < pend.length; j++)
    if (pend[i].c === pend[j].c && Math.abs(pend[i]._placed - pend[j]._placed) <= 1440)
      dupPairs.push([pend[i].c, pend[i].t, pend[j].t])
if (dupPairs.length !== 1 || dupPairs[0][0] !== dupCust.phone)
  fail('cặp Trùng SĐT không đúng: ' + JSON.stringify(dupPairs))
// Lê Thị Hoa
const hoaOrders = ordersByPhone.get(HOA_PHONE).map(finalOf).sort().join(',')
if (hoaOrders !== 'ChoXacNhan,DaHoan,DaHoan') fail('đơn của Lê Thị Hoa: ' + hoaOrders)
const overdue = orders.find((o) => o.t === -1500)
if (overdue.it.some(([s]) => TEST_SKUS.has(s))) fail('đơn quá hạn chứa biến thể dùng trong test')

// ---------- Số đối chiếu ----------
const priced = orders.map((o) => ({
  o,
  st: finalOf(o),
  p: price(o.it, customerByPhone.get(o.c).province, o.cp),
}))
const total = orders.length
const cancelled = stats.DaHuy
const returned = (stats.DangHoan ?? 0) + (stats.DaHoan ?? 0)
const shippedDone = (stats.DaGiao ?? 0) + returned
const hist = priced.filter(({ o }) => o.d != null)
const histDelivered = hist.filter(
  ({ st, o }) => st === 'DaGiao' && !(o.ev ?? []).some((e) => typeof e[1] === 'string')
)
const revenueHist = histDelivered.reduce((s, { p }) => s + p.subtotal - p.discount, 0)
const todayDelivered = priced.filter(
  ({ o, st }) =>
    st === 'DaGiao' && (o.ev ?? []).some((e) => e[0] === 'dv' && typeof e[1] === 'string')
)
const todayOrders = priced.filter(({ o }) => o.d == null && o.t !== -1500)
const evening = orders.filter((o) => o.d != null && /^(20|21|22):/.test(o.t)).length
const spent = new Map()
const returns = new Map()
for (const { o, st, p } of priced) {
  if (st === 'DaGiao') spent.set(o.c, (spent.get(o.c) ?? 0) + p.total)
  if (st === 'DangHoan' || st === 'DaHoan') returns.set(o.c, (returns.get(o.c) ?? 0) + 1)
}
const vip = [...spent.values()].filter((v) => v >= 5000000).length
const attention = [...returns.values()].filter((v) => v >= 2).length
const sold = new Map()
for (const { o, st } of priced)
  if (st === 'DaGiao')
    for (const [sku, q] of o.it) sold.set(sku.slice(0, 5), (sold.get(sku.slice(0, 5)) ?? 0) + q)
const topSold = [...sold].sort((a, b) => b[1] - a[1]).slice(0, 5)
const couponUse = Object.fromEntries(
  data.coupons.map((c) => [
    c.code,
    orders.filter((o) => o.cp === c.code && finalOf(o) !== 'DaHuy').length,
  ])
)
const firstHist = priced.filter(({ o }) => o.d === -89).slice(0, 3)

// ---------- Ghi file ----------
const omit = (obj, keys) =>
  Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)))
data.customers = customers.map((c) => omit(c, ['_target']))
data.orders = orders.map((o) => omit(o, ['_placed', '_final']))
const top = Object.entries(data)
  .map(([k, v]) => {
    if (k === 'customers' || k === 'orders')
      return `  ${JSON.stringify(k)}: [\n${v.map((x) => '    ' + JSON.stringify(x)).join(',\n')}\n  ]`
    return `  ${JSON.stringify(k)}: ${JSON.stringify(v, null, 2).replace(/\n/g, '\n  ')}`
  })
  .join(',\n')
const text = `{\n${top}\n}\n`
JSON.parse(text)
writeFileSync(file, text)

const pct = (a, b) => ((a / b) * 100).toFixed(1).replace('.', ',') + '%'
console.log(`Khách hàng: ${data.customers.length} (Khách VIP ${vip}, Cần lưu ý ${attention})`)
console.log(
  `Đơn: ${total} = ${hist.length} lịch sử 89 ngày + ${total - hist.length} hôm nay (gồm đơn quá hạn 25 giờ)`
)
console.log(
  'Trạng thái sau khi nạp (đơn quá hạn đã tự hủy):',
  all8.map((s) => `${s} ${stats[s]}`).join(', ')
)
console.log(
  `Tỉ lệ hủy ${pct(cancelled, total)}; tỉ lệ hoàn ${pct(returned, shippedDone)}; đơn lịch sử đặt 20–22h ${pct(evening, hist.length)}`
)
console.log(
  `Chuyển khoản ${orders.filter((o) => o.pm === 'B').length}, COD ${orders.filter((o) => o.pm === 'C').length}; dùng mã (không tính đơn hủy): ${JSON.stringify(couponUse)}`
)
console.log(
  `Doanh thu thuần đơn giao xong trước hôm nay: ${vnd(revenueHist)} / ${histDelivered.length} đơn`
)
console.log(
  `Hôm nay: ${todayOrders.length} đơn đặt (không gồm đơn quá hạn), giá trị đặt hàng ${vnd(todayOrders.filter(({ st }) => st !== 'DaHuy').reduce((s, { p }) => s + p.total, 0))}; giao xong hôm nay ${todayDelivered.length} đơn, doanh thu thuần ${vnd(todayDelivered.reduce((s, { p }) => s + p.subtotal - p.discount, 0))}`
)
console.log(
  `Giao chậm (Đang giao, bàn giao > 5 ngày): ${priced.filter(({ st, o }) => st === 'DangGiao' && atAbs(o, o.ev.find((e) => e[0] === 'sh')[1]) < nowNominal - 5 * 1440).length}`
)
console.log('Bán chạy (đã giao, mọi thời gian):', topSold.map(([c, q]) => `${c} ${q}`).join(', '))
console.log(
  'Ba đơn đầu ô -89:',
  firstHist.map(({ o, p }) => `${o.t} ${o.c} ${vnd(p.total)}`).join('; ')
)
console.log(`Cặp Trùng SĐT: ${dupPairs[0][0]} (${dupPairs[0][1]}, ${dupPairs[0][2]} phút)`)
console.log(`Kích thước file: ${(Buffer.byteLength(text) / 1024).toFixed(0)} KB`)
