'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { isApiError } from '@/lib/api-error'
import { isMockMode } from '@/lib/data-source'
import type {
  AddOrderNoteRequest,
  BulkConfirmRequest,
  BulkShipRequest,
  CancelOrderRequest,
  ConfirmOrderRequest,
  ConfirmPaymentRequest,
  DeliveryFailedRequest,
  EditOrderRequest,
  OrderDetailDto,
  OrderQuery,
  RefundRequest,
  ShipOrderRequest,
  VersionedRequest,
} from '@/types/shop'
import { orderService } from '../services/order.service'

/** Query key dùng chung giữa hai agent FE (07 §4.9) */
export const orderKeys = {
  list: (q: OrderQuery) => ['orders', q] as const,
  counts: (q: OrderQuery) => ['orders-counts', q] as const,
  detail: (id: string) => ['order', id] as const,
}

/** Chế độ api: hỏi lại 30 giây (07 §2.10); mock đã tự làm mới qua mockDb.subscribe */
const polling = isMockMode() ? {} : { refetchInterval: 30_000, refetchOnWindowFocus: true }

export const useOrders = (query: OrderQuery) =>
  useQuery({
    queryKey: orderKeys.list(query),
    queryFn: () => orderService.list(query),
    placeholderData: keepPreviousData,
    ...polling,
  })

export const useOrderStatusCounts = (query: OrderQuery) =>
  useQuery({
    queryKey: orderKeys.counts(query),
    queryFn: () => orderService.statusCounts(query),
    placeholderData: keepPreviousData,
    ...polling,
  })

export const useOrder = (id: string | undefined) =>
  useQuery({
    queryKey: orderKeys.detail(id ?? ''),
    queryFn: () => orderService.detail(id!),
    enabled: !!id,
    retry: (count, error) => !(isApiError(error) && error.status === 404) && count < 2,
  })

/** Sau khi đơn đổi: làm mới danh sách, số trên tab, Tổng quan, khách, mã, báo cáo, tồn */
export function invalidateOrderViews(qc: QueryClient) {
  for (const key of ['orders', 'orders-counts', 'dashboard', 'customers', 'customer', 'coupons', 'coupon', 'reports', 'products', 'product']) {
    void qc.invalidateQueries({ queryKey: [key] })
  }
}

/** 409 DonDaThayDoi / DonDaBiHuy kèm `order`: thay cache để nhân viên xem lại (07 §3.6) */
export function applyConflictOrder(qc: QueryClient, error: unknown) {
  if (!isApiError(error) || error.status !== 409) return
  const order = error.problem.order as OrderDetailDto | undefined
  if (order?.id) qc.setQueryData(orderKeys.detail(order.id), order)
  invalidateOrderViews(qc)
}

type ActionMap = {
  confirm: ConfirmOrderRequest
  confirmPayment: ConfirmPaymentRequest
  cancel: CancelOrderRequest
  ship: ShipOrderRequest
  deliver: VersionedRequest
  deliveryFailed: DeliveryFailedRequest
  receiveReturn: VersionedRequest
  refund: RefundRequest
  edit: EditOrderRequest
  addNote: AddOrderNoteRequest
}
export type OrderActionKind = keyof ActionMap

/** Một hook cho mọi thao tác đổi đơn: thay cache bằng DTO trả về, xử lý 409 */
export function useOrderAction<K extends OrderActionKind>(id: string, kind: K) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ActionMap[K]) =>
      (orderService[kind] as (id: string, body: ActionMap[K]) => Promise<OrderDetailDto>)(id, body),
    onSuccess: (order) => {
      qc.setQueryData(orderKeys.detail(order.id), order)
      invalidateOrderViews(qc)
    },
    onError: (error) => applyConflictOrder(qc, error),
  })
}

export const useEditPreview = (id: string) =>
  useMutation({ mutationFn: (body: EditOrderRequest) => orderService.editPreview(id, body) })

export function useLabelPrinted() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => orderService.labelPrinted(id),
    onSuccess: (_, id) => void qc.invalidateQueries({ queryKey: orderKeys.detail(id) }),
  })
}

export function useBulkConfirm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: BulkConfirmRequest) => orderService.bulkConfirm(body),
    onSettled: () => invalidateOrderViews(qc),
  })
}

export function useBulkShip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: BulkShipRequest) => orderService.bulkShip(body),
    onSettled: () => invalidateOrderViews(qc),
  })
}
