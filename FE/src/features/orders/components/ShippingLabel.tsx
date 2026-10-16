import { carrierLabels, paymentMethodShortLabels } from '@/config/shop-labels'
import { formatDateTime, formatNumber, formatPhone, formatVnd } from '@/lib/format'
import type { OrderDetailDto, PublicStoreInfo } from '@/types/shop'
import { suggestWeightGrams, variantText } from '../lib/order-ui'
import { Barcode } from './Barcode'

/**
 * Phiếu giao A6 (SCR-13, FR-29, 07 §2.11): đơn vị vận chuyển chữ lớn, mã vận đơn + mã vạch, mã đơn + mã
 * vạch, người gửi, người nhận (số điện thoại đầy đủ), sản phẩm, khối lượng, tiền thu hộ chữ lớn, ghi chú.
 */
export function ShippingLabel({
  order,
  store,
  reprint,
}: {
  order: OrderDetailDto
  store: Pick<PublicStoreInfo, 'name' | 'hotline' | 'address'>
  reprint: boolean
}) {
  const s = order.shipment
  const qty = order.lines.reduce((sum, l) => sum + l.quantity, 0)
  return (
    <article className="shipping-label flex flex-col gap-[1.5mm]" aria-label={`Phiếu giao ${order.code}`}>
      <header className="label-box flex items-center justify-between gap-2">
        <span className="text-[20pt] leading-none font-black tracking-tight">{s ? carrierLabels[s.carrier] : 'Chưa bàn giao'}</span>
        <span className="text-right text-[9pt] leading-tight">
          {reprint && <span className="block text-[12pt] font-black">IN LẠI</span>}
          In lúc {formatDateTime(new Date())}
        </span>
      </header>

      <section className="label-box text-center">
        <p className="text-[9pt]">Mã vận đơn</p>
        {s ? <Barcode value={s.trackingCode} height={44} className="mx-auto" /> : <p className="py-2 text-[14pt] font-bold">Chưa bàn giao</p>}
      </section>

      <section className="grid grid-cols-2 gap-[1.5mm]">
        <div className="label-box">
          <p className="text-[9pt] font-bold uppercase">Người gửi</p>
          <p className="font-bold">{store.name}</p>
          <p>{store.hotline}</p>
          <p className="text-[9pt]">{store.address}</p>
        </div>
        <div className="label-box flex flex-col items-center justify-center">
          <p className="text-[9pt]">Mã đơn</p>
          <Barcode value={order.code} height={30} />
        </div>
      </section>

      <section className="label-box">
        <p className="text-[9pt] font-bold uppercase">Người nhận</p>
        <p className="text-[12pt] font-bold">{order.recipientName}</p>
        <p className="text-[12pt] font-bold tabular-nums">{formatPhone(order.phone)}</p>
        <p>
          {order.addressLine}, {order.wardName}, {order.provinceName}
        </p>
      </section>

      <section className="label-box">
        <p className="text-[9pt] font-bold uppercase">
          Sản phẩm ({qty}) · {formatNumber(s?.weightGrams ?? suggestWeightGrams(order.lines), 0)} g
        </p>
        <ul>
          {order.lines.map((l) => (
            <li key={l.id} className="flex justify-between gap-2">
              <span>
                {l.productName} – {variantText(l)}
              </span>
              <span className="font-bold whitespace-nowrap">× {l.quantity}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="label-box flex items-center justify-between">
        <span>
          <span className="block text-[9pt] font-bold uppercase">Tiền thu hộ</span>
          <span className="text-[9pt]">{paymentMethodShortLabels[order.paymentMethod]}</span>
        </span>
        <span className="text-[22pt] leading-none font-black tabular-nums">{formatVnd(order.codAmount)}</span>
      </section>

      {(s?.shipperNote || order.customerNote) && (
        <section className="label-box text-[10pt]">
          {s?.shipperNote && (
            <p>
              <b>Ghi chú shipper:</b> {s.shipperNote}
            </p>
          )}
          {order.customerNote && (
            <p>
              <b>Khách ghi chú:</b> {order.customerNote}
            </p>
          )}
        </section>
      )}
      <p className="mt-auto text-center text-[9pt]">Đặt lúc {formatDateTime(order.placedAt)}</p>
    </article>
  )
}
