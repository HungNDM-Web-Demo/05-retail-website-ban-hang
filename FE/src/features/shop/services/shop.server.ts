import { apiRoutes } from '@/config/api-routes'
import { serverFetch } from '@/lib/server-fetch'
import { systemSeed } from '@/mock/system-seed'
import { expandSeedCached } from '@/features/sales/lib/seed-expand'
import { storeInfoFromSettings } from '@/features/sales/lib/store-info'
import type {
  PublicCategory,
  PublicHome,
  PublicProductListResult,
  PublicProductLookup,
  PublicProductQuery,
  PublicStoreInfo,
} from '@/types/shop'
import {
  publicCategories,
  publicHome,
  publicProductLookup,
  publicProducts,
  sellingSlugs,
  type CatalogSnapshot,
} from '../lib/public-catalog'

/**
 * Dữ liệu cửa hàng phía máy chủ cho SEO (NFR-04, 07 §4.1): chế độ api gọi BE; chế độ mock chiếu từ seed
 * bằng chính hàm chiếu của handler (`lib/public-catalog.ts`). Trình duyệt đọc lại mock-db sau khi tải.
 */

function seedSnapshot(): CatalogSnapshot & { banners: PublicHome['banners'] } {
  const s = expandSeedCached(Date.now())
  return { categories: s.categories, colors: s.colors, products: s.products, banners: s.banners }
}

const seedSettings = () => Object.fromEntries(systemSeed.settings.map((x) => [x.key, x.value]))

export const getStoreServer = (): Promise<PublicStoreInfo> =>
  serverFetch(apiRoutes.public.store, {
    mock: () => storeInfoFromSettings(seedSettings()),
    fallback: storeInfoFromSettings(seedSettings()),
    revalidate: 300,
  })

export const getHomeServer = (): Promise<PublicHome> =>
  serverFetch(apiRoutes.public.home, {
    mock: () => {
      const s = seedSnapshot()
      return publicHome(s, s.banners)
    },
    revalidate: 60,
  }).then((home) => (home.banners.length ? home : { ...home, banners: seedSnapshot().banners }))

export const getCategoriesServer = (): Promise<PublicCategory[]> =>
  serverFetch(apiRoutes.public.categories, { mock: () => publicCategories(seedSnapshot()), fallback: [], revalidate: 300 })

function toQueryString(query: PublicProductQuery): string {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
  })
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/** Danh sách sản phẩm; danh mục không có thì trả null (trang chuyển về /products, UC-01 E2) */
export async function getProductsServer(query: PublicProductQuery): Promise<PublicProductListResult | null> {
  try {
    return await serverFetch(`${apiRoutes.public.products}${toQueryString(query)}`, {
      mock: () => publicProducts(seedSnapshot(), query),
      revalidate: 60,
    })
  } catch {
    return null
  }
}

/** Chi tiết theo slug; không có trong seed (mock) hoặc 404 (api) → null */
export async function getProductServer(slug: string): Promise<PublicProductLookup | null> {
  try {
    return await serverFetch(apiRoutes.public.product(encodeURIComponent(slug)), {
      mock: () => publicProductLookup(seedSnapshot(), slug),
      revalidate: 60,
    })
  } catch {
    return null
  }
}

/** Sitemap: slug sản phẩm đang bán, slug danh mục */
export async function getSitemapDataServer(): Promise<{ products: { slug: string; updatedAt: string }[]; categories: string[] }> {
  const categories = (await getCategoriesServer()).map((c) => c.slug)
  try {
    const list = await serverFetch(`${apiRoutes.public.products}?pageSize=48&page=1`, {
      mock: () => null as PublicProductListResult | null,
      revalidate: 3600,
    })
    if (!list) return { products: sellingSlugs(seedSnapshot()), categories }
    const products = list.items.map((p) => ({ slug: p.slug, updatedAt: p.createdAt }))
    for (let page = 2; page <= list.totalPages; page++) {
      const next = await serverFetch<PublicProductListResult>(`${apiRoutes.public.products}?pageSize=48&page=${page}`, {
        mock: () => list,
        revalidate: 3600,
      })
      products.push(...next.items.map((p) => ({ slug: p.slug, updatedAt: p.createdAt })))
    }
    return { products, categories }
  } catch {
    return { products: [], categories }
  }
}
