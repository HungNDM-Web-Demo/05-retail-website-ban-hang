using Application.Common.Exceptions;
using Application.DTOs.Storefront;
using Application.Interfaces.Services.Orders;
using Application.Interfaces.Services.Storefront;
using Domain.Common;
using Domain.Entities.Crm.Customers;
using Domain.Entities.Sales.Coupons;
using Domain.Entities.Sales.Orders;
using Domain.Enums.Sales.Catalog;
using Domain.Enums.Sales.Orders;
using Microsoft.EntityFrameworkCore;
using UnitTests.TestSupport;

namespace UnitTests.Sales;

/// <summary>Giỏ, tính tiền, mã giảm giá, đặt hàng công khai (TC-05…TC-18, 07 §3.11 số tính sẵn).</summary>
public sealed class CheckoutTests : IAsyncLifetime
{
    private SalesTestHost _host = null!;
    private SalesScenario _s = null!;

    public async Task InitializeAsync()
    {
        _host = await SalesTestHost.StartAsync();
        _s = new SalesScenario(_host);
    }

    public async Task DisposeAsync() => await _host.DisposeAsync();

    private async Task<CheckoutQuote> QuoteAsync(string? province, string? coupon, params (string, int)[] lines)
    {
        var cart = await _s.CartAsync(lines);
        return await _host.CallAsync<ICheckoutService, CheckoutQuote>(s =>
            s.QuoteAsync(new CheckoutQuoteRequest { Lines = cart, ProvinceCode = province, CouponCode = coupon }));
    }

    [Fact]
    public async Task Tc05_FreeShipBanner()
    {
        var cart = await _host.CallAsync<ICheckoutService, CartCheckResult>(async s =>
            await s.CheckCartAsync(new CartCheckRequest { Lines = await _s.CartAsync(("AT001-TR-M", 2)) }));
        Assert.Equal(318_000m, cart.Subtotal);
        Assert.Equal(181_000m, cart.FreeShipRemaining);

        var quote = await QuoteAsync(SalesScenario.HaNoi, null, ("AT001-TR-M", 2), ("QJ003-XN-28", 1));
        Assert.Equal(707_000m, quote.Summary.Subtotal);
        Assert.Equal(0m, quote.Summary.ShippingFee);
        Assert.Equal(0m, quote.Summary.FreeShipRemaining);
    }

    [Theory]
    [InlineData("TC-10", SalesScenario.HaNoi, "GIAM10", 322_000, 31_000, 35_000)]
    [InlineData("TC-12 trước", SalesScenario.HaNoi, null, 424_000, 0, 35_000)]
    [InlineData("TC-12 sau", SalesScenario.HaNoi, "FREESHIP", 389_000, 0, 0)]
    [InlineData("TC-16", SalesScenario.Hcm, null, 409_000, 0, 20_000)]
    public async Task Quote_PrecomputedNumbers(string tc, string province, string? coupon, int total, int discount, int fee)
    {
        var lines = tc == "TC-10" ? new[] { ("AT001-TR-M", 2) } : [("QJ003-XN-28", 1)];
        var quote = await QuoteAsync(province, coupon, lines);
        Assert.Equal(total, quote.Summary.Total);
        Assert.Equal(discount, quote.Summary.Discount);
        Assert.Equal(fee, quote.Summary.ShippingFee);
        if (coupon == "FREESHIP")
            Assert.Equal(35_000m, quote.Summary.ShippingDiscount);
    }

    [Fact]
    public async Task Tc11_CouponLosesFreeShipping()
    {
        var before = await QuoteAsync(SalesScenario.HaNoi, null, ("QJ003-XN-28", 1), ("TX001-KE", 1));
        Assert.Equal(518_000m, before.Summary.Total);
        Assert.Equal(0m, before.Summary.ShippingFee);
        var after = await QuoteAsync(SalesScenario.HaNoi, "giam50k", ("QJ003-XN-28", 1), ("TX001-KE", 1));
        Assert.True(after.Coupon!.Ok);
        Assert.Equal(50_000m, after.Summary.Discount);
        Assert.Equal(35_000m, after.Summary.ShippingFee);
        Assert.Equal(503_000m, after.Summary.Total);
    }

    [Fact]
    public async Task Tc13_CouponErrors()
    {
        var c1 = (await QuoteAsync(SalesScenario.HaNoi, "HETHAN", ("AT001-TR-M", 2))).Coupon!;
        Assert.Equal(("MaHetHan", "Mã đã hết hạn"), (c1.ErrorCode, c1.Message));
        var c2 = (await QuoteAsync(SalesScenario.HaNoi, "GIAM50K", ("AT001-TR-M", 2))).Coupon!;
        Assert.Equal(("ChuaDatToiThieu", "Đơn tối thiểu 500.000 ₫"), (c2.ErrorCode, c2.Message));
        var c3 = (await QuoteAsync(SalesScenario.HaNoi, "FREESHIP", ("AT001-TR-M", 2), ("QJ003-XN-28", 1))).Coupon!;
        Assert.Equal(("DaMienPhiVanChuyen", "Đơn đã được miễn phí vận chuyển"), (c3.ErrorCode, c3.Message));
        var c4 = await QuoteAsync(SalesScenario.HaNoi, "FREESHIP", ("AT001-TR-M", 1));
        Assert.Equal(("ChuaDatToiThieu", "Đơn tối thiểu 200.000 ₫"), (c4.Coupon!.ErrorCode, c4.Coupon.Message));
        Assert.Equal(0m, c4.Summary.Discount);
        var c5 = (await QuoteAsync(SalesScenario.HaNoi, "KHONGCO", ("AT001-TR-M", 2))).Coupon!;
        Assert.Equal("MaKhongTonTai", c5.ErrorCode);
        var c6 = (await QuoteAsync(SalesScenario.HaNoi, "AOTHUN15", ("QJ003-XN-28", 1))).Coupon!;
        Assert.Equal("MaKhongApDungDanhMuc", c6.ErrorCode);
        Assert.Equal("Mã chỉ áp dụng cho sản phẩm thuộc danh mục Áo thun", c6.Message);
    }

    [Fact]
    public async Task Tc08_PlaceCod_Hcm()
    {
        var before = await _s.StockAsync("AT001-TR-M");
        var result = await _s.PlaceAsync("0901000001", SalesScenario.Hcm, PaymentMethod.Cod, null, ("AT001-TR-M", 2));
        var order = result.Order;
        Assert.False(result.Duplicate);
        Assert.Equal(338_000m, order.Summary.Total);
        Assert.Equal(20_000m, order.Summary.ShippingFee);
        Assert.Matches(@"^DH261015\d{4}$", order.Code);
        Assert.Equal(OrderStatus.ChoXacNhan, order.Status);
        Assert.Null(order.Transfer);
        Assert.Equal(before - 2, await _s.StockAsync("AT001-TR-M"));

        var orderId = await _s.OrderIdAsync(order.Code);
        var events = await _host.QueryAsync<OrderEvent, List<string>>(q =>
            q.Where(e => e.OrderId == orderId).OrderBy(e => e.Seq).Select(e => e.Content).ToListAsync());
        Assert.Contains("Đã gửi SMS xác nhận đơn (giả lập)", events);
        Assert.Contains("Đặt hàng qua website", events);

        var customer = await _host.QueryAsync<Customer, Customer>(q => q.SingleAsync(c => c.Phone == "0901000001"));
        Assert.Equal(1, customer.OrderCount);
    }

    [Fact]
    public async Task Tc09_Tc14_PhoneUsedCoupon_ThenPlainOrder()
    {
        var first = await _s.PlaceAsync("0901000002", SalesScenario.HaNoi, PaymentMethod.Cod, "GIAM10", ("AT001-TR-M", 2), ("QJ003-XN-28", 1));
        Assert.Equal(657_000m, first.Order.Summary.Total);
        Assert.Equal(50_000m, first.Order.Summary.Discount);
        Assert.Equal(0m, first.Order.Summary.ShippingFee);
        Assert.Equal(52, await UsedAsync("GIAM10"));

        // TC-14: bước tính tiền vẫn áp được; bấm Đặt hàng thì báo đã dùng, không tạo đơn.
        var quote = await QuoteAsync(SalesScenario.HaNoi, "GIAM10", ("AT001-TR-M", 2), ("QJ003-XN-28", 1));
        Assert.True(quote.Coupon!.Ok);
        var count = await _host.QueryAsync<Order, int>(q => q.CountAsync());
        var ex = await Assert.ThrowsAsync<DomainException>(() =>
            _s.PlaceAsync("0901000002", SalesScenario.HaNoi, PaymentMethod.Cod, "GIAM10", ("AT001-TR-M", 2), ("QJ003-XN-28", 1)));
        Assert.Equal("SdtDaDungMa", ex.Extensions["code"]);
        Assert.Equal("Số điện thoại này đã dùng mã GIAM10", ex.Message);
        Assert.Equal(count, await _host.QueryAsync<Order, int>(q => q.CountAsync()));

        var plain = await _s.PlaceAsync("0901000002", SalesScenario.HaNoi, PaymentMethod.Cod, null, ("AT001-TR-M", 2), ("QJ003-XN-28", 1));
        Assert.Equal(707_000m, plain.Order.Summary.Total);
    }

    [Fact]
    public async Task Tc16_Transfer_QrAndDueTime()
    {
        var result = await _s.PlaceAsync("0901000005", SalesScenario.Hcm, PaymentMethod.ChuyenKhoan, null, ("QJ003-XN-28", 1));
        var order = result.Order;
        Assert.Equal(OrderStatus.ChoThanhToan, order.Status);
        Assert.Equal(409_000m, order.Summary.Total);
        Assert.NotNull(order.Transfer);
        Assert.Equal(409_000m, order.Transfer!.Amount);
        Assert.Equal(order.Code, order.Transfer.Content);
        Assert.Equal("MB Bank", order.Transfer.BankName);
        Assert.Equal(order.PlacedAt.AddHours(24), order.Transfer.DueAt);
        Assert.Equal($"VIETQR|970422|0000000000|409000|{order.Code}", order.Transfer.QrPayload);
    }

    [Fact]
    public async Task Tc17_LastUnits_StockNeverNegative()
    {
        await _s.PlaceAsync("0901000011", SalesScenario.Hcm, PaymentMethod.Cod, null, ("AT001-DE-L", 3));
        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _s.PlaceAsync("0901000012", SalesScenario.Hcm, PaymentMethod.Cod, null, ("AT001-DE-L", 3)));
        Assert.Equal("KhongDuTon", ex.Extensions["code"]);
        Assert.Equal("Áo thun cotton basic – Đen / L chỉ còn 0 sản phẩm", ex.Message);
        Assert.Equal(0, await _s.StockAsync("AT001-DE-L"));
        Assert.False(await _host.QueryAsync<Customer, bool>(q => q.AnyAsync(c => c.Phone == "0901000012")));
    }

    [Fact]
    public async Task Tc18_SameClientRequestId_OneOrder()
    {
        var request = await _s.RequestAsync("0901000013", SalesScenario.Hcm, PaymentMethod.Cod, null, ("AT001-TR-M", 1));
        var stock = await _s.StockAsync("AT001-TR-M");
        var first = await _host.CallAsync<ICheckoutService, WriteOutcome<PlaceOrderResult>>(s => s.PlaceOrderAsync(request));
        var second = await _host.CallAsync<ICheckoutService, WriteOutcome<PlaceOrderResult>>(s => s.PlaceOrderAsync(request));
        Assert.True(first.Created);
        Assert.False(second.Created);
        Assert.True(second.Value.Duplicate);
        Assert.Equal(first.Value.Order.Code, second.Value.Order.Code);
        Assert.Equal(stock - 1, await _s.StockAsync("AT001-TR-M"));
    }

    [Fact]
    public async Task PriceChanged_And_Discontinued()
    {
        var request = await _s.RequestAsync("0901000016", SalesScenario.Hcm, PaymentMethod.Cod, null, ("AT001-TR-M", 1));
        request.Lines[0].ExpectedPrice = 149_000m;
        var ex = await Assert.ThrowsAsync<ConflictException>(() => _s.PlaceAsync(request));
        Assert.Equal("GiaDaThayDoi", ex.Extensions["code"]);

        var hidden = await _s.RequestAsync("0901000016", SalesScenario.Hcm, PaymentMethod.Cod, null, ("AK006-DE-M", 1));
        var ex2 = await Assert.ThrowsAsync<ConflictException>(() => _s.PlaceAsync(hidden));
        Assert.Equal("SanPhamNgungBan", ex2.Extensions["code"]);
        Assert.Equal("Áo blazer dáng suông đã ngừng kinh doanh, vui lòng xóa khỏi giỏ", ex2.Message);

        var cart = await _host.CallAsync<ICheckoutService, CartCheckResult>(async s => await s.CheckCartAsync(new CartCheckRequest
        {
            Lines = [.. await _s.CartAsync(("AT001-BE-XL", 1), ("VD008-DO-S", 1), ("AK006-DE-M", 1)),
                new CartLineInput { VariantId = await _s.VariantIdAsync("AT001-TR-M"), Quantity = 2, Price = 149_000m }]
        }));
        Assert.Equal([CartLineIssue.HetHang, CartLineIssue.BienTheDaTat, CartLineIssue.NgungKinhDoanh, CartLineIssue.GiaDaDoi],
            cart.Lines.Select(l => l.Issue!.Value));
        Assert.Equal("Giá đã đổi từ 149.000 ₫ thành 159.000 ₫", cart.Lines[3].IssueText);
        Assert.False(cart.CanCheckout);
    }

    [Fact]
    public async Task EmptyCart_HasCode()
    {
        var ex = await Assert.ThrowsAsync<DomainException>(() =>
            _host.CallAsync<ICheckoutService, CartCheckResult>(s => s.CheckCartAsync(new CartCheckRequest())));
        Assert.Equal("GioHangTrong", ex.Extensions["code"]);
    }

    [Fact]
    public async Task Tc42_CustomerProfileUpdatedByPhone()
    {
        await _s.PlaceAsync("0901000001", SalesScenario.Hcm, PaymentMethod.Cod, null, ("TX001-KE", 1));
        var request = await _s.RequestAsync("0901000001", SalesScenario.HaNoi, PaymentMethod.Cod, null, ("TX001-KE", 1));
        request.Shipping.FullName = "Nguyễn Minh Anh";
        await _s.PlaceAsync(request);
        var customers = await _host.QueryAsync<Customer, List<Customer>>(q => q.Where(c => c.Phone == "0901000001").ToListAsync());
        var customer = Assert.Single(customers);
        Assert.Equal("Nguyễn Minh Anh", customer.Name);
        Assert.Equal(2, customer.OrderCount);
        Assert.Equal(SalesScenario.HaNoi, customer.ProvinceCode);
    }

    private Task<int> UsedAsync(string code) =>
        _host.QueryAsync<Coupon, int>(q => q.Where(c => c.Code == code).Select(c => c.UsedCount).SingleAsync());
}
