namespace Domain.Enums.Sales.Catalog;

/// <summary>Trạng thái sản phẩm, suy ra từ <c>IsHidden</c> (06 §4 Sales_Products).</summary>
public enum ProductStatus
{
    DangBan = 0,
    An = 1
}

/// <summary>Tình trạng tồn (BR-02): 0 hết hàng, 1–5 sắp hết, &gt; 5 còn hàng.</summary>
public enum StockStatus
{
    ConHang = 0,
    SapHet = 1,
    HetHang = 2
}

/// <summary>Lý do điều chỉnh tồn (BR-27).</summary>
public enum StockAdjustReason
{
    NhapHang = 0,
    KiemKe = 1,
    HangLoi = 2,
    Khac = 3
}

/// <summary>Vấn đề của một dòng giỏ khi kiểm lại (07 §3.4); chỉ <see cref="GiaDaDoi"/> không chặn đặt hàng.</summary>
public enum CartLineIssue
{
    GiaDaDoi = 0,
    KhongDuTon = 1,
    HetHang = 2,
    NgungKinhDoanh = 3,
    BienTheDaTat = 4
}
