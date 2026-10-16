import { StatusBadge } from '@/components/shared/StatusBadge'
import { customerTagLabels } from '@/config/shop-labels'
import type { CustomerTag } from '@/types/shop'

/** Nhãn khách (BR-21): Khách VIP, Cần lưu ý */
export const CustomerTags = ({ tags }: { tags: CustomerTag[] }) => (
  <span className="flex flex-wrap gap-1">
    {tags.map((t) => (
      <StatusBadge key={t} tone={t === 'KhachVip' ? 'success' : 'warning'} dot={false} className="h-5 px-2 text-[0.6875rem]">
        {customerTagLabels[t]}
      </StatusBadge>
    ))}
  </span>
)
