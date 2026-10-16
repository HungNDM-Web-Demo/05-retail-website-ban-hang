using Application.Common.Exceptions;
using Application.DTOs.Demo;
using Application.DTOs.Storefront;
using Application.Interfaces.Services.Storefront;
using Application.Mappings.Sales;
using Domain.Entities.Crm.Customers;
using Domain.Entities.Sales;
using Domain.Entities.Sales.Orders;
using Domain.Enums.Sales.Catalog;
using Domain.Enums.Sales.Orders;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Sales;

// Giỏ, tính tiền, đặt hàng công khai (07 §2.2, §3.1–3.4, §3.7), giả lập khách đặt đơn (§2.9).
public sealed partial class SalesOperations
{
    /// <summary>Biến thể dùng trong test (06 §5.6), giả lập đặt đơn không lấy để số test không đổi.</summary>
    private static readonly string[] TestProductCodes = ["AT001", "QJ003", "TX001", "VD002"];

    private sealed record EvaluatedCart(List<CartCheckLine> Lines, List<PricingLine> PricingLines, bool CanCheckout)
    {
        public decimal Subtotal => PricingLines.Sum(l => l.LineTotal);
    }

    /// <summary>Kiểm lại từng dòng giỏ theo thứ tự 07 §3.4.</summary>
    private async Task<EvaluatedCart> EvaluateCartAsync(IReadOnlyList<CartLineInput> input, CancellationToken ct)
    {
        if (input.Count == 0)
            throw SalesErrors.EmptyCart();
        if (input.Count > SalesRules.MaxCartLines)
            throw SalesErrors.TooManyLines();

        var info = await LoadVariantsAsync(input.Select(l => l.VariantId), ct);
        var lines = new List<CartCheckLine>(input.Count);
        var pricingLines = new List<PricingLine>(input.Count);
        foreach (var line in input)
        {
            info.TryGetValue(line.VariantId, out var v);
            var price = v?.Product.Price ?? line.Price ?? 0m;
            var stock = v?.Variant.Stock ?? 0;
            CartLineIssue? issue = null;
            string? issueText = null;
            decimal? oldPrice = null;
            if (v is null || !v.Variant.IsActive || v.Product.IsDeleted)
            {
                issue = CartLineIssue.BienTheDaTat;
                issueText = "Mẫu này tạm ngừng bán";
            }
            else if (v.IsDiscontinued)
            {
                issue = CartLineIssue.NgungKinhDoanh;
                issueText = "Sản phẩm ngừng kinh doanh";
            }
            else if (stock <= 0)
            {
                issue = CartLineIssue.HetHang;
                issueText = "Hết hàng";
            }
            else if (line.Quantity > stock)
            {
                issue = CartLineIssue.KhongDuTon;
                issueText = $"Chỉ còn {stock} sản phẩm";
            }
            else if (line.Price is { } sent && sent != price)
            {
                issue = CartLineIssue.GiaDaDoi;
                issueText = $"Giá đã đổi từ {SalesText.Money(sent)} thành {SalesText.Money(price)}";
                oldPrice = sent;
            }

            lines.Add(new CartCheckLine
            {
                VariantId = line.VariantId,
                ProductId = v?.Product.Id,
                ProductName = v?.Product.Name ?? string.Empty,
                Slug = v?.Product.Slug,
                Sku = v?.Variant.Sku ?? string.Empty,
                ColorCode = v?.Color.Code ?? string.Empty,
                ColorName = v?.Color.Name ?? string.Empty,
                Size = v?.Variant.Size,
                ImageUrl = v?.ImageUrl,
                Price = price,
                OldPrice = oldPrice,
                Stock = stock,
                Quantity = line.Quantity,
                MaxQuantity = Math.Max(0, Math.Min(SalesRules.MaxLineQuantity, stock)),
                LineTotal = price * line.Quantity,
                Issue = issue,
                IssueText = issueText
            });
            if (v is not null && (issue is null or CartLineIssue.GiaDaDoi))
                pricingLines.Add(new PricingLine(v.Product.CategoryId, price, line.Quantity));
        }

        var canCheckout = lines.Count > 0 && lines.All(l => l.Issue is null or CartLineIssue.GiaDaDoi);
        return new EvaluatedCart(lines, pricingLines, canCheckout);
    }

    public async Task<CartCheckResult> CheckCartAsync(CartCheckRequest request, CancellationToken ct = default)
    {
        var cart = await EvaluateCartAsync(request.Lines, ct);
        return new CartCheckResult
        {
            Lines = cart.Lines,
            Subtotal = cart.Subtotal,
            FreeShipRemaining = Math.Max(0, SalesRules.FreeShipThreshold - cart.Subtotal),
            CanCheckout = cart.CanCheckout
        };
    }

    public async Task<CheckoutQuote> QuoteAsync(CheckoutQuoteRequest request, CancellationToken ct = default)
    {
        var cart = await EvaluateCartAsync(request.Lines, ct);
        var zone = string.IsNullOrWhiteSpace(request.ProvinceCode)
            ? null
            : await provinces.QueryNoTracking().Where(p => p.Code == request.ProvinceCode)
                .Select(p => (Domain.Enums.Sales.Locations.ShippingZone?)p.Zone).FirstOrDefaultAsync(ct);

        CouponCheck? couponCheck = null;
        CouponSpec? spec = null;
        if (!string.IsNullOrWhiteSpace(request.CouponCode))
        {
            var code = CouponRules.Normalize(request.CouponCode);
            var (coupon, categoryName) = await FindCouponAsync(code, ct);
            // Quyết định 5: không kiểm lượt theo số điện thoại ở bước tính tiền (TC-14).
            var check = CouponRules.Check(coupon, cart.PricingLines, Now, categoryName);
            if (check.Ok)
                spec = CouponRules.SpecOf(coupon!);
            var pricingWith = OrderPricing.Calculate(cart.PricingLines, zone, spec);
            couponCheck = new CouponCheck
            {
                Code = code,
                Ok = check.Ok,
                ErrorCode = check.ErrorCode,
                Message = check.Message,
                Description = coupon?.Name,
                Discount = check.Ok ? pricingWith.Discount : 0,
                ShippingDiscount = check.Ok ? pricingWith.ShippingDiscount : 0
            };
        }

        return new CheckoutQuote
        {
            Lines = cart.Lines,
            Summary = OrderPricing.Calculate(cart.PricingLines, zone, spec).ToSummary(),
            Coupon = couponCheck,
            CanCheckout = cart.CanCheckout
        };
    }

    public Task<WriteOutcome<PlaceOrderResult>> PlaceOrderAsync(PlaceOrderRequest request, CancellationToken ct = default) =>
        WithRetryAsync(s => s.PlaceOrderCoreAsync(request, ct));

    /// <summary>Đặt hàng theo 07 §2.2 bước 1–7, lỗi đầu tiên dừng lại.</summary>
    private async Task<WriteOutcome<PlaceOrderResult>> PlaceOrderCoreAsync(PlaceOrderRequest request, CancellationToken ct)
    {
        // 1. Trùng clientRequestId → kết quả cũ (NFR-05).
        var requestId = request.ClientRequestId.Trim();
        if (await FindByRequestIdAsync(requestId, ct) is { } existing)
            return existing;

        // 2. Dữ liệu (validator đã kiểm theo trường); giỏ, phường thuộc tỉnh.
        if (request.Lines.Count == 0)
            throw SalesErrors.EmptyCart();
        if (request.Lines.Count > SalesRules.MaxCartLines)
            throw SalesErrors.TooManyLines();
        var shipping = request.Shipping;
        var phone = SalesCodes.NormalizePhone(shipping.Phone);
        var (province, ward) = await ResolveAddressAsync(shipping.ProvinceCode, shipping.WardCode, "shipping.", ct);

        // Gộp dòng trùng biến thể.
        var lines = request.Lines
            .GroupBy(l => l.VariantId)
            .Select(g => new PlaceOrderLineInput { VariantId = g.Key, Quantity = g.Sum(l => l.Quantity), ExpectedPrice = g.First().ExpectedPrice })
            .ToList();
        var info = await LoadVariantsAsync(lines.Select(l => l.VariantId), ct);

        // 3. Sản phẩm ẩn, biến thể tắt hoặc không có.
        var stopped = lines.Where(l => !info.TryGetValue(l.VariantId, out var v) || !v.IsSellable).ToList();
        if (stopped.Count > 0)
        {
            var name = info.TryGetValue(stopped[0].VariantId, out var first) ? first.Product.Name : "Sản phẩm";
            throw SalesProblems.Conflict(SalesErrors.SanPhamNgungBan, SalesErrors.DiscontinuedMessage(name),
                new Dictionary<string, object?> { ["variantIds"] = stopped.Select(l => l.VariantId).ToList() });
        }

        // 4. Giá đổi (UC-04 E5).
        var priceChanges = lines.Where(l => info[l.VariantId].Product.Price != l.ExpectedPrice)
            .Select(l => new { variantId = l.VariantId, oldPrice = l.ExpectedPrice, newPrice = info[l.VariantId].Product.Price })
            .ToList();
        if (priceChanges.Count > 0)
            throw SalesProblems.Conflict(SalesErrors.GiaDaThayDoi, SalesErrors.PriceChangedMessage,
                new Dictionary<string, object?> { ["priceChanges"] = priceChanges });

        var pricingLines = lines.Select(l => new PricingLine(info[l.VariantId].Product.CategoryId, info[l.VariantId].Product.Price, l.Quantity)).ToList();

        // 5. Mã giảm giá bước 1–9.
        Domain.Entities.Sales.Coupons.Coupon? coupon = null;
        if (!string.IsNullOrWhiteSpace(request.CouponCode))
        {
            var (found, categoryName) = await FindCouponAsync(request.CouponCode, ct);
            var check = CouponRules.Check(found, pricingLines, Now, categoryName);
            if (!check.Ok)
                throw SalesErrors.Business(check.ErrorCode!, check.Message!);
            if (await CountPhoneUsageAsync(phone, found!.Id, null, ct) >= found.PerCustomerLimit)
                throw SalesErrors.Business(SalesErrors.SdtDaDungMa, CouponRules.PhoneUsedMessage(found.Code));
            coupon = found;
        }

        var pricing = OrderPricing.Calculate(pricingLines, province.Zone, coupon is null ? null : CouponRules.SpecOf(coupon));
        Order? order = null;
        await unitOfWork.ExecuteInTransactionAsync(async c =>
        {
            // 6. Trừ tồn từng dòng có điều kiện; một dòng không đủ thì rollback cả đơn (TC-17).
            foreach (var line in lines)
            {
                if (!await TryTakeStockAsync(line.VariantId, line.Quantity, c))
                    throw await NotEnoughStockAsync(lines.Select(l => (l.VariantId, l.Quantity, 0)).ToList(), info, c);
            }

            if (coupon is not null && !await TryUseCouponAsync(coupon.Id, c))
                throw SalesErrors.Business(SalesErrors.MaHetLuot, CouponRules.ExhaustedMessage);

            // 7. Khách theo số điện thoại (FR-34), tạo đơn, sự kiện.
            var now = Now;
            var customer = await customers.Query().FirstOrDefaultAsync(x => x.Phone == phone, c);
            if (customer is null)
            {
                customer = Customer.Create(phone, shipping.FullName, shipping.Email, province.Code, ward.Code, shipping.AddressLine, now);
                await customers.AddAsync(customer, c);
            }
            else
            {
                customer.UpdateFromOrder(shipping.FullName, shipping.Email, province.Code, ward.Code, shipping.AddressLine);
            }

            var orderLines = lines.Select((l, i) =>
            {
                var v = info[l.VariantId];
                return OrderLine.Create(v.Variant.Id, v.Product.Id, v.Product.Name, v.Variant.Sku, v.Color.Name, v.Variant.Size,
                    v.ImageUrl, v.Product.Price, l.Quantity, i);
            }).ToList();
            var recipient = new OrderRecipient(shipping.FullName, phone, shipping.Email, province.Code, province.Name, ward.Code,
                ward.Name, shipping.AddressLine);
            order = Order.Place(await NextOrderCodeAsync(now, c), customer.Id, now, request.PaymentMethod!.Value, recipient,
                shipping.Note, orderLines, pricing, coupon?.Id, requestId, request.DeviceId);
            await orders.AddAsync(order, c);
            await unitOfWork.SaveChangesAsync(c);
            await RecalculateCustomerAsync(customer.Id, c);
        }, ct);

        return new WriteOutcome<PlaceOrderResult>(
            new PlaceOrderResult { Order = await BuildPlacedSummaryAsync(order!, ct), Duplicate = false }, true);
    }

    private async Task<WriteOutcome<PlaceOrderResult>?> FindByRequestIdAsync(string requestId, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(requestId))
            return null;
        var existing = await orders.QueryNoTracking().Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.ClientRequestId == requestId, ct);
        return existing is null
            ? null
            : new WriteOutcome<PlaceOrderResult>(new PlaceOrderResult { Order = await BuildPlacedSummaryAsync(existing, ct), Duplicate = true }, false);
    }

    /// <summary>
    /// 409 <c>KhongDuTon</c> (TC-17, TC-30): đọc tồn hiện tại của các dòng, dòng thiếu kèm <c>errors["lines[i]"]</c>;
    /// <c>detail</c> là câu của dòng thiếu đầu tiên. <c>Held</c> là số lượng đơn đang giữ (sửa đơn) được cộng vào tồn khả dụng.
    /// </summary>
    private async Task<ConflictException> NotEnoughStockAsync(
        List<(Guid VariantId, int Quantity, int Held)> lines, IReadOnlyDictionary<Guid, VariantInfo> info, CancellationToken ct)
    {
        var ids = lines.Select(l => l.VariantId).ToList();
        var stocks = await variants.QueryNoTracking().Where(v => ids.Contains(v.Id)).ToDictionaryAsync(v => v.Id, v => v.Stock, ct);
        var issues = new List<object>();
        var errors = new Dictionary<string, string[]>();
        string? detail = null;
        for (var i = 0; i < lines.Count; i++)
        {
            var (variantId, quantity, held) = lines[i];
            var available = stocks.GetValueOrDefault(variantId) + held;
            if (quantity <= available)
                continue;
            issues.Add(new { variantId, stock = available });
            errors[$"lines[{i}]"] = [$"Chỉ còn {available} sản phẩm"];
            if (detail is null && info.TryGetValue(variantId, out var v))
                detail = SalesErrors.NotEnoughStockMessage(v.Product.Name, v.Color.Name, v.Variant.Size, available);
        }

        return SalesProblems.Conflict(SalesErrors.KhongDuTon, detail ?? "Sản phẩm không đủ tồn kho",
            new Dictionary<string, object?> { ["stockIssues"] = issues, ["errors"] = errors });
    }

    public async Task<SimulateOrderResult> SimulateOrderAsync(CancellationToken ct = default)
    {
        var random = Random.Shared;
        var candidates = await variants.QueryNoTracking()
            .Where(v => v.IsActive && v.Stock >= 3)
            .Join(products.QueryNoTracking().Where(p => !p.IsHidden && !TestProductCodes.Contains(p.Code)),
                v => v.ProductId, p => p.Id, (v, p) => new { v.Id, p.Price })
            .ToListAsync(ct);
        if (candidates.Count == 0)
            throw new NotFoundException("Không còn sản phẩm đủ tồn để giả lập đơn.");
        var picked = candidates.OrderBy(_ => random.Next()).Take(random.Next(1, 4)).ToList();

        string name, phone, provinceCode, wardCode, address;
        string? email = null;
        var existingCount = await customers.QueryNoTracking().CountAsync(ct);
        if (existingCount > 0 && random.NextDouble() < 0.6)
        {
            var customer = await customers.QueryNoTracking().OrderBy(c => c.Phone).Skip(random.Next(existingCount)).FirstAsync(ct);
            (name, phone, provinceCode, wardCode, address, email) =
                (customer.Name, customer.Phone, customer.ProvinceCode, customer.WardCode, customer.AddressLine, customer.Email);
        }
        else
        {
            string[] ho = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Võ", "Đặng"];
            string[] ten = ["Thị Mai Anh", "Ngọc Hân", "Minh Khoa", "Thu Trang", "Quốc Bảo", "Thanh Hương", "Gia Huy"];
            string[] prefixes = ["032", "035", "038", "070", "077", "086", "093", "097"];
            name = $"{ho[random.Next(ho.Length)]} {ten[random.Next(ten.Length)]}";
            do
            {
                phone = prefixes[random.Next(prefixes.Length)] + random.Next(0, 10_000_000).ToString("0000000");
            }
            while (phone.StartsWith("0901000", StringComparison.Ordinal) || await customers.QueryNoTracking().AnyAsync(c => c.Phone == phone, ct));

            var ward = await wards.QueryNoTracking().Join(provinces.QueryNoTracking(), w => w.ProvinceId, p => p.Id,
                (w, p) => new { WardCode = w.Code, ProvinceCode = p.Code }).OrderBy(x => x.WardCode).ToListAsync(ct);
            var chosen = ward[random.Next(ward.Count)];
            (provinceCode, wardCode) = (chosen.ProvinceCode, chosen.WardCode);
            address = $"{random.Next(1, 300)} Lê Lợi";
        }

        var request = new PlaceOrderRequest
        {
            ClientRequestId = Guid.NewGuid().ToString(),
            Lines = picked.Select(p => new PlaceOrderLineInput { VariantId = p.Id, Quantity = 1, ExpectedPrice = p.Price }).ToList(),
            Shipping = new ShippingAddressInput
            {
                FullName = name,
                Phone = phone,
                Email = email,
                ProvinceCode = provinceCode,
                WardCode = wardCode,
                AddressLine = address
            },
            PaymentMethod = random.NextDouble() < 0.7 ? PaymentMethod.Cod : PaymentMethod.ChuyenKhoan
        };
        var result = await PlaceOrderAsync(request, ct);
        return new SimulateOrderResult { Code = result.Value.Order.Code, Total = result.Value.Order.Summary.Total };
    }
}
