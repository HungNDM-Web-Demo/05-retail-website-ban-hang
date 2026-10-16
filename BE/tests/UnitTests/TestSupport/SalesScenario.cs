using Application.DTOs.Orders;
using Application.DTOs.Storefront;
using Application.Interfaces.Services.Orders;
using Application.Interfaces.Services.Storefront;
using Domain.Entities.Sales.Catalog;
using Domain.Entities.Sales.Locations;
using Domain.Enums.Sales.Orders;
using Microsoft.EntityFrameworkCore;

namespace UnitTests.TestSupport;

/// <summary>Thao tác dùng lại trong test: tra biến thể theo SKU, dựng giỏ, đặt hàng công khai (05 §1).</summary>
public sealed class SalesScenario(SalesTestHost host)
{
    public const string Hcm = "79";
    public const string HaNoi = "01";

    public SalesTestHost Host => host;

    public Task<Guid> VariantIdAsync(string sku) =>
        host.QueryAsync<ProductVariant, Guid>(q => q.Where(v => v.Sku == sku).Select(v => v.Id).SingleAsync());

    public Task<int> StockAsync(string sku) =>
        host.QueryAsync<ProductVariant, int>(q => q.Where(v => v.Sku == sku).Select(v => v.Stock).SingleAsync());

    public async Task<decimal> PriceAsync(string sku)
    {
        var productId = await host.QueryAsync<ProductVariant, Guid>(q => q.Where(v => v.Sku == sku).Select(v => v.ProductId).SingleAsync());
        return await host.QueryAsync<Product, decimal>(q => q.Where(p => p.Id == productId).Select(p => p.Price).SingleAsync());
    }

    public async Task<List<PlaceOrderLineInput>> LinesAsync(params (string Sku, int Quantity)[] lines)
    {
        var result = new List<PlaceOrderLineInput>();
        foreach (var (sku, quantity) in lines)
            result.Add(new PlaceOrderLineInput { VariantId = await VariantIdAsync(sku), Quantity = quantity, ExpectedPrice = await PriceAsync(sku) });
        return result;
    }

    public async Task<List<CartLineInput>> CartAsync(params (string Sku, int Quantity)[] lines) =>
        (await LinesAsync(lines)).Select(l => new CartLineInput { VariantId = l.VariantId, Quantity = l.Quantity, Price = l.ExpectedPrice }).ToList();

    /// <summary>Phường đầu tiên của tỉnh (TP.HCM: Phường Bến Thành; Hà Nội: Phường Cầu Giấy).</summary>
    public async Task<string> WardAsync(string provinceCode)
    {
        var name = provinceCode == Hcm ? "Phường Bến Thành" : provinceCode == HaNoi ? "Phường Cầu Giấy" : null;
        var provinceId = await host.QueryAsync<Province, Guid>(q => q.Where(p => p.Code == provinceCode).Select(p => p.Id).SingleAsync());
        return await host.QueryAsync<Ward, string>(q => q.Where(w => w.ProvinceId == provinceId && (name == null || w.Name == name))
            .OrderBy(w => w.Code).Select(w => w.Code).FirstAsync());
    }

    public async Task<PlaceOrderRequest> RequestAsync(
        string phone, string provinceCode, PaymentMethod method, string? coupon, params (string Sku, int Quantity)[] lines) =>
        new()
        {
            ClientRequestId = Guid.NewGuid().ToString(),
            Lines = await LinesAsync(lines),
            Shipping = new ShippingAddressInput
            {
                FullName = "Khách Kiểm Thử",
                Phone = phone,
                ProvinceCode = provinceCode,
                WardCode = await WardAsync(provinceCode),
                AddressLine = "12 Lê Lợi"
            },
            PaymentMethod = method,
            CouponCode = coupon
        };

    public async Task<PlaceOrderResult> PlaceAsync(
        string phone, string provinceCode, PaymentMethod method, string? coupon, params (string Sku, int Quantity)[] lines)
    {
        var request = await RequestAsync(phone, provinceCode, method, coupon, lines);
        return await PlaceAsync(request);
    }

    public async Task<PlaceOrderResult> PlaceAsync(PlaceOrderRequest request)
    {
        await host.SignInAsync(null);
        return (await host.CallAsync<ICheckoutService, WriteOutcome<PlaceOrderResult>>(s => s.PlaceOrderAsync(request))).Value;
    }

    public Task<Guid> OrderIdAsync(string code) =>
        host.QueryAsync<Domain.Entities.Sales.Orders.Order, Guid>(q => q.Where(o => o.Code == code).Select(o => o.Id).SingleAsync());

    public async Task<OrderDetailDto> AsStaffAsync(string username, Func<IOrderService, Task<OrderDetailDto>> call)
    {
        await host.SignInAsync(username);
        return await host.CallAsync(call);
    }
}
