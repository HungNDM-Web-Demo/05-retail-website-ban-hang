'use client'

import { useQuery } from '@tanstack/react-query'
import { orderService } from '../services/order.service'

/** Thông tin cửa hàng cho phiếu giao (người gửi); cùng khóa ['public', 'store'] với cửa hàng (07 §4.9) */
export const useStoreInfo = () =>
  useQuery({ queryKey: ['public', 'store'], queryFn: orderService.storeInfo, staleTime: 5 * 60_000 })
