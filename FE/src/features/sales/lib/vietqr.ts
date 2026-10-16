/**
 * QR chuyển khoản giả lập (BR-12, 07 §3.9): `VIETQR|{bankBin}|{bankAccount}|{số tiền}|{mã đơn}`.
 * Tên ngân hàng tra theo BIN; BE dùng cùng bảng.
 */
const BANKS: Record<string, string> = {
  '970422': 'MB Bank',
  '970436': 'Vietcombank',
  '970407': 'Techcombank',
  '970418': 'BIDV',
  '970415': 'VietinBank',
  '970405': 'Agribank',
  '970416': 'ACB',
}

export const bankNameOf = (bin: string): string => BANKS[bin] ?? `Ngân hàng ${bin}`

export function vietQrPayload(
  store: { bankBin: string; bankAccount: string },
  amount: number,
  code: string
): string {
  return `VIETQR|${store.bankBin}|${store.bankAccount}|${Math.round(amount)}|${code}`
}
