using Application.DTOs.Orders;
using Application.DTOs.Reports;
using Application.Interfaces.Services.Orders;
using Application.Interfaces.Services.Sales;
using Application.Common.Time;
using Domain.Entities.Crm.Customers;
using Domain.Entities.Sales.Catalog;
using Domain.Entities.Sales.Coupons;
using Domain.Entities.Sales.Locations;
using Domain.Entities.Sales.Orders;
using Domain.Enums.Sales.Orders;
using Microsoft.EntityFrameworkCore;
using UnitTests.TestSupport;

namespace UnitTests.Sales;

/// <summary>Dữ liệu mẫu nạp đúng số ở 06 §5.1, §5.6, §5.7 (đối chiếu với FE mock).</summary>
public sealed class SalesSeedTests : IAsyncLifetime
{
    private SalesTestHost _host = null!;
    private SalesScenario _s = null!;

    public async Task InitializeAsync()
    {
        _host = await SalesTestHost.StartAsync();
        _s = new SalesScenario(_host);
    }

    public async Task DisposeAsync() => await _host.DisposeAsync();

    [Fact]
    public async Task Counts_MatchDesign()
    {
        Assert.Equal(34, await _host.QueryAsync<Province, int>(q => q.CountAsync()));
        Assert.Equal(164, await _host.QueryAsync<Ward, int>(q => q.CountAsync()));
        Assert.Equal(8, await _host.QueryAsync<Category, int>(q => q.CountAsync()));
        Assert.Equal(17, await _host.QueryAsync<Color, int>(q => q.CountAsync()));
        Assert.Equal(60, await _host.QueryAsync<Product, int>(q => q.CountAsync()));
        Assert.Equal(143, await _host.QueryAsync<ProductImage, int>(q => q.CountAsync()));
        Assert.Equal(422, await _host.QueryAsync<ProductVariant, int>(q => q.CountAsync()));
        Assert.Equal(2, await _host.QueryAsync<ProductVariant, int>(q => q.CountAsync(v => !v.IsActive)));
        Assert.Equal(8, await _host.QueryAsync<StockAdjustment, int>(q => q.CountAsync()));
        Assert.Equal(5, await _host.QueryAsync<Coupon, int>(q => q.CountAsync()));
        Assert.Equal(300, await _host.QueryAsync<Customer, int>(q => q.CountAsync()));
        Assert.Equal(796, await _host.QueryAsync<Order, int>(q => q.CountAsync()));
        Assert.Equal(1310, await _host.QueryAsync<OrderLine, int>(q => q.CountAsync()));
        Assert.Equal(6237, await _host.QueryAsync<OrderEvent, int>(q => q.CountAsync()));
        Assert.Equal(708, await _host.QueryAsync<Shipment, int>(q => q.CountAsync()));
        Assert.Equal(566, await _host.QueryAsync<Order, int>(q => q.CountAsync(o => o.PaymentMethod == PaymentMethod.Cod)));
    }

    [Fact]
    public async Task StatusCounts_AfterLoad()
    {
        await _host.SignInAsync("nhanvien");
        var counts = await _host.CallAsync<IOrderService, IReadOnlyDictionary<string, int>>(s => s.GetStatusCountsAsync(new OrderQuery()));
        Assert.Equal(2, counts["ChoThanhToan"]);
        Assert.Equal(17, counts["ChoXacNhan"]);
        Assert.Equal(7, counts["DaXacNhan"]);
        Assert.Equal(18, counts["DangGiao"]);
        Assert.Equal(614, counts["DaGiao"]);
        Assert.Equal(2, counts["DangHoan"]);
        Assert.Equal(74, counts["DaHoan"]);
        Assert.Equal(62, counts["DaHuy"]);
        Assert.Equal(796, counts["TatCa"]);

        var todo = await _host.CallAsync<IReportService, DashboardTodo>(s => s.GetTodoAsync());
        Assert.Equal(2, todo.GiaoCham);
    }

    [Fact]
    public async Task Revenue_BeforeToday_AndToday()
    {
        var today = VietnamDates.Today(_host.Time);
        var report = await _host.CallAsync<IReportService, RevenueReport>(s => s.GetRevenueAsync(new DateRangeQuery
        {
            From = VietnamDates.Format(today.AddDays(-89)),
            To = VietnamDates.Format(today.AddDays(-1))
        }));
        Assert.Equal(332_576_000m, report.Totals.NetRevenue);
        var deliveredBefore = await _host.QueryAsync<Order, int>(q => q.CountAsync(o => o.Status == OrderStatus.DaGiao
            && o.Shipment!.DeliveredAt < VietnamDates.StartOfDayUtc(today)));
        Assert.Equal(602, deliveredBefore);

        var sales = await _host.CallAsync<IReportService, DashboardSales>(s => s.GetSalesAsync());
        Assert.Equal(20, sales.Today.NewOrders);
        Assert.Equal(11_134_000m, sales.Today.OrderValue);
        Assert.Equal(5_592_000m, sales.Today.NetRevenue);
        var todayReport = await _host.CallAsync<IReportService, RevenueReport>(s => s.GetRevenueAsync(new DateRangeQuery
        {
            From = VietnamDates.Format(today),
            To = VietnamDates.Format(today)
        }));
        Assert.Equal(5_592_000m, todayReport.Totals.NetRevenue);
    }

    [Fact]
    public async Task TestData_Section56()
    {
        Assert.Equal(50, await _s.StockAsync("AT001-TR-M"));
        Assert.Equal(3, await _s.StockAsync("AT001-DE-L"));
        Assert.Equal(0, await _s.StockAsync("AT001-BE-XL"));
        Assert.Equal(8, await _s.StockAsync("QJ003-XN-28"));
        Assert.Equal(20, await _s.StockAsync("TX001-KE"));

        var at001 = await _host.QueryAsync<Product, Product>(q => q.SingleAsync(p => p.Code == "AT001"));
        Assert.Equal(159_000m, at001.Price);
        Assert.Equal(199_000m, at001.ListPrice);
        Assert.Equal("ao-thun-cotton-basic", at001.Slug);
        Assert.Equal(90, at001.SoldCount);
        Assert.Equal(44, await _host.QueryAsync<Product, int>(q => q.Where(p => p.Code == "VD002").Select(p => p.SoldCount).SingleAsync()));
        Assert.True(await _host.QueryAsync<Product, bool>(q => q.Where(p => p.Code == "AK006").Select(p => p.IsHidden).SingleAsync()));

        var used = await _host.QueryAsync<Coupon, Dictionary<string, int>>(q => q.ToDictionaryAsync(c => c.Code, c => c.UsedCount));
        Assert.Equal(51, used["GIAM10"]);
        Assert.Equal(14, used["GIAM50K"]);
        Assert.Equal(23, used["FREESHIP"]);
        Assert.Equal(1, used["AOTHUN15"]);
        Assert.Equal(24, used["HETHAN"]);

        var hoa = await _host.QueryAsync<Customer, Customer>(q => q.SingleAsync(c => c.Phone == "0987654321"));
        Assert.Equal("Lê Thị Hoa", hoa.Name);
        Assert.Equal(2, hoa.ReturnCount);
        Assert.Equal(3, hoa.OrderCount);
        Assert.Equal(6, await _host.QueryAsync<Customer, int>(q => q.CountAsync(c => c.TotalSpent >= 5_000_000m)));
        Assert.Equal(10, await _host.QueryAsync<Customer, int>(q => q.CountAsync(c => c.ReturnCount >= 2)));
        Assert.Equal(101, await _host.QueryAsync<Customer, int>(q => q.CountAsync(c => c.Email != null)));
    }

    [Fact]
    public async Task Orders_CodesTotalsAndOverdue()
    {
        var today = VietnamDates.Today(_host.Time);
        var firstDay = SalesCodesPrefix(today.AddDays(-89));
        var first = await _host.QueryAsync<Order, List<Order>>(q => q.Where(o => o.Code.StartsWith(firstDay)).OrderBy(o => o.Code).Take(3).ToListAsync());
        Assert.Equal([718_000m, 378_000m, 354_000m], first.Select(o => o.Total));
        Assert.Equal(firstDay + "0001", first[0].Code);
        Assert.Equal("0932392694", first[0].Phone);

        // Đơn chuyển khoản đặt 25 giờ trước: tự hủy lúc nạp, lý do quá hạn, người "Hệ thống", cancelledAt = hạn thanh toán (TC-34).
        var now = _host.Time.GetUtcNow().UtcDateTime;
        var overdue = await _host.QueryAsync<Order, Order>(q => q.Include(o => o.Events)
            .SingleAsync(o => o.PlacedAt == now.AddMinutes(-1500)));
        Assert.Equal(OrderStatus.DaHuy, overdue.Status);
        Assert.Equal(CancelReason.QuaHanThanhToan, overdue.CancelReason);
        Assert.Equal("Hệ thống", overdue.CancelledByName);
        Assert.Equal(overdue.PaymentDueAt, overdue.CancelledAt);
        Assert.Equal(2, await _host.QueryAsync<Order, int>(q => q.CountAsync(o => o.Status == OrderStatus.ChoThanhToan)));

        // Tracking code: tiền tố + yyMMdd + 4 số; mọi vận đơn đã in một lần.
        var shipments = await _host.QueryAsync<Shipment, List<Shipment>>(q => q.ToListAsync());
        Assert.All(shipments, s => Assert.Matches(@"^(GHN|GHTK|VTP|JT)\d{10}$", s.TrackingCode));
        Assert.All(shipments, s => Assert.Equal(1, s.LabelPrintCount));
        Assert.Equal(246, shipments.Count(s => s.Carrier == Carrier.Ghtk));

        // Một cặp Trùng SĐT duy nhất (0582966421).
        await _host.SignInAsync("nhanvien");
        var dup = await _host.CallAsync<IOrderService, Application.Common.Models.PaginatedResult<OrderListItem>>(
            s => s.GetPagedAsync(new OrderQuery { Label = OrderLabel.TrungSdt }));
        Assert.Equal(2, dup.TotalCount);
        Assert.All(dup.Items, i => Assert.Equal("0582966421", i.Phone));
    }

    private static string SalesCodesPrefix(DateOnly date) => Domain.Entities.Sales.SalesCodes.OrderPrefix(date);
}
