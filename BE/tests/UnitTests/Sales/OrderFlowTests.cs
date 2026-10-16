using Application.Common.Exceptions;
using Application.Common.Time;
using Application.DTOs.Orders;
using Application.DTOs.Reports;
using Application.DTOs.Storefront;
using Application.Interfaces.Services.Orders;
using Application.Interfaces.Services.Sales;
using Application.Interfaces.Services.Storefront;
using Domain.Common;
using Domain.Entities.Crm.Customers;
using Domain.Entities.Sales.Coupons;
using Domain.Entities.Sales.Orders;
using Domain.Enums.Sales.Orders;
using Microsoft.EntityFrameworkCore;
using UnitTests.TestSupport;

namespace UnitTests.Sales;

/// <summary>Vòng đời đơn, tồn, lượt mã, version, tự hủy quá hạn, tra cứu, báo cáo (TC-19…TC-38, TC-43).</summary>
public sealed class OrderFlowTests : IAsyncLifetime
{
    private SalesTestHost _host = null!;
    private SalesScenario _s = null!;

    public async Task InitializeAsync()
    {
        _host = await SalesTestHost.StartAsync();
        _s = new SalesScenario(_host);
    }

    public async Task DisposeAsync() => await _host.DisposeAsync();

    private async Task<OrderDetailDto> DetailAsync(string code, string user = "nhanvien")
    {
        var id = await _s.OrderIdAsync(code);
        return await _s.AsStaffAsync(user, s => s.GetByIdAsync(id));
    }

    private Task<OrderDetailDto> ActAsync(string user, Func<IOrderService, Task<OrderDetailDto>> call) => _s.AsStaffAsync(user, call);

    private Task<PublicOrderView> LookupAsync(string code, string phone, string device = "dev-1") =>
        _host.CallAsync<IOrderLookupService, PublicOrderView>(s => s.LookupAsync(new OrderLookupRequest { Code = code, Phone = phone, DeviceId = device }));

    [Fact]
    public async Task Tc19_Tc26_Tc27_Tc35_Tc37_CodLifecycle()
    {
        var placed = (await _s.PlaceAsync("0901000001", SalesScenario.Hcm, PaymentMethod.Cod, null, ("AT001-TR-M", 2))).Order;
        var netBefore = (await _host.CallAsync<IReportService, DashboardSales>(s => s.GetSalesAsync())).Today.NetRevenue;

        // TC-19: tra cứu đúng số → che số, có dòng thời gian; sai số → 404.
        var view = await LookupAsync(placed.Code, "0901000001");
        Assert.Equal("090****001", view.MaskedPhone);
        Assert.Equal(338_000m, view.Summary.Total);
        Assert.True(view.CanCancel);
        Assert.Equal("Đặt hàng thành công, chờ shop xác nhận", view.Timeline[0].Text);
        var nf = await Assert.ThrowsAsync<CodedNotFoundException>(() => LookupAsync(placed.Code, "0901000002"));
        Assert.Equal("KhongTimThayDon", nf.Code);

        // TC-26: ghi chú nội bộ không hiện ở tra cứu.
        var detail = await DetailAsync(placed.Code);
        detail = await ActAsync("nhanvien", s => s.AddNoteAsync(detail.Id, new AddOrderNoteRequest { Content = "Khách hẹn giao sau 17h" }));
        Assert.Contains(detail.Events, e => e.Type == OrderEventType.GhiChuNoiBo && e.ActorName == "Lê Hoàng Nam");
        Assert.DoesNotContain((await LookupAsync(placed.Code, "0901000001")).Timeline, t => t.Text.Contains("17h"));
        Assert.Equal(2, detail.Version);

        // TC-27: xác nhận.
        detail = await ActAsync("nhanvien", s => s.ConfirmAsync(detail.Id, new ConfirmOrderRequest { Version = detail.Version }));
        Assert.Equal(OrderStatus.DaXacNhan, detail.Status);
        var confirm = detail.Events.Last(e => e.Type == OrderEventType.DoiTrangThai);
        Assert.Equal((OrderStatus.ChoXacNhan, OrderStatus.DaXacNhan, "Lê Hoàng Nam"), (confirm.FromStatus!.Value, confirm.ToStatus!.Value, confirm.ActorName));
        Assert.Equal([OrderAction.Ship, OrderAction.Cancel, OrderAction.PrintLabel], detail.AllowedActions);

        // TC-35/37: bàn giao GHN, đã giao → doanh thu thuần tăng 318.000, khách tăng chi tiêu 338.000.
        detail = await ActAsync("nhanvien", s => s.ShipAsync(detail.Id, new ShipOrderRequest { Version = detail.Version, Carrier = Carrier.Ghn, WeightGrams = 300 }));
        Assert.Equal(OrderStatus.DangGiao, detail.Status);
        Assert.Matches(@"^GHN261015\d{4}$", detail.Shipment!.TrackingCode);
        Assert.Equal(338_000m, detail.Shipment.CodAmount);
        var lookupShip = await LookupAsync(placed.Code, "0901000001");
        Assert.Equal($"Đã giao cho GHN, mã vận đơn {detail.Shipment.TrackingCode}", lookupShip.Timeline.Last().Text);
        Assert.False(lookupShip.CanCancel);

        var cancelShipped = await Assert.ThrowsAsync<DomainException>(() =>
            ActAsync("nhanvien", s => s.CancelAsync(detail.Id, new CancelOrderRequest { Reason = CancelReason.KhachDoiY })));
        Assert.Equal(("KhongHuyDonDaBanGiao", "Không thể hủy đơn đã bàn giao vận chuyển"), (cancelShipped.Extensions["code"], cancelShipped.Message));

        var printed = await _host.CallAsync<IOrderService, LabelPrintedResult>(s => s.MarkLabelPrintedAsync(detail.Id));
        Assert.Equal(1, printed.LabelPrintCount);
        detail = await DetailAsync(placed.Code);
        detail = await ActAsync("nhanvien", s => s.DeliverAsync(detail.Id, new VersionedRequest { Version = detail.Version }));
        Assert.Equal((OrderStatus.DaGiao, PaymentStatus.DaThanhToan), (detail.Status, detail.PaymentStatus));

        var netAfter = (await _host.CallAsync<IReportService, DashboardSales>(s => s.GetSalesAsync())).Today.NetRevenue;
        Assert.Equal(318_000m, netAfter - netBefore);
        var customer = await _host.QueryAsync<Customer, Customer>(q => q.SingleAsync(c => c.Phone == "0901000001"));
        Assert.Equal(338_000m, customer.TotalSpent);
        Assert.Equal(1, customer.DeliveredCount);
    }

    [Fact]
    public async Task Version_Stale_And_CancelledConflicts()
    {
        var placed = (await _s.PlaceAsync("0901000017", SalesScenario.Hcm, PaymentMethod.Cod, null, ("TX001-KE", 1))).Order;
        var detail = await DetailAsync(placed.Code);
        await ActAsync("quanly", s => s.AddNoteAsync(detail.Id, new AddOrderNoteRequest { Content = "Gọi lần 1" }));

        var stale = await Assert.ThrowsAsync<ConflictException>(() =>
            ActAsync("nhanvien", s => s.ConfirmAsync(detail.Id, new ConfirmOrderRequest { Version = detail.Version })));
        Assert.Equal("DonDaThayDoi", stale.Extensions["code"]);
        Assert.StartsWith("Đơn vừa được Trần Thị Mai cập nhật lúc ", stale.Message);
        Assert.IsType<OrderDetailDto>(stale.Extensions["order"]);

        // Khách tự hủy trong lúc nhân viên mở đơn (UC-08 E4).
        var view = await _host.CallAsync<IOrderLookupService, PublicOrderView>(s =>
            s.CancelAsync(placed.Code, new PublicCancelRequest { Phone = "0901000017", Reason = CancelReason.KhachDoiY }, "dev-x", null));
        Assert.Equal(OrderStatus.DaHuy, view.Status);
        Assert.Equal("Đơn đã hủy: Khách đổi ý", view.Timeline.Last().Text);
        var cancelled = await Assert.ThrowsAsync<ConflictException>(() =>
            ActAsync("nhanvien", s => s.ConfirmAsync(detail.Id, new ConfirmOrderRequest { Version = detail.Version + 1 })));
        Assert.Equal("DonDaBiHuy", cancelled.Extensions["code"]);
        Assert.StartsWith("Đơn đã bị hủy lúc ", cancelled.Message);

        // Không gửi version (Swagger): chỉ kiểm trạng thái.
        var invalid = await Assert.ThrowsAsync<DomainException>(() =>
            ActAsync("nhanvien", s => s.ConfirmAsync(detail.Id, new ConfirmOrderRequest())));
        Assert.Equal("TrangThaiKhongHopLe", invalid.Extensions["code"]);
        Assert.Equal("Thao tác không áp dụng cho đơn Đã hủy", invalid.Message);
    }

    [Fact]
    public async Task Tc20_SelfCancel_RestoresStock_ByCustomer()
    {
        var stock = await _s.StockAsync("TX001-KE");
        var placed = (await _s.PlaceAsync("0901000014", SalesScenario.Hcm, PaymentMethod.Cod, null, ("TX001-KE", 1))).Order;
        Assert.Equal(stock - 1, await _s.StockAsync("TX001-KE"));
        await _host.CallAsync<IOrderLookupService, PublicOrderView>(s =>
            s.CancelAsync(placed.Code, new PublicCancelRequest { Phone = "0901000014", Reason = CancelReason.KhachDoiY }, "dev-2", null));
        Assert.Equal(stock, await _s.StockAsync("TX001-KE"));
        var detail = await DetailAsync(placed.Code);
        Assert.Equal("Khách", detail.CancelledByName);

        // Đơn đã xác nhận thì khách không tự hủy được.
        var other = (await _s.PlaceAsync("0901000014", SalesScenario.Hcm, PaymentMethod.Cod, null, ("TX001-KE", 1))).Order;
        var otherId = await _s.OrderIdAsync(other.Code);
        await ActAsync("nhanvien", s => s.ConfirmAsync(otherId, new ConfirmOrderRequest()));
        var ex = await Assert.ThrowsAsync<DomainException>(() => _host.CallAsync<IOrderLookupService, PublicOrderView>(s =>
            s.CancelAsync(other.Code, new PublicCancelRequest { Phone = "0901000014", Reason = CancelReason.KhachDoiY }, "dev-2", null)));
        Assert.Equal(("KhongTheTuHuy", "Đơn đã được shop xử lý, không tự hủy được. Vui lòng gọi hotline 028 3000 1234"),
            (ex.Extensions["code"], ex.Message));
    }

    [Fact]
    public async Task Br28_LookupLockedAfterFiveFailures()
    {
        for (var i = 0; i < 4; i++)
            await Assert.ThrowsAsync<CodedNotFoundException>(() => LookupAsync("DH0000000000", "0901000088", "dev-lock"));
        var locked = await Assert.ThrowsAsync<TooManyRequestsException>(() => LookupAsync("DH0000000000", "0901000088", "dev-lock"));
        Assert.Equal("TraCuuTamKhoa", locked.Code);
        Assert.Equal("Bạn đã tra cứu sai quá 5 lần, vui lòng thử lại sau 10 phút", locked.Message);
        await Assert.ThrowsAsync<TooManyRequestsException>(() => LookupAsync("DH0000000000", "0901000088", "dev-lock"));
        // Trình duyệt khác không bị chặn.
        await Assert.ThrowsAsync<CodedNotFoundException>(() => LookupAsync("DH0000000000", "0901000088", "dev-other"));
        _host.Time.Advance(TimeSpan.FromMinutes(11));
        await Assert.ThrowsAsync<CodedNotFoundException>(() => LookupAsync("DH0000000000", "0901000088", "dev-lock"));
    }

    [Fact]
    public async Task Tc29_Tc30_EditOrder()
    {
        await _s.PlaceAsync("0901000011", SalesScenario.Hcm, PaymentMethod.Cod, null, ("AT001-DE-L", 3));
        var placed = (await _s.PlaceAsync("0901000007", SalesScenario.Hcm, PaymentMethod.Cod, null, ("AT001-TR-M", 2))).Order;
        Assert.Equal(338_000m, placed.Summary.Total);
        var stock = await _s.StockAsync("AT001-TR-M");
        var detail = await DetailAsync(placed.Code);
        var trm = await _s.VariantIdAsync("AT001-TR-M");
        EditOrderRequest Request(params (Guid, int)[] lines) => new()
        {
            Version = detail.Version,
            Lines = lines.Select(l => new EditOrderLineInput { VariantId = l.Item1, Quantity = l.Item2 }).ToList(),
            RecipientName = detail.RecipientName,
            Phone = detail.Phone,
            ProvinceCode = detail.ProvinceCode,
            WardCode = detail.WardCode,
            AddressLine = detail.AddressLine
        };

        await _host.SignInAsync("nhanvien");
        var preview = await _host.CallAsync<IOrderService, EditOrderPreview>(s => s.PreviewEditAsync(detail.Id, Request((trm, 4))));
        Assert.Equal(["Trắng/M 2 → 4"], preview.Changes);
        Assert.Equal(636_000m, preview.Summary.Total);

        detail = await ActAsync("nhanvien", s => s.EditAsync(detail.Id, Request((trm, 4))));
        Assert.Equal((636_000m, 0m, 636_000m), (detail.Subtotal, detail.ShippingFee, detail.Total));
        Assert.Equal(stock - 2, await _s.StockAsync("AT001-TR-M"));
        Assert.Contains(detail.Events, e => e.Type == OrderEventType.SuaDon && e.Content == "Sửa đơn: Trắng/M 2 → 4");

        // TC-30: thêm Đen/L (đã hết) → không lưu.
        var del = await _s.VariantIdAsync("AT001-DE-L");
        var ex = await Assert.ThrowsAsync<ConflictException>(() => ActAsync("nhanvien", s => s.EditAsync(detail.Id, Request((trm, 4), (del, 1)))));
        Assert.Equal("Áo thun cotton basic – Đen / L chỉ còn 0 sản phẩm", ex.Message);
        Assert.Equal(636_000m, (await DetailAsync(placed.Code)).Total);
        Assert.Equal(stock - 2, await _s.StockAsync("AT001-TR-M"));
    }

    [Fact]
    public async Task Tc31_CancelWithCoupon_ReturnsStockAndUsage()
    {
        var stockM = await _s.StockAsync("AT001-TR-M");
        var stock28 = await _s.StockAsync("QJ003-XN-28");
        var used = await UsedAsync("GIAM10");
        var placed = (await _s.PlaceAsync("0901000008", SalesScenario.HaNoi, PaymentMethod.Cod, "GIAM10", ("AT001-TR-M", 2), ("QJ003-XN-28", 1))).Order;
        Assert.Equal(657_000m, placed.Summary.Total);
        Assert.Equal(used + 1, await UsedAsync("GIAM10"));
        var id = await _s.OrderIdAsync(placed.Code);
        await ActAsync("nhanvien", s => s.ConfirmAsync(id, new ConfirmOrderRequest()));
        var detail = await ActAsync("nhanvien", s => s.CancelAsync(id, new CancelOrderRequest { Reason = CancelReason.KhachDoiY }));
        Assert.Equal(OrderStatus.DaHuy, detail.Status);
        Assert.Equal((stockM, stock28, used), (await _s.StockAsync("AT001-TR-M"), await _s.StockAsync("QJ003-XN-28"), await UsedAsync("GIAM10")));

        var again = await _s.PlaceAsync("0901000008", SalesScenario.HaNoi, PaymentMethod.Cod, "GIAM10", ("AT001-TR-M", 2), ("QJ003-XN-28", 1));
        Assert.Equal(50_000m, again.Order.Summary.Discount);
    }

    [Fact]
    public async Task Tc28_Tc32_PaidTransferCancelled_ThenRefund()
    {
        var placed = (await _s.PlaceAsync("0901000009", SalesScenario.Hcm, PaymentMethod.ChuyenKhoan, null, ("TX001-KE", 1))).Order;
        Assert.Equal(149_000m, placed.Summary.Total);
        var id = await _s.OrderIdAsync(placed.Code);
        var detail = await ActAsync("nhanvien", s => s.ConfirmPaymentAsync(id, new ConfirmPaymentRequest { TransactionRef = "FT26285904127" }));
        Assert.Equal((OrderStatus.DaXacNhan, PaymentStatus.DaThanhToan, "FT26285904127"), (detail.Status, detail.PaymentStatus, detail.TransactionRef!));
        detail = await ActAsync("nhanvien", s => s.CancelAsync(id, new CancelOrderRequest { Reason = CancelReason.HetHang }));
        Assert.Equal((PaymentStatus.CanHoanTien, 149_000m), (detail.PaymentStatus, detail.RefundAmount!.Value));
        Assert.Equal([OrderAction.Refund], detail.AllowedActions);
        Assert.Equal("Hết hàng · Cần hoàn tiền 149.000 ₫", detail.Events.Last(e => e.Type == OrderEventType.DoiTrangThai).Content);
        detail = await ActAsync("quanly", s => s.RefundAsync(id, new RefundRequest { RefundRef = "FT26999000111" }));
        Assert.Equal(PaymentStatus.DaHoanTien, detail.PaymentStatus);
        Assert.Contains(detail.Events, e => e.Type == OrderEventType.HoanTien && e.Content == "Đã hoàn tiền 149.000 ₫, mã giao dịch FT26999000111");
    }

    [Fact]
    public async Task Tc38_DeliveryFailed_ThenReturn_StockBack_CouponKept()
    {
        var placed = (await _s.PlaceAsync("0901000002", SalesScenario.HaNoi, PaymentMethod.Cod, "GIAM10", ("AT001-TR-M", 2), ("QJ003-XN-28", 1))).Order;
        var used = await UsedAsync("GIAM10");
        var id = await _s.OrderIdAsync(placed.Code);
        await ActAsync("nhanvien", s => s.ConfirmAsync(id, new ConfirmOrderRequest()));
        var shipped = await ActAsync("nhanvien", s => s.ShipAsync(id, new ShipOrderRequest { Carrier = Carrier.Ghtk, WeightGrams = 800 }));
        Assert.Matches(@"^GHTK\d{10}$", shipped.Shipment!.TrackingCode);
        Assert.Equal(657_000m, shipped.Shipment.CodAmount);
        var stockM = await _s.StockAsync("AT001-TR-M");
        var failed = await ActAsync("nhanvien", s => s.DeliveryFailedAsync(id, new DeliveryFailedRequest { Reason = DeliveryFailReason.KhachTuChoiNhan }));
        Assert.Equal(OrderStatus.DangHoan, failed.Status);
        Assert.Equal(stockM, await _s.StockAsync("AT001-TR-M"));
        var returned = await ActAsync("nhanvien", s => s.ReceiveReturnAsync(id, new VersionedRequest()));
        Assert.Equal(OrderStatus.DaHoan, returned.Status);
        Assert.Equal(stockM + 2, await _s.StockAsync("AT001-TR-M"));
        Assert.Equal(used, await UsedAsync("GIAM10"));

        // TC-43: tình trạng đơn hôm nay có lý do giao thất bại "Khách từ chối nhận".
        var today = VietnamDates.Format(VietnamDates.Today(_host.Time));
        var report = await _host.CallAsync<IReportService, OrderStatusReport>(s => s.GetOrderStatusAsync(new OrderStatusReportQuery { From = today, To = today }));
        Assert.Contains(report.FailReasons, r => r.Reason == DeliveryFailReason.KhachTuChoiNhan);
    }

    [Fact]
    public async Task Tc34_OverdueTransfer_AutoCancelledAfter24h()
    {
        var stock = await _s.StockAsync("TX001-KE");
        var placed = (await _s.PlaceAsync("0901000019", SalesScenario.Hcm, PaymentMethod.ChuyenKhoan, null, ("TX001-KE", 1))).Order;
        _host.Time.Advance(TimeSpan.FromHours(24).Add(TimeSpan.FromMinutes(1)));
        var detail = await DetailAsync(placed.Code);
        Assert.Equal(OrderStatus.DaHuy, detail.Status);
        Assert.Equal(CancelReason.QuaHanThanhToan, detail.CancelReason);
        Assert.Equal("Hệ thống", detail.CancelledByName);
        Assert.Equal(placed.PaymentDueAt, detail.CancelledAt);
        Assert.Equal(stock, await _s.StockAsync("TX001-KE"));
    }

    [Fact]
    public async Task Tc25_DuplicatePhone_And_AttentionCustomer()
    {
        var a = (await _s.PlaceAsync("0901000006", SalesScenario.Hcm, PaymentMethod.Cod, null, ("AT001-TR-M", 1))).Order;
        _host.Time.Advance(TimeSpan.FromMinutes(3));
        var b = (await _s.PlaceAsync("0901000006", SalesScenario.Hcm, PaymentMethod.Cod, null, ("AT001-TR-M", 1))).Order;
        await _host.SignInAsync("nhanvien");
        var list = await _host.CallAsync<IOrderService, Application.Common.Models.PaginatedResult<OrderListItem>>(s =>
            s.GetPagedAsync(new OrderQuery { Label = OrderLabel.TrungSdt, Search = "0901000006" }));
        Assert.Equal(2, list.TotalCount);
        var detailA = await DetailAsync(a.Code);
        Assert.Equal(b.Code, Assert.Single(detailA.DuplicateOrders).Code);
        Assert.Contains(OrderLabel.TrungSdt, detailA.Labels);

        var hoa = await _host.CallAsync<IOrderService, Application.Common.Models.PaginatedResult<OrderListItem>>(s =>
            s.GetPagedAsync(new OrderQuery { Search = "0987654321", Status = OrderStatus.ChoXacNhan }));
        var hoaDetail = await DetailAsync(Assert.Single(hoa.Items).Code);
        Assert.Equal(2, hoaDetail.Customer.ReturnCount);
        Assert.Contains(OrderLabel.KhachCanLuuY, hoaDetail.Labels);

        // Xác nhận một đơn thì nhãn Trùng SĐT ở đơn kia tự mất (UC-09 1b).
        await ActAsync("nhanvien", s => s.ConfirmAsync(detailA.Id, new ConfirmOrderRequest()));
        Assert.DoesNotContain(OrderLabel.TrungSdt, (await DetailAsync(b.Code)).Labels);
    }

    [Fact]
    public async Task Tc39_Tc43_DashboardAndRevenue()
    {
        var before = (await _host.CallAsync<IReportService, DashboardSales>(s => s.GetSalesAsync())).Today;
        var todoBefore = await _host.CallAsync<IReportService, DashboardTodo>(s => s.GetTodoAsync());
        await _s.PlaceAsync("0901000015", SalesScenario.Hcm, PaymentMethod.Cod, null, ("AT001-TR-M", 2));
        var after = (await _host.CallAsync<IReportService, DashboardSales>(s => s.GetSalesAsync())).Today;
        var todoAfter = await _host.CallAsync<IReportService, DashboardTodo>(s => s.GetTodoAsync());
        Assert.Equal(338_000m, after.OrderValue - before.OrderValue);
        Assert.Equal(1, after.NewOrders - before.NewOrders);
        Assert.Equal(1, todoAfter.ChoXacNhan - todoBefore.ChoXacNhan);

        // Đơn hủy không tính giá trị đặt hàng nhưng vẫn tính số đơn mới.
        var cancelled = (await _s.PlaceAsync("0901000018", SalesScenario.Hcm, PaymentMethod.Cod, null, ("TX001-KE", 1))).Order;
        var id = await _s.OrderIdAsync(cancelled.Code);
        await ActAsync("nhanvien", s => s.CancelAsync(id, new CancelOrderRequest { Reason = CancelReason.KhachDoiY }));
        var last = (await _host.CallAsync<IReportService, DashboardSales>(s => s.GetSalesAsync())).Today;
        Assert.Equal(after.OrderValue, last.OrderValue);
        Assert.Equal(after.NewOrders + 1, last.NewOrders);

        var top = await _host.CallAsync<IReportService, TopProductsReport>(s => s.GetTopProductsAsync(new TopProductsQuery
        {
            From = VietnamDates.Format(VietnamDates.Today(_host.Time).AddDays(-89)),
            To = VietnamDates.Format(VietnamDates.Today(_host.Time))
        }));
        var revenue = await _host.CallAsync<IReportService, RevenueReport>(s => s.GetRevenueAsync(new DateRangeQuery
        {
            From = VietnamDates.Format(VietnamDates.Today(_host.Time).AddDays(-89)),
            To = VietnamDates.Format(VietnamDates.Today(_host.Time))
        }));
        // Phân bổ giảm giá theo dòng cộng đúng bằng doanh thu thuần.
        Assert.Equal(revenue.Totals.NetRevenue, top.TotalNetRevenue);
        Assert.Equal(332_576_000m + 5_592_000m, revenue.Totals.NetRevenue);
    }

    private Task<int> UsedAsync(string code) =>
        _host.QueryAsync<Coupon, int>(q => q.Where(c => c.Code == code).Select(c => c.UsedCount).SingleAsync());
}
