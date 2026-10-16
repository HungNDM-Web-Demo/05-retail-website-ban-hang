/**
 * Nhãn, gợi ý và quy tắc kiểm tra cho khóa cài đặt riêng của dự án (project.json → settings;
 * docs/06-THIET-KE-CSDL.md §3). Trang Cài đặt chung hiển thị khóa ngoài nhóm Thương hiệu/Doanh nghiệp theo nhóm;
 * mock gọi `validateProjectSettings` khi lưu, BE kiểm cùng quy tắc.
 * Nhóm "Cửa hàng" hiện trên website (đầu trang, chân trang), phiếu giao (người gửi) và QR chuyển khoản.
 */
export const settingExtraLabels: Record<string, { label: string; hint?: string }> = {
  'Store.Name': {
    label: 'Tên cửa hàng',
    hint: 'Hiện ở đầu website, tiêu đề trang, phiếu giao hàng',
  },
  'Store.Tagline': { label: 'Khẩu hiệu', hint: 'Dòng nhỏ dưới tên cửa hàng, có thể bỏ trống' },
  'Store.Hotline': { label: 'Hotline', hint: 'Hiện ở chân trang và phiếu giao (người gửi)' },
  'Store.Email': { label: 'Email chăm sóc khách hàng', hint: 'Có thể bỏ trống' },
  'Store.Address': { label: 'Địa chỉ kho', hint: 'Người gửi trên phiếu giao, chân trang website' },
  'Store.WorkingHours': {
    label: 'Giờ làm việc',
    hint: 'Câu ở trang đặt hàng thành công, vd 8h–21h hằng ngày',
  },
  'Store.BankBin': { label: 'Mã ngân hàng (BIN)', hint: '6 chữ số theo VietQR, vd 970422' },
  'Store.BankAccount': {
    label: 'Số tài khoản nhận chuyển khoản',
    hint: 'Dùng cho QR chuyển khoản giả lập',
  },
  'Store.BankAccountName': { label: 'Tên chủ tài khoản', hint: 'Chữ in hoa không dấu' },
}

/** Kiểm tra giá trị cài đặt riêng của dự án; trả về { [chỉ số trong items]: thông báo lỗi }. */
export function validateProjectSettings(
  items: { key: string; value?: string | null }[],
  current: Record<string, string>
): Record<number, string> {
  void current
  const errors: Record<number, string> = {}
  items.forEach(({ key, value }, i) => {
    const v = (value ?? '').trim()
    switch (key) {
      case 'Store.Name':
        if (!v) errors[i] = 'Nhập tên cửa hàng'
        else if (v.length > 100) errors[i] = 'Tên cửa hàng tối đa 100 ký tự'
        break
      case 'Store.Hotline':
        if (!/^[0-9 .]{8,15}$/.test(v)) errors[i] = 'Hotline gồm 8–15 chữ số'
        break
      case 'Store.Email':
        if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) errors[i] = 'Email chưa đúng định dạng'
        break
      case 'Store.Address':
        if (!v) errors[i] = 'Nhập địa chỉ kho'
        break
      case 'Store.BankBin':
        if (!/^\d{6}$/.test(v)) errors[i] = 'Mã ngân hàng gồm 6 chữ số'
        break
      case 'Store.BankAccount':
        if (!/^\d{6,19}$/.test(v)) errors[i] = 'Số tài khoản gồm 6 đến 19 chữ số'
        break
      case 'Store.BankAccountName':
        if (!/^[A-Z0-9 ]{2,50}$/.test(v))
          errors[i] = 'Tên chủ tài khoản viết in hoa không dấu, tối đa 50 ký tự'
        break
    }
  })
  return errors
}
