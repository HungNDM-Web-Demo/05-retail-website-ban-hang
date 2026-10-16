using System.Reflection;
using Application.Common.Exceptions;
using Application.Constants;
using Application.DTOs.Catalog;
using Application.DTOs.Coupons;
using Application.DTOs.Orders;
using Application.DTOs.Storefront;
using Application.Interfaces.Services.Catalog;
using Application.Interfaces.Services.Roles;
using Application.Interfaces.Services.Sales;
using Application.Interfaces.Services.Storefront;
using Application.Validators.Sales;
using Domain.Common;
using Domain.Entities.Sales.Catalog;
using Domain.Enums.Crm.Customers;
using Domain.Enums.Sales.Catalog;
using Domain.Enums.Sales.Coupons;
using Domain.Enums.Sales.Orders;
using FluentValidation;
using Infrastructure.Persistence.Seeders;
using Microsoft.EntityFrameworkCore;
using UnitTests.TestSupport;

namespace UnitTests.Sales;

/// <summary>Cửa hàng (TC-01…TC-03), sản phẩm (TC-21…TC-24), mã giảm giá (TC-41), khách (TC-42), quyền (07 §1), validator.</summary>
public sealed class CatalogAndAdminTests : IAsyncLifetime
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
    public async Task Tc01_Tc02_Tc03_Storefront()
    {
        var list = await _host.CallAsync<IStorefrontService, PublicProductListResult>(s => s.GetProductsAsync(new PublicProductQuery
        {
            Category = "ao-thun", Colors = "TR", Sizes = "M", InStock = true
        }));
        Assert.Contains(list.Items, p => p.Code == "AT001");
        Assert.Equal("Áo thun", list.Category!.Name);
        await Assert.ThrowsAsync<CodedNotFoundException>(() =>
            _host.CallAsync<IStorefrontService, PublicProductListResult>(s => s.GetProductsAsync(new PublicProductQuery { Category = "khong-co" })));

        var suggest = await _host.CallAsync<IStorefrontService, IReadOnlyList<PublicSuggestion>>(s => s.SuggestAsync("ao thun"));
        Assert.Contains(suggest, x => x.Name == "Áo thun cotton basic");
        var bySku = await _host.CallAsync<IStorefrontService, PublicProductListResult>(s => s.GetProductsAsync(new PublicProductQuery { Search = "AT001-DE-L" }));
        Assert.Equal("AT001", Assert.Single(bySku.Items).Code);
        var none = await _host.CallAsync<IStorefrontService, PublicProductListResult>(s => s.GetProductsAsync(new PublicProductQuery { Search = "xyzabc" }));
        Assert.Empty(none.Items);

        var detail = (await _host.CallAsync<IStorefrontService, PublicProductLookup>(s => s.GetProductAsync("ao-thun-cotton-basic"))).Product!;
        Assert.Equal((159_000m, 199_000m, 20), (detail.Price, detail.ListPrice!.Value, detail.DiscountPercent!.Value));
        Assert.Equal(StockStatus.SapHet, detail.Variants.Single(v => v.Sku == "AT001-DE-L").StockStatus);
        Assert.Equal(StockStatus.HetHang, detail.Variants.Single(v => v.Sku == "AT001-BE-XL").StockStatus);
        Assert.Equal(["S", "M", "L", "XL"], detail.Sizes);
        Assert.NotNull(detail.SizeChart);

        var hidden = await _host.CallAsync<IStorefrontService, PublicProductLookup>(s => s.GetProductAsync("ao-blazer-dang-suong"));
        Assert.Null(hidden.Product);
        Assert.Equal("Áo blazer dáng suông", hidden.Discontinued!.Name);
        await Assert.ThrowsAsync<CodedNotFoundException>(() =>
            _host.CallAsync<IStorefrontService, PublicProductLookup>(s => s.GetProductAsync("khong-ton-tai")));

        var home = await _host.CallAsync<IStorefrontService, PublicHome>(s => s.GetHomeAsync());
        Assert.Equal(8, home.Featured.Count);
        Assert.Equal(8, home.Categories.Count);
    }

    [Fact]
    public async Task Tc21_Tc22_Tc23_Tc24_Products()
    {
        await _host.SignInAsync("quanly");
        var colors = await _host.CallAsync<IColorService, IReadOnlyList<ColorDto>>(s => s.GetAllAsync());
        var categories = await _host.CallAsync<ICategoryService, IReadOnlyList<CategoryDto>>(s => s.GetAllAsync());
        var tr = colors.Single(c => c.Code == "TR").Id;
        var xr = colors.Single(c => c.Code == "XR").Id;
        var sizes = new List<string> { "S", "M", "L", "XL" };
        var request = new SaveProductRequest
        {
            Code = "SM010",
            Name = "Áo sơ mi linen",
            CategoryId = categories.Single(c => c.Code == "SM").Id,
            Price = 299_000,
            ListPrice = 350_000,
            ColorIds = [tr, xr],
            Sizes = sizes,
            Variants = new[] { tr, xr }.SelectMany(c => sizes.Select(s => new SaveProductVariantInput { ColorId = c, Size = s, IsActive = true, InitialStock = 10 })).ToList()
        };
        var created = await _host.CallAsync<IProductService, ProductDto>(s => s.CreateAsync(request));
        Assert.Equal("ao-so-mi-linen", created.Slug);
        Assert.Equal(8, created.Variants.Count);
        Assert.Equal("SM010-TR-S", created.Variants[0].Sku);
        Assert.Equal("SM010-XR-XL", created.Variants[^1].Sku);
        var card = (await _host.CallAsync<IStorefrontService, PublicProductLookup>(s => s.GetProductAsync("ao-so-mi-linen"))).Product!;
        Assert.Equal(15, card.DiscountPercent);

        // TC-22: mã trùng → 409 errors.code; giá sai → validator.
        request.Code = "AT001";
        var dup = await Assert.ThrowsAsync<ConflictException>(() => _host.CallAsync<IProductService, ProductDto>(s => s.CreateAsync(request)));
        Assert.Equal(("code", "Mã sản phẩm đã tồn tại"), (dup.Field, dup.Message));
        var validator = new SaveProductRequestValidator();
        request.Code = "SM011";
        request.Price = 299_500;
        request.ListPrice = 250_000;
        var errors = validator.Validate(request).Errors.Select(e => (e.PropertyName, e.ErrorMessage)).ToList();
        Assert.Contains(("Price", "Giá bán là bội số của 1.000 ₫"), errors);
        Assert.Contains(("ListPrice", "Giá gốc phải lớn hơn giá bán"), errors);

        // TC-23: xóa sản phẩm đã bán bị từ chối, ẩn thì cửa hàng báo ngừng kinh doanh.
        var vd002 = await _host.QueryAsync<Product, Guid>(q => q.Where(p => p.Code == "VD002").Select(p => p.Id).SingleAsync());
        var del = await Assert.ThrowsAsync<DomainException>(() => _host.CallAsync<IProductService>(s => s.DeleteAsync(vd002)));
        Assert.Equal(("SanPhamDaCoTrongDon", "Sản phẩm đã có trong đơn hàng, không xóa được. Hãy dùng Ẩn"), (del.Extensions["code"], del.Message));
        await _host.CallAsync<IProductService>(s => s.SetHiddenAsync(vd002, true));
        Assert.NotNull((await _host.CallAsync<IStorefrontService, PublicProductLookup>(s => s.GetProductAsync("dam-midi-hoa-nhi"))).Discontinued);

        // TC-24: điều chỉnh tồn Be/XL 0 → 15.
        var at001 = await _host.QueryAsync<Product, Guid>(q => q.Where(p => p.Code == "AT001").Select(p => p.Id).SingleAsync());
        var bexl = await _s.VariantIdAsync("AT001-BE-XL");
        var adjusted = await _host.CallAsync<IProductService, ProductVariantDto>(s =>
            s.AdjustStockAsync(at001, bexl, new StockAdjustmentRequest { NewStock = 15, Reason = StockAdjustReason.NhapHang }));
        Assert.Equal((15, StockStatus.ConHang), (adjusted.Stock, adjusted.StockStatus));
        var history = await _host.CallAsync<IProductService, IReadOnlyList<StockAdjustmentDto>>(s => s.GetStockAdjustmentsAsync(at001));
        Assert.Equal((0, 15, "Trần Thị Mai"), (history[0].Before, history[0].After, history[0].ByName));
        Assert.Contains(new StockAdjustmentRequestValidator().Validate(new StockAdjustmentRequest { NewStock = -1, Reason = StockAdjustReason.NhapHang }).Errors,
            e => e.ErrorMessage == "Tồn mới là số nguyên từ 0");

        // Bỏ màu đã bán → 400 BienTheDaCoTrongDon.
        var product = await _host.CallAsync<IProductService, ProductDto>(s => s.GetByIdAsync(at001));
        var keep = product.ColorIds.Take(2).ToList();
        var update = new SaveProductRequest
        {
            Code = product.Code, Name = product.Name, Slug = product.Slug, CategoryId = product.CategoryId, Price = product.Price,
            ListPrice = product.ListPrice, ColorIds = keep, Sizes = product.Sizes.ToList(),
            Variants = product.Variants.Where(v => keep.Contains(v.ColorId)).Select(v => new SaveProductVariantInput { ColorId = v.ColorId, Size = v.Size, IsActive = true }).ToList()
        };
        var removeSold = await Assert.ThrowsAsync<DomainException>(() => _host.CallAsync<IProductService, ProductDto>(s => s.UpdateAsync(at001, update)));
        Assert.Equal("BienTheDaCoTrongDon", removeSold.Extensions["code"]);
    }

    [Fact]
    public async Task Tc41_Coupons()
    {
        await _host.SignInAsync("quanly");
        var tomorrow = _host.Time.GetUtcNow().UtcDateTime.AddDays(1);
        var created = await _host.CallAsync<ICouponService, CouponDto>(s => s.CreateAsync(new SaveCouponRequest
        {
            Code = "sale1111", Name = "Sale 11/11", Type = CouponType.PhanTram, Value = 15, MaxDiscount = 100_000, MinOrder = 399_000,
            PerCustomerLimit = 1, StartAt = tomorrow, EndAt = tomorrow.AddDays(3)
        }));
        Assert.Equal(("SALE1111", CouponStatus.SapChay), (created.Code, created.Status));
        var quote = await _host.CallAsync<ICheckoutService, CheckoutQuote>(async s => await s.QuoteAsync(new CheckoutQuoteRequest
        {
            Lines = await _s.CartAsync(("QJ003-XN-28", 2)), CouponCode = "sale1111"
        }));
        Assert.Equal(("MaChuaApDung", "Mã chưa đến thời gian áp dụng"), (quote.Coupon!.ErrorCode, quote.Coupon.Message));

        var dup = await Assert.ThrowsAsync<ConflictException>(() => _host.CallAsync<ICouponService, CouponDto>(s => s.CreateAsync(new SaveCouponRequest
        {
            Code = "GIAM10", Name = "Trùng", Type = CouponType.SoTien, Value = 10_000, PerCustomerLimit = 1, StartAt = tomorrow, EndAt = tomorrow.AddDays(1)
        })));
        Assert.Equal("Mã giảm giá đã tồn tại", dup.Message);
        var noMax = new SaveCouponRequestValidator().Validate(new SaveCouponRequest
        {
            Code = "SALE2", Name = "Thiếu tối đa", Type = CouponType.PhanTram, Value = 10, PerCustomerLimit = 1, StartAt = tomorrow, EndAt = tomorrow.AddDays(1)
        });
        Assert.Contains(noMax.Errors, e => e.ErrorMessage == "Nhập mức giảm tối đa cho mã phần trăm");

        var list = await _host.CallAsync<ICouponService, Application.Common.Models.PaginatedResult<CouponDto>>(s => s.GetPagedAsync(new CouponQuery()));
        var giam10 = list.Items.Single(c => c.Code == "GIAM10");
        Assert.Equal((51, CouponStatus.DangChay, false), (giam10.UsedCount, giam10.Status, giam10.CanDelete));
        var delete = await Assert.ThrowsAsync<DomainException>(() => _host.CallAsync<ICouponService>(s => s.DeleteAsync(giam10.Id)));
        Assert.Equal("MaDaCoLuotDung", delete.Extensions["code"]);
        Assert.Equal(CouponStatus.HetHan, list.Items.Single(c => c.Code == "HETHAN").Status);
    }

    [Fact]
    public async Task Tc42_CustomersWithAttentionTag()
    {
        await _host.SignInAsync("quanly");
        var list = await _host.CallAsync<ICustomerService, Application.Common.Models.PaginatedResult<Application.DTOs.Customers.CustomerListItem>>(
            s => s.GetPagedAsync(new Application.DTOs.Customers.CustomerQuery { Tag = CustomerTag.CanLuuY, PageSize = 50 }));
        Assert.Equal(10, list.TotalCount);
        Assert.Contains(list.Items, c => c.Name == "Lê Thị Hoa" && c.ProvinceName == "Đồng Nai");
    }

    /// <summary>Khóa sắp xếp FE gửi (ProductsTab: totalStock; CustomersPage: deliveredCount, returnCount) phải được BE áp dụng.</summary>
    [Fact]
    public async Task AdminListSortKeys_UsedByFe()
    {
        await _host.SignInAsync("quanly");
        var products = await _host.CallAsync<IProductService, Application.Common.Models.PaginatedResult<ProductListItem>>(
            s => s.GetPagedAsync(new ProductQuery { SortBy = "totalStock", SortDir = "asc", PageSize = 100 }));
        var stocks = products.Items.Select(p => p.TotalStock).ToList();
        Assert.Equal(stocks.OrderBy(x => x).ToList(), stocks);

        foreach (var key in new[] { "deliveredCount", "returnCount" })
        {
            var customers = await _host.CallAsync<ICustomerService, Application.Common.Models.PaginatedResult<Application.DTOs.Customers.CustomerListItem>>(
                s => s.GetPagedAsync(new Application.DTOs.Customers.CustomerQuery { SortBy = key, SortDir = "desc", PageSize = 100 }));
            var values = customers.Items.Select(c => key == "deliveredCount" ? c.DeliveredCount : c.ReturnCount).ToList();
            Assert.Equal(values.OrderByDescending(x => x).ToList(), values);
            Assert.True(values.Distinct().Count() > 1);
        }
    }

    [Theory]
    [InlineData("nhanvien", ProjectPermissions.Orders.Confirm, true)]
    [InlineData("nhanvien", ProjectPermissions.Orders.Ship, true)]
    [InlineData("nhanvien", ProjectPermissions.Orders.Refund, false)]
    [InlineData("nhanvien", ProjectPermissions.Reports.View, false)]
    [InlineData("nhanvien", ProjectPermissions.Products.Update, false)]
    [InlineData("nhanvien", ProjectPermissions.Products.View, true)]
    [InlineData("nhanvien2", ProjectPermissions.Orders.Cancel, true)]
    [InlineData("quanly", ProjectPermissions.Orders.Refund, true)]
    [InlineData("quanly", ProjectPermissions.Reports.View, true)]
    [InlineData("quanly", ProjectPermissions.Products.AdjustStock, true)]
    [InlineData("admin", ProjectPermissions.Coupons.Delete, true)]
    public async Task RolePermissions(string username, string permission, bool expected)
    {
        var userId = await _host.SignInAsync(username);
        var granted = await _host.CallAsync<IPermissionService, bool>(s => s.HasPermissionAsync(userId!.Value, permission));
        Assert.Equal(expected, granted);
    }

    [Fact]
    public void ProjectPermissions_DeclaredInSeedAndFe()
    {
        var codes = typeof(ProjectPermissions).GetNestedTypes(BindingFlags.Public | BindingFlags.Static)
            .SelectMany(t => t.GetFields(BindingFlags.Public | BindingFlags.Static))
            .Where(f => f is { IsLiteral: true } && f.FieldType == typeof(string))
            .Select(f => (string)f.GetRawConstantValue()!).ToList();
        Assert.Equal(19, codes.Count);
        var seeded = SystemSeedData.Embedded.Permissions.Select(p => p.Code).ToHashSet();
        Assert.All(codes, c => Assert.Contains(c, seeded));

        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "FE", "src", "config", "permissions.ts")))
            dir = dir.Parent;
        Assert.NotNull(dir);
        var fe = File.ReadAllText(Path.Combine(dir!.FullName, "FE", "src", "config", "permissions.ts"));
        Assert.All(codes, c => Assert.Contains($"'{c}'", fe));
    }

    [Fact]
    public void Validators_FieldMessages()
    {
        var place = new PlaceOrderRequestValidator().Validate(new PlaceOrderRequest
        {
            ClientRequestId = "x",
            Shipping = new ShippingAddressInput { FullName = "Khách", Phone = "0212345678", ProvinceCode = "79", WardCode = "", AddressLine = "12 Lê Lợi" },
            PaymentMethod = PaymentMethod.Cod
        });
        Assert.Contains(place.Errors, e => e.PropertyName == "shipping.phone" && e.ErrorMessage == "Số điện thoại không hợp lệ");
        Assert.Contains(place.Errors, e => e.PropertyName == "shipping.wardCode" && e.ErrorMessage == "Vui lòng chọn phường/xã");

        Assert.Contains(new ConfirmPaymentRequestValidator().Validate(new ConfirmPaymentRequest()).Errors,
            e => e.ErrorMessage == "Nhập mã giao dịch ngân hàng");
        Assert.Contains(new ShipOrderRequestValidator().Validate(new ShipOrderRequest { Carrier = Carrier.Ghn, WeightGrams = 0 }).Errors,
            e => e.ErrorMessage == "Khối lượng từ 50 đến 30.000 g");
        Assert.Contains(new CancelOrderRequestValidator().Validate(new CancelOrderRequest()).Errors, e => e.ErrorMessage == "Chọn lý do");
        Assert.Contains(new DeliveryFailedRequestValidator().Validate(new DeliveryFailedRequest { Reason = DeliveryFailReason.Khac }).Errors,
            e => e.ErrorMessage == "Nhập ghi chú cho lý do Khác");
    }
}
