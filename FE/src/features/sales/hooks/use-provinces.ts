import { useQuery } from '@tanstack/react-query'
import { provinceService } from '../services/province.service'

/** 34 tỉnh/thành kèm phường/xã; cache vô hạn (07 §2.1). Query key `['provinces']`. */
export function useProvinces() {
  return useQuery({
    queryKey: ['provinces'],
    queryFn: provinceService.list,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}
