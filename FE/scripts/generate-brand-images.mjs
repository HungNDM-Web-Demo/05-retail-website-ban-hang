// Sinh bộ nhận diện và ảnh trang chủ cho Nhà Sợi (cửa hàng thời trang hư cấu, màu chính #1E40AF):
// - public/logo/logo-mark.svg, public/logo/logo.svg, src/app/icon.svg (vector, viết tay ở dưới)
// - public/seed/categories/{categories[].image}  600×600, WebP ≤ 50 KB: minh họa phẳng trang phục tiêu
//   biểu của danh mục trên nền màu danh mục nhạt (`categories[].color`)
// - public/seed/banners/{banners[].image}        1600×700, WebP ≤ 150 KB: phối đồ flat-lay theo chủ đề
//   banner. Cụm chủ thể nằm quanh x ≈ 920 (khung vuông giữa ảnh vẫn giữ đủ chủ thể khi cắt cho điện thoại),
//   phần trái ảnh để trống, nền dịu cho chữ do FE đè lên. Không vẽ chữ vào ảnh.
// Nguồn dữ liệu: src/mock/seed/demo-data.json (chỉ đọc). Xác định: không ngẫu nhiên tự do (bộ sinh số có
// hạt giống theo mã), chạy lại cho cùng byte.
//
// Chạy:      pnpm seed:brand-images
// Tùy chọn:  --only <chuỗi>       chỉ vẽ ảnh có tên file chứa chuỗi
//            --preview <thư mục>  xuất thêm PNG để xem nhanh
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_FILE = join(ROOT, 'src', 'mock', 'seed', 'demo-data.json')
const LOGO_DIR = join(ROOT, 'public', 'logo')
const ICON_FILE = join(ROOT, 'src', 'app', 'icon.svg')
const CAT_DIR = join(ROOT, 'public', 'seed', 'categories')
const BANNER_DIR = join(ROOT, 'public', 'seed', 'banners')
const CAT_SIZE = 600
const CAT_MAX = 50 * 1000
const BAN_W = 1600
const BAN_H = 700
const BAN_MAX = 150 * 1000
const BRAND = '#1E40AF'

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
// Đặt một chi tiết vẽ theo tọa độ cục bộ (tâm 0,0) vào vị trí x, y, xoay a độ, phóng s lần
const at = (x, y, a = 0, s = 1) =>
  `translate(${r2(x)} ${r2(y)})${a ? ` rotate(${r2(a)})` : ''}${s !== 1 ? ` scale(${r2(s)})` : ''}`
const put = (x, y, a, s, body) => g({ transform: at(x, y, a, s) }, body)
const mirrorX = (body) => g({ transform: 'scale(-1 1)' }, body)
const stroke = (color, width, extra = {}) => ({
  fill: 'none',
  stroke: color,
  'stroke-width': width,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  ...extra,
})
const stitch = (color, width = 1.6, dash = '6 5') =>
  stroke(color, width, { 'stroke-dasharray': dash })
// Tô một hình có góc bo mềm (viền cùng màu, nối tròn)
const soft = (fill, w = 6) => ({
  fill,
  stroke: fill,
  'stroke-width': w,
  'stroke-linejoin': 'round',
})

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
const range = (n) => Array.from({ length: n }, (_, i) => i)
const DEG = Math.PI / 180

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
const newId = (p) => `${p}${++uid}`
function resetDefs(shadowColor) {
  defs = []
  uid = 0
  // Bóng đổ mềm dưới đồ vật (đồ trải phẳng trên mặt nền)
  defs.push(
    el(
      'filter',
      { id: 'ds', x: '-30%', y: '-30%', width: '160%', height: '170%' },
      el('feGaussianBlur', { in: 'SourceAlpha', stdDeviation: 7 }) +
        el('feOffset', { dx: 0, dy: 9, result: 'o' }) +
        el('feFlood', { 'flood-color': shadowColor, 'flood-opacity': 0.2 }) +
        el('feComposite', { in2: 'o', operator: 'in' }) +
        el('feMerge', {}, el('feMergeNode') + el('feMergeNode', { in: 'SourceGraphic' }))
    )
  )
}
const shadowed = (body) => g({ filter: 'url(#ds)' }, body)
function linGrad(stops, dir = 'h') {
  const id = newId('lg')
  const [x2, y2] = dir === 'v' ? [0, 1] : dir === 'd' ? [1, 1] : [1, 0]
  defs.push(
    el(
      'linearGradient',
      { id, x1: 0, y1: 0, x2, y2 },
      stops
        .map(([o, c, op]) => el('stop', { offset: o, 'stop-color': c, 'stop-opacity': op }))
        .join('')
    )
  )
  return `url(#${id})`
}
// Vải: sáng nhẹ bên trái, tối nhẹ bên phải
const cloth = (c, k = 0.06) =>
  linGrad([
    [0, tint(c, k)],
    [0.5, c],
    [1, shade(c, k)],
  ])
function clipOf(inner) {
  const id = newId('cp')
  defs.push(el('clipPath', { id }, inner))
  return `url(#${id})`
}
function pattern(w, h, body, transform) {
  const id = newId('pt')
  defs.push(
    el(
      'pattern',
      { id, width: w, height: h, patternUnits: 'userSpaceOnUse', patternTransform: transform },
      body
    )
  )
  return `url(#${id})`
}
// Sọc dọc (sơ mi kẻ)
const stripes = (bg, fg, step = 14, w = 3, angle = 0) =>
  pattern(
    step,
    step,
    rect(0, 0, step, step, { fill: bg }) + rect(0, 0, w, step, { fill: fg }),
    angle ? `rotate(${angle})` : undefined
  )
// Vân chéo của vải denim / kaki
const twill = (bg, fg, step = 7, w = 1.6) =>
  pattern(
    step,
    step,
    rect(0, 0, step, step, { fill: bg }) + rect(0, 0, w, step, { fill: fg }),
    'rotate(35)'
  )
// Vải canvas dệt thô
const weave = (bg, fg) =>
  pattern(
    8,
    8,
    rect(0, 0, 8, 8, { fill: bg }) +
      rect(0, 0, 8, 1.4, { fill: fg }) +
      rect(0, 4, 4, 1.4, { fill: fg, 'fill-opacity': 0.6 }) +
      rect(0, 0, 1.4, 8, { fill: fg, 'fill-opacity': 0.6 })
  )
// Hoa nhí: hai bông năm cánh xen lá nhỏ trên ô 38×38
function floral(bg, a, b, leafC, center = '#F4D58D') {
  const flower = (x, y, c, r) =>
    range(5)
      .map((i) =>
        circle(
          x + Math.cos((i * 72 - 90) * DEG) * r,
          y + Math.sin((i * 72 - 90) * DEG) * r,
          r * 0.82,
          {
            fill: c,
          }
        )
      )
      .join('') + circle(x, y, r * 0.55, { fill: center })
  const leafAt = (x, y, ang) =>
    ellipse(x, y, 3.6, 1.5, { fill: leafC, transform: `rotate(${ang} ${x} ${y})` })
  return pattern(
    38,
    38,
    rect(0, 0, 38, 38, { fill: bg }) +
      flower(9, 10, a, 3.2) +
      leafAt(16, 15, 40) +
      leafAt(3, 17, -30) +
      flower(28, 28, b, 2.8) +
      leafAt(21, 33, -40) +
      leafAt(34, 21, 60) +
      circle(30, 8, 1.2, { fill: a }) +
      circle(8, 31, 1.1, { fill: b }),
    'rotate(-8)'
  )
}

// ============================================================ Trang phục (tọa độ cục bộ, tâm 0,0, cao ~360)
// Áo thun trải phẳng
function tee(c, o = {}) {
  const fill = o.fill ?? cloth(c)
  const line = shade(c, 0.16)
  const body =
    'M-44 -152Q0 -118 44 -152L114 -134Q152 -112 186 -72L142 -26Q124 -42 108 -54L110 148Q0 156 -110 148L-108 -54Q-124 -42 -142 -26L-186 -72Q-152 -112 -114 -134Z'
  let out = path(body, soft(fill, 8))
  // lòng cổ sau, bo cổ, đường may
  out += path('M-44 -152Q0 -168 44 -152Q0 -118 -44 -152Z', { fill: shade(c, 0.14) })
  out += path('M-44 -152Q0 -118 44 -152', stroke(shade(c, 0.06), 11))
  out += path('M-36 -141Q0 -112 36 -141', stitch(line, 1.5, '5 4'))
  const half =
    path('M176 -82L133 -36', stitch(line, 1.6)) +
    path('M108 -54Q118 -20 110 30', stroke(shade(c, 0.07), 3, { 'stroke-opacity': 0.7 })) +
    path('M114 -134L108 -54', stroke(shade(c, 0.08), 2, { 'stroke-opacity': 0.6 }))
  out += half + mirrorX(half)
  out += path('M-104 134Q0 142 104 134', stitch(line, 1.6))
  // nếp vải nhẹ
  out += path('M-60 -60Q-40 20 -64 110', stroke(tint(c, 0.25), 5, { 'stroke-opacity': 0.35 }))
  out += path('M40 -20Q62 50 44 120', stroke(shade(c, 0.06), 4, { 'stroke-opacity': 0.45 }))
  return out
}

// Áo thun gấp vuông (chồng áo)
function foldedTee(c, w = 230, h = 150) {
  const x = -w / 2
  const y = -h / 2
  let out = rect(x, y, w, h, { rx: 12, fill: cloth(c, 0.05) })
  out += rect(x, y + h - 14, w, 14, { rx: 7, fill: shade(c, 0.08) })
  for (const k of [-1, 1])
    out += path(
      `M${k * (w / 2 - 30)} ${y + 8}L${k * (w / 2 - 26)} ${y + h - 10}`,
      stroke(shade(c, 0.12), 2.5)
    )
  out += path(`M-38 ${y}Q0 ${y - 12} 38 ${y}Q0 ${y + 36} -38 ${y}Z`, { fill: shade(c, 0.22) })
  out += path(`M-38 ${y}Q0 ${y + 36} 38 ${y}`, stroke(shade(c, 0.05), 10))
  out += path(`M-30 ${y + 9}Q0 ${y + 32} 30 ${y + 9}`, stitch(shade(c, 0.18), 1.4, '4 4'))
  return out
}

// Sơ mi dài tay cài nút; o.fill: vải (sọc), o.cuff: màu măng-sét
function shirt(c, o = {}) {
  const fill = o.fill ?? cloth(c)
  const line = shade(c, 0.2)
  const sleeve =
    path('M104 -136Q150 -60 203 98L156 112Q132 10 104 -40Z', soft(fill, 6)) +
    path('M156 112L203 98L211 130L164 144Z', soft(o.cuff ?? fill, 5)) +
    path('M156 112L203 98', stroke(line, 2)) +
    circle(190, 124, 3.6, { fill: '#F4F1EA', stroke: line, 'stroke-width': 1.2 }) +
    path('M130 -40Q150 30 168 96', stroke(shade(c, 0.08), 3, { 'stroke-opacity': 0.6 }))
  let out = sleeve + mirrorX(sleeve)
  const body =
    'M-36 -150L36 -150L112 -132Q118 -110 116 -80L114 140Q110 164 84 160Q40 152 22 170L-22 170Q-40 152 -84 160Q-110 164 -114 140L-116 -80Q-118 -110 -112 -132Z'
  out += path(body, soft(fill, 6))
  out += path('M-34 -150Q0 -164 34 -150Q0 -126 -34 -150Z', { fill: shade(c, 0.22) })
  // cầu vai, nẹp nút, túi ngực
  out += path('M-112 -124Q0 -110 112 -124', stroke(line, 1.6, { 'stroke-opacity': 0.6 }))
  out += path('M-11 -122V168M11 -122V168', stroke(line, 1.6))
  for (const y of [-98, -52, -6, 40, 86, 132])
    out += circle(0, y, 5, { fill: '#F4F1EA', stroke: line, 'stroke-width': 1.4 })
  out += path('M40 -74H90V-22L65 -12L40 -22Z', stroke(line, 1.8))
  out += path('M40 -64H90', stitch(line, 1.3, '4 4'))
  // cổ áo
  const collar =
    path('M2 -122L34 -152Q48 -148 54 -138L30 -94Q12 -104 2 -122Z', {
      fill: o.collar ?? fill,
      stroke: line,
      'stroke-width': 1.6,
      'stroke-linejoin': 'round',
    }) + path('M10 -120L35 -144Q44 -141 47 -136L28 -103', stitch(line, 1.2, '4 4'))
  out += collar + mirrorX(collar)
  out += path('M-60 -40Q-44 40 -66 120', stroke(tint(c, 0.4), 5, { 'stroke-opacity': 0.35 }))
  return out
}

// Áo khoác kiểu chore: cổ bẻ màu tương phản, 4 túi đắp, nút dọc
function jacket(c, o = {}) {
  const fill = o.fill ?? cloth(c)
  const line = tint(c, 0.32)
  const seam = shade(c, 0.2)
  const sleeve =
    path('M108 -138Q158 -60 210 100L160 116Q136 14 110 -36Z', soft(fill, 6)) +
    path('M160 116L210 100L216 120L166 136Z', soft(shade(c, 0.05), 5)) +
    path('M160 116L210 100', stitch(line, 1.6)) +
    path('M134 -36Q156 30 176 98', stroke(shade(c, 0.12), 3, { 'stroke-opacity': 0.6 }))
  let out = sleeve + mirrorX(sleeve)
  const body =
    'M-38 -152L38 -152L118 -134Q126 -112 124 -80L124 156Q124 166 112 166L-112 166Q-124 166 -124 156L-124 -80Q-126 -112 -118 -134Z'
  out += path(body, soft(fill, 6))
  out += path('M-38 -152Q0 -166 38 -152Q0 -126 -38 -152Z', { fill: shade(c, 0.3) })
  out += path('M-118 152H118', stitch(line, 1.6))
  // nẹp và nút
  out += path('M10 -126V166', stroke(seam, 2.2))
  out += path('M16 -122V160', stitch(line, 1.4, '5 4'))
  for (const y of [-100, -44, 12, 68, 124])
    out += circle(0, y, 6.5, {
      fill: o.button ?? '#3B2A1E',
      stroke: shade(c, 0.35),
      'stroke-width': 1.2,
    })
  // túi
  const pockets = (k) => {
    const x0 = k > 0 ? 34 : -94
    return (
      path(`M${x0} -66H${x0 + 60}V-14Q${x0 + 60} -8 ${x0 + 54} -8H${x0 + 6}Q${x0} -8 ${x0} -14Z`, {
        fill: shade(c, 0.03),
        stroke: seam,
        'stroke-width': 1.6,
      }) +
      path(`M${x0 - 2} -72H${x0 + 62}V-54Q${x0 + 30} -46 ${x0 - 2} -54Z`, {
        fill: tint(c, 0.04),
        stroke: seam,
        'stroke-width': 1.6,
        'stroke-linejoin': 'round',
      }) +
      path(`M${x0 + 4} -60H${x0 + 56}`, stitch(line, 1.2, '4 4')) +
      path(
        `M${x0 - 10} 34H${x0 + 70}V112Q${x0 + 70} 120 ${x0 + 62} 120H${x0 - 2}Q${x0 - 10} 120 ${x0 - 10} 112Z`,
        { fill: shade(c, 0.03), stroke: seam, 'stroke-width': 1.6 }
      ) +
      path(`M${x0 - 4} 42H${x0 + 64}`, stitch(line, 1.3, '4 4'))
    )
  }
  out += pockets(-1) + pockets(1)
  // cổ bẻ
  const cc = o.collar ?? '#7A5236'
  const collar =
    path('M4 -124L38 -154Q56 -150 66 -136L36 -88Q14 -100 4 -124Z', {
      fill: cc,
      stroke: shade(cc, 0.25),
      'stroke-width': 1.6,
      'stroke-linejoin': 'round',
    }) +
    range(5)
      .map((i) =>
        path(
          `M${12 + i * 9} ${-120 + i * 2}L${36 + i * 5} ${-148 + i * 9}`,
          stroke(shade(cc, 0.18), 2)
        )
      )
      .join('')
  out += collar + mirrorX(collar)
  out += path('M-62 -30Q-50 50 -70 140', stroke(tint(c, 0.25), 5, { 'stroke-opacity': 0.3 }))
  return out
}

// Quần jeans trải phẳng
function jeans(c, o = {}) {
  const thread = o.thread ?? '#D9A441'
  const rivet = '#C9A55A'
  const legs =
    'M-124 -162H124Q138 -60 136 40L124 262L28 266L0 -12L-28 266L-124 262L-136 40Q-138 -60 -124 -162Z'
  let out = path(legs, soft(twill(c, shade(c, 0.1)), 6))
  const clip = clipOf(path(legs))
  // vệt bạc màu trên đùi, nếp nhăn quanh đáy
  let fade = ''
  for (const k of [-1, 1]) {
    fade += ellipse(k * 78, -10, 46, 120, { fill: tint(c, 0.35), 'fill-opacity': 0.22 })
    fade += ellipse(k * 76, 190, 34, 50, { fill: tint(c, 0.3), 'fill-opacity': 0.12 })
    for (let i = 0; i < 3; i++)
      fade += path(
        `M${k * 10} ${-44 + i * 12}q${k * 16} ${-5} ${k * 32} ${1 + i * 2}`,
        stroke(tint(c, 0.4), 2.5, { 'stroke-opacity': 0.3 })
      )
  }
  out += g({ 'clip-path': clip }, fade)
  // lưng quần, đỉa, nút
  out += rect(-127, -190, 254, 30, {
    rx: 6,
    fill: shade(c, 0.04),
    stroke: shade(c, 0.22),
    'stroke-width': 1.5,
  })
  out += path('M-122 -182H122M-122 -168H122', stitch(thread, 1.4, '5 4'))
  for (const x of [-106, -54, 54, 106])
    out += rect(x - 5, -194, 10, 38, {
      rx: 3,
      fill: shade(c, 0.06),
      stroke: shade(c, 0.25),
      'stroke-width': 1.2,
    })
  out += circle(16, -176, 7, { fill: rivet, stroke: shade(rivet, 0.3), 'stroke-width': 1.5 })
  // cửa quần chữ J, đường giữa
  out += path('M0 -160V-14', stroke(shade(c, 0.28), 2))
  out += path('M12 -160V-66Q12 -40 -2 -34', stitch(thread, 1.6))
  // túi trước, túi đồng xu, đinh tán
  const pocket =
    path('M54 -160Q62 -112 131 -110', stroke(shade(c, 0.3), 2.2)) +
    path('M62 -160Q70 -120 131 -118', stitch(thread, 1.4, '5 4')) +
    path('M84 -160V-136Q98 -128 114 -132V-160', stitch(thread, 1.3, '4 4')) +
    circle(56, -156, 3, { fill: rivet }) +
    circle(129, -112, 3, { fill: rivet })
  out += pocket + mirrorX(pocket)
  // gấu, đường may sườn
  out += path('M30 252L124 248M-30 252L-124 248', stitch(thread, 1.6))
  out += path(
    'M134 -40L123 258M-134 -40L-123 258',
    stroke(shade(c, 0.2), 1.6, { 'stroke-opacity': 0.7 })
  )
  return out
}

// Quần short kaki gấu lật
function shorts(c) {
  const legs =
    'M-122 -96H122Q134 -40 140 40L150 104L30 116L0 24L-30 116L-150 104L-140 40Q-134 -40 -122 -96Z'
  let out = path(legs, soft(twill(c, shade(c, 0.05), 6, 1.2), 6))
  const clip = clipOf(path(legs))
  out += g(
    { 'clip-path': clip },
    path('M138 64L150 104L30 116L24 82Z', { fill: tint(c, 0.08) }) +
      path('M-138 64L-150 104L-30 116L-24 82Z', { fill: tint(c, 0.08) }) +
      path('M24 82L138 64M-24 82L-138 64', stroke(shade(c, 0.2), 2)) +
      path('M28 96L144 82M-28 96L-144 82', stitch(shade(c, 0.25), 1.3, '4 4'))
  )
  out += rect(-125, -122, 250, 28, {
    rx: 6,
    fill: shade(c, 0.03),
    stroke: shade(c, 0.2),
    'stroke-width': 1.4,
  })
  out += path('M-120 -108H120', stitch(shade(c, 0.28), 1.3, '5 4'))
  for (const x of [-104, -50, 50, 104])
    out += rect(x - 5, -126, 10, 36, {
      rx: 3,
      fill: shade(c, 0.05),
      stroke: shade(c, 0.25),
      'stroke-width': 1.1,
    })
  out += circle(14, -108, 6, { fill: '#5B4632' })
  out += path('M0 -94V20', stroke(shade(c, 0.25), 2))
  out += path('M12 -94V-24Q12 -6 0 0', stitch(shade(c, 0.3), 1.5))
  const pocket =
    path('M62 -94L128 -30', stroke(shade(c, 0.28), 2.2)) +
    path('M72 -94L130 -38', stitch(shade(c, 0.3), 1.3, '4 4'))
  out += pocket + mirrorX(pocket)
  return out
}

// Đầm midi cổ V tay bèo, chiết eo có dây buộc; o.fill: vải hoa
function dress(c, o = {}) {
  const fill = o.fill ?? cloth(c)
  const d =
    'M-40 -192L0 -128L40 -192L90 -180Q124 -168 142 -138Q134 -112 116 -100Q100 -114 88 -118Q80 -90 74 -60L186 196Q0 226 -186 196L-74 -60Q-80 -90 -88 -118Q-100 -114 -116 -100Q-134 -112 -142 -138Q-124 -168 -90 -180Z'
  let out = path(d, soft(fill, 6))
  out += path('M-40 -192Q0 -202 40 -192L0 -128Z', { fill: shade(o.base ?? c, 0.12) })
  out += path('M-40 -192L0 -128L40 -192', stroke(shade(o.base ?? c, 0.1), 5))
  const clip = clipOf(path(d))
  // nếp xòe của chân váy
  let folds = ''
  for (const x of [-120, -64, -12, 44, 104]) {
    folds += path(
      `M${x * 0.3} -50Q${x * 0.8} 60 ${x * 1.25} 206`,
      stroke(shade(o.base ?? c, 0.25), 7, { 'stroke-opacity': 0.12 })
    )
    folds += path(
      `M${x * 0.3 + 12} -50Q${x * 0.8 + 16} 60 ${x * 1.25 + 24} 206`,
      stroke('#FFFFFF', 6, { 'stroke-opacity': 0.14 })
    )
  }
  folds += path('M-186 192Q0 222 186 192', stitch(shade(o.base ?? c, 0.3), 1.6))
  out += g({ 'clip-path': clip }, folds)
  // đai eo và nơ
  const tie = o.tie ?? shade(o.base ?? c, 0.05)
  out += path('M-76 -66Q0 -58 76 -66L78 -50Q0 -42 -78 -50Z', {
    fill: tie,
    stroke: shade(tie, 0.2),
    'stroke-width': 1.2,
  })
  out += path('M30 -54Q14 -84 -6 -72Q-10 -58 26 -56Z', soft(tie, 3))
  out += path('M34 -54Q60 -86 72 -66Q66 -52 38 -54Z', soft(tie, 3))
  out += path('M30 -54Q26 -10 10 26', stroke(tie, 9))
  out += path('M36 -54Q52 -14 60 30', stroke(tie, 9))
  out += circle(33, -56, 7, { fill: shade(tie, 0.08) })
  return out
}

// Túi tote vải canvas quai da
function tote(c, strap) {
  let out = path(
    'M-62 -40V-110Q-62 -196 0 -196Q62 -196 62 -110V-40',
    stroke(shade(strap, 0.18), 17)
  )
  out += path('M-72 -40V-118Q-72 -208 0 -208Q72 -208 72 -118V-40', stroke(strap, 17))
  out += path(
    'M-72 -40V-118Q-72 -208 0 -208Q72 -208 72 -118V-40',
    stitch(tint(strap, 0.35), 1.2, '4 4')
  )
  out += path(
    'M-136 -50H136L130 190Q130 198 122 198H-122Q-130 198 -130 190Z',
    soft(weave(c, shade(c, 0.07)), 6)
  )
  out += rect(-138, -56, 276, 30, { rx: 5, fill: shade(c, 0.06) })
  out += path('M-132 -32H132', stitch(shade(c, 0.28), 1.5))
  for (const k of [-1, 1]) {
    out += rect(k * 72 - 14, -48, 28, 36, { rx: 4, fill: strap })
    out += circle(k * 72, -38, 3, { fill: '#C9A55A' }) + circle(k * 72, -22, 3, { fill: '#C9A55A' })
  }
  out += path('M-100 40Q-80 120 -110 180', stroke(shade(c, 0.08), 6, { 'stroke-opacity': 0.5 }))
  out += path('M90 10Q70 110 96 186', stroke('#FFFFFF', 6, { 'stroke-opacity': 0.3 }))
  return out
}

// Túi đeo chéo da nhỏ
function crossbody(c) {
  let out = path('M-70 -30Q-120 -150 0 -160Q120 -150 70 -30', stroke(shade(c, 0.1), 7))
  out += rect(-90, -40, 180, 120, { rx: 18, fill: cloth(c, 0.08) })
  out += path('M-90 -22Q-90 -40 -72 -40H72Q90 -40 90 -22V20Q0 46 -90 20Z', {
    fill: tint(c, 0.08),
    stroke: shade(c, 0.2),
    'stroke-width': 1.5,
  })
  out += path('M-80 -16V16Q0 38 80 16V-16', stitch(tint(c, 0.4), 1.3, '4 4'))
  out += rect(-14, 22, 28, 18, { rx: 4, fill: '#D4B26A', stroke: '#A8853F', 'stroke-width': 1.5 })
  return out
}

// Mũ bucket nhìn chính diện
function bucketHat(c) {
  let out = path('M-84 -30L-74 -118Q0 -136 74 -118L84 -30Z', soft(cloth(c, 0.06), 10))
  out += path('M-76 -96Q0 -112 76 -96', stitch(shade(c, 0.22), 1.4, '5 4'))
  out += path('M-80 -62Q0 -74 80 -62', stitch(shade(c, 0.22), 1.4, '5 4'))
  out += path('M-86 -40Q0 -50 86 -40L86 -26Q0 -36 -86 -26Z', { fill: shade(c, 0.12) })
  out += path('M-84 -28Q0 -40 84 -28L138 30Q0 56 -138 30Z', soft(tint(c, 0.04), 8))
  for (const k of [0.3, 0.6])
    out += path(
      `M${-84 - 54 * k} ${-28 + 58 * k}Q0 ${-40 + 92 * k} ${84 + 54 * k} ${-28 + 58 * k}`,
      stitch(shade(c, 0.22), 1.4, '5 4')
    )
  out +=
    circle(-40, -100, 4, { fill: shade(c, 0.25) }) + circle(40, -100, 4, { fill: shade(c, 0.25) })
  return out
}

// Thắt lưng da cuộn tròn (xoắn ốc nhìn từ trên)
function rolledBelt(c) {
  let d = ''
  const turns = 3.2
  for (let i = 0; i <= 160; i++) {
    const t = (i / 160) * turns * Math.PI * 2
    const r = 22 + (t / (Math.PI * 2)) * 24
    d += `${i ? 'L' : 'M'}${r2(Math.cos(t) * r)} ${r2(Math.sin(t) * r)}`
  }
  let out = path(d, stroke(shade(c, 0.2), 24))
  out += path(d, stroke(c, 20))
  out += path(d, stitch(tint(c, 0.35), 1.2, '4 4'))
  const end = 22 + turns * 24
  const ex = Math.cos(turns * Math.PI * 2) * end
  const ey = Math.sin(turns * Math.PI * 2) * end
  out += path(
    `M${r2(ex)} ${r2(ey)}L${r2(ex + 10)} ${r2(ey + 70)}`,
    stroke(c, 20, { 'stroke-linecap': 'butt' })
  )
  out += rect(ex - 18, ey + 62, 56, 44, {
    rx: 8,
    fill: 'none',
    stroke: '#C9A55A',
    'stroke-width': 7,
    transform: `rotate(8 ${r2(ex + 10)} ${r2(ey + 84)})`,
  })
  out += path(`M${r2(ex + 10)} ${r2(ey + 64)}L${r2(ex + 13)} ${r2(ey + 104)}`, stroke('#C9A55A', 5))
  return out
}

// Đôi tất cổ cao kẻ sọc
function sock(c, stripe) {
  const d = 'M-24 -96H24V24Q24 46 46 50L78 56Q100 60 98 82Q96 104 72 102L6 98Q-24 96 -24 64Z'
  let out = path(d, soft(c, 6))
  out += g(
    { 'clip-path': clipOf(path(d)) },
    rect(-30, -96, 60, 30, { fill: shade(c, 0.06) }) +
      range(6)
        .map((i) => path(`M${-16 + i * 7} -94V-68`, stroke(shade(c, 0.16), 1.6)))
        .join('') +
      rect(-30, -50, 60, 9, { fill: stripe }) +
      rect(-30, -34, 60, 5, { fill: stripe }) +
      path('M60 52Q86 54 98 76V110H60Z', { fill: shade(c, 0.1) })
  )
  return out
}

// ============================================================ Đồ trang trí flat-lay
// Cành bạch đàn lá tròn
function eucalyptus(len, c = '#93A68A', rnd = () => 0.5) {
  let out = path(
    `M0 0Q${len * 0.1} ${-len * 0.5} ${-len * 0.05} ${-len}`,
    stroke(shade(c, 0.25), 3)
  )
  const n = Math.round(len / 34)
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 0.6)
    const y = -len * t
    const x = Math.sin(t * Math.PI) * len * 0.06
    const k = i % 2 ? 1 : -1
    const r = 17 - t * 8 + rnd() * 3
    out += ellipse(x + k * r * 0.9, y, r, r * 0.86, {
      fill: i % 3 ? c : tint(c, 0.15),
      stroke: shade(c, 0.12),
      'stroke-width': 1.2,
    })
  }
  return out
}

// Cành bông vải
function cottonBranch(rnd) {
  const boll = (s) => {
    let o = ''
    for (let i = 0; i < 5; i++) {
      const a = i * 72 - 90
      o += put(
        0,
        0,
        a,
        1,
        path(`M0 0L${s * 0.9} ${-s * 0.25}L${s * 1.25} 0L${s * 0.9} ${s * 0.25}Z`, {
          fill: '#7A5236',
        })
      )
    }
    const puffs = [
      [0, -s * 0.38, s * 0.62],
      [-s * 0.42, s * 0.1, s * 0.58],
      [s * 0.42, s * 0.1, s * 0.58],
      [0, s * 0.42, s * 0.5],
    ]
    for (const [x, y, r] of puffs) {
      o += circle(x, y + 3, r, { fill: '#DCD6CB' })
      o += circle(x, y, r, { fill: '#FBFAF6' })
      o += circle(x - r * 0.3, y - r * 0.3, r * 0.3, { fill: '#FFFFFF' })
    }
    return o
  }
  let out = path('M0 160Q-6 60 14 -20Q24 -70 10 -130', stroke('#6B4A32', 6))
  out += path('M6 40Q40 10 70 -10', stroke('#6B4A32', 5))
  out += path('M14 -40Q-20 -70 -52 -78', stroke('#6B4A32', 5))
  out += put(70, -14, 10, 1, boll(34 + rnd() * 4))
  out += put(-56, -82, -10, 1, boll(30 + rnd() * 4))
  out += put(10, -136, 0, 1, boll(36))
  out += put(-4, 100, -30, 1, path('M0 0Q24 -26 54 -10Q30 14 0 0Z', { fill: '#A08A62' }))
  return out
}

// Mũ cói rộng vành nhìn từ trên xuống
function strawHat(rnd) {
  const c = '#E3C48D'
  let out = circle(0, 0, 176, { fill: cloth(c, 0.08) })
  for (let r = 96; r < 172; r += 9)
    out += circle(0, 0, r, stitch(shade(c, 0.12 + rnd() * 0.04), 2.2, '7 4'))
  out += circle(0, 0, 176, { fill: 'none', stroke: shade(c, 0.12), 'stroke-width': 4 })
  out += circle(0, 4, 92, { fill: shade(c, 0.12), 'fill-opacity': 0.5 })
  out += circle(0, 0, 88, { fill: tint(c, 0.06) })
  for (let r = 14; r < 84; r += 9) out += circle(0, 0, r, stitch(shade(c, 0.12), 2, '6 4'))
  out += circle(0, 0, 86, { fill: 'none', stroke: '#2B2B2B', 'stroke-width': 13 })
  out += path('M60 60Q90 110 80 150', stroke('#2B2B2B', 10))
  out += path('M66 56Q114 90 128 128', stroke('#2B2B2B', 10))
  return out
}

function sunglasses() {
  const frame = '#5A3A26'
  const lens = (x) =>
    ellipse(x, 0, 50, 42, { fill: '#2F3338', stroke: frame, 'stroke-width': 9 }) +
    path(
      `M${x - 30} -18Q${x - 14} -30 ${x + 6} -28`,
      stroke('#FFFFFF', 5, { 'stroke-opacity': 0.35 })
    )
  return (
    path('M-104 -10L-150 -26M104 -10L150 -26', stroke(frame, 8)) +
    lens(-56) +
    lens(56) +
    path('M-10 -10Q0 -20 10 -10', stroke(frame, 8))
  )
}

// Hộp giấy kraft mở nắp nhìn từ trên; inner: nội dung trong lòng hộp
function openBox(inner) {
  const k = '#C99A62'
  const flap = (d) => path(d, soft(tint(k, 0.14), 4))
  let out =
    flap('M-200 -130L200 -130L176 -214L-176 -214Z') +
    flap('M-200 130L200 130L184 196L-184 196Z') +
    flap('M-200 -130L-200 130L-282 112L-282 -112Z') +
    flap('M200 -130L200 130L282 112L282 -112Z')
  out += path('M-176 -214L176 -214', stroke(shade(k, 0.08), 3))
  out += rect(-200, -130, 400, 260, { fill: shade(k, 0.12) })
  out += rect(-184, -114, 368, 228, { fill: shade(k, 0.28) })
  out += path(
    'M-200 -130L-184 -114M200 -130L184 -114M-200 130L-184 114M200 130L184 114',
    stroke(shade(k, 0.35), 2)
  )
  out += g({ 'clip-path': clipOf(rect(-184, -114, 368, 228)) }, inner)
  // băng keo giấy ở nắp trên
  out += rect(-40, -214, 80, 46, { fill: '#E9D8B8', 'fill-opacity': 0.85 })
  return out
}
// Giấy lụa gói hàng nhàu
function tissue(rnd, w, h) {
  let out = ''
  for (let i = 0; i < 5; i++) {
    const pts = range(7).map((j) => {
      const a = (j / 7) * Math.PI * 2 + i
      return [Math.cos(a) * w * (0.4 + rnd() * 0.25), Math.sin(a) * h * (0.4 + rnd() * 0.25)]
    })
    out += path('M' + pts.map((p) => `${r2(p[0])} ${r2(p[1])}`).join('L') + 'Z', {
      fill: '#FFFFFF',
      'fill-opacity': 0.55,
      stroke: '#E9E4DA',
      'stroke-width': 2,
      'stroke-linejoin': 'round',
    })
  }
  return out
}
// Gói hàng đã buộc dây
function parcel(w, h) {
  const k = '#C99A62'
  let out = rect(-w / 2, -h / 2, w, h, { rx: 6, fill: cloth(k, 0.06) })
  out += rect(-w / 2, -h / 2, w, 10, { fill: shade(k, 0.08), rx: 4 })
  out += path(`M${-w / 2} -6H${w / 2}M-14 ${-h / 2}V${h / 2}`, stroke('#F4EEE2', 6))
  out += path(`M${-w / 2} -6H${w / 2}M-14 ${-h / 2}V${h / 2}`, stitch('#D7CBB5', 2, '3 5'))
  out += path(
    'M-14 -6Q-50 -46 -40 -10Q-30 6 -14 -6Q22 -46 14 -10Q4 6 -14 -6Z',
    stroke('#F4EEE2', 5)
  )
  out += path('M-14 -6L-34 30M-14 -6L4 34', stroke('#F4EEE2', 5))
  return out
}
// Thẻ treo trống (không chữ)
function blankTag(c = '#F4EEE2') {
  return (
    path('M0 -60Q10 -110 -30 -130', stroke('#B38B5D', 3)) +
    path('M-34 -50L34 -50L34 70Q34 76 28 76H-28Q-34 76 -34 70V-50L0 -76Z', soft(c, 4)) +
    circle(0, -54, 7, { fill: 'none', stroke: '#B38B5D', 'stroke-width': 3 }) +
    rect(-20, 4, 40, 4, { rx: 2, fill: shade(c, 0.12) }) +
    rect(-20, 18, 26, 4, { rx: 2, fill: shade(c, 0.12) })
  )
}

// ============================================================ Ảnh danh mục 600×600
const CATS = {
  AT: () =>
    put(338, 270, 9, 0.72, shadowed(tee('#1F2C4A'))) +
    put(282, 336, -5, 0.8, shadowed(tee('#F7F6F2'))),
  SM: () =>
    put(
      300,
      306,
      0,
      0.88,
      shadowed(shirt('#F7F6F2', { fill: stripes('#F7F6F2', '#6F8FB6', 13, 3) }))
    ),
  AK: () => put(300, 306, 0, 0.86, shadowed(jacket('#5D6B3B'))),
  QJ: () => put(300, 268, 0, 0.84, shadowed(jeans('#3A5A86'))),
  QK: () => put(300, 312, -4, 1.12, shadowed(shorts('#C4A877'))),
  VD: () =>
    put(
      300,
      306,
      0,
      0.94,
      shadowed(
        dress('#F6EEE6', {
          fill: floral('#F6EEE6', '#C76F86', '#E3A9B4', '#7E9C6B'),
          base: '#F6EEE6',
          tie: '#E9C9CF',
        })
      )
    ),
  TX: () =>
    put(268, 300, -4, 0.86, shadowed(tote('#E8DCC4', '#7C4A2D'))) +
    put(420, 430, 10, 0.72, shadowed(crossbody('#A0613A'))),
  PK: () =>
    put(250, 214, -8, 0.95, shadowed(bucketHat('#EFE5CF'))) +
    put(386, 366, -40, 0.72, shadowed(rolledBelt('#7A5236'))) +
    put(190, 420, -12, 0.86, shadowed(sock('#8E9196', BRAND))),
}

function renderCategory(cat) {
  const rnd = mulberry32(hashStr(cat.code))
  const bg = tint(cat.color, 0.88)
  resetDefs(shade(cat.color, 0.55))
  let body = rect(0, 0, CAT_SIZE, CAT_SIZE, { fill: bg })
  body += circle(300, 300, 238, { fill: tint(cat.color, 0.79) })
  body += circle(492, 104, 34 + rnd() * 8, { fill: tint(cat.color, 0.74), 'fill-opacity': 0.6 })
  body += circle(96, 512, 22 + rnd() * 6, { fill: tint(cat.color, 0.74), 'fill-opacity': 0.6 })
  const draw = CATS[cat.code]
  if (!draw) throw new Error(`Chưa có hình cho danh mục ${cat.code}`)
  body += draw(cat, rnd)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CAT_SIZE}" height="${CAT_SIZE}" viewBox="0 0 ${CAT_SIZE} ${CAT_SIZE}"><defs>${defs.join('')}</defs>${body}</svg>`
}

// ============================================================ Banner 1600×700
// Nền: màu dịu, vệt sáng phía trái (vùng chữ), đĩa màu nhạt sau cụm chủ thể
function bannerBg(base, accent) {
  const fade = linGrad(
    [
      [0, tint(base, 0.35)],
      [0.45, base],
      [1, base],
    ],
    'h'
  )
  return (
    rect(0, 0, BAN_W, BAN_H, { fill: fade }) +
    circle(940, 350, 330, { fill: accent, 'fill-opacity': 0.55 }) +
    circle(1460, 90, 70, { fill: accent, 'fill-opacity': 0.45 }) +
    circle(560, 640, 40, { fill: accent, 'fill-opacity': 0.4 })
  )
}

const BANNERS = {
  // Cotton mặc mỗi ngày: áo thun trắng trải phẳng, chồng áo gấp, cành bông vải, lá bạch đàn
  'hero-1': (rnd) => {
    const base = '#E4E9F4'
    let out = bannerBg(base, tint(BRAND, 0.8))
    out += put(700, 560, -128, 1.1, eucalyptus(240, '#93A68A', rnd))
    out += put(650, 300, -18, 0.95, shadowed(cottonBranch(rnd)))
    out += put(900, 360, -4, 1.32, shadowed(tee('#F7F6F2')))
    const stack = ['#D8C6A6', '#1F2C4A', '#9DB6D3', '#F7F6F2']
    stack.forEach((c, i) => {
      out += put(1222 - i * 3, 560 - i * 34, 2 - i * 1.5, 0.92, shadowed(foldedTee(c)))
    })
    out += put(1420, 330, 18, 0.95, eucalyptus(220, '#A3B49A', rnd))
    return out
  },
  // Váy đầm mùa hè: đầm midi hoa nhí, mũ cói, kính râm, cành lá
  'hero-2': (rnd) => {
    const base = '#F6E6E3'
    let out = bannerBg(base, '#F1D3D2')
    out += put(640, 520, -140, 1.05, eucalyptus(220, '#8FA78A', rnd))
    out += put(1210, 230, 0, 0.92, shadowed(strawHat(rnd)))
    out += put(
      910,
      362,
      -3,
      1.42,
      shadowed(
        dress('#EEF3F8', {
          fill: floral('#EEF3F8', '#5F86B3', '#86A9C9', '#7E9C6B', '#F2D27A'),
          base: '#EEF3F8',
          tie: '#C9D8E8',
        })
      )
    )
    out += put(1230, 545, 12, 0.92, shadowed(sunglasses()))
    out += put(650, 200, 20, 0.62, shadowed(crossbody('#C9A27A')))
    return out
  },
  // Miễn phí vận chuyển: hộp kraft mở có áo gấp và giấy lụa, gói hàng buộc dây, thẻ treo trống
  'hero-3': (rnd) => {
    const base = '#EFE7DA'
    let out = bannerBg(base, '#E5D6BF')
    // đường nét đứt gợi hành trình giao hàng
    out += path('M520 600Q640 470 600 360Q560 250 690 170', stitch(tint(BRAND, 0.45), 4, '14 12'))
    out += put(690, 166, 0, 1, circle(0, 0, 12, { fill: tint(BRAND, 0.45) }))
    const inner =
      tissue(rnd, 420, 300) +
      put(-60, 10, -6, 0.95, foldedTee('#1F2C4A')) +
      put(70, -10, 8, 0.82, shadowed(foldedTee('#F7F6F2'))) +
      put(80, 70, 4, 0.7, foldedTee('#D8C6A6'))
    out += put(930, 350, 0, 1.12, shadowed(openBox(inner)))
    out += put(1310, 540, -8, 0.85, shadowed(parcel(220, 150)))
    out += put(1300, 300, 14, 1, shadowed(blankTag()))
    out += put(1450, 330, 12, 0.85, eucalyptus(200, '#9AA88D', rnd))
    return out
  },
}

function renderBanner(name) {
  const rnd = mulberry32(hashStr(name))
  resetDefs('#3A3226')
  const draw = BANNERS[name]
  if (!draw) throw new Error(`Chưa có hình cho banner ${name}`)
  const body = draw(rnd)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BAN_W}" height="${BAN_H}" viewBox="0 0 ${BAN_W} ${BAN_H}"><defs>${defs.join('')}</defs>${body}</svg>`
}

// ============================================================ Logo (vector)
// Chữ N viết liền một nét như sợi chỉ, đuôi chỉ cuộn nhẹ; đường khâu mũi chỉ phía dưới
const MARK_BODY =
  `<rect width="64" height="64" rx="14" fill="${BRAND}"/>` +
  '<path d="M17 45V22.4c0-1.9 2.4-2.7 3.6-1.2l16.8 21.6c1.2 1.5 3.6.7 3.6-1.2V19.5c0-3.6 2.7-6 5.6-5.3 2.4.6 3 3.6.6 4.6" fill="none" stroke="#FFFFFF" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<path d="M16 52.5h32" fill="none" stroke="#FFFFFF" stroke-opacity=".7" stroke-width="2" stroke-linecap="round" stroke-dasharray="3.6 3.4"/>'
const LOGO_MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Nhà Sợi">${MARK_BODY}</svg>\n`
const LOGO_FULL =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 64" role="img" aria-label="Nhà Sợi">${MARK_BODY}` +
  `<text x="78" y="42.5" fill="${BRAND}" font-family="'Be Vietnam Pro','Segoe UI','Helvetica Neue',Arial,sans-serif" font-size="29" font-weight="600" letter-spacing="0.4">Nhà Sợi</text>` +
  '</svg>\n'

// ============================================================ Xuất
async function encodeWebp(svg, max) {
  const png = await sharp(Buffer.from(svg)).png().toBuffer()
  for (let q = 88; q >= 40; q -= 6) {
    const buf = await sharp(png).webp({ quality: q, effort: 6, smartSubsample: true }).toBuffer()
    if (buf.length <= max) return { buf, q, png }
  }
  throw new Error(`Ảnh vượt ${max / 1000} KB ở mọi mức chất lượng`)
}

async function emit(dir, file, svg, max) {
  const { buf, q, png } = await encodeWebp(svg, max)
  writeFileSync(join(dir, file), buf)
  if (PREVIEW) writeFileSync(join(PREVIEW, file.replace(/\.\w+$/, '.png')), png)
  console.log(`${file.padEnd(14)} ${(buf.length / 1024).toFixed(1).padStart(6)} KB  q${q}`)
}

async function main() {
  const data = JSON.parse(readFileSync(DATA_FILE, 'utf8'))
  if (PREVIEW) mkdirSync(PREVIEW, { recursive: true })

  if (!ONLY || 'logo'.includes(ONLY)) {
    mkdirSync(LOGO_DIR, { recursive: true })
    writeFileSync(join(LOGO_DIR, 'logo-mark.svg'), LOGO_MARK)
    writeFileSync(join(LOGO_DIR, 'logo.svg'), LOGO_FULL)
    writeFileSync(ICON_FILE, LOGO_MARK)
    if (PREVIEW) {
      await sharp(Buffer.from(LOGO_MARK), { density: 576 })
        .png()
        .toFile(join(PREVIEW, 'logo-mark.png'))
      await sharp(Buffer.from(LOGO_FULL), { density: 288 }).png().toFile(join(PREVIEW, 'logo.png'))
    }
    console.log('logo-mark.svg, logo.svg, src/app/icon.svg')
  }

  mkdirSync(CAT_DIR, { recursive: true })
  for (const cat of data.categories) {
    const file = cat.image || `${cat.code}.webp`
    if (ONLY && !file.includes(ONLY)) continue
    await emit(CAT_DIR, file, renderCategory(cat), CAT_MAX)
  }

  mkdirSync(BANNER_DIR, { recursive: true })
  for (const b of data.banners) {
    if (ONLY && !b.image.includes(ONLY)) continue
    await emit(BANNER_DIR, b.image, renderBanner(b.image.replace(/\.\w+$/, '')), BAN_MAX)
  }
}

await main()
