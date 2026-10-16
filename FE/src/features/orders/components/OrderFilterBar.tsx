'use client'

import { FilterX } from 'lucide-react'
import { SearchInput } from '@/components/shared/SearchInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { orderLabelLabels, paymentMethodShortLabels, paymentStatusLabels } from '@/config/shop-labels'
import { useProvinces } from '@/features/sales/hooks/use-provinces'
import type { OrderLabel, PaymentMethod, PaymentStatus } from '@/types/shop'
import { hasExtraFilters, type OrderFilters } from '../lib/order-ui'

const ALL = '__all'

/** Bộ lọc danh sách đơn (FR-21): tìm, khoảng ngày đặt, phương thức, tỉnh/thành, nhãn; ghi lên URL */
export function OrderFilterBar({
  filters,
  onChange,
  onReset,
  resetKey = 0,
}: {
  resetKey?: number
  filters: OrderFilters
  onChange: (patch: Partial<OrderFilters>) => void
  onReset: () => void
}) {
  const provinces = useProvinces()
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchInput
        key={resetKey}
        value={filters.search ?? ''}
        onSearch={(v) => v !== (filters.search ?? '') && onChange({ search: v || undefined })}
        placeholder="Mã đơn, số điện thoại, tên khách…"
        aria-label="Tìm đơn"
        className="w-full sm:w-72"
      />
      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          aria-label="Đặt từ ngày"
          value={filters.fromDate ?? ''}
          onChange={(e) => onChange({ fromDate: e.target.value || undefined })}
          className="w-38"
        />
        <span className="text-muted-foreground" aria-hidden="true">
          →
        </span>
        <Input
          type="date"
          aria-label="Đặt đến ngày"
          value={filters.toDate ?? ''}
          onChange={(e) => onChange({ toDate: e.target.value || undefined })}
          className="w-38"
        />
      </div>
      <Select
        value={filters.paymentMethod ?? ALL}
        onValueChange={(v) => onChange({ paymentMethod: v === ALL ? undefined : (v as PaymentMethod) })}
      >
        <SelectTrigger className="w-40" aria-label="Phương thức thanh toán">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Mọi phương thức</SelectItem>
          {(Object.keys(paymentMethodShortLabels) as PaymentMethod[]).map((m) => (
            <SelectItem key={m} value={m}>
              {paymentMethodShortLabels[m]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filters.provinceCode ?? ALL}
        onValueChange={(v) => onChange({ provinceCode: v === ALL ? undefined : v })}
      >
        <SelectTrigger className="w-44" aria-label="Tỉnh/thành">
          <SelectValue placeholder="Mọi tỉnh/thành" />
        </SelectTrigger>
        <SelectContent className="max-h-80">
          <SelectItem value={ALL}>Mọi tỉnh/thành</SelectItem>
          {(provinces.data ?? []).map((p) => (
            <SelectItem key={p.code} value={p.code}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filters.label ?? ALL}
        onValueChange={(v) => onChange({ label: v === ALL ? undefined : (v as OrderLabel) })}
      >
        <SelectTrigger className="w-40" aria-label="Nhãn">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Mọi nhãn</SelectItem>
          {(Object.keys(orderLabelLabels) as OrderLabel[]).map((l) => (
            <SelectItem key={l} value={l}>
              {orderLabelLabels[l]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {filters.paymentStatus && (
        <Select
          value={filters.paymentStatus}
          onValueChange={(v) => onChange({ paymentStatus: v === ALL ? undefined : (v as PaymentStatus) })}
        >
          <SelectTrigger className="w-40" aria-label="Thanh toán">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Mọi trạng thái thanh toán</SelectItem>
            {(Object.keys(paymentStatusLabels) as PaymentStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {paymentStatusLabels[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {hasExtraFilters(filters) && (
        <Button variant="ghost" onClick={onReset}>
          <FilterX aria-hidden="true" />
          Xóa bộ lọc
        </Button>
      )}
    </div>
  )
}
