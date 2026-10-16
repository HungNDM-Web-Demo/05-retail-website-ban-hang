import type { OrderRecord, PublicStoreInfo, TransferInfo } from '@/types/shop'
import { SalesRules } from './rules'
import { bankNameOf, vietQrPayload } from './vietqr'

/**
 * Thông tin cửa hàng từ cài đặt `Brand.*`, `Store.*` (06 §3) → `PublicStoreInfo` (07 §2.2).
 * Thuần: mock đọc `settingsDb`, máy chủ đọc seed `project.json`.
 */
export function storeInfoFromSettings(s: Record<string, string>): PublicStoreInfo {
  const bankBin = s['Store.BankBin'] || '970422'
  return {
    name: s['Store.Name'] || 'Nhà Sợi',
    tagline: s['Store.Tagline'] || undefined,
    logoUrl: s['Brand.LogoUrl'] || '/logo/logo-mark.svg',
    primaryColor: s['Brand.PrimaryColor'] || '#1E40AF',
    hotline: s['Store.Hotline'] || '',
    email: s['Store.Email'] || undefined,
    address: s['Store.Address'] || '',
    workingHours: s['Store.WorkingHours'] || '',
    bankBin,
    bankName: bankNameOf(bankBin),
    bankAccount: s['Store.BankAccount'] || '',
    bankAccountName: s['Store.BankAccountName'] || '',
    freeShipThreshold: SalesRules.freeShipThreshold,
    shippingFees: { TpHcm: SalesRules.shippingFeeHcm, TinhKhac: SalesRules.shippingFeeOther },
    paymentHours: SalesRules.paymentHours,
  }
}

/** Thông tin chuyển khoản của đơn (BR-12): nội dung = mã đơn, QR giả lập */
export function transferInfoOf(
  order: Pick<OrderRecord, 'code' | 'total' | 'paymentDueAt'>,
  store: PublicStoreInfo
): TransferInfo {
  return {
    bankBin: store.bankBin,
    bankName: store.bankName,
    bankAccount: store.bankAccount,
    bankAccountName: store.bankAccountName,
    amount: order.total,
    content: order.code,
    dueAt: order.paymentDueAt ?? '',
    qrPayload: vietQrPayload(store, order.total, order.code),
  }
}
