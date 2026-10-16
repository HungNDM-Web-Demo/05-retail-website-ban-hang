namespace Domain.Enums.Sales.Coupons;

/// <summary>Kiểu mã giảm giá (BR-08).</summary>
public enum CouponType
{
    PhanTram = 0,
    SoTien = 1,
    MienPhiVanChuyen = 2
}

/// <summary>Trạng thái mã, suy ra lúc đọc (06 §4 Sales_Coupons).</summary>
public enum CouponStatus
{
    SapChay = 0,
    DangChay = 1,
    TamDung = 2,
    HetLuot = 3,
    HetHan = 4
}
