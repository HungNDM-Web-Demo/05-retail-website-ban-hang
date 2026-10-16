'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PaginationQuery } from '@/types/api'
import type { CouponQuery, SaveCouponRequest } from '@/types/shop'
import { couponService } from '../services/coupon.service'

export const couponKeys = {
  list: (q: CouponQuery) => ['coupons', q] as const,
  detail: (id: string) => ['coupon', id] as const,
  orders: (id: string, q: PaginationQuery) => ['coupon', id, 'orders', q] as const,
}

export const useCoupons = (q: CouponQuery) =>
  useQuery({ queryKey: couponKeys.list(q), queryFn: () => couponService.list(q), placeholderData: keepPreviousData })
export const useCoupon = (id: string | undefined) =>
  useQuery({ queryKey: couponKeys.detail(id ?? ''), queryFn: () => couponService.detail(id!), enabled: !!id })
export const useCouponOrders = (id: string | undefined, q: PaginationQuery) =>
  useQuery({
    queryKey: couponKeys.orders(id ?? '', q),
    queryFn: () => couponService.orders(id!, q),
    enabled: !!id,
    placeholderData: keepPreviousData,
  })

function useCouponMutation<A, R>(fn: (a: A) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['coupons'] })
      void qc.invalidateQueries({ queryKey: ['coupon'] })
      void qc.invalidateQueries({ queryKey: ['reports'] })
    },
  })
}

export const useSaveCoupon = () =>
  useCouponMutation(({ id, body }: { id?: string; body: SaveCouponRequest }) =>
    id ? couponService.update(id, body) : couponService.create(body)
  )
export const usePauseCoupon = () =>
  useCouponMutation(({ id, paused }: { id: string; paused: boolean }) => couponService.pause(id, paused))
export const useDeleteCoupon = () => useCouponMutation((id: string) => couponService.remove(id))
