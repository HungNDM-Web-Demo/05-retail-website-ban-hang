'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PaginationQuery } from '@/types/api'
import type { CustomerQuery } from '@/types/shop'
import { customerService } from '../services/customer.service'

export const customerKeys = {
  list: (q: CustomerQuery) => ['customers', q] as const,
  detail: (id: string) => ['customer', id] as const,
  orders: (id: string, q: PaginationQuery) => ['customer', id, 'orders', q] as const,
}

export const useCustomers = (q: CustomerQuery) =>
  useQuery({ queryKey: customerKeys.list(q), queryFn: () => customerService.list(q), placeholderData: keepPreviousData })
export const useCustomer = (id: string) =>
  useQuery({ queryKey: customerKeys.detail(id), queryFn: () => customerService.detail(id) })
export const useCustomerOrders = (id: string, q: PaginationQuery) =>
  useQuery({ queryKey: customerKeys.orders(id, q), queryFn: () => customerService.orders(id, q), placeholderData: keepPreviousData })

export function useUpdateCustomerNote(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (note?: string) => customerService.updateNote(id, note),
    onSuccess: (c) => {
      qc.setQueryData(customerKeys.detail(id), c)
      void qc.invalidateQueries({ queryKey: ['customers'] })
      void qc.invalidateQueries({ queryKey: ['order'] })
    },
  })
}
