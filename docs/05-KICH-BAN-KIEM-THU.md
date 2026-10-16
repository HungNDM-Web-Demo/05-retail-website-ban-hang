# Kịch bản kiểm thử nghiệm thu — Website Bán hàng

> Test case theo use case trong `03-USE-CASE.md`. Phần nền (đăng nhập, phân quyền, đặt lại dữ liệu) dùng TC-SYS-01 đến TC-SYS-10 trong `ZDOCS/03-KIEN-TRUC/USE-CASE-NEN.md` §8.

---

## 1. Cách chạy

| Mục | Nội dung |
| :--- | :--- |
| Môi trường | Chạy cả hai chế độ: dữ liệu mẫu (`mock`) và BE thật (`api`) |
| Dữ liệu | Đặt lại dữ liệu demo trước mỗi lượt test. TC có ghi "(đặt lại dữ liệu sau TC này)" làm đổi giá hoặc tồn mẫu |
| Thứ tự | Chạy theo thứ tự mã TC; một số TC dùng đơn tạo ở TC trước |
| Tài khoản | Khách: không đăng nhập. Vai trò khác theo cột "Vai trò", dùng "Đăng nhập nhanh" |
| Thiết bị | TC vai trò Khách chạy ở cửa sổ 390×844; TC quản trị chạy ở 1366×768 |
| Đạt | Kết quả thực tế khớp toàn bộ cột "Kết quả mong đợi" |

Dữ liệu mẫu dùng trong test:

- Sản phẩm "Áo thun cotton basic" `AT001`: giá bán 159.000 ₫, giá gốc 199.000 ₫; màu Trắng (`TR`), Đen (`DE`), Be (`BE`); size S, M, L, XL; tồn Trắng/M = 50, Đen/L = 3, Be/XL = 0.
- "Quần jeans ống suông" `QJ003`: 389.000 ₫, màu Xanh nhạt, size 26–30; tồn size 28 = 8.
- "Túi tote canvas" `TX001`: 129.000 ₫, màu Kem, không có size; tồn 20.
- "Đầm midi hoa nhí" `VD002`: đã có trong đơn mẫu.
- Mã giảm giá: `GIAM10` (giảm 10%, tối đa 50.000 ₫, đơn tối thiểu 300.000 ₫, 1 lượt mỗi số điện thoại); `GIAM50K` (giảm 50.000 ₫, đơn tối thiểu 500.000 ₫); `FREESHIP` (miễn phí vận chuyển, đơn tối thiểu 200.000 ₫); `HETHAN` (đã hết hạn).
- Phí vận chuyển: TP.HCM 20.000 ₫, tỉnh/thành khác 35.000 ₫; miễn phí khi tạm tính − giảm giá ≥ 499.000 ₫.
- Khách "Lê Thị Hoa" `0987654321`: 2 đơn Đã hoàn, 1 đơn Chờ xác nhận.
- Hai đơn chuyển khoản Chờ thanh toán: một đơn đặt cách đây 25 giờ, một đơn đặt cách đây 2 giờ.
- Số điện thoại test `0901000001` đến `0901000019` chưa có trong dữ liệu mẫu. Địa chỉ TP.HCM: Phường Bến Thành; Hà Nội: Phường Cầu Giấy.

---

## 2. Test case

### 2.1. Cửa hàng

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-01 | UC-01 | Lọc theo danh mục, màu, size | Khách | 1. Trang chủ → danh mục Áo thun 2. Lọc size M, màu Trắng, bật "Chỉ hiện còn hàng" 3. Sao chép URL, mở ở tab mới | Có "Áo thun cotton basic"; mọi sản phẩm trong kết quả đều có biến thể Trắng/M còn hàng; tab mới ra đúng kết quả và bộ lọc |
| TC-02 | UC-01 | Tìm không dấu, tìm theo SKU, không có kết quả | Khách | 1. Gõ "ao thun" 2. Gõ `AT001-DE-L` 3. Gõ "xyzabc" | Bước 1 gợi ý có "Áo thun cotton basic"; bước 2 ra đúng sản phẩm đó; bước 3 hiện "Không tìm thấy sản phẩm phù hợp" kèm sản phẩm nổi bật |
| TC-03 | UC-02 | Xem tình trạng biến thể, thêm cộng dồn | Khách | 1. Mở "Áo thun cotton basic" 2. Chọn Đen, rồi Be 3. Chọn Trắng / M, thêm vào giỏ 1 cái, thêm tiếp 1 cái | Giá 159.000 ₫, giá gốc 199.000 ₫ gạch ngang, nhãn "−20%"; Đen/L hiện "Chỉ còn 3 sản phẩm"; Be/XL gạch chéo, không chọn được; giỏ có 1 dòng Trắng/M số lượng 2 |
| TC-04 | UC-02 | Vượt tồn, chưa chọn size | Khách | 1. Chọn Đen, chưa chọn size 2. Chọn L, bấm tăng số lượng tới 4 | Bước 1 nút "Thêm vào giỏ" khóa, hiện "Vui lòng chọn size"; bước 2 số lượng dừng ở 3, hiện "Chỉ còn 3 sản phẩm" |
| TC-05 | UC-03 | Dải miễn phí vận chuyển | Khách | 1. Giỏ có 2 × Trắng/M 2. Thêm 1 "Quần jeans ống suông" size 28 | Bước 1 tạm tính 318.000 ₫, hiện "Mua thêm 181.000 ₫ để được miễn phí vận chuyển"; bước 2 tạm tính 707.000 ₫, hiện "Đơn được miễn phí vận chuyển" |
| TC-06 | UC-03 | Giá đổi khi đã ở trong giỏ (đặt lại dữ liệu sau TC này) | Khách, Quản lý | 1. Giỏ có 2 × Trắng/M 2. Quản lý đổi giá `AT001` thành 169.000 ₫ 3. Khách mở lại giỏ | Dòng hiện "Giá đã đổi từ 159.000 ₫ thành 169.000 ₫"; tạm tính 338.000 ₫; dải hiện "Mua thêm 161.000 ₫" |
| TC-07 | UC-03 | Dòng trong giỏ hết hàng (đặt lại dữ liệu sau TC này) | Khách, Quản lý | 1. Giỏ có 2 × Trắng/M 2. Quản lý chỉnh tồn Trắng/M về 0 3. Khách mở giỏ 4. Xóa dòng đó | Bước 3 dòng đánh dấu đỏ "Hết hàng", nút "Đặt hàng" khóa; bước 4 nút mở lại nếu giỏ còn dòng khác |

### 2.2. Đặt hàng và tra cứu

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-08 | UC-04 | Đặt COD, giao TP.HCM | Khách | 1. Giỏ 2 × Trắng/M 2. Thanh toán: số `0901000001`, TP.HCM, Phường Bến Thành, COD 3. Đặt hàng | Phí vận chuyển 20.000 ₫, tổng 338.000 ₫; trang thành công hiện mã `DH{yyMMdd}{nnnn}`; đơn Chờ xác nhận; tồn Trắng/M giảm 2; giỏ trống; dòng thời gian có "Đã gửi SMS xác nhận đơn (giả lập)" |
| TC-09 | UC-04 | Mã phần trăm chạm mức tối đa, giữ miễn phí vận chuyển | Khách | 1. Giỏ 2 × Trắng/M + 1 Jeans size 28 (707.000 ₫) 2. Số `0901000002`, Hà Nội, COD 3. Nhập `GIAM10`, đặt hàng | 10% = 70.700 ₫, làm tròn 70.000 ₫, giới hạn còn 50.000 ₫; phí vận chuyển 0 ₫ (657.000 ₫ ≥ 499.000 ₫); tổng 657.000 ₫ |
| TC-10 | UC-04 | Mã phần trăm làm tròn xuống, có phí vận chuyển | Khách | 1. Giỏ 2 × Trắng/M (318.000 ₫) 2. Số `0901000003`, Hà Nội 3. Nhập `GIAM10` | Giảm 31.000 ₫ (31.800 làm tròn xuống); sau giảm 287.000 ₫ < 499.000 ₫ nên phí 35.000 ₫; tổng 322.000 ₫ |
| TC-11 | UC-04 | Mã làm mất miễn phí vận chuyển | Khách | 1. Giỏ 1 Jeans size 28 + 1 Túi tote (518.000 ₫), số `0901000004`, Hà Nội 2. Nhập `GIAM50K` | Trước khi áp mã: phí 0 ₫, tổng 518.000 ₫. Sau khi áp: giảm 50.000 ₫, còn 468.000 ₫ < 499.000 ₫ nên phí 35.000 ₫; tổng 503.000 ₫ |
| TC-12 | UC-04 | Mã miễn phí vận chuyển | Khách | 1. Giỏ 1 Jeans size 28, số `0901000010`, Hà Nội 2. Nhập `FREESHIP` | Trước khi áp mã: phí 35.000 ₫, tổng 424.000 ₫. Sau khi áp: phí 0 ₫, tổng 389.000 ₫ |
| TC-13 | UC-04 | Mã không dùng được | Khách | 1. Nhập `HETHAN` 2. Giỏ 318.000 ₫, nhập `GIAM50K` 3. Giỏ 707.000 ₫, nhập `FREESHIP` 4. Giỏ 1 × Trắng/M (159.000 ₫), nhập `FREESHIP` | Bước 1 "Mã đã hết hạn"; bước 2 "Đơn tối thiểu 500.000 ₫"; bước 3 "Đơn đã được miễn phí vận chuyển"; bước 4 "Đơn tối thiểu 200.000 ₫"; không áp mã nào |
| TC-14 | UC-04 | Số điện thoại đã dùng hết lượt mã | Khách | 1. Sau TC-09, giỏ 2 × Trắng/M + 1 Jeans size 28 2. Số `0901000002`, nhập `GIAM10` (áp được) 3. Bấm Đặt hàng 4. Bấm Đặt hàng lần nữa | Bước 3 không tạo đơn, báo "Số điện thoại này đã dùng mã GIAM10", mã bị gỡ, tổng 707.000 ₫; bước 4 tạo đơn 707.000 ₫ không giảm giá |
| TC-15 | UC-04 | Thông tin giao hàng không hợp lệ | Khách | 1. Nhập số `0212345678` 2. Bỏ trống phường/xã 3. Bấm Đặt hàng | Báo "Số điện thoại không hợp lệ" và "Vui lòng chọn phường/xã" dưới từng ô; không tạo đơn; dữ liệu đã nhập giữ nguyên |
| TC-16 | UC-04 | Đặt chuyển khoản | Khách | 1. Giỏ 1 Jeans size 28 2. Số `0901000005`, TP.HCM, chọn Chuyển khoản 3. Đặt hàng | Tổng 409.000 ₫ (389.000 + 20.000); trang thành công có QR giả lập số tiền 409.000 ₫, nội dung đúng mã đơn, hạn thanh toán = giờ đặt + 24 giờ; đơn Chờ thanh toán |
| TC-17 | UC-04 | Hai khách cùng mua biến thể cuối | Khách | 1. Trình duyệt A (số `0901000011`) và B (số `0901000012`) cùng có 3 × Đen/L trong giỏ 2. A đặt hàng 3. B đặt hàng | A thành công; B bị từ chối với "Áo thun cotton basic – Đen / L chỉ còn 0 sản phẩm", về giỏ với dòng đánh dấu đỏ; tồn Đen/L = 0, không âm |
| TC-18 | UC-04 | Bấm Đặt hàng hai lần liên tiếp (chế độ `api`) | Khách | 1. Giỏ 1 × Trắng/M, số `0901000013` 2. Bấm Đặt hàng hai lần thật nhanh | Chỉ một đơn được tạo, tồn chỉ trừ một lần |
| TC-19 | UC-05 | Tra cứu đơn | Khách | 1. Tra cứu đơn của TC-08 với số `0901000001` 2. Tra cứu lại với số `0901000002` | Bước 1 hiện trạng thái, dòng thời gian, sản phẩm, tổng 338.000 ₫, số điện thoại che `090****001`, không có ghi chú nội bộ; bước 2 hiện "Không tìm thấy đơn hàng" |
| TC-20 | UC-05 | Khách tự hủy đơn | Khách | 1. Đặt COD 1 Túi tote, số `0901000014` 2. Tra cứu, bấm Hủy đơn, lý do "Đổi ý" | Đơn Đã hủy, người làm "Khách"; tồn Túi tote trở lại như trước khi đặt |

### 2.3. Sản phẩm

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-21 | UC-06 | Thêm sản phẩm có lưới biến thể | Quản lý | 1. Thêm sản phẩm: mã `SM010`, tên "Áo sơ mi linen", danh mục Áo sơ mi, giá bán 299.000 ₫, giá gốc 350.000 ₫ 2. Chọn màu Trắng, Xanh rêu (`XR`); size S, M, L, XL 3. "Điền cùng số tồn" 10, lưu 4. Mở cửa hàng | 8 biến thể, SKU từ `SM010-TR-S` tới `SM010-XR-XL`; slug `ao-so-mi-linen`; cửa hàng hiện 299.000 ₫, gạch 350.000 ₫, nhãn "−15%" |
| TC-22 | UC-06 | Dữ liệu sản phẩm sai | Quản lý | 1. Giá gốc 250.000 ₫ < giá bán 299.000 ₫ 2. Mã `AT001` 3. Giá bán 299.500 ₫ | Mỗi bước báo lỗi tại ô tương ứng; không lưu |
| TC-23 | UC-06 | Xóa sản phẩm đã bán, ẩn sản phẩm | Quản lý, Khách | 1. Chọn "Đầm midi hoa nhí", bấm Xóa 2. Bật "Ẩn" 3. Khách mở link cũ của sản phẩm | Bước 1 bị từ chối, gợi ý "Ẩn"; bước 2 sản phẩm biến mất khỏi danh sách cửa hàng; bước 3 hiện "Sản phẩm ngừng kinh doanh" |
| TC-24 | UC-06 | Điều chỉnh tồn (P2) | Quản lý, Khách | 1. Điều chỉnh tồn Be/XL `AT001` từ 0 thành 15, lý do "Nhập hàng" 2. Khách mở sản phẩm, chọn Be 3. Thử nhập tồn −1 | Lịch sử ghi 0 → 15, người `quanly`; cửa hàng chọn được Be/XL, hiện "Còn hàng"; bước 3 báo lỗi |

### 2.4. Xử lý đơn

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-25 | UC-07 | Đơn trùng số điện thoại, khách cần lưu ý | Nhân viên | 1. Khách đặt 2 đơn COD, mỗi đơn 1 × Trắng/M, cùng số `0901000006`, cách nhau vài phút 2. Lọc nhãn "Trùng SĐT" 3. Tìm số `0987654321`, mở đơn Chờ xác nhận | Bước 2 danh sách có cả 2 đơn của `0901000006`, mỗi đơn có link sang đơn kia; bước 3 chi tiết có cảnh báo vàng "Khách có 2 đơn hoàn hàng" |
| TC-26 | UC-07 | Ghi chú nội bộ, đơn không tồn tại | Nhân viên, Khách | 1. Mở đơn TC-08, ghi chú "Khách hẹn giao sau 17h", lưu 2. Khách tra cứu đơn TC-08 3. Nhân viên gõ thẳng URL `/admin/orders/khong-ton-tai` | Ghi chú hiện trên dòng thời gian kèm `nhanvien` và giờ; trang tra cứu không hiện ghi chú; bước 3 hiện "Không tìm thấy đơn hàng" |
| TC-27 | UC-08 | Xác nhận đơn COD | Nhân viên | 1. Mở đơn TC-08 2. Bấm "Xác nhận đơn" | Đơn Đã xác nhận; dòng thời gian ghi "Chờ xác nhận → Đã xác nhận", người `nhanvien` |
| TC-28 | UC-08 | Xác nhận đã nhận tiền | Nhân viên | 1. Mở đơn TC-16, bấm "Xác nhận đã nhận tiền", để trống mã giao dịch 2. Nhập `FT26285904127`, xác nhận | Bước 1 báo lỗi tại ô mã giao dịch; bước 2 đơn Đã xác nhận, thanh toán "Đã thanh toán", lưu mã giao dịch |
| TC-29 | UC-08 | Sửa đơn Chờ xác nhận (P2) | Nhân viên | 1. Khách đặt COD 2 × Trắng/M, TP.HCM, số `0901000007` (338.000 ₫) 2. Nhân viên sửa số lượng thành 4, lưu | Tạm tính 636.000 ₫, phí 0 ₫, tổng 636.000 ₫; tồn Trắng/M giảm thêm 2; dòng thời gian ghi "Sửa đơn: Trắng/M 2 → 4" |
| TC-30 | UC-08 | Sửa đơn vượt tồn | Nhân viên | 1. Mở đơn TC-29, thêm dòng Đen/L (đã hết sau TC-17) số lượng 1, lưu | Báo "Áo thun cotton basic – Đen / L chỉ còn 0 sản phẩm", không lưu, đơn giữ nguyên |
| TC-31 | UC-09 | Hủy đơn có mã giảm giá | Nhân viên | 1. Khách đặt 2 × Trắng/M + 1 Jeans size 28, số `0901000008`, Hà Nội, mã `GIAM10` (657.000 ₫) 2. Nhân viên xác nhận đơn 3. Bấm Hủy đơn, không chọn lý do 4. Chọn "Khách đổi ý", xác nhận 5. Khách đặt lại với cùng số và `GIAM10` | Bước 3 nút xác nhận khóa; bước 4 đơn Đã hủy, tồn Trắng/M +2 và Jeans size 28 +1, số lượt đã dùng của `GIAM10` giảm 1; bước 5 áp mã thành công |
| TC-32 | UC-09 | Hủy đơn chuyển khoản đã thanh toán | Nhân viên, Quản lý | 1. Khách đặt chuyển khoản 1 Túi tote, TP.HCM, số `0901000009` (149.000 ₫) 2. Nhân viên xác nhận đã nhận tiền, rồi hủy đơn lý do "Hết hàng" 3. Đổi sang Quản lý, bấm "Đã hoàn tiền" | Sau bước 2 thanh toán "Cần hoàn tiền 149.000 ₫", nhân viên không thấy nút "Đã hoàn tiền"; sau bước 3 thanh toán "Đã hoàn tiền" |
| TC-33 | UC-09 | Không hủy được đơn đang giao | Nhân viên | 1. Mở một đơn Đang giao 2. Chế độ `api`: gọi API hủy đơn đó | Không có nút "Hủy đơn"; API trả lỗi "Không thể hủy đơn đã bàn giao vận chuyển" |
| TC-34 | UC-09 | Tự hủy đơn quá hạn thanh toán | Nhân viên | 1. Mở tab Đã hủy, tìm đơn chuyển khoản mẫu đặt cách đây 25 giờ | Đơn Đã hủy, lý do "Quá hạn thanh toán", người làm "Hệ thống"; đơn mẫu đặt cách đây 2 giờ vẫn Chờ thanh toán |
| TC-35 | UC-10 | Bàn giao vận chuyển, in phiếu | Nhân viên | 1. Xác nhận đơn TC-09 2. Bàn giao GHTK, 800 g 3. Bàn giao đơn TC-16 (đã nhận tiền ở TC-28), GHN, 400 g | Đơn TC-09 Đang giao, mã vận đơn `GHTK` + 10 số; phiếu A6 có người nhận, địa chỉ, 2 dòng sản phẩm, tiền thu hộ 657.000 ₫. Phiếu đơn TC-16 có tiền thu hộ 0 ₫ |
| TC-36 | UC-10 | Bàn giao sai điều kiện | Nhân viên | 1. Mở một đơn Chờ xác nhận 2. Mở đơn Đã xác nhận, nhập khối lượng 0 g | Bước 1 không có nút "Bàn giao vận chuyển"; bước 2 báo lỗi khối lượng 50–30.000 g |
| TC-37 | UC-11 | Giao thành công | Nhân viên, Quản lý | 1. Quản lý ghi lại doanh thu thuần hôm nay 2. Nhân viên bàn giao đơn TC-08 (GHN, 300 g), bấm "Đã giao" 3. Quản lý mở lại Tổng quan | Đơn Đã giao, thanh toán "Đã thanh toán"; doanh thu thuần tăng đúng 318.000 ₫ (không gồm 20.000 ₫ phí vận chuyển); tổng chi tiêu của khách `0901000001` tăng 338.000 ₫ |
| TC-38 | UC-11 | Giao thất bại và nhận hàng hoàn | Nhân viên | 1. Mở đơn TC-09 (Đang giao), bấm "Giao thất bại", không chọn lý do 2. Chọn "Khách từ chối nhận" 3. Bấm "Đã nhận hàng hoàn" | Bước 1 nút xác nhận khóa; bước 2 đơn Đang hoàn, tồn chưa đổi; bước 3 đơn Đã hoàn, tồn Trắng/M +2, Jeans size 28 +1; lượt `GIAM10` không được trả |

### 2.5. Tổng quan, mã giảm giá, khách hàng, báo cáo

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-39 | UC-12 | Tổng quan cập nhật theo đơn mới | Quản lý | 1. Ghi lại giá trị đặt hàng, số đơn mới, thẻ Chờ xác nhận 2. Khách đặt COD 2 × Trắng/M, TP.HCM, số `0901000015` 3. Tải lại Tổng quan | Giá trị đặt hàng tăng 338.000 ₫, số đơn mới tăng 1, thẻ Chờ xác nhận tăng 1 và bằng số ở tab Chờ xác nhận |
| TC-40 | UC-12 | Nhân viên không thấy doanh thu | Nhân viên | 1. Đăng nhập nhanh vai trò Nhân viên 2. Gõ thẳng URL `/admin/reports` | Tổng quan chỉ có thẻ việc cần làm, không có số doanh thu; bước 2 chuyển tới `/forbidden` |
| TC-41 | UC-13 | Tạo mã cho đợt sale | Quản lý, Khách | 1. Thêm mã `SALE1111`: giảm 15%, tối đa 100.000 ₫, đơn tối thiểu 399.000 ₫, bắt đầu từ ngày mai 2. Khách nhập `sale1111` ở trang thanh toán 3. Thêm mã `GIAM10` 4. Thêm mã kiểu phần trăm không có mức giảm tối đa | Bước 1 mã ở trạng thái "Sắp chạy"; bước 2 báo "Mã chưa đến thời gian áp dụng"; bước 3 báo mã đã tồn tại; bước 4 báo thiếu mức giảm tối đa |
| TC-42 | UC-14 | Hồ sơ khách tự cập nhật, nhãn | Quản lý | 1. Lọc nhãn "Cần lưu ý" 2. Khách đặt đơn mới với số `0901000001`, tên "Nguyễn Minh Anh" 3. Mở hồ sơ khách `0901000001` | Bước 1 có "Lê Thị Hoa"; bước 3 tên đổi thành "Nguyễn Minh Anh", số đơn tăng 1, không sinh hồ sơ mới |
| TC-43 | UC-15 | Doanh thu không gồm đơn hủy và phí vận chuyển | Quản lý | 1. Sau TC-31 và TC-37, mở Báo cáo, chọn Hôm nay 2. Mở tab Tình trạng đơn | Doanh thu thuần gồm 318.000 ₫ của đơn TC-08, không gồm phí 20.000 ₫, không gồm đơn hủy ở TC-31; tab Tình trạng đơn có lý do hủy "Khách đổi ý" và lý do giao thất bại "Khách từ chối nhận" |

---

## 3. Biên bản chạy thử

| Ngày | Người test | Chế độ | Số TC đạt / tổng | Lỗi ghi nhận |
| :--- | :--- | :--- | :---: | :--- |
| 16/10/2026 | Claude (kiểm thử tự động trên trình duyệt) | `mock` | 6 / 6 điểm kiểm lại (phần đã sửa) | Kiểm lại sau sửa, đều đạt: mã danh mục 2 chữ in hoa, gộp dòng trùng biến thể khi đặt và sửa đơn, sửa đơn đổi số điện thoại chuyển đơn sang hồ sơ khách số mới, giả lập đơn bỏ AT001/QJ003/TX001/VD002, bấm Đặt hàng liên tiếp chỉ tạo một đơn |
| 16/10/2026 | Claude (kiểm thử tự động trên trình duyệt) | `api` (BE .NET + Postgres) | 43 / 43 | Đã sửa: (1) TC-18 bấm Đặt hàng nhiều lần liền nhau tạo nhiều đơn (mỗi lần một `clientRequestId` mới) → giữ mã yêu cầu và cờ đang gửi trong ref; (2) form sửa sản phẩm, sửa mã giảm giá không lưu được khi BE trả `null` (`listPrice`, `size`, `colorId` ảnh, `sizeChart`, `maxDiscount`, `categoryId`, `totalLimit`) → đổi `null` thành `undefined` khi nạp form; (3) BE bỏ qua khóa sắp xếp `totalStock` (sản phẩm), `deliveredCount`, `returnCount` (khách) → thêm, kèm test; (4) lỗi trường không thuộc form thanh toán bị nuốt, không hiện thông báo → hiện toast; (5) dòng giỏ hết hàng hiện số lượng 1 trong khi thành tiền tính theo số đã chọn → hiện đúng số đã chọn; (6) mã danh mục FE/mock cho 2–10 ký tự → theo BE 2 chữ in hoa |
