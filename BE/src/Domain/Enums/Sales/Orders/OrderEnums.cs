namespace Domain.Enums.Sales.Orders;

/// <summary>Vòng đời đơn (SRS §5.2, 06 §4 Sales_Orders).</summary>
public enum OrderStatus
{
    ChoThanhToan = 0,
    ChoXacNhan = 1,
    DaXacNhan = 2,
    DangGiao = 3,
    DaGiao = 4,
    DangHoan = 5,
    DaHoan = 6,
    DaHuy = 7
}

public enum PaymentMethod
{
    Cod = 0,
    ChuyenKhoan = 1
}

public enum PaymentStatus
{
    ChuaThanhToan = 0,
    DaThanhToan = 1,
    CanHoanTien = 2,
    DaHoanTien = 3
}

/// <summary>Lý do hủy (BR-16); <see cref="QuaHanThanhToan"/> chỉ hệ thống dùng.</summary>
public enum CancelReason
{
    KhachDoiY = 0,
    KhongLienLacDuoc = 1,
    HetHang = 2,
    DatTrung = 3,
    QuaHanThanhToan = 4,
    Khac = 5
}

/// <summary>Lý do giao thất bại (BR-19).</summary>
public enum DeliveryFailReason
{
    KhachKhongNgheMay = 0,
    KhachTuChoiNhan = 1,
    SaiDiaChi = 2,
    Khac = 3
}

/// <summary>Đơn vị vận chuyển giả lập (BR-17); tiền tố mã vận đơn GHN, GHTK, VTP, JT.</summary>
public enum Carrier
{
    Ghn = 0,
    Ghtk = 1,
    Vtp = 2,
    Jt = 3
}

public enum OrderEventType
{
    DoiTrangThai = 0,
    GhiChuNoiBo = 1,
    TinGuiKhach = 2,
    SuaDon = 3,
    HoanTien = 4
}

public enum ActorType
{
    NhanVien = 0,
    Khach = 1,
    HeThong = 2
}

/// <summary>Nhãn đơn, tính lúc đọc (07 §3.8), không lưu.</summary>
public enum OrderLabel
{
    TrungSdt = 0,
    GiaoCham = 1,
    KhachCanLuuY = 2
}

/// <summary>Thao tác được phép theo trạng thái (07 §3.5), không xét quyền.</summary>
public enum OrderAction
{
    Confirm = 0,
    ConfirmPayment = 1,
    Edit = 2,
    Cancel = 3,
    Ship = 4,
    Deliver = 5,
    DeliveryFailed = 6,
    ReceiveReturn = 7,
    Refund = 8,
    PrintLabel = 9
}
