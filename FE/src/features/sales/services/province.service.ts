import { apiRoutes } from '@/config/api-routes'
import { isMockMode, mockDelay } from '@/lib/data-source'
import type { ProvinceDto } from '@/types/shop'
import { seedProvinces } from '../lib/seed-expand'
import { publicHttp } from './public-http'

/** Danh mục hành chính `GET /api/provinces` (07 §2.1): công khai, chỉ đọc; mock đọc thẳng seed */
export const provinceService = {
  list: async (): Promise<ProvinceDto[]> => {
    if (isMockMode()) {
      await mockDelay(50, 120)
      return seedProvinces()
    }
    return (await publicHttp.get<ProvinceDto[]>(apiRoutes.provinces)).data
  },
}

/** TP.HCM và Hà Nội đầu danh sách (07 §4.3), còn lại giữ thứ tự danh mục */
export function sortProvincesForPicker(provinces: ProvinceDto[]): ProvinceDto[] {
  const rank = (p: ProvinceDto) => (p.zone === 'TpHcm' ? 0 : p.code === '01' ? 1 : 2)
  return [...provinces].sort((a, b) => rank(a) - rank(b))
}
