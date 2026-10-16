// Sinh ảnh sản phẩm mẫu cho cửa hàng Nhà Sợi (minh họa phẳng kiểu flat-lay catalog, 800×1000,
// WebP ≤ 60 KB) vào public/seed/products/{tên file}. Tên file và màu lấy từ `products[].images`
// trong src/mock/seed/demo-data.json: mỗi phần tử là [tên file, mã màu], ảnh vẽ sản phẩm ở đúng mã
// màu đó (hex lấy từ `colors[]`). Ảnh lặp lại một màu đã vẽ trong cùng sản phẩm là ảnh cận chất
// liệu (vân jersey, denim, canvas…).
// Mỗi sản phẩm vẽ bằng SVG theo một "khuôn" (áo thun, polo, sơ mi, áo khoác, hoodie, quần dài,
// quần short, đầm, chân váy, túi, mũ, thắt lưng, tất, khăn…) cộng chi tiết riêng (cổ, nút, túi,
// đường may, nếp vải). Không chữ, không logo, không người.
// Xác định: không ngẫu nhiên tự do (bộ sinh số có hạt giống theo mã sản phẩm), chạy lại cho cùng byte.
// Không ghi gì vào file JSON. Khung tái dùng từ scripts/generate-menu-images.mjs của 04-fnb-menu-qr.
//
// Chạy:      pnpm seed:product-images
// Tùy chọn:  --only <chuỗi>       chỉ vẽ ảnh có tên file chứa chuỗi
//            --preview <thư mục>  xuất thêm PNG để xem nhanh
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_FILE = join(ROOT, 'src', 'mock', 'seed', 'demo-data.json')
const OUT_DIR = join(ROOT, 'public', 'seed', 'products')
const W = 800
const H = 1000
const CX = W / 2
const MAX_BYTES = 60 * 1000

const args = process.argv.slice(2)
const argVal = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const ONLY = argVal('--only')
const PREVIEW = argVal('--preview')

// ============================================================ Tiện ích SVG
const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
const r2 = (n) => Math.round(n * 100) / 100
function attrs(o) {
  let out = ''
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null || v === false) continue
    out += ` ${k}="${typeof v === 'number' ? r2(v) : esc(v)}"`
  }
  return out
}
const el = (tag, o = {}, body = '') =>
  body ? `<${tag}${attrs(o)}>${body}</${tag}>` : `<${tag}${attrs(o)}/>`
const rect = (x, y, w, h, o = {}) => el('rect', { x, y, width: w, height: h, ...o })
const circle = (cx, cy, r, o = {}) => el('circle', { cx, cy, r, ...o })
const ellipse = (cx, cy, rx, ry, o = {}) => el('ellipse', { cx, cy, rx, ry, ...o })
const path = (d, o = {}) => el('path', { d, ...o })
const g = (o, body) => el('g', o, body)
const stroke = (color, width, extra = {}) => ({
  fill: 'none',
  stroke: color,
  'stroke-width': width,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  ...extra,
})
const dashed = (color, width, dash = '7 5', extra = {}) =>
  stroke(color, width, { 'stroke-dasharray': dash, 'stroke-linecap': 'butt', ...extra })

// Hình học điểm
const P = (pt) => `${r2(pt[0])} ${r2(pt[1])}`
const add = (a, b) => [a[0] + b[0], a[1] + b[1]]
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]]
const mul = (a, k) => [a[0] * k, a[1] * k]
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
const unit = (a) => mul(a, 1 / (Math.hypot(a[0], a[1]) || 1))
const range = (n) => Array.from({ length: n }, (_, i) => i)
const DEG = Math.PI / 180
const mirror = (svg) => g({ transform: `matrix(-1 0 0 1 ${2 * CX} 0)` }, svg)
const poly = (pts) => `M${pts.map(P).join('L')}Z`

// Đường đối xứng qua trục x = CX: `start` và các đoạn mô tả nửa trái (đi từ trên xuống), nửa phải
// sinh tự động bằng cách lật và đi ngược. Đoạn: ['L', x, y] | ['Q', x1, y1, x, y] | ['C', …].
function sym(start, segs, closed = true) {
  const ends = [start, ...segs.map((s) => [s[s.length - 2], s[s.length - 1]])]
  let d = `M${P(start)}`
  for (const s of segs) d += s[0] + s.slice(1).map(r2).join(' ')
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i]
    const c = s.slice(1, -2)
    const ctrl = []
    for (let k = 0; k < c.length; k += 2) ctrl.unshift([2 * CX - c[k], c[k + 1]])
    const prev = ends[i]
    d += s[0] + [...ctrl, [2 * CX - prev[0], prev[1]]].map(P).join(' ')
  }
  return closed ? d + 'Z' : d
}

// ============================================================ Màu
const hexToRgb = (h) => [0, 2, 4].map((i) => parseInt(h.replace('#', '').slice(i, i + 2), 16))
const rgbToHex = (c) =>
  '#' +
  c
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')
    .toUpperCase()
const mix = (a, b, t) => {
  const A = hexToRgb(a)
  const B = hexToRgb(b)
  return rgbToHex(A.map((v, i) => v + (B[i] - v) * t))
}
const tint = (c, t) => mix(c, '#FFFFFF', t)
const shade = (c, t) => mix(c, '#000000', t)
const luma = (c) => {
  const [r, gg, b] = hexToRgb(c)
  return (0.2126 * r + 0.7152 * gg + 0.0722 * b) / 255
}
// Bộ màu phụ suy từ màu vải: viền, chỉ may, mặt trong, nếp gấp
function pal(hex) {
  const L = luma(hex)
  const dark = L < 0.3
  const light = L > 0.8
  return {
    c: hex,
    L,
    dark,
    line: dark ? tint(hex, 0.2) : shade(hex, light ? 0.2 : 0.3),
    stitch: dark ? tint(hex, 0.34) : shade(hex, light ? 0.3 : 0.38),
    inside: dark ? shade(hex, 0.45) : shade(hex, light ? 0.13 : 0.24),
    rib: dark ? tint(hex, 0.05) : shade(hex, 0.05),
  }
}

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hashStr(s) {
  let h = 2166136261
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0), 16777619)
  return h >>> 0
}

// ============================================================ Định nghĩa dùng chung trong một ảnh
let defs = []
let uid = 0
let memo = new Map()
const newId = (p) => `${p}${++uid}`
function once(key, make) {
  if (!memo.has(key)) memo.set(key, make())
  return memo.get(key)
}
// stops: [offset, màu, độ mờ?]
function grad(stops, [x1, y1, x2, y2] = [0, 0, 1, 0]) {
  const id = newId('lg')
  defs.push(
    el(
      'linearGradient',
      { id, x1, y1, x2, y2 },
      stops
        .map(([o, c, op]) => el('stop', { offset: o, 'stop-color': c, 'stop-opacity': op }))
        .join('')
    )
  )
  return `url(#${id})`
}
function radial(stops, r = 0.5) {
  const id = newId('rg')
  defs.push(
    el(
      'radialGradient',
      { id, r },
      stops
        .map(([o, c, op]) => el('stop', { offset: o, 'stop-color': c, 'stop-opacity': op }))
        .join('')
    )
  )
  return `url(#${id})`
}
function clipOf(inner) {
  const id = newId('cp')
  defs.push(el('clipPath', { id }, inner))
  return `url(#${id})`
}
const blur = (std) =>
  once(`blur${std}`, () => {
    const id = newId('bl')
    defs.push(
      el(
        'filter',
        { id, x: '-50%', y: '-50%', width: '200%', height: '200%' },
        el('feGaussianBlur', { stdDeviation: std })
      )
    )
    return `url(#${id})`
  })
// Khối: sáng bên trái, tối bên phải (đèn chiếu chéo từ trái)
const VOL = () =>
  once('vol', () =>
    grad([
      [0, '#FFFFFF', 0.2],
      [0.38, '#FFFFFF', 0],
      [0.62, '#000000', 0],
      [1, '#000000', 0.14],
    ])
  )
const VOLV = () =>
  once('volv', () =>
    grad(
      [
        [0, '#FFFFFF', 0.14],
        [0.5, '#FFFFFF', 0],
        [1, '#000000', 0.12],
      ],
      [0, 0, 0, 1]
    )
  )
const SHADOW_FILTER = () =>
  once('drop', () => {
    const id = newId('ds')
    defs.push(
      el(
        'filter',
        { id, x: '-20%', y: '-20%', width: '140%', height: '140%' },
        el('feGaussianBlur', { in: 'SourceAlpha', stdDeviation: 10 }) +
          el('feOffset', { dx: 6, dy: 14, result: 'b' }) +
          el('feFlood', { 'flood-color': '#4A3E30', 'flood-opacity': 0.24 }) +
          el('feComposite', { in2: 'b', operator: 'in' }) +
          el('feMerge', {}, el('feMergeNode') + el('feMergeNode', { in: 'SourceGraphic' }))
      )
    )
    return `url(#${id})`
  })

// ============================================================ Vải (màu trơn hoặc họa tiết)
function makePattern(kind, hex, p, rot, ex) {
  const id = newId('pt')
  let w = 10
  let h = 10
  let body = ''
  const base = (ww, hh) => rect(0, 0, ww, hh, { fill: hex })
  switch (kind) {
    case 'stripeH': {
      w = 40
      h = ex.period ?? 36
      body = base(w, h) + rect(0, 0, w, ex.sw ?? 13, { fill: ex.stripe })
      break
    }
    case 'pin': {
      w = ex.period ?? 14
      h = 20
      body = base(w, h) + rect(0, 0, ex.sw ?? 3, h, { fill: ex.stripe })
      break
    }
    case 'plaid': {
      w = h = 104
      const dk = shade(hex, 0.55)
      const lt = tint(hex, 0.55)
      body =
        base(w, h) +
        rect(0, 0, w, 40, { fill: dk, 'fill-opacity': 0.5 }) +
        rect(0, 0, 40, h, { fill: dk, 'fill-opacity': 0.5 }) +
        rect(0, 18, w, 3, { fill: '#000000', 'fill-opacity': 0.35 }) +
        rect(18, 0, 3, h, { fill: '#000000', 'fill-opacity': 0.35 }) +
        rect(0, 70, w, 4, { fill: lt, 'fill-opacity': 0.75 }) +
        rect(70, 0, 4, h, { fill: lt, 'fill-opacity': 0.75 })
      break
    }
    case 'floral': {
      w = h = 64
      const petal = ex.petal ?? '#FBFAF6'
      const petal2 = ex.petal2 ?? tint(hex, 0.6)
      const leafC = ex.leaf ?? mix(hex, '#3F5A3A', 0.6)
      const flower = (x, y, s, pc) =>
        range(2)
          .map((k) =>
            ellipse(x + (k ? 5 : -5) * s, y + 5 * s, 3.6 * s, 1.6 * s, {
              fill: leafC,
              transform: `rotate(${k ? 35 : -35} ${x + (k ? 5 : -5) * s} ${y + 5 * s})`,
            })
          )
          .join('') +
        range(5)
          .map((k) =>
            circle(
              x + Math.cos(k * 72 * DEG) * 3.6 * s,
              y + Math.sin(k * 72 * DEG) * 3.6 * s,
              3 * s,
              {
                fill: pc,
              }
            )
          )
          .join('') +
        circle(x, y, 1.8 * s, { fill: '#E2B84E' })
      body =
        base(w, h) +
        flower(15, 14, 1, petal) +
        flower(47, 30, 0.9, petal2) +
        flower(22, 47, 0.8, petal2) +
        flower(52, 54, 0.75, petal) +
        circle(36, 10, 1.4, { fill: petal }) +
        circle(6, 33, 1.4, { fill: petal }) +
        circle(38, 52, 1.2, { fill: petal })
      break
    }
    case 'denim': {
      w = h = 9
      body =
        base(w, h) +
        path(
          'M0 9L9 0M-3 3L3 -3M6 12L12 6',
          stroke(p.dark ? tint(hex, 0.14) : tint(hex, 0.24), 1.4, {
            'stroke-opacity': 0.6,
            'stroke-linecap': 'butt',
          })
        )
      break
    }
    case 'rib': {
      w = ex.period ?? 10
      h = 10
      body =
        base(w, h) +
        rect(w / 2 - 1.2, 0, 2.4, h, {
          fill: p.dark ? tint(hex, 0.14) : shade(hex, 0.12),
          'fill-opacity': 0.6,
        })
      break
    }
    case 'knit': {
      w = 14
      h = 12
      body =
        base(w, h) +
        path(
          'M1.5 2L7 9.5L12.5 2',
          stroke(p.dark ? tint(hex, 0.14) : shade(hex, 0.1), 1.6, { 'stroke-opacity': 0.7 })
        )
      break
    }
    case 'linen': {
      w = h = 140
      const rnd = mulberry32(hashStr(hex + 'linen'))
      body =
        base(w, h) +
        range(30)
          .map((i) => {
            const len = 18 + rnd() * 46
            const x = rnd() * (w - len)
            const y = 2 + rnd() * (h - 4)
            return path(
              `M${r2(x)} ${r2(y)}h${r2(len)}`,
              stroke(i % 2 ? tint(hex, 0.3) : shade(hex, 0.12), 1.4 + rnd() * 0.8, {
                'stroke-opacity': 0.55,
              })
            )
          })
          .join('')
      break
    }
    case 'canvas': {
      w = h = 6
      body =
        base(w, h) +
        path(
          'M0 0.6H6M0.6 0V6',
          stroke(p.dark ? tint(hex, 0.1) : shade(hex, 0.08), 1.1, {
            'stroke-linecap': 'butt',
            'stroke-opacity': 0.7,
          })
        )
      break
    }
    case 'pique': {
      w = h = 8
      body =
        base(w, h) +
        circle(2, 2, 1.3, { fill: p.dark ? tint(hex, 0.12) : shade(hex, 0.08) }) +
        circle(6, 6, 1.3, { fill: p.dark ? tint(hex, 0.12) : shade(hex, 0.08) })
      break
    }
    case 'geo': {
      w = h = 44
      const c = ex.motif ?? shade(hex, 0.35)
      body =
        base(w, h) +
        path('M22 8L36 22L22 36L8 22Z', stroke(c, 2, { 'stroke-opacity': 0.75 })) +
        circle(22, 22, 3, { fill: c, 'fill-opacity': 0.8 }) +
        circle(0, 0, 2.4, { fill: c }) +
        circle(44, 0, 2.4, { fill: c }) +
        circle(0, 44, 2.4, { fill: c }) +
        circle(44, 44, 2.4, { fill: c })
      break
    }
    default:
      throw new Error(`Họa tiết lạ: ${kind}`)
  }
  const tf = [rot ? `rotate(${r2(rot)})` : '', ex.scale ? `scale(${ex.scale})` : '']
    .filter(Boolean)
    .join(' ')
  defs.push(
    el(
      'pattern',
      {
        id,
        patternUnits: 'userSpaceOnUse',
        width: w,
        height: h,
        patternTransform: tf || undefined,
      },
      body
    )
  )
  return `url(#${id})`
}
function fabric(kind, hex, ex = {}) {
  const p = pal(hex)
  const fill = (rot = 0) =>
    kind === 'solid'
      ? hex
      : once(`${kind}|${hex}|${r2(rot)}|${ex.stripe ?? ''}|${ex.scale ?? ''}`, () =>
          makePattern(kind, hex, p, rot, ex)
        )
  return { kind, hex, p, fill, ex }
}

// ============================================================ Mảnh vải và chi tiết may
const fold = (d, p, w = 9, k = 1) =>
  path(d, {
    ...stroke(p.dark ? '#000000' : shade(p.c, 0.55), w),
    'stroke-opacity': (p.dark ? 0.55 : p.L > 0.8 ? 0.13 : 0.2) * k,
    filter: blur(4),
  }) +
  path(d, {
    ...stroke(tint(p.c, p.dark ? 0.32 : 0.75), w * 0.55),
    'stroke-opacity': (p.dark ? 0.4 : 0.45) * k,
    filter: blur(3),
    transform: 'translate(5 -3)',
  })

// Một mảnh vải: nền + (chi tiết bên dưới) + nếp gấp + khối sáng tối, cắt theo hình, rồi viền
function piece(d, fab, o = {}) {
  const p = fab.p
  let s = path(d, { fill: o.fill ?? fab.fill(o.rot || 0) })
  let inner = o.under ?? ''
  if (o.folds) inner += o.folds.map((f) => fold(f, p, o.foldW ?? 9, o.foldK ?? 1)).join('')
  if (o.over) inner += o.over
  if (o.vol !== false) inner += path(d, { fill: o.volV ? VOLV() : VOL() })
  if (inner) s += g({ 'clip-path': clipOf(path(d)) }, inner)
  s += path(d, { fill: 'none', stroke: o.line ?? p.line, 'stroke-width': o.lw ?? 2 })
  return s
}

// Đường chỉ cách mép `offs` px (đặt trong `under` của piece để được cắt theo mảnh)
function edgeStitch(edgeD, offs, p, fill, color) {
  let s = ''
  for (const off of [...offs].sort((a, b) => b - a)) {
    s += path(edgeD, dashed(color ?? p.stitch, 2 * (off + 1.1)))
    s += path(edgeD, stroke(fill, 2 * (off - 1.1), { 'stroke-linecap': 'butt' }))
  }
  return s
}
const stitchLine = (d, color, w = 1.8, dash = '7 5') =>
  path(d, dashed(color, w, dash, { 'stroke-linecap': 'round' }))
const seam = (d, p, w = 2) => path(d, stroke(p.line, w))

// Gân bo (cổ, tay, gấu) cho dải bốn góc a1-a2 (mép trên) và b1-b2 (mép dưới)
function ribQuad(a1, a2, b1, b2, fab, o = {}) {
  const p = fab.p
  const d = poly([a1, a2, b2, b1])
  const n = o.n ?? 26
  const lines = range(n + 1)
    .map((i) => {
      const t = i / n
      return `M${P(lerp(a1, a2, t))}L${P(lerp(b1, b2, t))}`
    })
    .join('')
  let over = path(
    lines,
    stroke(p.dark ? tint(p.c, 0.16) : shade(p.c, 0.14), 1.6, { 'stroke-opacity': 0.55 })
  )
  if (o.stripes)
    over += o.stripes
      .map(([t1, t2, c]) =>
        path(poly([lerp(a1, b1, t1), lerp(a2, b2, t1), lerp(a2, b2, t2), lerp(a1, b1, t2)]), {
          fill: c,
        })
      )
      .join('')
  return piece(d, fab, { fill: o.fill ?? fab.p.rib, over, vol: o.vol })
}

function button(x, y, r, color, o = {}) {
  const pc = pal(color)
  const holes =
    o.holes === 0
      ? ''
      : [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ]
          .slice(0, o.holes === 2 ? 2 : 4)
          .map(([a, b]) =>
            circle(x + a * r * 0.24, y + (o.holes === 2 ? 0 : b * r * 0.24), r * 0.11, {
              fill: shade(color, 0.5),
            })
          )
          .join('')
  return (
    circle(x + 1, y + 2, r, { fill: '#000000', 'fill-opacity': 0.15 }) +
    circle(x, y, r, { fill: color, stroke: pc.line, 'stroke-width': 1.3 }) +
    circle(x, y, r * 0.72, {
      fill: 'none',
      stroke: pc.dark ? tint(color, 0.25) : shade(color, 0.16),
      'stroke-width': 1,
    }) +
    holes +
    circle(x - r * 0.35, y - r * 0.4, r * 0.22, { fill: '#FFFFFF', 'fill-opacity': 0.45 })
  )
}
function metalDot(x, y, r, c = '#B87B3E') {
  const f = once(`metal${c}`, () =>
    radial([
      [0, tint(c, 0.55)],
      [0.6, c],
      [1, shade(c, 0.35)],
    ])
  )
  return (
    circle(x + 1, y + 2, r, { fill: '#000000', 'fill-opacity': 0.18 }) +
    circle(x, y, r, { fill: f, stroke: shade(c, 0.4), 'stroke-width': 1 })
  )
}
// Khóa kéo dọc
function zipper(x, y1, y2, tape, o = {}) {
  const metal = o.metal ?? '#9EA2A8'
  return (
    rect(x - 7, y1, 14, y2 - y1, { fill: tape }) +
    path(`M${x} ${y1}V${y2}`, dashed(shade(metal, 0.1), 8, '2.6 2.4')) +
    path(`M${x} ${y1}V${y2}`, stroke(shade(metal, 0.45), 1.2)) +
    (o.pull === false
      ? ''
      : rect(x - 6, y1 + 4, 12, 18, {
          rx: 3,
          fill: metal,
          stroke: shade(metal, 0.4),
          'stroke-width': 1,
        }) +
        rect(x - 4.5, y1 + 20, 9, 26, {
          rx: 4,
          fill: tint(metal, 0.15),
          stroke: shade(metal, 0.4),
          'stroke-width': 1,
        }) +
        rect(x - 1.5, y1 + 30, 3, 10, { rx: 1.5, fill: shade(metal, 0.4) }))
  )
}
// Dây dệt (quai túi, dây đeo): đường dày có hai đường chỉ chạy sát mép
function strap(d, w, color, p, o = {}) {
  return (
    path(d, stroke(o.line ?? p.line, w + 3)) +
    path(d, stroke(color, w)) +
    (o.stitch === false ? '' : path(d, dashed(o.stitchColor ?? p.stitch, w - 8, '7 5'))) +
    (o.stitch === false ? '' : path(d, stroke(color, w - 12, { 'stroke-linecap': 'butt' }))) +
    path(d, {
      ...stroke('#FFFFFF', w * 0.3),
      'stroke-opacity': 0.12,
      transform: 'translate(-2 -2)',
    })
  )
}
const sheen = (clipD, ds, op = 0.3, w = 46) =>
  g(
    { 'clip-path': clipOf(path(clipD)) },
    ds
      .map((d) => path(d, { ...stroke('#FFFFFF', w), 'stroke-opacity': op, filter: blur(16) }))
      .join('')
  )

// ============================================================ Khuôn áo (thân + tay + cổ + chi tiết)
function sleeveGeom(side, A, B, s) {
  const a = s.ang * DEG
  const d = [side * Math.cos(a), Math.sin(a)]
  const n = [-side * Math.sin(a), Math.cos(a)]
  const A2 = add(A, mul(d, s.L))
  const B2 = add(A2, mul(n, s.wE))
  return { d, n, A2, B2, u: unit(sub(B, B2)) }
}

function drawSleeve(side, fab, A, B, s) {
  const p = fab.p
  const { d, n, A2, B2, u } = sleeveGeom(side, A, B, s)
  const rot = -side * (90 - s.ang)
  const bulge = s.bulge ?? 6
  const mA = sub(lerp(A, A2, 0.5), mul(n, bulge))
  const mB = add(lerp(B2, B, 0.5), mul(n, s.ibulge ?? 0))
  const inner = [CX + side * (Math.abs(A[0] - CX) - 60), A[1] + 60]
  const startPts = s.raglanTop ? `M${P(s.raglanTop)}L${P(A)}` : `M${P(A)}`
  // Tay raglan khép theo đường may chéo về cổ; tay thường khép vào trong thân (bị thân che)
  const close = s.raglanBack ? `C${s.raglanBack}Z` : `L${P(inner)}Z`
  const sd = `${startPts}Q${P(mA)} ${P(A2)}L${P(B2)}Q${P(mB)} ${P(B)}${close}`
  const cuff = s.cuff ?? { kind: 'hem' }
  const cl = cuff.len ?? 0
  const A3 = sub(A2, mul(d, cl))
  const B3 = add(B2, mul(u, cl))
  const fill = fab.fill(rot)
  let under = ''
  if (cuff.kind === 'hem') under += edgeStitch(`M${P(A2)}L${P(B2)}`, cuff.offs ?? [14], p, fill)
  const folds = s.folds ?? [
    `M${P(lerp(lerp(A, B, 0.5), A2, 0.25))}Q${P(lerp(lerp(A, B, 0.3), lerp(A2, B2, 0.5), 0.6))} ${P(lerp(A3, B3, 0.45))}`,
  ]
  let svg = piece(sd, fab, { rot, under, folds, foldW: s.foldW ?? 8 })
  if (s.gather) {
    // Nếp nhún ở đầu tay phồng
    svg += range(5)
      .map((i) => {
        const q = lerp(A, lerp(A, B, 0.6), (i + 1) / 6)
        return fold(`M${P(q)}l${P(mul(d, 34))}`, p, 4, 0.8)
      })
      .join('')
  }
  // Cổ tay
  if (cuff.kind === 'rib') {
    svg += ribQuad(A3, B3, A2, B2, fab, { n: 16, stripes: cuff.stripes })
  } else if (cuff.kind === 'band' || cuff.kind === 'roll') {
    const ext = cuff.kind === 'roll' ? 7 : 1
    const a3 = sub(A3, mul(n, ext))
    const a2 = sub(A2, mul(n, ext))
    const b2 = add(B2, mul(n, ext))
    const b3 = add(B3, mul(n, ext))
    const cd = poly([a3, a2, b2, b3])
    svg += piece(cd, fab, {
      rot,
      under:
        edgeStitch(`M${P(a2)}L${P(b2)}`, [7], p, fill) +
        edgeStitch(`M${P(a3)}L${P(b3)}`, [7], p, fill),
    })
    if (cuff.button) {
      const bp = lerp(lerp(a3, a2, 0.5), lerp(b3, b2, 0.5), 0.78)
      svg += button(bp[0], bp[1], 6.5, cuff.button, { holes: 2 })
    }
    if (cuff.placket) {
      const q1 = lerp(A3, B3, 0.7)
      svg += seam(`M${P(q1)}l${P(mul(d, -70))}`, p, 1.6)
      const bq = add(q1, mul(d, -40))
      svg += button(bq[0] + n[0] * 8, bq[1] + n[1] * 8, 4.5, cuff.button ?? p.line, { holes: 2 })
    }
  } else if (cuff.kind === 'elastic') {
    const a3 = sub(A3, mul(n, -6))
    const b3 = add(B3, mul(n, -6))
    const cd = poly([a3, A2, B2, b3])
    svg += piece(cd, fab, { rot, fill: p.rib })
    svg += range(9)
      .map((i) => {
        const t = (i + 0.5) / 9
        return path(`M${P(lerp(a3, b3, t))}L${P(lerp(A2, B2, t))}`, {
          ...stroke(p.line, 1.4),
          'stroke-opacity': 0.6,
        })
      })
      .join('')
  }
  return svg
}

// Cổ áo: frontD là đường viền cổ trước, insideD là khoảng hở thấy mặt trong
function neckOpening(frontD, insideD, bodyD, fab, bw, o = {}) {
  const p = fab.p
  const bodyFill = fab.fill(0)
  const bandFill = o.bandFill ?? p.rib
  let s = g(
    { 'clip-path': clipOf(path(bodyD)) },
    (o.stitch === false
      ? ''
      : path(frontD, dashed(p.stitch, 2 * (bw + 6))) +
        path(frontD, stroke(bodyFill, 2 * (bw + 4)))) +
      path(frontD, stroke(p.line, 2 * bw + 2.4)) +
      path(frontD, stroke(bandFill, 2 * bw, { 'stroke-linejoin': o.join ?? 'round' })) +
      (o.rib === false
        ? ''
        : path(frontD, {
            ...dashed(p.dark ? tint(p.c, 0.16) : shade(p.c, 0.14), 2 * bw, '1.6 4.2'),
            'stroke-opacity': 0.55,
          }))
  )
  s += path(insideD, { fill: p.inside })
  if (o.backBand !== false)
    s += g(
      { 'clip-path': clipOf(path(insideD)) },
      path(o.backD, stroke(p.line, 2 * bw * 0.8 + 2)) +
        path(o.backD, stroke(bandFill, 2 * bw * 0.8))
    )
  if (o.label) s += o.label
  s += path(insideD, { fill: 'none', stroke: p.line, 'stroke-width': 1.6 })
  return s
}

function shirtCollar(ctx, o = {}) {
  const { fab, sy, nw, nsY } = ctx
  const p = fab.p
  const tipY = sy + (o.tipY ?? 92)
  const tipX = o.tipX ?? 58
  const standH = o.standH ?? 26
  // Chân cổ phía sau (thấy mặt trong)
  const back = `M${CX - nw - 6} ${nsY + 4}Q${CX - nw + 4} ${sy - standH - 6} ${CX} ${sy - standH}Q${CX + nw - 4} ${sy - standH - 6} ${CX + nw + 6} ${nsY + 4}L${CX + nw - 8} ${nsY + 12}Q${CX} ${sy - 6} ${CX - nw + 8} ${nsY + 12}Z`
  let s = piece(back, fab, { fill: p.inside, vol: false })
  // Lá cổ trái
  const leaf = `M${CX - nw - 8} ${nsY + 2}Q${CX - nw - 4} ${sy - standH - 4} ${CX - 8} ${sy - standH + 8}L${CX - 2} ${sy + 30}L${CX - tipX + 6} ${tipY}Q${CX - nw - 26} ${sy + 50} ${CX - nw - 8} ${nsY + 2}Z`
  const leafStitch = `M${CX - 10} ${sy + 22}L${CX - tipX + 10} ${tipY - 12}`
  const leafSvg = (fill) =>
    piece(leaf, fab, {
      fill,
      over:
        stitchLine(leafStitch, p.stitch, 1.6) +
        stitchLine(
          `M${CX - tipX + 8} ${tipY - 14}Q${CX - nw - 18} ${sy + 46} ${CX - nw - 4} ${nsY + 8}`,
          p.stitch,
          1.6
        ),
      folds: [`M${CX - nw + 10} ${sy}Q${CX - 30} ${sy + 20} ${CX - 30} ${sy + 50}`],
      foldW: 6,
      foldK: 0.6,
    })
  s += leafSvg(o.fill)
  s += mirror(leafSvg(o.fillR ?? o.fill))
  if (o.buttonDown) {
    s += button(CX - tipX + 16, tipY - 16, 4.2, o.btn ?? '#F3F0E8', { holes: 2 })
    s += button(CX + tipX - 16, tipY - 16, 4.2, o.btn ?? '#F3F0E8', { holes: 2 })
  }
  return s
}

// Nẹp nút trước ngực
function placket(ctx, y1, y2, o = {}) {
  const { fab } = ctx
  const p = fab.p
  const w = o.w ?? 32
  const d = `M${CX - w / 2} ${y1}H${CX + w / 2}V${y2}H${CX - w / 2}Z`
  let s = piece(d, fab, {
    fill: o.fill,
    vol: false,
    over:
      stitchLine(`M${CX - w / 2 + 5} ${y1}V${y2}`, o.stitch ?? p.stitch, 1.6) +
      stitchLine(`M${CX + w / 2 - 5} ${y1}V${y2}`, o.stitch ?? p.stitch, 1.6),
  })
  const n = o.n ?? 5
  const step = o.step ?? (y2 - y1 - 30) / Math.max(1, n - 1)
  for (let i = 0; i < n; i++) {
    const y = (o.first ?? y1 + 16) + i * step
    if (y > y2 - 8) break
    s += o.btnFn
      ? o.btnFn(CX, y)
      : button(CX, y, o.r ?? 7, o.btn ?? '#F3F0E8', { holes: o.holes ?? 4 })
  }
  return s
}

// Túi ngực (có thể có nắp)
function chestPocket(ctx, x, y, o = {}) {
  const { fab } = ctx
  const p = fab.p
  const w = o.w ?? 74
  const h = o.h ?? 84
  const fill = o.fill
  const d = `M${x - w / 2} ${y}H${x + w / 2}V${y + h - 12}L${x} ${y + h}L${x - w / 2} ${y + h - 12}Z`
  let s = piece(d, fab, {
    fill,
    vol: false,
    lw: 1.6,
    under: edgeStitch(d, [5], p, fill ?? fab.fill(0), o.stitch),
    over: path(`M${x - w / 2} ${y + 10}H${x + w / 2}`, stroke(p.line, 1.4)),
  })
  if (o.flap) {
    const fd = `M${x - w / 2 - 3} ${y - 6}H${x + w / 2 + 3}V${y + 18}L${x} ${y + 34}L${x - w / 2 - 3} ${y + 18}Z`
    s += path(fd, {
      fill: '#000000',
      'fill-opacity': 0.14,
      transform: 'translate(2 4)',
      filter: blur(3),
    })
    s += piece(fd, fab, {
      fill,
      vol: false,
      lw: 1.6,
      under: edgeStitch(fd, [5], p, fill ?? fab.fill(0), o.stitch),
    })
    if (o.snap) s += o.snap(x, y + 20)
  }
  return s
}

function top(fab, o, ctx) {
  const p = fab.p
  const sy = o.sy ?? 210
  const nw = o.nw ?? 62
  const sw = o.sw ?? 184
  const slope = o.slope ?? 26
  const aw = o.aw ?? 168
  const ay = o.ay ?? sy + 196
  const hw = o.hw ?? aw
  const hy = o.hy ?? 800
  const hc = o.hc ?? 8
  const tail = o.tail ?? 0
  const nsY = sy - 6
  const A = o.A ?? (o.openTop ? [CX - nw - o.strapW, nsY + 2] : [CX - sw, sy + slope])
  const B = [CX - aw, ay]
  const sideSegs = []
  if (o.waistY) {
    const wy = o.waistY
    const ww = o.ww
    sideSegs.push(['C', B[0], ay + (wy - ay) * 0.45, CX - ww, wy - (wy - ay) * 0.3, CX - ww, wy])
    sideSegs.push([
      'C',
      CX - ww - (o.flareOut ?? 0),
      wy + (hy - wy) * 0.3,
      CX - hw + (o.flare ?? 0),
      hy - (hy - wy) * 0.35,
      CX - hw,
      hy - tail,
    ])
  } else {
    const ww = o.ww ?? aw
    sideSegs.push([
      'C',
      CX - ww,
      ay + (hy - ay) * 0.45,
      CX - hw,
      hy - (hy - ay) * 0.3,
      CX - hw,
      hy - tail,
    ])
  }
  const hemSeg = tail
    ? ['C', CX - hw + 4, hy - tail * 0.2, CX - hw * 0.45, hy + hc, CX, hy + hc]
    : ['Q', CX - hw * 0.5, hy + hc, CX, hy + hc]
  const armSeg = o.armSeg
    ? o.armSeg(A, B)
    : ['C', A[0] + 6, A[1] + 70, B[0] - 2, B[1] - 64, B[0], B[1]]
  let topSegs
  let start = [CX, sy + (o.backDip ?? 6)]
  if (o.raglan) {
    topSegs = [
      ['Q', CX - nw * 0.55, sy + 5, CX - nw + 8, nsY + 6],
      ['C', CX - nw - 10, nsY + 70, B[0] + 40, B[1] - 70, B[0], B[1]],
    ]
  } else if (o.openTop) {
    start = [CX, sy + o.nd]
    topSegs = [
      [
        'C',
        CX - nw * 0.5,
        sy + o.nd,
        CX - nw,
        sy + o.nd * 0.7,
        CX - nw,
        sy + o.nd * (o.squareK ?? 0.55),
      ],
      ['L', CX - nw, nsY],
      ['L', A[0], A[1]],
      armSeg,
    ]
    if (o.squareNeck) topSegs[0] = ['L', CX - nw, sy + o.nd]
  } else {
    topSegs = [['Q', CX - nw * 0.55, sy + 5, CX - nw, nsY], ['L', A[0], A[1]], armSeg]
  }
  const bodyD = sym(start, [...topSegs, ...sideSegs, hemSeg])
  const hemD = sym([CX - hw, hy - tail], [hemSeg], false)
  const c = { fab, p, sy, nw, nsY, aw, ay, hw, hy, hc, tail, A, B, bodyD, hemD, sw, rnd: ctx.rnd }

  let svg = ''
  if (o.behind) svg += o.behind(c)
  // Mặt sau (thấy qua cổ khoét)
  if (o.openTop) {
    const backD = sym(
      [CX, sy + (o.backNeck ?? 34)],
      [
        ['Q', CX - nw * 0.6, sy + (o.backNeck ?? 34), CX - nw - 2, nsY + 4],
        ['L', A[0] + 4, A[1] + 2],
        armSeg,
        ...sideSegs.slice(0, 1),
        ['L', CX, sideSegs[0][sideSegs[0].length - 1]],
      ]
    )
    svg += piece(backD, fab, { fill: p.inside, vol: false })
  }
  // Tay áo
  if (o.sleeve) {
    for (const side of [-1, 1]) {
      const As = side < 0 ? A : [2 * CX - A[0], A[1]]
      const Bs = side < 0 ? B : [2 * CX - B[0], B[1]]
      const s = { ...o.sleeve }
      if (o.raglan) {
        s.raglanTop = [CX + side * (nw - 8), nsY + 6]
        s.raglanBack = [
          [Bs[0] - side * 40, Bs[1] - 70],
          [CX + side * (nw + 10), nsY + 70],
          s.raglanTop,
        ]
          .map(P)
          .join(' ')
      }
      svg += drawSleeve(side, o.sleeveFab ?? fab, As, Bs, s)
    }
  }
  // Thân
  let under = ''
  if (o.hem === 'stitch') under += edgeStitch(hemD, o.hemOffs ?? [16], p, fab.fill(0))
  if (o.binding) under += edgeStitch(o.binding(c), [12], p, fab.fill(0))
  const folds = o.folds
    ? o.folds(c)
    : [
        `M${CX - aw + 40} ${ay + 30}Q${CX - aw + 74} ${(ay + hy) / 2} ${CX - hw + 56} ${hy - 30}`,
        `M${CX + aw - 46} ${ay + 70}Q${CX + aw - 96} ${(ay + hy) / 2 + 20} ${CX + hw - 84} ${hy - 24}`,
      ]
  svg += piece(bodyD, fab, { under, folds, foldK: 0.8 })
  if (o.hem === 'rib') {
    const h = o.ribH ?? 46
    const L1 = [CX - hw, hy - tail - h]
    const R1 = [CX + hw, hy - tail - h]
    svg += ribQuad(L1, R1, [CX - hw, hy], [CX + hw, hy], fab, { n: 44, stripes: o.ribStripes })
  }
  if (o.decor) svg += o.decor(c)
  if (o.neck) svg += o.neck(c)
  if (o.front) svg += o.front(c)
  return svg
}

// Các kiểu cổ
const neckCrew =
  (nd = 46, bw = 8, o = {}) =>
  (c) => {
    const { sy, nw, nsY, bodyD, fab, p } = c
    const frontD = `M${CX - nw} ${nsY}C${CX - nw} ${nsY + nd * 0.75} ${CX - nw * 0.55} ${sy + nd} ${CX} ${sy + nd}C${CX + nw * 0.55} ${sy + nd} ${CX + nw} ${nsY + nd * 0.75} ${CX + nw} ${nsY}`
    const backD = `M${CX - nw} ${nsY}Q${CX - nw * 0.55} ${sy + 5} ${CX} ${sy + 6}Q${CX + nw * 0.55} ${sy + 5} ${CX + nw} ${nsY}`
    const insideD =
      backD +
      `C${CX + nw} ${nsY + nd * 0.75} ${CX + nw * 0.55} ${sy + nd} ${CX} ${sy + nd}C${CX - nw * 0.55} ${sy + nd} ${CX - nw} ${nsY + nd * 0.75} ${CX - nw} ${nsY}Z`
    const label =
      o.label === false
        ? ''
        : rect(CX - 15, sy + 14, 30, 16, {
            rx: 2,
            fill: p.dark ? '#3A3A3A' : '#E7E1D4',
            stroke: p.line,
            'stroke-width': 1,
          })
    return neckOpening(frontD, insideD, bodyD, fab, bw, {
      backD: `M${CX - nw} ${nsY}Q${CX - nw * 0.55} ${sy + 5} ${CX} ${sy + 6}Q${CX + nw * 0.55} ${sy + 5} ${CX + nw} ${nsY}`,
      label,
      bandFill: o.bandFill,
      rib: o.rib,
    })
  }
const neckV =
  (nd = 112, bw = 8) =>
  (c) => {
    const { sy, nw, nsY, bodyD, fab } = c
    const frontD = `M${CX - nw} ${nsY}Q${CX - nw * 0.35} ${sy + nd * 0.55} ${CX} ${sy + nd}Q${CX + nw * 0.35} ${sy + nd * 0.55} ${CX + nw} ${nsY}`
    const backD = `M${CX - nw} ${nsY}Q${CX - nw * 0.55} ${sy + 5} ${CX} ${sy + 6}Q${CX + nw * 0.55} ${sy + 5} ${CX + nw} ${nsY}`
    const insideD =
      backD +
      `Q${CX + nw * 0.35} ${sy + nd * 0.55} ${CX} ${sy + nd}Q${CX - nw * 0.35} ${sy + nd * 0.55} ${CX - nw} ${nsY}Z`
    return (
      neckOpening(frontD, insideD, bodyD, fab, bw, { backD, join: 'miter' }) +
      seam(`M${CX} ${sy + nd}L${CX} ${sy + nd + bw + 4}`, fab.p, 1.6)
    )
  }

// Áo sơ mi (cổ đức, nẹp nút, tay dài có măng sét)
function shirtTop(fab, o, ctx) {
  const btn = o.btn ?? (fab.p.dark ? tint(fab.hex, 0.12) : '#F4F1EA')
  return top(
    fab,
    {
      sy: 205,
      nw: 56,
      sw: 182,
      aw: 168,
      hw: 170,
      hy: 812,
      tail: 34,
      hc: 22,
      sleeve: {
        ang: 75,
        L: 430,
        wE: 74,
        bulge: 8,
        cuff: { kind: 'band', len: 50, button: btn, placket: true },
      },
      neck: (c) =>
        o.collar === 'mandarin'
          ? mandarinCollar(c)
          : o.collar === 'bow'
            ? bowNeck(c)
            : shirtCollar(c, { buttonDown: o.buttonDown, btn, tipY: o.tipY, tipX: o.tipX }),
      decor: (c) =>
        (o.collar === 'bow'
          ? ''
          : placket(c, c.sy + 30, c.hy + c.hc - 10, {
              btn,
              n: 6,
              first: c.sy + 70,
              step: 96,
              stitch: o.stitch,
            })) + (o.decor ? o.decor(c) : ''),
      ...o.top,
    },
    ctx
  )
}
function mandarinCollar(c) {
  const { sy, nw, nsY, fab, p } = c
  const back = `M${CX - nw - 4} ${nsY + 2}Q${CX} ${sy - 30} ${CX + nw + 4} ${nsY + 2}L${CX + nw} ${nsY + 10}Q${CX} ${sy - 4} ${CX - nw} ${nsY + 10}Z`
  const band = `M${CX - nw - 6} ${nsY + 4}Q${CX - nw - 2} ${sy - 22} ${CX - 30} ${sy - 18}Q${CX - 6} ${sy - 14} ${CX - 4} ${sy + 10}L${CX - 4} ${sy + 34}Q${CX - 40} ${sy + 32} ${CX - nw + 4} ${nsY + 26}Z`
  const leaf = piece(band, fab, {
    over: stitchLine(
      `M${CX - nw + 2} ${nsY + 8}Q${CX - nw + 4} ${sy - 12} ${CX - 30} ${sy - 9}Q${CX - 13} ${sy - 6} ${CX - 12} ${sy + 12}`,
      p.stitch,
      1.5
    ),
  })
  return (
    piece(back, fab, { fill: p.inside, vol: false }) +
    leaf +
    mirror(leaf) +
    button(CX, sy + 12, 6, fab.p.dark ? tint(fab.hex, 0.1) : '#F4F1EA', { holes: 2 })
  )
}
function bowNeck(c) {
  const { sy, fab } = c
  let s = neckCrew(30, 7, { label: false })(c)
  const tie = (side) => {
    const loop = `M${CX} ${sy + 34}C${CX + side * 30} ${sy + 4} ${CX + side * 96} ${sy + 8} ${CX + side * 92} ${sy + 38}C${CX + side * 90} ${sy + 66} ${CX + side * 30} ${sy + 62} ${CX} ${sy + 40}Z`
    const tail = `M${CX + side * 4} ${sy + 42}C${CX + side * 20} ${sy + 100} ${CX + side * 36} ${sy + 160} ${CX + side * 30} ${sy + 230}L${CX + side * 62} ${sy + 222}C${CX + side * 60} ${sy + 150} ${CX + side * 36} ${sy + 90} ${CX + side * 14} ${sy + 40}Z`
    return (
      piece(tail, fab, {
        rot: side * 12,
        folds: [
          `M${CX + side * 16} ${sy + 70}Q${CX + side * 40} ${sy + 150} ${CX + side * 44} ${sy + 220}`,
        ],
        foldW: 5,
      }) +
      piece(loop, fab, {
        folds: [
          `M${CX + side * 14} ${sy + 38}Q${CX + side * 50} ${sy + 30} ${CX + side * 80} ${sy + 36}`,
        ],
        foldW: 5,
      })
    )
  }
  s += tie(1) + tie(-1)
  s += piece(
    `M${CX - 16} ${sy + 22}Q${CX} ${sy + 16} ${CX + 16} ${sy + 22}L${CX + 13} ${sy + 54}Q${CX} ${sy + 60} ${CX - 13} ${sy + 54}Z`,
    fab,
    {}
  )
  return s
}

// Mũ trùm (hoodie, áo gió): vẽ phía sau thân
const hoodBehind =
  (o = {}) =>
  (c) => {
    const { sy, nw, fab, p } = c
    const hood = `M${CX - nw - 64} ${sy + 26}C${CX - nw - 96} ${sy - 120} ${CX - 60} ${sy - 196} ${CX} ${sy - 196}C${CX + 60} ${sy - 196} ${CX + nw + 96} ${sy - 120} ${CX + nw + 64} ${sy + 26}Z`
    const seamD = `M${CX} ${sy - 196}V${sy - 20}`
    return piece(hood, fab, {
      over: seam(seamD, p, 1.6) + stitchLine(`M${CX - 7} ${sy - 192}V${sy - 24}`, p.stitch, 1.4),
      folds: [`M${CX - nw - 40} ${sy - 40}Q${CX - nw - 30} ${sy - 120} ${CX - 40} ${sy - 170}`],
      foldW: 8,
      ...o,
    })
  }
const hoodFront =
  (o = {}) =>
  (c) => {
    const { sy, nw, fab, p } = c
    const opening = `M${CX - nw - 6} ${sy + 4}C${CX - nw - 20} ${sy - 110} ${CX + nw + 20} ${sy - 110} ${CX + nw + 6} ${sy + 4}L${CX} ${sy + 64}Z`
    let s = path(opening, { fill: p.inside, stroke: p.line, 'stroke-width': 1.6 })
    const side = (sd) => {
      const d = `M${CX + sd * (nw + 30)} ${sy + 12}C${CX + sd * (nw + 26)} ${sy - 70} ${CX + sd * 20} ${sy - 118} ${CX - sd * 6} ${sy - 104}C${CX + sd * 40} ${sy - 80} ${CX + sd * (nw + 2)} ${sy - 30} ${CX + sd * (nw - 2)} ${sy + 10}C${CX + sd * 60} ${sy + 34} ${CX + sd * 10} ${sy + 62} ${CX - sd * 14} ${sy + 72}C${CX + sd * 30} ${sy + 72} ${CX + sd * 70} ${sy + 50} ${CX + sd * (nw + 30)} ${sy + 12}Z`
      return piece(d, fab, {
        over: stitchLine(
          `M${CX + sd * (nw + 18)} ${sy + 10}C${CX + sd * (nw + 14)} ${sy - 60} ${CX + sd * 20} ${sy - 104} ${CX - sd * 2} ${sy - 96}`,
          p.stitch,
          1.5
        ),
      })
    }
    s += side(-1) + side(1)
    if (o.cords !== false) {
      const cord = o.cord ?? (p.dark || p.L < 0.55 ? '#EDEAE3' : shade(fab.hex, 0.12))
      for (const sd of [-1, 1]) {
        const x0 = CX + sd * 34
        const d = `M${x0} ${sy + 40}C${x0 + sd * 4} ${sy + 110} ${x0 - sd * 8} ${sy + 170} ${x0 + sd * 2} ${sy + 230}`
        s += circle(x0, sy + 38, 6, { fill: p.inside, stroke: '#9EA2A8', 'stroke-width': 2.4 })
        s += path(d, stroke(shade(cord, 0.25), 9)) + path(d, stroke(cord, 7))
        s += rect(x0 + sd * 2 - 5, sy + 228, 10, 26, {
          rx: 3,
          fill: o.aglet ?? '#A9ADB3',
          stroke: '#6E7277',
          'stroke-width': 1,
        })
      }
    }
    return s
  }

// Ve áo blazer
function blazerLapels(c, o = {}) {
  const { sy, nw, nsY, fab, p } = c
  const by = sy + (o.breakY ?? 300)
  const vD = `M${CX - nw + 6} ${nsY + 4}L${CX} ${by}L${CX + nw - 6} ${nsY + 4}Q${CX} ${sy + 4} ${CX - nw + 6} ${nsY + 4}Z`
  let s = path(vD, { fill: o.inner ?? p.inside, stroke: p.line, 'stroke-width': 1.6 })
  const lapel = (sd) => {
    const d = `M${CX + sd * (nw - 2)} ${nsY - 2}L${CX + sd * (nw + 36)} ${sy + 64}L${CX + sd * (nw + 12)} ${sy + 84}L${CX + sd * (nw + 74)} ${sy + 104}L${CX + sd * 4} ${by}L${CX + sd * (nw - 14)} ${nsY + 10}Z`
    return piece(d, fab, {
      over:
        stitchLine(
          `M${CX + sd * (nw + 62)} ${sy + 112}L${CX + sd * 12} ${by - 18}`,
          p.stitch,
          1.3,
          '3 4'
        ) + seam(`M${CX + sd * (nw + 12)} ${sy + 84}L${CX + sd * (nw - 6)} ${sy + 60}`, p, 1.4),
      folds: [`M${CX + sd * (nw + 30)} ${sy + 120}L${CX + sd * 16} ${by - 30}`],
      foldW: 7,
    })
  }
  s += lapel(1) + lapel(-1)
  return s
}

// ============================================================ Khuôn quần
function pants(fab, o, ctx) {
  const p = fab.p
  const wy = o.wy ?? 130
  const wh = o.wh ?? 38
  const ww = o.ww ?? 150
  const hipY = o.hipY ?? 320
  const hw = o.hw ?? 176
  const cy = o.cy ?? 430
  const ky = o.ky ?? 670
  const hy = o.hy ?? 930
  const { ko = 150, ki = 26, ho = 140, hi = 40 } = o
  const segs = [
    ['L', CX - ww, wy],
    ['C', CX - ww - 10, wy + (hipY - wy) * 0.5, CX - hw, hipY - (hipY - wy) * 0.4, CX - hw, hipY],
  ]
  if (o.short) {
    segs.push([
      'C',
      CX - hw - 2,
      hipY + (hy - hipY) * 0.4,
      CX - ho,
      hy - (hy - hipY) * 0.3,
      CX - ho,
      hy,
    ])
    segs.push(['L', CX - hi, hy + (o.hemTilt ?? 8)])
    segs.push(['C', CX - hi + 2, hy - 40, CX - 18, cy + 40, CX, cy])
  } else {
    segs.push(['C', CX - hw, hipY + 130, CX - ko, ky - 140, CX - ko, ky])
    segs.push(['C', CX - ko, ky + 110, CX - ho, hy - 90, CX - ho, hy])
    segs.push(['L', CX - hi, hy + 4])
    segs.push(['C', CX - hi, hy - 90, CX - ki, ky + 110, CX - ki, ky])
    segs.push(['C', CX - ki, ky - 150, CX - 14, cy + 40, CX, cy])
  }
  const bodyD = sym([CX, wy], segs)
  const hemL = `M${CX - ho} ${hy}L${CX - hi} ${hy + (o.short ? (o.hemTilt ?? 8) : 4)}`
  const hemD = hemL + `M${CX + hi} ${hy + (o.short ? (o.hemTilt ?? 8) : 4)}L${CX + ho} ${hy}`
  const c = { fab, p, wy, wh, ww, hipY, hw, cy, ky, hy, ko, ki, ho, hi, bodyD, rnd: ctx.rnd }
  const fill = fab.fill(0)
  const thread = o.thread ?? p.stitch

  let under = ''
  if (o.hem !== 'none' && o.hem !== 'rib' && o.hem !== 'fray')
    under += edgeStitch(hemD, o.hemOffs ?? [18], p, fill, thread)
  if (o.fade) {
    const fc = tint(fab.hex, 0.45)
    for (const sd of [-1, 1]) {
      const tx = CX + sd * hw * 0.55
      under += ellipse(tx, hipY + 90, 58, 150, { fill: fc, 'fill-opacity': 0.45, filter: blur(26) })
      if (!o.short)
        under += ellipse(CX + (sd * (ko + ki)) / 2, ky, 40, 80, {
          fill: fc,
          'fill-opacity': 0.35,
          filter: blur(20),
        })
    }
  }
  const legMid = (sd, t) => [
    CX + sd * ((ko + ki) / 2) * (1 - t) + sd * ((ho + hi) / 2) * t,
    ky + (hy - ky) * t,
  ]
  const folds = o.short
    ? [
        `M${CX - hw + 30} ${hipY + 20}Q${CX - hw * 0.5} ${hipY + 60} ${CX - 40} ${cy - 10}`,
        `M${CX + hw - 40} ${hipY + 40}Q${CX + hw * 0.6} ${hy - 50} ${CX + hi + 30} ${hy - 30}`,
      ]
    : [
        `M${CX - 30} ${cy - 20}Q${CX - 80} ${cy + 30} ${CX - hw + 50} ${cy + 20}`,
        `M${CX + 34} ${cy - 10}Q${CX + 90} ${cy + 40} ${CX + hw - 60} ${cy + 50}`,
        `M${legMid(-1, 0)[0] - 40} ${ky - 30}Q${legMid(-1, 0)[0]} ${ky - 10} ${legMid(-1, 0)[0] + 36} ${ky - 36}`,
        `M${legMid(1, 0)[0] - 36} ${ky + 10}Q${legMid(1, 0)[0]} ${ky - 18} ${legMid(1, 0)[0] + 40} ${ky + 2}`,
        `M${legMid(-1, 0.6)[0] - 30} ${legMid(-1, 0.6)[1]}Q${legMid(-1, 0.6)[0] + 10} ${legMid(-1, 0.6)[1] + 20} ${legMid(-1, 0.6)[0] + 30} ${legMid(-1, 0.6)[1] - 6}`,
      ]
  let over = ''
  if (o.whiskers) {
    for (const sd of [-1, 1])
      for (let i = 0; i < 4; i++)
        over += path(
          `M${CX + sd * 26} ${cy - 30 - i * 16}Q${CX + sd * 70} ${cy - 40 - i * 22} ${CX + sd * (110 + i * 6)} ${cy - 76 - i * 26}`,
          { ...stroke(tint(fab.hex, 0.5), 4), 'stroke-opacity': 0.26, filter: blur(3) }
        )
  }
  if (o.crease)
    for (const sd of [-1, 1]) {
      const a = [CX + sd * (hw * 0.5 + 4), wy + wh + 30]
      const b = legMid(sd, 0)
      const e = legMid(sd, 1)
      over += path(`M${P(a)}Q${P(b)} ${P(e)}`, {
        ...stroke(tint(fab.hex, p.dark ? 0.22 : 0.5), 3),
        'stroke-opacity': 0.7,
      })
      over += path(`M${P(a)}Q${P(b)} ${P(e)}`, {
        ...stroke(p.line, 1.4),
        'stroke-opacity': 0.6,
        transform: 'translate(3 0)',
      })
    }
  let svg = piece(bodyD, fab, { under, folds, over, foldW: 10, foldK: 0.7 })
  // Gấu bo / tua
  if (o.hem === 'rib') {
    for (const sd of [-1, 1])
      svg += ribQuad(
        [CX + sd * (ho + 2), hy - 56],
        [CX + sd * (hi - 2), hy - 52],
        [CX + sd * (ho + 1), hy],
        [CX + sd * (hi - 1), hy + 4],
        fab,
        { n: 14 }
      )
  }
  if (o.hem === 'fray') {
    const rnd = mulberry32(hashStr('fray' + fab.hex))
    let fr = ''
    for (const sd of [-1, 1]) {
      const a = [CX + sd * ho, hy]
      const b = [CX + sd * hi, hy + (o.hemTilt ?? 8)]
      for (let i = 0; i <= 36; i++) {
        const q = lerp(a, b, i / 36)
        fr += `M${P(q)}l${r2((rnd() - 0.5) * 4)} ${r2(6 + rnd() * 12)}`
      }
      svg += path(`M${P(a)}L${P(b)}`, stroke(tint(fab.hex, 0.5), 6))
    }
    svg += path(fr, stroke(tint(fab.hex, 0.55), 1.6))
  }
  // Cạp quần
  const wbD = `M${CX - ww} ${wy}H${CX + ww}L${CX + ww + 2} ${wy + wh}H${CX - ww - 2}Z`
  if (o.waist === 'elastic') {
    let ov = ''
    for (let i = 0; i <= 40; i++) {
      const x = CX - ww + (2 * ww * i) / 40
      ov += path(`M${x} ${wy + 4}V${wy + wh - 4}`, {
        ...stroke(p.line, 1.2),
        'stroke-opacity': 0.5,
      })
    }
    svg += piece(wbD, fab, { over: ov, vol: false })
    for (let i = 0; i < 9; i++) {
      const x = CX - ww + 20 + ((2 * ww - 40) * i) / 8
      svg += fold(`M${x} ${wy + wh + 2}l${i % 2 ? 4 : -4} 34`, p, 4, 0.8)
    }
  } else {
    svg += piece(wbD, fab, {
      vol: false,
      under:
        edgeStitch(`M${CX - ww - 2} ${wy + wh}H${CX + ww + 2}`, [6], p, fill, thread) +
        edgeStitch(`M${CX - ww} ${wy}H${CX + ww}`, [6], p, fill, thread),
    })
  }
  if (o.drawstring) {
    const cord = o.cord ?? (p.dark || p.L < 0.5 ? '#EDEAE3' : shade(fab.hex, 0.15))
    for (const sd of [-1, 1]) {
      const x0 = CX + sd * 12
      const d = `M${x0} ${wy + wh * 0.5}C${x0 + sd * 20} ${wy + 70} ${x0 + sd * 2} ${wy + 110} ${x0 + sd * 18} ${wy + 150}`
      svg += circle(x0, wy + wh * 0.5, 5, { fill: p.inside, stroke: '#9EA2A8', 'stroke-width': 2 })
      svg += path(d, stroke(shade(cord, 0.25), 7)) + path(d, stroke(cord, 5))
      svg += circle(x0 + sd * 18, wy + 152, 6, {
        fill: cord,
        stroke: shade(cord, 0.3),
        'stroke-width': 1,
      })
    }
  }
  if (o.loops) {
    for (const x of [-ww + 34, -ww * 0.38, ww * 0.38, ww - 34])
      svg += piece(`M${CX + x - 7} ${wy - 4}h14v${wh + 12}h-14Z`, fab, {
        vol: false,
        lw: 1.4,
        under: stitchLine(
          `M${CX + x - 7} ${wy + 2}h14M${CX + x - 7} ${wy + wh + 2}h14`,
          thread,
          1.6,
          '3 2'
        ),
      })
  }
  if (o.waist !== 'elastic' && o.button !== false) {
    svg += o.metalBtn
      ? metalDot(CX, wy + wh / 2, 10, o.metalBtn) +
        circle(CX, wy + wh / 2, 4, { fill: shade(o.metalBtn, 0.3) })
      : button(CX, wy + wh / 2, 8, p.dark ? tint(fab.hex, 0.12) : shade(fab.hex, 0.12), {
          holes: 4,
        })
  }
  // Đường may khóa trước (chữ J)
  if (o.fly !== false) {
    const fy = cy - (o.flyGap ?? 60)
    svg += seam(`M${CX} ${wy + wh}V${fy + 22}`, p, 1.6)
    svg += stitchLine(
      `M${CX + 30} ${wy + wh + 2}V${fy - 10}Q${CX + 30} ${fy + 14} ${CX + 2} ${fy + 22}`,
      thread,
      1.8
    )
  }
  // Túi trước
  if (o.pockets === 'scoop' || o.pockets === 'slant') {
    for (const sd of [-1, 1]) {
      const a = [CX + sd * (ww - (o.pocketIn ?? 56)), wy + wh]
      const b = [CX + sd * (ww + (hw - ww) * 0.62), wy + wh + (o.pocketDepth ?? 96)]
      const d =
        o.pockets === 'scoop'
          ? `M${P(a)}Q${P([a[0] + sd * 6, b[1] - 6])} ${P(b)}`
          : `M${P(a)}L${P(b)}`
      svg += seam(d, p, 1.8)
      svg += path(d, { ...dashed(thread, 1.8), transform: `translate(${sd * 8} 2)` })
      if (o.rivets)
        svg += metalDot(a[0] + sd * 4, a[1] + 6, 4.5) + metalDot(b[0] - sd * 5, b[1] - 4, 4.5)
    }
    if (o.coin) {
      const x0 = CX - ww + 14
      const d = `M${x0} ${wy + wh + 8}h40v42h-40Z`
      svg += seam(d, p, 1.4) + stitchLine(`M${x0 + 4} ${wy + wh + 14}h32`, thread, 1.6)
    }
  }
  if (o.decor) svg += o.decor(c)
  return svg
}

// Chân váy
function skirt(fab, o, ctx) {
  const p = fab.p
  const wy = o.wy ?? 170
  const wh = o.wh ?? 36
  const ww = o.ww ?? 130
  const hy = o.hy ?? 860
  const hw = o.hw ?? 260
  const hc = o.hc ?? 18
  const bodyD = sym(
    [CX, wy],
    [
      ['L', CX - ww, wy],
      [
        'C',
        CX - ww - 18,
        wy + (hy - wy) * 0.3,
        CX - hw + (o.flare ?? 30),
        hy - (hy - wy) * 0.4,
        CX - hw,
        hy,
      ],
      ['Q', CX - hw * 0.5, hy + hc, CX, hy + hc],
    ]
  )
  const hemD = sym([CX - hw, hy], [['Q', CX - hw * 0.5, hy + hc, CX, hy + hc]], false)
  const c = { fab, p, wy, wh, ww, hy, hw, hc, bodyD, rnd: ctx.rnd }
  let under = o.hem === 'none' ? '' : edgeStitch(hemD, [16], p, fab.fill(0), o.thread)
  if (o.under) under += o.under(c)
  let svg = piece(bodyD, fab, {
    under,
    folds: o.folds
      ? o.folds(c)
      : [
          `M${CX - ww + 30} ${wy + wh + 40}Q${CX - hw * 0.55} ${(wy + hy) / 2} ${CX - hw * 0.7} ${hy - 10}`,
          `M${CX + 20} ${wy + wh + 80}Q${CX + 10} ${(wy + hy) / 2} ${CX + 30} ${hy}`,
          `M${CX + ww - 20} ${wy + wh + 40}Q${CX + hw * 0.5} ${(wy + hy) / 2} ${CX + hw * 0.62} ${hy}`,
        ],
    over: o.over ? o.over(c) : '',
    foldW: o.foldW ?? 12,
  })
  const wbD = `M${CX - ww} ${wy}H${CX + ww}L${CX + ww + 3} ${wy + wh}H${CX - ww - 3}Z`
  svg += piece(wbD, fab, {
    vol: false,
    under:
      edgeStitch(`M${CX - ww - 3} ${wy + wh}H${CX + ww + 3}`, [6], p, fab.fill(0), o.thread) +
      edgeStitch(`M${CX - ww} ${wy}H${CX + ww}`, [6], p, fab.fill(0), o.thread),
  })
  if (o.decor) svg += o.decor(c)
  return svg
}

// ============================================================ Túi, phụ kiện
const GOLD = '#C9A55A'
const SILVER = '#A9ADB3'
function metalRect(x, y, w, h, c = GOLD, rx = 4) {
  const f = once(`mg${c}`, () =>
    grad(
      [
        [0, tint(c, 0.5)],
        [0.5, c],
        [1, shade(c, 0.3)],
      ],
      [0, 0, 0, 1]
    )
  )
  return rect(x, y, w, h, { rx, fill: f, stroke: shade(c, 0.45), 'stroke-width': 1.2 })
}

const ACC = {
  tote(fab) {
    const p = fab.p
    const body = 'M190 410L610 410L626 872Q627 886 612 886L188 886Q173 886 174 872Z'
    let s = ''
    const handle = (dx, dy, col) =>
      strap(
        `M${262 + dx} 470C${262 + dx} ${130 + dy} ${538 + dx} ${130 + dy} ${538 + dx} 470`,
        40,
        col,
        p
      )
    s += handle(18, -16, shade(fab.hex, 0.12))
    s += piece(body, fab, {
      under: edgeStitch('M190 410L610 410', [26, 32], p, fab.fill(0)),
      folds: ['M250 520Q300 700 260 860', 'M520 470Q560 640 540 860', 'M200 840Q400 820 600 845'],
      foldW: 12,
    })
    s += path('M190 410Q400 424 610 410', stroke(p.line, 1.6))
    s += handle(0, 0, fab.hex)
    for (const x of [262, 538]) {
      s += piece(`M${x - 20} 404h40v104h-40Z`, fab, { vol: false })
      s += path(
        `M${x - 13} 440h26v58h-26ZM${x - 13} 440l26 58M${x + 13} 440l-26 58`,
        dashed(p.stitch, 1.6, '4 3')
      )
    }
    return s
  },
  crossbody(fab) {
    const p = fab.p
    let s = ''
    s += strap('M214 494C196 30 604 30 586 494', 14, fab.hex, p, { stitch: false })
    const body =
      'M206 470Q206 452 224 452L576 452Q594 452 594 470L598 752Q598 772 578 772L222 772Q202 772 202 752Z'
    s += piece(body, fab, { volV: false, folds: ['M230 740Q400 724 570 742'], foldW: 10 })
    s += path('M206 470Q200 600 202 752', stroke(p.line, 1.4))
    const flap =
      'M204 462Q204 448 222 448L578 448Q596 448 596 462L596 606Q596 664 540 664L260 664Q204 664 204 606Z'
    s += path(flap, {
      fill: '#000000',
      'fill-opacity': 0.18,
      filter: blur(5),
      transform: 'translate(2 8)',
    })
    s += piece(flap, fab, {
      under: edgeStitch(flap, [10], p, fab.hex),
      over: path('M240 470Q400 452 560 470', {
        ...stroke('#FFFFFF', 18),
        'stroke-opacity': 0.12,
        filter: blur(6),
      }),
    })
    s += circle(400, 628, 17, {
      fill: once('mgc', () =>
        radial([
          [0, tint(GOLD, 0.5)],
          [0.7, GOLD],
          [1, shade(GOLD, 0.3)],
        ])
      ),
      stroke: shade(GOLD, 0.45),
      'stroke-width': 1.4,
    })
    s += circle(400, 628, 9, { fill: 'none', stroke: shade(GOLD, 0.3), 'stroke-width': 1.4 })
    for (const x of [214, 586]) s += path(`M${x - 12} 466a12 12 0 0 1 24 0`, stroke(GOLD, 5))
    return s
  },
  backpack(fab) {
    const p = fab.p
    let s = ''
    const sc = shade(fab.hex, p.dark ? 0 : 0.18)
    s += strap('M262 300C196 420 186 620 232 830', 52, sc, p)
    s += strap('M538 300C604 420 614 620 568 830', 52, sc, p)
    s += strap('M362 236C362 150 438 150 438 236', 16, sc, p)
    const body = 'M234 330C234 214 566 214 566 330L584 844Q584 888 540 888L260 888Q216 888 216 844Z'
    s += piece(body, fab, {
      under: edgeStitch(body, [10], p, fab.fill(0)),
      folds: ['M260 420Q300 600 270 820', 'M540 400Q510 620 540 820'],
      foldW: 12,
    })
    const zipD = 'M240 372C240 252 560 252 560 372'
    s += path(zipD, stroke(shade(fab.hex, 0.2), 14)) + path(zipD, dashed('#8E9298', 8, '2.6 2.4'))
    s += metalRect(268, 296, 12, 34, SILVER, 4) + metalRect(520, 296, 12, 34, SILVER, 4)
    const pocket =
      'M282 600Q282 556 326 556L474 556Q518 556 518 600L526 806Q526 840 492 840L308 840Q274 840 274 806Z'
    s += path(pocket, {
      fill: '#000000',
      'fill-opacity': 0.16,
      filter: blur(5),
      transform: 'translate(2 6)',
    })
    s += piece(pocket, fab, { under: edgeStitch(pocket, [9], p, fab.fill(0)) })
    const pz = 'M300 612Q400 584 500 612'
    s += path(pz, stroke(shade(fab.hex, 0.2), 12)) + path(pz, dashed('#8E9298', 7, '2.6 2.4'))
    s += metalRect(472, 600, 10, 30, SILVER, 4)
    s += piece('M216 844L584 844Q584 888 540 888L260 888Q216 888 216 844Z', fab, {
      fill: shade(fab.hex, p.dark ? 0 : 0.1),
      vol: false,
    })
    return s
  },
  baguette(fab) {
    const p = fab.p
    let s = ''
    s += strap('M262 470C276 250 524 250 538 470', 22, fab.hex, p)
    for (const x of [262, 538])
      s += circle(x, 470, 13, { fill: 'none', stroke: GOLD, 'stroke-width': 6 })
    const body =
      'M168 560C168 470 236 456 400 456C564 456 632 470 632 560C632 660 600 704 400 704C200 704 168 660 168 560Z'
    s += piece(body, fab, { folds: ['M210 670Q400 690 590 668'], foldW: 10 })
    const flap = 'M172 540C176 478 238 462 400 462C562 462 624 478 628 540L606 600Q400 650 194 600Z'
    s += path(flap, {
      fill: '#000000',
      'fill-opacity': 0.2,
      filter: blur(5),
      transform: 'translate(2 7)',
    })
    s += piece(flap, fab, {
      under: edgeStitch(flap, [10], p, fab.hex),
      over: path('M230 490Q400 470 570 490', {
        ...stroke('#FFFFFF', 16),
        'stroke-opacity': 0.14,
        filter: blur(6),
      }),
    })
    s +=
      metalRect(372, 600, 56, 30, GOLD, 6) +
      rect(384, 608, 32, 14, {
        rx: 4,
        fill: 'none',
        stroke: shade(GOLD, 0.35),
        'stroke-width': 1.4,
      })
    return s
  },
  bucket(fab) {
    const p = fab.p
    let s = ''
    s += strap('M226 420C236 80 564 80 574 420', 16, fab.hex, p)
    const body = 'M212 410C204 600 222 780 234 846A166 40 0 0 0 566 846C578 780 596 600 588 410Z'
    s += piece(body, fab, {
      folds: range(7).map(
        (i) => `M${250 + i * 50} 430Q${256 + i * 50 + (i % 2 ? 8 : -8)} 490 ${252 + i * 50} 540`
      ),
      foldW: 7,
      under: edgeStitch('M222 780Q400 820 578 780', [0.1], p, fab.hex),
    })
    s += path('M230 790Q400 836 572 790', stroke(p.line, 1.6))
    s += ellipse(400, 410, 188, 34, { fill: p.inside, stroke: p.line, 'stroke-width': 2 })
    s += path('M212 410C240 440 560 440 588 410', stroke(p.line, 1.6))
    for (let i = 0; i < 8; i++) {
      const t = (i + 0.5) / 8
      const x = 228 + t * 344
      const y = 446 + Math.sin(t * Math.PI) * 26
      s += circle(x, y, 7, { fill: p.inside, stroke: GOLD, 'stroke-width': 3 })
    }
    const cord = p.dark ? '#D9D3C6' : shade(fab.hex, 0.25)
    const c1 = 'M384 470C372 520 362 560 352 610'
    const c2 = 'M414 470C424 520 436 570 448 630'
    s += path(c1, stroke(shade(cord, 0.3), 8)) + path(c1, stroke(cord, 6))
    s += path(c2, stroke(shade(cord, 0.3), 8)) + path(c2, stroke(cord, 6))
    s += circle(399, 470, 11, { fill: cord, stroke: shade(cord, 0.3), 'stroke-width': 1.4 })
    s += metalRect(342, 606, 20, 26, GOLD, 6) + metalRect(438, 626, 20, 26, GOLD, 6)
    return s
  },
  wallet(fab) {
    const p = fab.p
    let s = ''
    const body =
      'M194 404Q194 380 218 380L600 380Q624 380 624 404L624 676Q624 700 600 700L218 700Q194 700 194 676Z'
    s += path('M200 690L620 690L620 712Q620 724 600 724L220 724Q200 724 200 712Z', {
      fill: shade(fab.hex, 0.25),
    })
    s += piece(body, fab, {
      under: edgeStitch(body, [13], p, fab.hex),
      over: path('M200 390Q190 540 200 690', {
        ...stroke('#FFFFFF', 16),
        'stroke-opacity': 0.18,
        filter: blur(6),
      }),
    })
    const tab =
      'M524 470Q524 456 538 456L640 456Q664 456 664 480L664 584Q664 608 640 608L538 608Q524 608 524 594Z'
    s += path(tab, {
      fill: '#000000',
      'fill-opacity': 0.18,
      filter: blur(4),
      transform: 'translate(-2 5)',
    })
    s += piece(tab, fab, { under: edgeStitch(tab, [8], p, fab.hex) })
    s += circle(612, 532, 17, {
      fill: once('mgw', () =>
        radial([
          [0, tint(SILVER, 0.5)],
          [0.7, SILVER],
          [1, shade(SILVER, 0.3)],
        ])
      ),
      stroke: shade(SILVER, 0.45),
      'stroke-width': 1.2,
    })
    s += circle(612, 532, 7, { fill: 'none', stroke: shade(SILVER, 0.3), 'stroke-width': 1.4 })
    return g({ transform: 'rotate(-6 400 540)' }, s)
  },
  // Mũ lưỡi trai nhìn chéo 3/4, lưỡi trai chĩa về phía trước bên phải
  cap(fab) {
    const p = fab.p
    let s = ''
    const crown = 'M168 604C150 420 250 280 380 272C520 266 612 380 606 556Q390 648 168 604Z'
    s += piece(crown, fab, {
      over:
        seam('M382 274C430 340 474 460 492 610', p, 1.8) +
        stitchLine('M374 278C420 344 462 462 480 612', p.stitch, 1.5) +
        stitchLine('M390 276C440 340 486 458 504 606', p.stitch, 1.5) +
        seam('M382 274C330 350 300 470 300 622', p, 1.6) +
        seam('M382 274C270 330 204 450 190 600', p, 1.6) +
        path('M168 604Q390 648 606 556', stroke(p.line, 2)),
      folds: ['M250 380Q232 480 246 580'],
      foldW: 10,
    })
    for (const [x, y] of [
      [262, 392],
      [436, 372],
    ])
      s += circle(x, y, 8, { fill: p.inside, stroke: p.stitch, 'stroke-width': 2.4 })
    s +=
      circle(382, 274, 14, { fill: fab.hex, stroke: p.line, 'stroke-width': 1.6 }) +
      circle(378, 269, 4, { fill: '#FFFFFF', 'fill-opacity': 0.3 })
    const brim =
      'M312 606C400 624 540 600 610 552C684 558 748 612 738 664C704 716 566 732 452 708C380 692 330 662 318 612Z'
    s += path(brim, {
      fill: '#000000',
      'fill-opacity': 0.22,
      filter: blur(6),
      transform: 'translate(2 10)',
    })
    s += path(brim, { fill: shade(fab.hex, p.dark ? 0 : 0.18), transform: 'translate(0 6)' })
    s += piece(brim, fab, {
      volV: true,
      under: edgeStitch(brim, [12, 24, 36, 48], p, fab.fill(0)),
    })
    return s
  },
  bucketHat(fab) {
    const p = fab.p
    let s = ''
    const crown = 'M262 360Q266 316 314 312L486 312Q534 316 538 360L556 540L244 540Z'
    s += piece(crown, fab, {
      over:
        seam('M400 314V540', p, 1.4) +
        range(4)
          .map((i) =>
            stitchLine(
              `M${256 - i * 2} ${420 + i * 30}L${544 + i * 2} ${420 + i * 30}`,
              p.stitch,
              1.4
            )
          )
          .join(''),
      folds: ['M300 330Q290 430 296 520'],
    })
    s += ellipse(400, 322, 112, 14, {
      fill: tint(fab.hex, p.dark ? 0.08 : 0.2),
      stroke: p.line,
      'stroke-width': 1.6,
    })
    for (const x of [284, 516])
      s += circle(x, 380, 7, { fill: p.inside, stroke: SILVER, 'stroke-width': 3 })
    const brim =
      'M250 528C176 556 126 616 116 664C260 716 540 716 684 664C674 616 624 556 550 528Q400 552 250 528Z'
    s += path(brim, {
      fill: '#000000',
      'fill-opacity': 0.2,
      filter: blur(6),
      transform: 'translate(0 8)',
    })
    s += piece(brim, fab, {
      volV: true,
      over: range(6)
        .map((i) =>
          stitchLine(
            `M${136 + i * 22} ${658 - i * 20}C${280 + i * 12} ${700 - i * 22} ${520 - i * 12} ${700 - i * 22} ${664 - i * 22} ${658 - i * 20}`,
            p.stitch,
            1.5
          )
        )
        .join(''),
    })
    return s
  },
  belt(fab) {
    const p = fab.p
    const P0 = [214, 300]
    const P1 = [720, 240]
    const P2 = [80, 760]
    const P3 = [600, 760]
    const bez = (t) => {
      const u = 1 - t
      return [0, 1].map(
        (k) => u * u * u * P0[k] + 3 * u * u * t * P1[k] + 3 * u * t * t * P2[k] + t * t * t * P3[k]
      )
    }
    const d = `M${P(P0)}C${P(P1)} ${P(P2)} ${P(P3)}`
    let s = ''
    s += path(d, {
      ...stroke('#4A3E30', 66),
      'stroke-opacity': 0.22,
      filter: blur(9),
      transform: 'translate(6 12)',
    })
    s += path(d, stroke(p.line, 66))
    s += path(d, stroke(fab.hex, 63))
    s += path(d, dashed(p.stitch, 50, '7 5'))
    s += path(d, stroke(fab.hex, 46, { 'stroke-linecap': 'butt' }))
    s += path(d, {
      ...stroke('#FFFFFF', 18),
      'stroke-opacity': 0.12,
      transform: 'translate(-3 -4)',
    })
    // Lỗ khóa gần đuôi
    for (const t of [0.8, 0.835, 0.87, 0.905, 0.94]) {
      const q = bez(t)
      s += ellipse(q[0], q[1], 5.5, 5.5, {
        fill: shade(fab.hex, 0.6),
        stroke: tint(fab.hex, 0.2),
        'stroke-width': 1,
      })
    }
    // Đai giữ dây và khóa kim ở đầu
    const tan = unit(sub(bez(0.02), P0))
    const ang = Math.atan2(tan[1], tan[0]) / DEG
    const kp = bez(0.07)
    s += g(
      { transform: `translate(${P(kp)}) rotate(${r2(ang)})` },
      rect(-10, -38, 20, 76, { rx: 4, fill: fab.hex, stroke: p.line, 'stroke-width': 1.6 }) +
        rect(-10, -38, 20, 76, { rx: 4, fill: VOL() })
    )
    s += g(
      { transform: `translate(${P(P0)}) rotate(${r2(ang)})` },
      rect(-58, -46, 76, 92, {
        rx: 16,
        fill: 'none',
        stroke: shade(SILVER, 0.45),
        'stroke-width': 13,
      }) +
        rect(-58, -46, 76, 92, {
          rx: 16,
          fill: 'none',
          stroke: once('mgs', () =>
            grad(
              [
                [0, tint(SILVER, 0.6)],
                [0.5, SILVER],
                [1, shade(SILVER, 0.3)],
              ],
              [0, 0, 0, 1]
            )
          ),
          'stroke-width': 10,
        }) +
        path('M-58 0H28', stroke(shade(SILVER, 0.45), 8)) +
        path('M-58 0H28', stroke(SILVER, 5))
    )
    return s
  },
  socks(fab) {
    const p = fab.p
    const sock = () => {
      const d =
        'M-56 -270L56 -270L56 60C60 96 90 120 140 138L186 156C240 178 244 252 186 254L-8 254C-64 254 -74 192 -56 140Z'
      const heel = 'M-56 120C-76 190 -64 254 -8 254L36 254C26 200 -2 156 -56 106Z'
      const toe = 'M150 142L186 156C240 178 244 252 186 254L150 254C170 220 168 170 150 142Z'
      const cuff = ribQuad([-56, -270], [56, -270], [-56, -170], [56, -170], fab, {
        n: 16,
        vol: false,
      })
      return (
        piece(d, fab, {
          under:
            path(heel, { fill: shade(fab.hex, p.dark ? 0 : 0.06) }) +
            path(toe, { fill: shade(fab.hex, p.dark ? 0 : 0.06) }),
          over: seam(heel, p, 1.2) + seam(toe, p, 1.2),
          folds: ['M-30 -120Q-20 0 -36 100', 'M30 -40Q36 40 60 90'],
          foldW: 7,
        }) + cuff
      )
    }
    return [
      [250, 470, -6],
      [390, 500, 0],
      [530, 530, 6],
    ]
      .map(([x, y, a]) => g({ transform: `translate(${x} ${y}) rotate(${a}) scale(1.08)` }, sock()))
      .join('')
  },
  scarf(fab, ctx) {
    const p = fab.p
    const border = ctx.scarfBorder
    let s = ''
    const sq = 'M130 210L670 210L670 750L130 750Z'
    const folded = 'M130 210L670 210L670 530L450 750L130 750Z'
    s += piece(folded, fab, {
      under:
        path('M130 210L670 210L670 750L130 750ZM180 260V700H620V260Z', {
          fill: border,
          'fill-rule': 'evenodd',
        }) + path('M190 270H610V690H190Z', stroke(border, 3)),
      folds: ['M200 300Q400 360 600 330', 'M180 600Q400 520 560 620'],
      foldW: 14,
      over: sheen(sq, ['M150 640L520 230'], 0.12, 70),
    })
    // Góc gấp lộ mặt trái
    const back = 'M670 530L450 750L612 704Z'
    s += path(back, {
      fill: '#000000',
      'fill-opacity': 0.2,
      filter: blur(5),
      transform: 'translate(-4 -4)',
    })
    s += piece(back, fab, { fill: tint(border, 0.35), vol: true })
    s += stitchLine('M666 540L460 746', p.stitch, 1.2, '2 3')
    return s
  },
}

// ============================================================ Ảnh cận chất liệu
const CLOSE = {
  knitStripe(fab) {
    const base = fab.hex
    const stripe = fab.ex.stripe
    let s = ''
    s += rect(0, 0, W, H, { fill: base })
    for (let y = -30; y < H; y += 150) s += rect(0, y, W, 58, { fill: stripe })
    const id = newId('pt')
    defs.push(
      el(
        'pattern',
        {
          id,
          patternUnits: 'userSpaceOnUse',
          width: 20,
          height: 18,
          patternTransform: 'rotate(-4)',
        },
        path('M2 2L10 15L18 2', stroke('#000000', 2.6, { 'stroke-opacity': 0.12 })) +
          path('M3 1L10 12L17 1', stroke('#FFFFFF', 1.3, { 'stroke-opacity': 0.35 }))
      )
    )
    s += rect(0, 0, W, H, { fill: `url(#${id})` })
    s += path('M-40 300C200 360 500 200 860 330', {
      ...stroke('#000000', 70),
      'stroke-opacity': 0.1,
      filter: blur(26),
    })
    s += path('M-40 250C200 310 500 150 860 280', {
      ...stroke('#FFFFFF', 50),
      'stroke-opacity': 0.18,
      filter: blur(22),
    })
    // Gấu áo may hai kim
    s += path('M0 860L800 860L800 1000L0 1000Z', { fill: '#E9E5DE' })
    s += path('M0 870H800', { ...stroke('#000000', 20), 'stroke-opacity': 0.15, filter: blur(8) })
    s += rect(0, 700, W, 160, { fill: 'none' })
    s +=
      stitchLine('M0 812H800', shade(base, 0.4), 2.2, '9 6') +
      stitchLine('M0 828H800', shade(base, 0.4), 2.2, '9 6')
    s += path('M0 858H800', stroke(shade(base, 0.3), 2))
    return s
  },
  denim(fab) {
    const base = fab.hex
    const p = fab.p
    let s = rect(0, 0, W, H, { fill: base })
    const id = newId('pt')
    defs.push(
      el(
        'pattern',
        { id, patternUnits: 'userSpaceOnUse', width: 16, height: 16 },
        path(
          'M0 16L16 0M-4 4L4 -4M12 20L20 12',
          stroke(tint(base, p.dark ? 0.2 : 0.32), 4, {
            'stroke-linecap': 'butt',
            'stroke-opacity': 0.7,
          })
        ) +
          path(
            'M8 16L16 8M0 8L8 0',
            stroke(shade(base, 0.2), 1.6, { 'stroke-linecap': 'butt', 'stroke-opacity': 0.5 })
          )
      )
    )
    s += rect(0, 0, W, H, { fill: `url(#${id})` })
    const rnd = mulberry32(hashStr('slub' + base))
    let sl = ''
    for (let i = 0; i < 70; i++) {
      const x = rnd() * W
      const y = rnd() * H
      sl += `M${r2(x)} ${r2(y)}v${r2(30 + rnd() * 90)}`
    }
    s += path(sl, { ...stroke(tint(base, 0.4), 2), 'stroke-opacity': 0.35 })
    s += ellipse(260, 380, 260, 330, {
      fill: tint(base, 0.4),
      'fill-opacity': 0.35,
      filter: blur(60),
    })
    // Mép túi trước: đường cong may hai đường chỉ vàng + đinh tán
    const thread = '#D2A04C'
    const edge = 'M380 -20C420 260 600 420 830 470'
    s += path(edge + 'L830 -20Z', { fill: shade(base, 0.08), 'fill-opacity': 0.5 })
    s += path(edge, {
      ...stroke('#000000', 16),
      'stroke-opacity': 0.25,
      filter: blur(6),
      transform: 'translate(4 8)',
    })
    s += path(edge, stroke(shade(base, 0.3), 3))
    s += path(edge, { ...dashed(thread, 3.2, '11 6'), transform: 'translate(-10 16)' })
    s += path(edge, { ...dashed(thread, 3.2, '11 6'), transform: 'translate(-22 32)' })
    s += stitchLine('M0 880C260 860 540 870 800 890', thread, 3.2, '11 6')
    s += stitchLine('M0 900C260 880 540 890 800 910', thread, 3.2, '11 6')
    s += metalDot(724, 452, 18)
    s += circle(724, 452, 8, { fill: 'none', stroke: shade('#B87B3E', 0.35), 'stroke-width': 2 })
    return s
  },
  canvas(fab) {
    const base = fab.hex
    let s = rect(0, 0, W, H, { fill: base })
    const id = newId('pt')
    const dk = shade(base, 0.14)
    const lt = tint(base, 0.4)
    defs.push(
      el(
        'pattern',
        { id, patternUnits: 'userSpaceOnUse', width: 20, height: 20 },
        // Đan rổ: mỗi ô 10×10 có hai sợi nằm ngang hoặc dọc, xen kẽ như bàn cờ
        rect(0, 0, 20, 20, { fill: dk }) +
          [
            [0, 0, 'h'],
            [10, 0, 'v'],
            [0, 10, 'v'],
            [10, 10, 'h'],
          ]
            .map(([x, y, dir]) =>
              [0, 1]
                .map((k) =>
                  dir === 'h'
                    ? rect(x + 0.6, y + 0.6 + k * 4.8, 8.8, 4, { rx: 2, fill: k ? base : lt })
                    : rect(x + 0.6 + k * 4.8, y + 0.6, 4, 8.8, { rx: 2, fill: k ? base : lt })
                )
                .join('')
            )
            .join('')
      )
    )
    s += rect(0, 0, W, H, { fill: `url(#${id})` })
    s += ellipse(300, 400, 300, 360, { fill: '#FFFFFF', 'fill-opacity': 0.2, filter: blur(60) })
    // Quai túi may chéo chữ X
    const sx = 480
    const sw = 150
    const strapC = shade(base, 0.06)
    s += rect(sx + 6, -10, sw, 640, { fill: '#000000', 'fill-opacity': 0.18, filter: blur(10) })
    s += rect(sx, -10, sw, 630, { fill: `url(#${id})` })
    s += rect(sx, -10, sw, 630, { fill: strapC, 'fill-opacity': 0.35 })
    s += rect(sx, -10, sw, 630, { fill: 'none', stroke: shade(base, 0.3), 'stroke-width': 2 })
    const t = shade(base, 0.4)
    s += stitchLine(`M${sx + 14} -10V610M${sx + sw - 14} -10V610`, t, 2.4, '10 6')
    s += path(
      `M${sx + 22} 420H${sx + sw - 22}V590H${sx + 22}ZM${sx + 22} 420L${sx + sw - 22} 590M${sx + sw - 22} 420L${sx + 22} 590`,
      dashed(t, 2.4, '8 5')
    )
    // Mép miệng túi gấp
    s += rect(0, 120, W, 6, { fill: '#000000', 'fill-opacity': 0.12, filter: blur(4) })
    s += stitchLine('M0 96H480M630 96H800', t, 2.4, '10 6')
    return s
  },
}

// ============================================================ Cấu hình từng sản phẩm
const TEE_SLEEVE = { ang: 33, L: 150, wE: 124, cuff: { kind: 'hem' } }
const contrastOf = (hex) => (luma(hex) < 0.3 ? '#EFE9DD' : '#2A2A2A')

const PRODUCTS = {
  AT001: {
    fit: [510, 1.08],
    mold: 'top',
    o: () => ({ sy: 220, hy: 800, neck: neckCrew(), hem: 'stitch', sleeve: TEE_SLEEVE }),
  },
  AT002: {
    fit: [510, 1.08],
    mold: 'top',
    o: () => ({
      sy: 220,
      hy: 800,
      sw: 170,
      aw: 154,
      ww: 146,
      hw: 154,
      nw: 58,
      neck: neckV(),
      hem: 'stitch',
      sleeve: { ang: 36, L: 132, wE: 110 },
    }),
  },
  AT003: {
    fit: [516, 1.06],
    mold: 'top',
    o: (fab) => ({
      sy: 220,
      hy: 812,
      sw: 222,
      slope: 36,
      aw: 200,
      ay: 450,
      nw: 64,
      neck: neckCrew(42, 10),
      hem: 'stitch',
      sleeve: { ang: 44, L: 150, wE: 144, cuff: { kind: 'hem' } },
      decor: () => {
        const ink = contrastOf(fab.hex)
        return g(
          { opacity: 0.92 },
          circle(400, 380, 34, { fill: 'none', stroke: ink, 'stroke-width': 7 }) +
            path('M320 450Q340 436 360 450T400 450T440 450T480 450', stroke(ink, 7)) +
            path('M336 478Q352 466 368 478T400 478T432 478T464 478', stroke(ink, 6)) +
            path('M400 330V338M400 422V430M350 380H358M442 380H450', stroke(ink, 5))
        )
      },
    }),
  },
  AT004: {
    fit: [510, 1.08],
    mold: 'top',
    fabric: 'pique',
    o: (fab) => {
      const btn = fab.p.dark ? tint(fab.hex, 0.1) : shade(fab.hex, 0.06)
      return {
        sy: 220,
        hy: 800,
        nw: 56,
        hem: 'stitch',
        sleeve: { ang: 34, L: 140, wE: 116, cuff: { kind: 'rib', len: 28 } },
        decor: (c) =>
          placket(c, c.sy + 30, c.sy + 170, { btn, n: 3, first: c.sy + 70, step: 40, w: 34 }) +
          path(
            `M${CX - c.hw + 1} ${c.hy - 50}l6 50M${CX + c.hw - 1} ${c.hy - 50}l-6 50`,
            stroke(c.p.line, 1.6)
          ),
        neck: (c) => shirtCollar(c, { tipY: 74, tipX: 64, standH: 22, fill: c.p.rib }),
      }
    },
  },
  AT005: {
    fit: [510, 1.06],
    mold: 'top',
    fabric: 'stripeH',
    close: 'knitStripe',
    o: () => ({
      sy: 220,
      hy: 800,
      nw: 92,
      neck: neckCrew(22, 9, { bandFill: '#F7F6F2', rib: false, label: false }),
      hem: 'stitch',
      sleeve: { ang: 62, L: 290, wE: 82, cuff: { kind: 'hem' } },
    }),
  },
  AT006: {
    fit: [508, 1.04],
    mold: 'top',
    o: (fab) => ({
      sy: 210,
      hy: 806,
      raglan: true,
      neck: neckCrew(44, 9),
      hem: 'stitch',
      sleeveFab: fabric('solid', shade(fab.hex, 0.5)),
      sleeve: { ang: 72, L: 430, wE: 70, cuff: { kind: 'rib', len: 44 } },
    }),
  },
  AT007: {
    fit: [504, 1.08],
    mold: 'top',
    o: () => ({
      sy: 196,
      hy: 812,
      nw: 74,
      aw: 160,
      ay: 430,
      A: [CX - 74 - 40, 194],
      armSeg: (A, B) => ['C', A[0] + 2, A[1] + 120, B[0] + 50, B[1] - 24, B[0], B[1]],
      neck: neckCrew(118, 8, { label: false }),
      hem: 'stitch',
      binding: (c) =>
        `M${P(c.A)}C${c.A[0] + 2} ${c.A[1] + 120} ${c.B[0] + 50} ${c.B[1] - 24} ${P(c.B)}M${2 * CX - c.A[0]} ${c.A[1]}C${2 * CX - c.A[0] - 2} ${c.A[1] + 120} ${2 * CX - c.B[0] - 50} ${c.B[1] - 24} ${2 * CX - c.B[0]} ${c.B[1]}`,
    }),
  },
  AT008: {
    fit: [460, 1.25],
    mold: 'top',
    o: () => ({
      sy: 300,
      hy: 620,
      sw: 166,
      aw: 148,
      ww: 140,
      hw: 146,
      ay: 470,
      nw: 58,
      hc: 4,
      neck: neckCrew(40, 7),
      hem: 'stitch',
      sleeve: { ang: 34, L: 112, wE: 100 },
    }),
  },
  AT009: {
    fit: [512, 1.06],
    mold: 'top',
    fabric: 'linen',
    o: () => ({
      sy: 220,
      hy: 806,
      sw: 190,
      aw: 176,
      hw: 180,
      neck: neckCrew(44, 5, { rib: false }),
      hem: 'stitch',
      sleeve: { ang: 32, L: 156, wE: 128 },
    }),
  },
  AT010: {
    fit: [510, 1.08],
    mold: 'top',
    fabric: 'linen',
    o: (fab) => ({
      sy: 220,
      hy: 800,
      neck: neckCrew(40, 8),
      hem: 'stitch',
      sleeve: { ang: 34, L: 138, wE: 124, cuff: { kind: 'roll', len: 32 } },
      decor: (c) =>
        placket(c, c.sy + 38, c.sy + 160, {
          n: 3,
          first: c.sy + 64,
          step: 38,
          w: 32,
          btnFn: (x, y) => button(x, y, 7.5, fab.p.dark ? '#B98A5C' : '#9C6B3F', { holes: 2 }),
        }),
    }),
  },
  SM001: { mold: 'shirt', o: () => ({ buttonDown: true }) },
  SM002: {
    mold: 'shirt',
    fabric: 'pin',
    o: () => ({ decor: (c) => chestPocket(c, CX + 92, c.sy + 140, {}) }),
  },
  SM003: { mold: 'shirt', o: () => ({ collar: 'mandarin', top: { tail: 46, hc: 34 } }) },
  SM004: {
    mold: 'shirt',
    o: () => ({
      tipY: 64,
      tipX: 60,
      top: {
        sw: 170,
        aw: 156,
        hw: 160,
        ww: 148,
        hy: 790,
        tail: 18,
        hc: 14,
        sleeve: {
          ang: 70,
          L: 400,
          wE: 72,
          bulge: 40,
          ibulge: 26,
          gather: true,
          cuff: { kind: 'elastic', len: 34 },
          foldW: 10,
        },
      },
    }),
  },
  SM005: {
    mold: 'shirt',
    fabric: 'denim',
    o: (fab) => {
      const thread = '#C99A4A'
      const snap = (x, y) =>
        circle(x, y, 7, { fill: '#E9E4D8', stroke: '#9A958A', 'stroke-width': 2 }) +
        circle(x - 2, y - 2, 2, { fill: '#FFFFFF' })
      return {
        stitch: thread,
        btn: '#E9E4D8',
        decor: (c) =>
          chestPocket(c, CX - 92, c.sy + 128, { flap: true, snap, stitch: thread }) +
          chestPocket(c, CX + 92, c.sy + 128, { flap: true, snap, stitch: thread }) +
          stitchLine(
            `M${CX - c.sw + 16} ${c.sy + 64}Q${CX} ${c.sy + 86} ${CX + c.sw - 16} ${c.sy + 64}`,
            thread,
            1.8
          ) +
          seam(
            `M${CX - c.sw + 16} ${c.sy + 58}Q${CX} ${c.sy + 80} ${CX + c.sw - 16} ${c.sy + 58}`,
            fab.p,
            1.4
          ),
      }
    },
  },
  SM006: {
    fit: [505, 1.06],
    mold: 'top',
    o: (fab) => {
      const btn = fab.p.dark ? tint(fab.hex, 0.12) : shade(fab.hex, 0.12)
      return {
        sy: 220,
        hy: 790,
        nw: 58,
        sw: 200,
        slope: 30,
        aw: 186,
        hw: 188,
        hc: 4,
        hem: 'stitch',
        sleeve: { ang: 30, L: 140, wE: 146, cuff: { kind: 'hem', offs: [22] } },
        decor: (c) =>
          range(4)
            .map((i) => button(CX + 2, c.sy + 214 + i * 100, 7, btn, { holes: 2 }))
            .join('') + seam(`M${CX + 18} ${c.sy + 176}V${c.hy + c.hc - 2}`, c.p, 1.6),
        neck: (c) => {
          const { sy, nw, nsY, p } = c
          const vb = sy + 176
          let s = path(
            `M${CX - nw} ${nsY}Q${CX} ${sy + 8} ${CX + nw} ${nsY}L${CX + 18} ${vb}L${CX - 6} ${vb}Z`,
            { fill: p.inside, stroke: p.line, 'stroke-width': 1.6 }
          )
          const leaf = (sd) => {
            const d = `M${CX + sd * (nw - 4)} ${nsY - 4}L${CX + sd * (nw + 74)} ${sy + 86}L${CX + sd * (nw + 30)} ${sy + 100}L${CX + sd * (sd > 0 ? 18 : -6)} ${vb}Z`
            return piece(d, fab, {
              over: stitchLine(
                `M${CX + sd * (nw + 58)} ${sy + 92}L${CX + sd * (nw + 26)} ${sy + 104}`,
                p.stitch,
                1.3
              ),
              folds: [`M${CX + sd * (nw + 10)} ${sy + 20}L${CX + sd * 30} ${vb - 30}`],
              foldW: 6,
            })
          }
          s += leaf(-1) + leaf(1)
          return s
        },
      }
    },
  },
  SM007: {
    mold: 'shirt',
    o: (fab) => ({
      btn: fab.hex,
      decor: (c) =>
        sheen(
          c.bodyD,
          [
            `M${CX - 140} ${c.sy + 60}Q${CX - 90} ${c.sy + 300} ${CX - 120} ${c.hy}`,
            `M${CX + 70} ${c.sy + 140}Q${CX + 120} ${c.sy + 360} ${CX + 90} ${c.hy}`,
          ],
          0.3,
          40
        ),
    }),
  },
  SM008: {
    mold: 'shirt',
    fabric: 'plaid',
    o: (fab) => ({
      btn: shade(fab.hex, 0.4),
      decor: (c) =>
        chestPocket(c, CX - 92, c.sy + 132, {
          flap: true,
          fill: fab.fill(45),
          snap: (x, y) => button(x, y, 6, shade(fab.hex, 0.4), { holes: 2 }),
        }) +
        chestPocket(c, CX + 92, c.sy + 132, {
          flap: true,
          fill: fab.fill(45),
          snap: (x, y) => button(x, y, 6, shade(fab.hex, 0.4), { holes: 2 }),
        }),
    }),
  },
  SM009: {
    mold: 'shirt',
    o: () => ({
      collar: 'bow',
      top: {
        sw: 172,
        aw: 158,
        hw: 162,
        ww: 150,
        hy: 790,
        tail: 10,
        hc: 10,
        hem: 'stitch',
        sleeve: {
          ang: 72,
          L: 410,
          wE: 72,
          bulge: 22,
          ibulge: 10,
          cuff: { kind: 'band', len: 54, button: '#F4F1EA' },
        },
      },
    }),
  },
  AK001: {
    mold: 'top',
    o: (fab) => {
      const stripeC = fab.p.dark ? '#B9A57E' : contrastOf(fab.hex)
      const stripes = [
        [0.3, 0.4, stripeC],
        [0.56, 0.66, stripeC],
      ]
      return {
        sy: 210,
        hy: 806,
        sw: 196,
        aw: 186,
        hw: 172,
        nw: 64,
        hc: 2,
        hem: 'rib',
        ribH: 52,
        ribStripes: stripes,
        sleeve: {
          ang: 73,
          L: 430,
          wE: 80,
          bulge: 20,
          ibulge: 8,
          cuff: { kind: 'rib', len: 52, stripes },
          foldW: 12,
        },
        decor: (c) =>
          zipper(CX, c.sy + 36, c.hy - 52, shade(fab.hex, 0.15)) +
          sheen(
            c.bodyD,
            [`M${CX - 120} ${c.sy + 80}Q${CX - 140} ${c.sy + 300} ${CX - 110} ${c.hy - 60}`],
            0.22,
            50
          ) +
          [-1, 1]
            .map((sd) => {
              const d = `M${CX + sd * 70} ${c.hy - 210}L${CX + sd * 120} ${c.hy - 92}`
              return path(d, stroke(c.p.line, 14)) + path(d, stroke(shade(fab.hex, 0.25), 10))
            })
            .join(''),
        neck: (c) => {
          const { sy, nw, nsY } = c
          const a1 = [CX - nw - 6, nsY - 4]
          const b1 = [CX - nw + 12, nsY + 42]
          const a2 = [CX - 4, sy + 10]
          const b2 = [CX - 4, sy + 48]
          const back = `M${CX - nw - 6} ${nsY - 2}Q${CX} ${sy - 30} ${CX + nw + 6} ${nsY - 2}L${CX + nw - 10} ${nsY + 10}Q${CX} ${sy - 2} ${CX - nw + 10} ${nsY + 10}Z`
          const band = ribQuad(a1, a2, b1, b2, fab, { n: 14, stripes: [[0.62, 0.74, stripeC]] })
          return piece(back, fab, { fill: c.p.inside, vol: false }) + band + mirror(band)
        },
      }
    },
  },
  AK002: {
    mold: 'top',
    fabric: 'denim',
    o: (fab) => {
      const thread = '#C99A4A'
      const copper = '#B87B3E'
      const btnFn = (x, y) =>
        metalDot(x, y, 9, copper) + circle(x, y, 4, { fill: shade(copper, 0.3) })
      return {
        sy: 220,
        hy: 700,
        sw: 192,
        aw: 180,
        hw: 176,
        nw: 58,
        hc: 2,
        sleeve: { ang: 74, L: 420, wE: 84, bulge: 10, cuff: { kind: 'band', len: 44 } },
        decor: (c) => {
          let s = ''
          s += seam(
            `M${CX - c.sw + 10} ${c.sy + 82}L${CX - 60} ${c.sy + 100}L${CX} ${c.sy + 86}L${CX + 60} ${c.sy + 100}L${CX + c.sw - 10} ${c.sy + 82}`,
            c.p,
            1.8
          )
          s += stitchLine(
            `M${CX - c.sw + 10} ${c.sy + 92}L${CX - 60} ${c.sy + 110}L${CX} ${c.sy + 96}L${CX + 60} ${c.sy + 110}L${CX + c.sw - 10} ${c.sy + 92}`,
            thread,
            1.8
          )
          for (const sd of [-1, 1]) {
            s += seam(`M${CX + sd * 92} ${c.sy + 210}V${c.hy - 50}`, c.p, 1.6)
            s += stitchLine(`M${CX + sd * 100} ${c.sy + 210}V${c.hy - 50}`, thread, 1.8)
          }
          s += chestPocket(c, CX - 92, c.sy + 130, {
            flap: true,
            w: 80,
            h: 70,
            stitch: thread,
            snap: btnFn,
          })
          s += chestPocket(c, CX + 92, c.sy + 130, {
            flap: true,
            w: 80,
            h: 70,
            stitch: thread,
            snap: btnFn,
          })
          const wb = `M${CX - c.hw} ${c.hy - 50}H${CX + c.hw}V${c.hy + 2}H${CX - c.hw}Z`
          s += piece(wb, fab, {
            vol: false,
            under: edgeStitch(
              `M${CX - c.hw} ${c.hy - 50}H${CX + c.hw}`,
              [7],
              c.p,
              fab.fill(0),
              thread
            ),
          })
          s += placket(c, c.sy + 40, c.hy + 2, {
            n: 5,
            first: c.sy + 62,
            step: 104,
            w: 36,
            stitch: thread,
            btnFn,
          })
          for (const sd of [-1, 1]) s += btnFn(CX + sd * (c.hw - 40), c.hy - 24)
          return s
        },
        neck: (c) => shirtCollar(c, { tipY: 104, tipX: 76, standH: 26 }),
      }
    },
  },
  AK003: {
    mold: 'top',
    o: (fab) => ({
      sy: 236,
      hy: 830,
      sw: 194,
      aw: 180,
      hw: 166,
      nw: 64,
      hc: 2,
      hem: 'rib',
      ribH: 54,
      behind: hoodBehind(),
      sleeve: {
        ang: 74,
        L: 420,
        wE: 80,
        bulge: 14,
        ibulge: 6,
        cuff: { kind: 'rib', len: 54 },
        foldW: 12,
      },
      decor: (c) => {
        const d = `M${CX - 150} ${c.hy - 54}L${CX - 118} ${c.hy - 236}Q${CX} ${c.hy - 250} ${CX + 118} ${c.hy - 236}L${CX + 150} ${c.hy - 54}Z`
        return (
          path(d, {
            fill: '#000000',
            'fill-opacity': 0.12,
            filter: blur(4),
            transform: 'translate(2 5)',
          }) +
          piece(d, fab, {
            under: edgeStitch(d, [8], c.p, fab.hex),
            over: [-1, 1]
              .map((sd) =>
                seam(`M${CX + sd * 118} ${c.hy - 236}L${CX + sd * 150} ${c.hy - 54}`, c.p, 2.4)
              )
              .join(''),
          })
        )
      },
      front: hoodFront(),
    }),
  },
  AK004: {
    mold: 'top',
    fabric: 'knit',
    o: (fab) => {
      const pearl = '#F3EFE6'
      return {
        sy: 210,
        hy: 800,
        sw: 186,
        aw: 172,
        hw: 168,
        nw: 60,
        hc: 2,
        hem: 'rib',
        ribH: 44,
        sleeve: { ang: 74, L: 420, wE: 74, bulge: 10, cuff: { kind: 'rib', len: 46 } },
        neck: (c) => {
          const { sy, nw, nsY, p } = c
          const vb = sy + 250
          let s = path(`M${CX - nw} ${nsY}Q${CX} ${sy + 8} ${CX + nw} ${nsY}L${CX} ${vb}Z`, {
            fill: p.inside,
            stroke: p.line,
            'stroke-width': 1.6,
          })
          s += ribQuad(
            [CX - nw - 26, nsY + 4],
            [CX - nw, nsY - 2],
            [CX - 16, vb + 24],
            [CX + 6, vb],
            fab,
            { n: 6 }
          )
          s += ribQuad(
            [CX + nw, nsY - 2],
            [CX + nw + 26, nsY + 4],
            [CX - 6, vb],
            [CX + 16, vb + 24],
            fab,
            { n: 6 }
          )
          s += ribQuad(
            [CX - 14, vb + 20],
            [CX + 14, vb + 20],
            [CX - 14, c.hy - 44],
            [CX + 14, c.hy - 44],
            fab,
            { n: 4 }
          )
          for (let y = vb + 46; y < c.hy - 64; y += 86) s += button(CX, y, 7.5, pearl, { holes: 0 })
          return s
        },
      }
    },
  },
  AK005: {
    mold: 'top',
    o: (fab) => ({
      sy: 236,
      hy: 830,
      sw: 194,
      aw: 182,
      hw: 176,
      nw: 64,
      hc: 2,
      hem: 'stitch',
      hemOffs: [14],
      behind: hoodBehind(),
      sleeve: {
        ang: 74,
        L: 420,
        wE: 82,
        bulge: 16,
        ibulge: 8,
        cuff: { kind: 'elastic', len: 30 },
        foldW: 12,
      },
      decor: (c) =>
        zipper(CX, c.sy + 40, c.hy - 2, shade(fab.hex, 0.12)) +
        sheen(
          c.bodyD,
          [
            `M${CX - 130} ${c.sy + 60}Q${CX - 150} ${c.sy + 300} ${CX - 110} ${c.hy - 40}`,
            `M${CX + 60} ${c.sy + 200}Q${CX + 120} ${c.sy + 360} ${CX + 140} ${c.hy - 40}`,
          ],
          0.28,
          40
        ) +
        [-1, 1]
          .map((sd) => {
            const d = `M${CX + sd * 60} ${c.hy - 240}L${CX + sd * 110} ${c.hy - 110}`
            return (
              path(d, stroke(c.p.line, 10)) +
              path(d, dashed('#8E9298', 6, '2.4 2.2')) +
              metalRect(CX + sd * 60 - 4, c.hy - 244, 8, 22, SILVER, 3)
            )
          })
          .join('') +
        [-1, 1]
          .map((sd) => circle(CX + sd * (c.hw - 22), c.hy - 6, 7, { fill: '#2B2B2B' }))
          .join(''),
      front: hoodFront({ cords: true }),
    }),
  },
  AK006: {
    mold: 'top',
    o: (fab) => {
      const btn = fab.p.dark ? '#2E2E2E' : shade(fab.hex, 0.45)
      const lining = fab.p.dark ? '#3B3A44' : shade(fab.hex, 0.3)
      return {
        sy: 200,
        hy: 820,
        sw: 196,
        slope: 20,
        aw: 178,
        ww: 166,
        hw: 180,
        nw: 52,
        hc: 4,
        sleeve: { ang: 76, L: 440, wE: 80, bulge: 8, cuff: { kind: 'hem', offs: [0.1] } },
        decor: (c) => {
          let s = ''
          s += path(
            `M${CX} ${c.sy + 470}C${CX - 2} ${c.hy - 40} ${CX - 30} ${c.hy + 2} ${CX - 70} ${c.hy + 4}L${CX + 70} ${c.hy + 4}C${CX + 30} ${c.hy + 2} ${CX + 2} ${c.hy - 40} ${CX} ${c.sy + 470}Z`,
            { fill: lining, stroke: c.p.line, 'stroke-width': 1.6 }
          )
          s += seam(`M${CX} ${c.sy + 300}V${c.sy + 470}`, c.p, 1.8)
          s += button(CX - 10, c.sy + 330, 10, btn) + button(CX - 10, c.sy + 430, 10, btn)
          for (const sd of [-1, 1]) {
            const fx = CX + sd * 100
            s += piece(`M${fx - 52} ${c.sy + 470}H${fx + 52}V${c.sy + 506}H${fx - 52}Z`, fab, {
              vol: false,
              under: edgeStitch(`M${fx - 52} ${c.sy + 506}H${fx + 52}`, [6], c.p, fab.hex),
            })
            s += seam(
              `M${CX + sd * 70} ${c.sy + 250}Q${CX + sd * 80} ${c.sy + 360} ${CX + sd * 74} ${c.sy + 468}`,
              c.p,
              1.4
            )
          }
          s += piece(
            `M${CX + 70} ${c.sy + 150}L${CX + 136} ${c.sy + 146}L${CX + 138} ${c.sy + 160}L${CX + 72} ${c.sy + 164}Z`,
            fab,
            { vol: false }
          )
          return s
        },
        neck: (c) => blazerLapels(c, { inner: lining }),
        // Ba nút nhỏ gần cổ tay, phía ngoài tay áo
        front: (c) => {
          let s = ''
          for (const side of [-1, 1]) {
            const A = [CX + side * c.sw, c.sy + 20]
            const B = [CX + side * c.aw, c.ay]
            const { d, n, A2 } = sleeveGeom(side, A, B, { ang: 76, L: 440, wE: 80 })
            for (let i = 0; i < 3; i++) {
              const q = add(sub(A2, mul(d, 30 + i * 18)), mul(n, 16))
              s += button(q[0], q[1], 5.5, btn, { holes: 2 })
            }
          }
          return s
        },
      }
    },
  },
  // ------------------------------------------------------------------ Quần
  QJ001: { mold: 'jeans', o: () => ({ ko: 146, ki: 30, ho: 132, hi: 44 }) },
  QJ002: {
    mold: 'jeans',
    o: () => ({ wy: 120, ww: 140, hw: 168, ko: 132, ki: 36, ho: 112, hi: 50, hy: 920 }),
  },
  QJ003: {
    mold: 'jeans',
    close: 'denim',
    o: () => ({ wy: 118, ww: 146, hw: 176, ko: 168, ki: 20, ho: 172, hi: 24, hy: 940 }),
  },
  QJ004: {
    mold: 'jeans',
    o: () => ({ wy: 118, ww: 142, hw: 172, ky: 640, ko: 142, ki: 34, ho: 196, hi: 8, hy: 940 }),
  },
  QJ005: {
    mold: 'jeans',
    o: () => ({ ww: 160, hw: 192, ko: 188, ki: 14, ho: 182, hi: 16, hy: 930, cy: 450 }),
  },
  QJ006: {
    fit: [442, 1.3],
    mold: 'jeans',
    o: () => ({
      wy: 210,
      ww: 150,
      hw: 186,
      hipY: 380,
      cy: 520,
      hy: 660,
      ho: 206,
      hi: 26,
      short: true,
      hem: 'fray',
      hemTilt: 14,
      pocketDepth: 86,
    }),
  },
  QJ007: {
    mold: 'jeans',
    close: 'denim',
    o: () => ({ ko: 160, ki: 24, ho: 158, hi: 30, hy: 935 }),
  },
  QJ008: {
    mold: 'jeans',
    o: () => ({
      wy: 112,
      ww: 150,
      hw: 186,
      hipY: 330,
      cy: 450,
      ko: 160,
      ki: 22,
      ho: 132,
      hi: 44,
      hy: 900,
    }),
  },
  QK001: {
    mold: 'pants',
    o: () => ({ ko: 148, ki: 28, ho: 132, hi: 44, pockets: 'slant', loops: true }),
  },
  QK002: {
    fit: [458, 1.25],
    mold: 'pants',
    o: () => ({
      wy: 210,
      hipY: 390,
      cy: 520,
      hw: 186,
      hy: 700,
      ho: 200,
      hi: 20,
      short: true,
      pockets: 'slant',
      loops: true,
      hemOffs: [22],
    }),
  },
  QK003: {
    mold: 'pants',
    o: () => ({
      ko: 156,
      ki: 24,
      ho: 152,
      hi: 32,
      pockets: 'slant',
      loops: true,
      crease: true,
      hemOffs: [0.1],
    }),
  },
  QK004: {
    mold: 'pants',
    o: () => ({
      wy: 150,
      ww: 140,
      hw: 182,
      hipY: 330,
      cy: 460,
      ky: 650,
      ko: 210,
      ki: 6,
      ho: 236,
      hi: 4,
      hy: 860,
      pockets: 'slant',
      loops: false,
      crease: true,
    }),
  },
  QK005: {
    mold: 'pants',
    o: () => ({
      ww: 152,
      ko: 150,
      ki: 30,
      ho: 108,
      hi: 54,
      hy: 920,
      waist: 'elastic',
      drawstring: true,
      fly: false,
      pockets: 'slant',
      pocketIn: 40,
      hem: 'rib',
    }),
  },
  QK006: {
    fit: [452, 1.3],
    mold: 'pants',
    fabric: 'linen',
    o: () => ({
      wy: 220,
      ww: 158,
      hipY: 390,
      hw: 190,
      cy: 530,
      hy: 680,
      ho: 206,
      hi: 18,
      short: true,
      waist: 'elastic',
      drawstring: true,
      fly: false,
      pockets: 'slant',
      pocketIn: 40,
      hemOffs: [18],
    }),
  },
  QK007: {
    mold: 'pants',
    fabric: 'linen',
    o: (fab) => ({
      wy: 116,
      wh: 44,
      ww: 142,
      hw: 184,
      hipY: 320,
      cy: 450,
      ky: 660,
      ko: 214,
      ki: 4,
      ho: 232,
      hi: 2,
      hy: 940,
      pockets: 'slant',
      button: false,
      decor: (c) => {
        const p = c.p
        const y = c.wy + c.wh / 2
        const loop = (sd) =>
          `M${CX} ${y}C${CX + sd * 20} ${y - 40} ${CX + sd * 86} ${y - 36} ${CX + sd * 78} ${y}C${CX + sd * 70} ${y + 30} ${CX + sd * 24} ${y + 20} ${CX} ${y + 4}Z`
        const tail = (sd, len) =>
          `M${CX + sd * 2} ${y + 6}C${CX + sd * 16} ${y + 60} ${CX + sd * 20} ${y + len - 40} ${CX + sd * 30} ${y + len}L${CX + sd * 58} ${y + len - 6}C${CX + sd * 44} ${y + len - 50} ${CX + sd * 28} ${y + 50} ${CX + sd * 14} ${y + 4}Z`
        return (
          piece(tail(-1, 150), fab, { foldW: 5 }) +
          piece(tail(1, 120), fab, { foldW: 5 }) +
          piece(loop(-1), fab, {}) +
          piece(loop(1), fab, {}) +
          piece(`M${CX - 14} ${y - 16}H${CX + 14}V${y + 18}H${CX - 14}Z`, fab, { line: p.line }) +
          ''
        )
      },
    }),
  },
  // ------------------------------------------------------------------ Váy đầm
  VD001: {
    mold: 'top',
    o: () => ({
      sy: 160,
      hy: 920,
      nw: 70,
      sw: 158,
      slope: 22,
      aw: 160,
      ay: 360,
      hw: 228,
      hc: 14,
      openTop: true,
      squareNeck: true,
      nd: 96,
      strapW: 74,
      backNeck: 30,
      A: [CX - 152, 176],
      sleeve: { ang: 38, L: 70, wE: 118, cuff: { kind: 'hem' } },
      hem: 'stitch',
      binding: (c) => `M${CX - c.nw} ${c.nsY}V${c.sy + 96}H${CX + c.nw}V${c.nsY}`,
      folds: (c) => [
        `M${CX - 100} ${c.ay + 40}Q${CX - 150} ${c.ay + 300} ${CX - 170} ${c.hy - 10}`,
        `M${CX + 40} ${c.ay + 120}Q${CX + 50} ${c.ay + 340} ${CX + 70} ${c.hy}`,
        `M${CX + 120} ${c.ay + 40}Q${CX + 150} ${c.ay + 300} ${CX + 186} ${c.hy - 10}`,
      ],
    }),
  },
  VD002: {
    mold: 'top',
    fabric: 'floral',
    o: () => ({
      sy: 150,
      hy: 940,
      nw: 64,
      sw: 152,
      slope: 20,
      aw: 140,
      ay: 330,
      waistY: 470,
      ww: 124,
      hw: 290,
      flare: 40,
      hc: 22,
      neck: neckCrew(52, 7, { label: false }),
      hem: 'stitch',
      sleeve: {
        ang: 30,
        L: 104,
        wE: 128,
        bulge: 34,
        ibulge: 10,
        gather: true,
        cuff: { kind: 'elastic', len: 22 },
      },
      decor: (c) => gathers(c, 470, 124),
      folds: skirtFolds(470, 124, 290, 940),
    }),
  },
  VD004: {
    mold: 'top',
    o: () => ({
      sy: 190,
      hy: 860,
      nw: 60,
      sw: 152,
      slope: 20,
      aw: 140,
      ay: 360,
      waistY: 400,
      ww: 136,
      hw: 270,
      flare: 30,
      flareOut: 6,
      hc: 20,
      neck: (c) => neckCrew(48, 7, { label: false })(c) + lace(c, 48),
      hem: 'stitch',
      sleeve: {
        ang: 32,
        L: 116,
        wE: 130,
        bulge: 40,
        ibulge: 14,
        gather: true,
        cuff: { kind: 'elastic', len: 24 },
      },
      decor: (c) => gathers(c, 400, 136),
      folds: skirtFolds(400, 136, 270, 860),
    }),
  },
  VD006: {
    mold: 'top',
    o: (fab) => {
      const btn = fab.p.dark ? tint(fab.hex, 0.12) : shade(fab.hex, 0.14)
      return {
        sy: 150,
        hy: 930,
        nw: 54,
        sw: 160,
        slope: 22,
        aw: 148,
        ay: 340,
        waistY: 470,
        ww: 130,
        hw: 252,
        flare: 30,
        hc: 18,
        hem: 'stitch',
        sleeve: { ang: 34, L: 112, wE: 112, cuff: { kind: 'roll', len: 30 } },
        decor: (c) =>
          placket(c, c.sy + 30, c.hy + c.hc - 6, { btn, n: 8, first: c.sy + 70, step: 92, w: 30 }) +
          belt(c, 470, 130),
        neck: (c) => shirtCollar(c, { tipY: 76, tipX: 58, standH: 22 }),
        folds: skirtFolds(470, 130, 252, 930),
      }
    },
  },
  VD007: {
    mold: 'top',
    o: () => ({
      sy: 120,
      hy: 950,
      nw: 74,
      aw: 146,
      ay: 300,
      waistY: 440,
      ww: 128,
      hw: 262,
      flare: 30,
      hc: 16,
      openTop: true,
      nd: 112,
      squareK: 0.95,
      strapW: 40,
      backNeck: 60,
      armSeg: (A, B) => ['C', A[0] - 2, A[1] + 80, B[0] + 30, B[1] - 20, B[0], B[1]],
      hem: 'stitch',
      binding: (c) =>
        `M${CX - c.nw} ${c.nsY}V${c.sy + 106}Q${CX} ${c.sy + 114} ${CX + c.nw} ${c.sy + 106}V${c.nsY}`,
      decor: (c) =>
        seam(
          `M${CX - c.aw + 6} ${c.sy + 210}Q${CX} ${c.sy + 226} ${CX + c.aw - 6} ${c.sy + 210}`,
          c.p,
          1.6
        ) +
        path(`M${CX + 196} ${c.hy + 4}L${CX + 172} ${c.hy - 230}`, stroke(c.p.line, 2)) +
        path(`M${CX + 192} ${c.hy}L${CX + 172} ${c.hy - 220}L${CX + 210} ${c.hy}Z`, {
          fill: '#000000',
          'fill-opacity': 0.1,
        }),
      folds: skirtFolds(440, 128, 262, 950),
    }),
  },
  VD008: {
    mold: 'top',
    fabric: 'rib',
    o: () => ({
      sy: 170,
      hy: 920,
      nw: 50,
      sw: 158,
      slope: 26,
      aw: 140,
      ay: 350,
      waistY: 540,
      ww: 124,
      hw: 150,
      flare: -30,
      flareOut: -30,
      hc: 6,
      hem: 'stitch',
      sleeve: { ang: 78, L: 440, wE: 58, bulge: 6, cuff: { kind: 'hem', offs: [18] } },
      neck: (c) => {
        const { sy, nw, nsY, fab, p } = c
        const d = `M${CX - nw - 8} ${nsY + 14}C${CX - nw - 6} ${sy - 10} ${CX - nw} ${sy - 40} ${CX - nw + 4} ${sy - 46}Q${CX} ${sy - 58} ${CX + nw - 4} ${sy - 46}C${CX + nw} ${sy - 40} ${CX + nw + 6} ${sy - 10} ${CX + nw + 8} ${nsY + 14}Q${CX} ${sy + 30} ${CX - nw - 8} ${nsY + 14}Z`
        return (
          piece(d, fab, {}) +
          ellipse(CX, sy - 46, nw - 4, 10, { fill: p.inside, stroke: p.line, 'stroke-width': 1.6 })
        )
      },
      folds: (c) => [
        `M${CX - 90} ${c.ay + 30}Q${CX - 60} ${c.ay + 120} ${CX - 110} ${c.ay + 190}`,
        `M${CX + 80} ${c.ay + 20}Q${CX + 50} ${c.ay + 140} ${CX + 100} ${c.ay + 210}`,
      ],
    }),
  },
  VD003: {
    mold: 'skirt',
    o: () => ({
      wy: 190,
      ww: 130,
      hy: 840,
      hw: 250,
      flare: 20,
      over: (c) => pleats(c, 22),
      folds: () => [],
    }),
  },
  VD005: {
    fit: [485, 1.12],
    mold: 'skirt',
    fabric: 'denim',
    o: () => ({
      wy: 200,
      ww: 140,
      hw: 236,
      hy: 760,
      hc: 10,
      flare: 50,
      thread: '#C99A4A',
      decor: (c) => {
        const thread = '#C99A4A'
        let s =
          seam(`M${CX} ${c.wy + c.wh}V${c.hy + c.hc}`, c.p, 1.8) +
          stitchLine(`M${CX + 9} ${c.wy + c.wh}V${c.hy + c.hc - 10}`, thread, 1.8) +
          stitchLine(`M${CX - 9} ${c.wy + c.wh}V${c.hy + c.hc - 10}`, thread, 1.8)
        for (let i = 0; i < 5; i++)
          s +=
            metalDot(CX, c.wy + c.wh / 2 + i * 104, 9) +
            circle(CX, c.wy + c.wh / 2 + i * 104, 3.5, { fill: shade('#B87B3E', 0.3) })
        for (const sd of [-1, 1]) {
          const d = `M${CX + sd * (c.ww - 50)} ${c.wy + c.wh}Q${CX + sd * (c.ww - 40)} ${c.wy + c.wh + 80} ${CX + sd * (c.ww + 12)} ${c.wy + c.wh + 90}`
          s +=
            seam(d, c.p, 1.8) +
            path(d, { ...dashed(thread, 1.8), transform: `translate(${sd * 8} 2)` }) +
            metalDot(CX + sd * (c.ww - 46), c.wy + c.wh + 8, 4.5)
        }
        for (const x of [-c.ww + 30, -50, 50, c.ww - 30])
          s += piece(`M${CX + x - 7} ${c.wy - 4}h14v${c.wh + 12}h-14Z`, c.fab, {
            vol: false,
            lw: 1.4,
          })
        return s
      },
    }),
  },
  VD009: {
    mold: 'skirt',
    o: () => ({
      wy: 170,
      ww: 124,
      hy: 900,
      hw: 228,
      flare: 10,
      hc: 26,
      folds: (c) => [
        `M${CX - 80} ${c.wy + 60}Q${CX - 110} ${c.wy + 400} ${CX - 170} ${c.hy}`,
        `M${CX - 10} ${c.wy + 90}Q${CX - 20} ${c.wy + 420} ${CX - 40} ${c.hy + 20}`,
        `M${CX + 60} ${c.wy + 70}Q${CX + 90} ${c.wy + 420} ${CX + 120} ${c.hy + 10}`,
      ],
      foldW: 16,
      over: (c) =>
        sheen(
          c.bodyD,
          [
            `M${CX - 130} ${c.wy + 60}Q${CX - 150} ${c.wy + 360} ${CX - 200} ${c.hy}`,
            `M${CX + 30} ${c.wy + 80}Q${CX + 40} ${c.wy + 400} ${CX + 60} ${c.hy}`,
          ],
          0.4,
          36
        ),
    }),
  },
  // ------------------------------------------------------------------ Túi, phụ kiện
  TX001: { mold: 'acc', acc: 'tote', fabric: 'canvas', close: 'canvas' },
  TX002: { mold: 'acc', acc: 'crossbody' },
  TX003: { mold: 'acc', acc: 'backpack', fabric: 'canvas' },
  TX004: { mold: 'acc', acc: 'baguette' },
  TX005: { mold: 'acc', acc: 'bucket' },
  TX006: { mold: 'acc', acc: 'wallet' },
  PK001: { mold: 'acc', acc: 'cap', fabric: 'canvas' },
  PK002: { mold: 'acc', acc: 'belt' },
  PK003: { mold: 'acc', acc: 'socks' },
  PK004: { mold: 'acc', acc: 'scarf' },
  PK005: { mold: 'acc', acc: 'bucketHat', fabric: 'canvas' },
}

// Chi tiết đầm: nhún eo, nếp chân váy, đai, ren
function gathers(c, y, ww) {
  let s = seam(`M${CX - ww} ${y}Q${CX} ${y + 6} ${CX + ww} ${y}`, c.p, 1.8)
  for (let i = 0; i <= 14; i++) {
    const x = CX - ww + 12 + ((2 * ww - 24) * i) / 14
    s += fold(`M${x} ${y + 4}l${i % 2 ? 5 : -5} 46`, c.p, 4, 0.9)
    s += fold(`M${x} ${y - 4}l${i % 2 ? -3 : 3} -26`, c.p, 3, 0.6)
  }
  return s
}
const skirtFolds = (y, ww, hw, hy) => () => [
  `M${CX - ww + 30} ${y + 30}Q${CX - ww} ${(y + hy) / 2} ${CX - hw + 50} ${hy - 6}`,
  `M${CX - 40} ${y + 50}Q${CX - 70} ${(y + hy) / 2} ${CX - 110} ${hy + 8}`,
  `M${CX + 30} ${y + 40}Q${CX + 40} ${(y + hy) / 2} ${CX + 60} ${hy + 10}`,
  `M${CX + ww - 20} ${y + 30}Q${CX + ww + 20} ${(y + hy) / 2} ${CX + hw - 60} ${hy - 4}`,
]
function belt(c, y, ww) {
  const { fab, p } = c
  const band = `M${CX - ww - 6} ${y - 18}Q${CX} ${y - 12} ${CX + ww + 6} ${y - 18}L${CX + ww + 6} ${y + 18}Q${CX} ${y + 24} ${CX - ww - 6} ${y + 18}Z`
  let s = piece(band, fab, { vol: false, under: edgeStitch(band, [5], p, fab.fill(0)) })
  const loop = (sd) =>
    `M${CX - 30} ${y}C${CX - 30 + sd * 20} ${y - 46} ${CX - 30 + sd * 80} ${y - 40} ${CX - 30 + sd * 74} ${y}C${CX - 30 + sd * 68} ${y + 34} ${CX - 30 + sd * 22} ${y + 22} ${CX - 30} ${y + 6}Z`
  const tail = (sd, len) =>
    `M${CX - 30 + sd * 2} ${y + 8}C${CX - 30 + sd * 12} ${y + 60} ${CX - 30 + sd * 18} ${y + len - 40} ${CX - 30 + sd * 26} ${y + len}L${CX - 30 + sd * 54} ${y + len - 8}C${CX - 30 + sd * 40} ${y + len - 50} ${CX - 30 + sd * 26} ${y + 50} ${CX - 30 + sd * 14} ${y + 6}Z`
  s +=
    piece(tail(-1, 170), fab, {}) +
    piece(tail(1, 140), fab, {}) +
    piece(loop(-1), fab, {}) +
    piece(loop(1), fab, {})
  s += piece(`M${CX - 44} ${y - 16}H${CX - 16}V${y + 20}H${CX - 44}Z`, fab, {})
  return s
}
function lace(c, nd) {
  const { sy, nw, nsY } = c
  let s = ''
  for (let i = 0; i <= 18; i++) {
    const t = i / 18
    const a = Math.PI * t
    const x = CX - Math.cos(a) * (nw + 8)
    const y = nsY + Math.sin(a) * (sy + nd - nsY + 8)
    s +=
      circle(x, y + 8, 6, { fill: '#FBF8F2', stroke: '#D9D2C4', 'stroke-width': 1 }) +
      circle(x, y + 8, 2, { fill: '#D9D2C4' })
  }
  return s
}
function pleats(c, n) {
  const { wy, wh, ww, hy, hw, hc } = c
  let s = ''
  for (let i = 0; i < n; i++) {
    const t1 = i / n
    const t2 = (i + 1) / n
    const xt = (t) => CX - ww + 2 * ww * t
    const xb = (t) => CX - hw + 2 * hw * t
    const yb = (t) => hy + hc * (1 - Math.pow(2 * t - 1, 2)) + 4
    const d = `M${xt(t1)} ${wy + wh}L${xt(t2)} ${wy + wh}L${xb(t2)} ${yb(t2)}L${xb(t1)} ${yb(t1)}Z`
    s += path(d, { fill: i % 2 ? '#000000' : '#FFFFFF', 'fill-opacity': i % 2 ? 0.07 : 0.06 })
    s += path(`M${xt(t1)} ${wy + wh}L${xb(t1)} ${yb(t1)}`, {
      ...stroke(c.p.line, 1.4),
      'stroke-opacity': 0.8,
    })
  }
  return s
}

// ============================================================ Chọn vải theo sản phẩm + màu
function fabricFor(cfg, code, hex) {
  if (code === 'KS') {
    return cfg.fabric === 'pin'
      ? fabric('pin', '#F7F6F2', { stripe: hex, sw: 3, period: 14 })
      : fabric('stripeH', '#F7F6F2', { stripe: shade(hex, 0.12), sw: 13, period: 36 })
  }
  if (code === 'HN' || code === 'HH') {
    return fabric(
      'floral',
      hex,
      code === 'HH' ? { leaf: '#6E8A5A', petal2: '#FFF3E8' } : { petal2: '#F2E7C9' }
    )
  }
  const kind = cfg.fabric ?? 'solid'
  if (kind === 'pin' || kind === 'stripeH') return fabric('solid', hex)
  return fabric(kind, hex)
}

// ============================================================ Dựng và xuất
function background() {
  const bg = once('bg', () =>
    grad(
      [
        [0, '#F4F2EE'],
        [1, '#E9E5DE'],
      ],
      [0, 0, 0, 1]
    )
  )
  const glow = once('glow', () =>
    radial([
      [0, '#FFFFFF', 0.55],
      [1, '#FFFFFF', 0],
    ])
  )
  return rect(0, 0, W, H, { fill: bg }) + ellipse(400, 470, 420, 470, { fill: glow })
}

function renderImage(product, colorCode, hex, isClose, palette) {
  defs = []
  uid = 0
  memo = new Map()
  const cfg = PRODUCTS[product.code]
  if (!cfg) throw new Error(`Chưa có khuôn cho sản phẩm ${product.code}`)
  const rnd = mulberry32(hashStr(product.code + colorCode))
  const fab = fabricFor(cfg, colorCode, hex)
  const ctx = { rnd, code: product.code, colorCode, palette }
  let body
  if (isClose) {
    if (!cfg.close)
      throw new Error(`${product.code}: ảnh trùng màu nhưng chưa khai báo ảnh cận chất liệu`)
    body = CLOSE[cfg.close](fab, ctx)
  } else {
    let inner
    const o = cfg.o ? cfg.o(fab) : {}
    if (cfg.mold === 'top') inner = top(fab, o, ctx)
    else if (cfg.mold === 'shirt') inner = shirtTop(fab, o, ctx)
    else if (cfg.mold === 'jeans') {
      const thread =
        colorCode === 'TR'
          ? '#C9C2B2'
          : colorCode === 'XA' || colorCode === 'DE'
            ? '#B8B2A6'
            : '#C99A4A'
      inner = pants(
        fabricFor({ fabric: 'denim' }, colorCode, hex),
        {
          pockets: 'scoop',
          loops: true,
          rivets: true,
          coin: true,
          whiskers: true,
          fade: colorCode !== 'TR',
          thread,
          metalBtn: '#B87B3E',
          ...o,
        },
        ctx
      )
    } else if (cfg.mold === 'pants') inner = pants(fab, o, ctx)
    else if (cfg.mold === 'skirt') inner = skirt(fab, o, ctx)
    else if (cfg.mold === 'acc') {
      if (cfg.acc === 'scarf') ctx.scarfBorder = colorCode === 'KE' ? '#9C7A4A' : shade(hex, 0.5)
      const f =
        cfg.acc === 'scarf' && colorCode === 'KE' ? fabric('geo', hex, { motif: '#B8925A' }) : fab
      inner = ACC[cfg.acc](f, ctx)
    } else throw new Error(`Khuôn lạ: ${cfg.mold}`)
    // Căn khung: [tâm dọc của hình gốc, hệ số phóng], phóng quanh tâm rồi đưa về giữa ảnh
    if (cfg.fit)
      inner = g(
        {
          transform: `translate(${CX} ${H / 2}) scale(${cfg.fit[1]}) translate(${-CX} ${-cfg.fit[0]})`,
        },
        inner
      )
    body = background() + g({ filter: SHADOW_FILTER() }, inner)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs.join('')}</defs>${body}</svg>`
}

async function encodeWebp(svg) {
  const png = await sharp(Buffer.from(svg)).png().toBuffer()
  for (let q = 86; q >= 40; q -= 6) {
    const buf = await sharp(png).webp({ quality: q, effort: 6, smartSubsample: true }).toBuffer()
    if (buf.length <= MAX_BYTES) return { buf, q, png }
  }
  throw new Error('Ảnh vượt 60 KB ở mọi mức chất lượng')
}

async function main() {
  const data = JSON.parse(readFileSync(DATA_FILE, 'utf8'))
  const colors = Object.fromEntries(data.colors.map((c) => [c.code, c]))
  mkdirSync(OUT_DIR, { recursive: true })
  if (PREVIEW) mkdirSync(PREVIEW, { recursive: true })
  const sizes = []
  for (const product of data.products) {
    const seen = new Set()
    for (const [file, colorCode] of product.images) {
      const color = colors[colorCode]
      if (!color) throw new Error(`${product.code}: mã màu lạ ${colorCode}`)
      const isClose = seen.has(colorCode)
      seen.add(colorCode)
      if (ONLY && !file.includes(ONLY)) continue
      const svg = renderImage(product, colorCode, color.hex, isClose, colors)
      const { buf, q, png } = await encodeWebp(svg)
      writeFileSync(join(OUT_DIR, file), buf)
      if (PREVIEW) writeFileSync(join(PREVIEW, file.replace(/\.\w+$/, '.png')), png)
      sizes.push(buf.length)
      console.log(
        `${file.padEnd(14)} ${product.name.padEnd(30)} ${colorCode} ${isClose ? 'cận' : '   '} ${(buf.length / 1024).toFixed(1).padStart(6)} KB  q${q}`
      )
    }
  }
  const max = Math.max(...sizes) / 1024
  const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length / 1024
  console.log(
    `Đã tạo ${sizes.length} ảnh · lớn nhất ${max.toFixed(1)} KB · trung bình ${avg.toFixed(1)} KB`
  )
}

await main()
