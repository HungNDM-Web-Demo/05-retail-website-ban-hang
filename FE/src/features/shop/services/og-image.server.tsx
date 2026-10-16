import { realpathSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

/**
 * Ảnh chia sẻ mạng xã hội 1200×630 (NFR-04, chép từ demo Danh mục Demo): nền theo màu cửa hàng
 * tên chữ trắng đậm, kèm ảnh sản phẩm nếu có.
 * Chữ dùng Be Vietnam Pro (gói @fontsource, đủ dấu tiếng Việt); thiếu font thì dùng font mặc định.
 */

export const OG_SIZE = { width: 1200, height: 630 }

type Rgb = [number, number, number]

const hexToRgb = (hex: string): Rgb => {
  const value = /^#?([0-9a-f]{6})$/i.exec(hex.trim())?.[1] ?? '475569'
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)) as Rgb
}
const mix = (a: Rgb, b: Rgb, weight: number) =>
  `rgb(${a.map((v, i) => Math.round(v * weight + b[i] * (1 - weight))).join(' ')})`

const FONT_DIR = join(process.cwd(), 'node_modules', '@fontsource', 'be-vietnam-pro', 'files')

async function loadFonts() {
  const files = [
    // Bộ latin đứng trước (font chính), bộ latin-ext và vietnamese bù các ký tự có dấu
    ['latin', 700],
    ['latin', 500],
    ['latin-ext', 700],
    ['latin-ext', 500],
    ['vietnamese', 700],
    ['vietnamese', 500],
  ] as const
  const loaded = await Promise.all(
    files.map(async ([subset, weight]) => {
      try {
        const data = await readFile(
          join(FONT_DIR, `be-vietnam-pro-${subset}-${weight}-normal.woff`)
        )
        return { name: 'Be Vietnam Pro', data, weight, style: 'normal' as const }
      } catch {
        return null
      }
    })
  )
  return loaded.filter((font): font is NonNullable<typeof font> => font !== null)
}

type SharpFn = typeof import('sharp')

/**
 * Dùng đúng bản sharp mà Next.js đang dùng cho bộ tối ưu ảnh: nạp hai bản libvips khác phiên bản
 * trong cùng tiến trình (vd sharp của script sinh ảnh mẫu) gây lỗi "colourspace: parameter space not set".
 */
function loadSharp(): SharpFn {
  const nextPackage = realpathSync(join(process.cwd(), 'node_modules', 'next', 'package.json'))
  const mod = createRequire(nextPackage)('sharp') as SharpFn | { default: SharpFn }
  return 'default' in mod ? mod.default : mod
}

/** Ảnh đại diện trong public/ (ảnh mẫu /seed/...) đổi sang PNG data URL (ảnh WebP trình vẽ không đọc được). */
async function loadCover(url: string | null | undefined): Promise<string | null> {
  if (!url || !url.startsWith('/seed/') || url.includes('..')) return null
  try {
    const buffer = await readFile(join(process.cwd(), 'public', ...url.split('/').filter(Boolean)))
    const sharp = loadSharp()
    const png = await sharp(buffer)
      .resize({ width: 720, withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer()
    return `data:image/png;base64,${png.toString('base64')}`
  } catch {
    return null
  }
}

type OgInput = {
  title: string
  description?: string | null
  /** Nhãn nhỏ phía trên tiêu đề, vd tên nhóm ngành */
  tag?: string | null
  color: string
  coverUrl?: string | null
  /** Tên công ty / ứng dụng ở chân ảnh */
  footer: string
}

export async function renderOgImage(input: OgInput): Promise<ImageResponse> {
  const [fonts, cover] = await Promise.all([loadFonts(), loadCover(input.coverUrl)])
  const base = hexToRgb(input.color)
  const dark = mix(base, [0, 0, 0], 0.72)
  const light = mix(base, [255, 255, 255], 0.3)
  const solid = `rgb(${base.join(' ')})`
  const description =
    input.description && input.description.length > 150
      ? `${input.description.slice(0, 147)}…`
      : input.description

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
        backgroundImage: `linear-gradient(45deg, ${dark} 0%, ${solid} 48%, ${light} 100%)`,
        fontFamily: fonts.length ? 'Be Vietnam Pro' : undefined,
        color: 'white',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -180,
          right: -120,
          width: 560,
          height: 560,
          borderRadius: 9999,
          background: 'rgba(255,255,255,0.14)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -220,
          left: 260,
          width: 520,
          height: 520,
          borderRadius: 9999,
          background: 'rgba(255,255,255,0.08)',
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 0 56px 72px',
          width: cover ? 620 : 1060,
          height: '100%',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {input.tag && (
            <div
              style={{
                display: 'flex',
                alignSelf: 'flex-start',
                padding: '8px 20px',
                borderRadius: 9999,
                background: 'rgba(255,255,255,0.18)',
                fontSize: 26,
                fontWeight: 500,
                marginBottom: 28,
              }}
            >
              {input.tag}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              fontSize: input.title.length > 28 ? 60 : 72,
              fontWeight: 700,
              lineHeight: 1.12,
              letterSpacing: -1.5,
              textShadow: '0 2px 18px rgba(0,0,0,0.25)',
            }}
          >
            {input.title}
          </div>
          {description && (
            <div
              style={{
                display: 'flex',
                marginTop: 24,
                fontSize: 28,
                lineHeight: 1.4,
                color: 'rgba(255,255,255,0.92)',
                fontWeight: 500,
              }}
            >
              {description}
            </div>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: 26,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.9)',
          }}
        >
          <div
            style={{
              display: 'flex',
              width: 14,
              height: 14,
              borderRadius: 9999,
              background: 'white',
              marginRight: 14,
            }}
          />
          {input.footer}
        </div>
      </div>

      {cover && (
        <div
          style={{
            position: 'absolute',
            right: 70,
            top: 70,
            width: 392,
            height: 490,
            display: 'flex',
            borderRadius: 24,
            overflow: 'hidden',
            border: '8px solid rgba(255,255,255,0.9)',
            boxShadow: '0 30px 60px rgba(0,0,0,0.35)',
            transform: 'rotate(-4deg)',
            background: 'white',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- trình vẽ ảnh OG chỉ nhận thẻ img */}
          <img
            src={cover}
            alt=""
            width={392}
            height={490}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: "center" }}
          />
        </div>
      )}
    </div>,
    { ...OG_SIZE, fonts: fonts.length ? fonts : undefined }
  )
}
