# Kịch bản demo — Website Bán hàng

> Dùng khi trình bày cho chủ shop thời trang, mỹ phẩm, đồ gia dụng đang bán qua Facebook, Zalo. Thời lượng 12–15 phút. Đi theo một ngày của shop: khách đặt hàng trên điện thoại, nhân viên xác nhận và giao, quản lý lên hàng mới và xem số liệu.

---

## 1. Chuẩn bị trước buổi demo

- [ ] Mở sẵn link demo, thử "Đăng nhập nhanh" cả 3 vai trò
- [ ] Đặt lại dữ liệu demo (thanh công cụ demo → Đặt lại dữ liệu) để có 90 ngày đơn hàng tính tới hôm nay
- [ ] Đổi tên shop, logo, màu theo thương hiệu khách (Cài đặt → Thương hiệu) nếu đã biết
- [ ] Mở 2 cửa sổ: cửa hàng ở chế độ điện thoại (DevTools 390×844 hoặc điện thoại thật) và trang quản trị ở màn hình máy tính
- [ ] Ghi nhớ dữ liệu mẫu: sản phẩm "Áo thun cotton basic" (159.000 ₫, màu Đen size L chỉ còn 3), "Quần jeans ống suông" (389.000 ₫), mã `GIAM10` (giảm 10%, tối đa 50.000 ₫)
- [ ] Chuẩn bị số điện thoại demo chưa có trong dữ liệu mẫu, vd `0901000088`

| Link | Ghi chú |
| :--- | :--- |
| FE | `http://localhost:3105` hoặc link online |
| Swagger | `https://localhost:7105/swagger` (khi khách hỏi về tích hợp) |

| Tài khoản | Vai trò | Dùng để cho xem |
| :--- | :--- | :--- |
| `admin` | Quản trị viên | Phân quyền, thương hiệu, thông tin shop |
| `quanly` | Quản lý | Tổng quan, sản phẩm, tồn kho, mã giảm giá, khách hàng, báo cáo |
| `nhanvien` | Nhân viên | Xác nhận đơn, bàn giao vận chuyển, in phiếu, xử lý hủy và hoàn hàng |

Mật khẩu: giá trị `DEMO_PASSWORD` trong `.env`, hoặc bấm "Đăng nhập nhanh". Phần cửa hàng không cần đăng nhập.

---

## 2. Câu chuyện demo

> Mở đầu: "Anh/chị hình dung một khách thấy bài quảng cáo của shop trên Facebook và bấm vào link. Em đi đúng hành trình của đơn hàng đó, từ lúc khách chọn hàng tới lúc shop thu được tiền."

| # | Vai trò | Thao tác | Điểm cần nhấn mạnh |
| :---: | :--- | :--- | :--- |
| 1 | Khách | Trên điện thoại, mở trang chủ, vào danh mục Áo thun, lọc size M, màu Trắng, bật "Chỉ hiện còn hàng" | Khách tự tìm đúng màu, đúng size còn hàng, không phải nhắn tin hỏi rồi chờ shop trả lời |
| 2 | Khách | Mở "Áo thun cotton basic": chọn màu Đen thấy size L "Chỉ còn 3", màu Be thì size XL bị gạch; chọn Trắng / M, số lượng 2, thêm vào giỏ | Tồn kho theo từng màu, từng size; hết là khóa, không bao giờ bán lố rồi phải xin lỗi khách |
| 3 | Khách | Mở giỏ: tạm tính 318.000 ₫, dải "Mua thêm 181.000 ₫ để được miễn phí vận chuyển"; quay lại thêm "Quần jeans ống suông" size 28, giỏ lên 707.000 ₫, báo được miễn phí vận chuyển | Gợi ý freeship làm khách mua thêm, giá trị đơn tăng mà shop không cần tư vấn |
| 4 | Khách | Đặt hàng: nhập tên, số `0901000088`, Hà Nội, Phường Cầu Giấy; nhập `GIAM10` được giảm 50.000 ₫ (đạt mức tối đa); chọn COD; nhận mã đơn `DH…`, tổng 657.000 ₫ | Không cần tạo tài khoản, 3 màn hình là xong đơn; mã giảm giá tự kiểm điều kiện, không phải tính tay |
| 5 | Nhân viên | Đổi vai trò Nhân viên trên thanh công cụ demo; Tổng quan thấy thẻ "Chờ xác nhận" tăng 1; bấm thẻ, mở đơn vừa đặt, bấm số gọi khách, bấm "Xác nhận đơn" | Đơn từ mọi nguồn về một chỗ, không sót như tin nhắn; ai xác nhận lúc nào đều có trên dòng thời gian |
| 6 | Nhân viên | Mở một đơn của khách "Lê Thị Hoa" trong dữ liệu mẫu: cảnh báo vàng "Khách có 2 đơn hoàn hàng"; ghi chú nội bộ "Gọi kỹ trước khi gửi" | Nhận diện khách hay bom hàng, bớt mất phí ship hai chiều |
| 7 | Nhân viên | Tab Chờ thanh toán: mở đơn chuyển khoản mẫu, đối chiếu nội dung chuyển khoản là mã đơn, nhập mã giao dịch, bấm "Xác nhận đã nhận tiền" | Đơn chuyển khoản chưa thấy tiền thì không giao; quá 24 giờ chưa chuyển hệ thống tự hủy và trả hàng về kho |
| 8 | Nhân viên | Mở lại đơn 657.000 ₫, bấm "Bàn giao vận chuyển", chọn GHTK, 800 g; hệ thống sinh mã vận đơn (giả lập) và mở phiếu giao A6 có tiền thu hộ 657.000 ₫ | Không chép tay địa chỉ, không ghi sai tiền thu hộ; in phiếu dán lên gói là xong |
| 9 | Khách | Quay lại điện thoại, vào Tra cứu đơn, nhập mã đơn và số điện thoại: thấy "Đang giao", mã vận đơn, dòng thời gian | Khách tự tra, shop bớt hẳn tin nhắn "đơn em tới đâu rồi" |
| 10 | Nhân viên | Đơn đang giao khác: bấm "Đã giao"; một đơn khác bấm "Giao thất bại", lý do "Khách từ chối nhận", rồi "Đã nhận hàng hoàn" | Hàng hoàn về tự cộng lại tồn, kho không lệch; doanh thu chỉ tính đơn đã giao thật |
| 11 | Quản lý | Đổi sang Quản lý; thêm sản phẩm "Áo sơ mi linen" 2 màu × 4 size, hệ thống sinh 8 biến thể và SKU, nhập tồn; tạo mã `SALE1111` giảm 15%, tối đa 100.000 ₫ cho đợt sale 11.11 | Lên hàng mới vài phút; chuẩn bị khuyến mãi trước ngày sale, tới giờ mã tự chạy |
| 12 | Quản lý | Mở Tổng quan và Báo cáo: doanh thu thuần, tỉ lệ hoàn theo tỉnh/thành, sản phẩm bán chạy theo màu và size; mở Khách hàng lọc "Khách VIP" | Biết size nào, màu nào nên nhập thêm; tỉnh nào hay hoàn để cân nhắc yêu cầu chuyển khoản trước |

> Kết: "Toàn bộ dữ liệu anh/chị vừa thấy là dữ liệu mẫu. Bản triển khai sẽ dùng sản phẩm, tên miền và thương hiệu của shop mình, nối thẳng với đơn vị vận chuyển và tài khoản ngân hàng shop đang dùng."

---

## 3. Câu hỏi khách hay hỏi

| Câu hỏi | Trả lời gợi ý |
| :--- | :--- |
| Có nối thẳng với GHN, GHTK, Viettel Post không? | Demo giả lập mã vận đơn. Bản triển khai nối API đơn vị vận chuyển để tạo vận đơn, tính phí ship theo cân nặng và tự cập nhật trạng thái giao. |
| Có tự xác nhận khi khách chuyển khoản không? | Demo để nhân viên đối chiếu và bấm xác nhận. Bản triển khai có thể nối với ngân hàng hoặc cổng thanh toán để tự xác nhận tiền về. |
| Có thanh toán MoMo, VNPay, thẻ không? | Demo có COD và chuyển khoản QR. Cổng thanh toán tích hợp khi triển khai, phí giao dịch theo hợp đồng của shop với cổng. |
| Có đồng bộ đơn và tồn với Shopee, TikTok Shop không? | Cần khảo sát API từng sàn. Hướng thường làm là dùng chung tồn kho để không bán vượt. |
| Shop có cửa hàng offline, tồn kho dùng chung được không? | Được. Có sẵn demo POS bán lẻ và Quản lý kho; bản triển khai dùng chung danh mục sản phẩm và tồn. |
| Khách có tài khoản, tích điểm được không? | Demo cho đặt không cần tài khoản để khách không bỏ ngang. Hồ sơ khách đã tự gom theo số điện thoại; tích điểm, hạng thành viên làm thêm khi triển khai. |
| Chống bom hàng thế nào? | Hệ thống gắn nhãn khách có từ 2 đơn hoàn, cảnh báo khi họ đặt tiếp. Bản triển khai có thể bắt chuyển khoản trước với nhóm khách này. |
| Có tên miền riêng, lên Google được không? | Có. Tên miền riêng, SSL, link sản phẩm thân thiện, sitemap; trang sản phẩm render phía máy chủ để Google đọc được. |
| Có đổi size, đổi trả không? | Demo chưa có. Bản triển khai thêm phiếu đổi trả gắn với đơn gốc, tự cập nhật tồn. |

---

## 4. Sau buổi demo

- [ ] Ghi lại yêu cầu khách nêu thêm vào `01-TONG-QUAN-NGHIEP-VU.md`
- [ ] Ghi lại số sản phẩm, số mẫu × màu × size, số đơn mỗi ngày, đơn vị vận chuyển và ngân hàng khách đang dùng
- [ ] Gửi link demo và tài khoản `nhanvien`, `quanly` cho khách tự trải nghiệm (nếu đồng ý)
