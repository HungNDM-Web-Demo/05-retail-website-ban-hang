using System.Globalization;
using System.Text.Json;
using Application.Common.Time;
using Application.Interfaces.Services.Orders;
using Domain.Entities.Crm.Customers;
using Domain.Entities.Sales;
using Domain.Entities.Sales.Catalog;
using Domain.Entities.Sales.Coupons;
using Domain.Entities.Sales.Locations;
using Domain.Entities.Sales.Orders;
using Domain.Entities.System.Users;
using Domain.Enums.Sales.Catalog;
using Domain.Enums.Sales.Locations;
using Domain.Enums.Sales.Orders;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistence.Seeders;

/// <summary>
/// Dữ liệu mẫu Website Bán hàng từ <c>FE/src/mock/seed/demo-data.json</c> (06 §5). Suy ra trường đúng 06 §5.2–5.4:
/// slug, biến thể, SKU, ảnh; đơn phát lại sự kiện qua đúng các method chuyển trạng thái của <see cref="Order"/> (không trừ tồn
/// vì tồn trong file là tồn lúc nạp); sau khi nạp tính thống kê khách, lượt mã, số đã bán rồi quét đơn quá hạn thanh toán
/// như lúc vận hành (<see cref="IOrderWorkflow"/>).
/// </summary>
public sealed class DemoDataSeeder(AppDbContext db, TimeProvider timeProvider, IOrderWorkflow orderWorkflow) : IDemoDataSeeder
{
    public const string FileName = "demo-data.json";

    private static readonly JsonSerializerOptions SizeChartJson = new(JsonSerializerDefaults.Web);

    public Task<bool> HasDataAsync(CancellationToken ct = default) =>
        db.Set<Province>().AnyAsync(ct);

    public async Task SeedAsync(CancellationToken ct = default)
    {
        var seed = SeedJson.Read<SalesSeed>(FileName, timeProvider);
        var utcNow = timeProvider.GetUtcNow().UtcDateTime;
        // 06 §5.3: now làm tròn xuống tới phút.
        var now = new DateTime(utcNow.Ticks - utcNow.Ticks % TimeSpan.TicksPerMinute, DateTimeKind.Utc);

        var users = await db.Set<User>().IgnoreQueryFilters().AsNoTracking()
            .Select(u => new { u.Id, u.Username, u.FullName })
            .ToDictionaryAsync(u => u.Username, StringComparer.OrdinalIgnoreCase, ct);
        OrderActor Staff(string username) =>
            users.TryGetValue(username, out var u) ? OrderActor.Staff(u.Id, u.FullName) : OrderActor.Staff(null, username);

        // Màu, danh mục, tỉnh/thành.
        var colors = seed.Colors.ToDictionary(c => c.Code, c => Color.Create(c.Code, c.Name, c.Hex, c.SortOrder));
        db.AddRange(colors.Values);

        var categories = seed.Categories.ToDictionary(c => c.Code, c => Category.Create(
            c.Code, c.Name, c.Slug, c.Image is null ? null : "/seed/categories/" + c.Image, c.Color, true, c.SortOrder));
        db.AddRange(categories.Values);

        var provinces = new Dictionary<string, Province>();
        var wards = new Dictionary<string, Ward>();
        for (var i = 0; i < seed.Provinces.Count; i++)
        {
            var p = seed.Provinces[i];
            var province = Province.Create(p.Code, p.Name, p.Zone ?? ShippingZone.TinhKhac, (i + 1) * 10);
            foreach (var w in p.Wards)
            {
                var ward = Ward.Create(province.Id, w[0], w[1]);
                province.Wards.Add(ward);
                wards[ward.Code] = ward;
            }

            provinces[province.Code] = province;
        }

        db.AddRange(provinces.Values);

        // Sản phẩm, biến thể, ảnh (06 §5.2).
        var variants = new Dictionary<string, (ProductVariant Variant, Product Product, Color Color, Guid CategoryId)>();
        var products = new Dictionary<string, Product>();
        var usedSlugs = new HashSet<string>();
        var todayVn = VietnamDates.Today(timeProvider);
        foreach (var p in seed.Products)
        {
            var category = categories[p.Category];
            var slug = UniqueSlug(SalesCodes.Slugify(p.Name), usedSlugs);
            var sizeChart = p.SizeChart is not null && seed.SizeCharts.TryGetValue(p.SizeChart, out var chart)
                ? JsonSerializer.Serialize(chart, SizeChartJson)
                : null;
            var product = Product.Create(p.Code, p.Name, slug, category.Id, p.Price, p.ListPrice, p.Description, sizeChart,
                p.Featured, p.Hidden, p.SortOrder);
            var off = p.Off ?? [];
            for (var ci = 0; ci < p.Colors.Count; ci++)
            {
                var color = colors[p.Colors[ci]];
                if (p.Sizes.Count == 0)
                {
                    AddVariant(product, color, null, p.Stock.GetValueOrDefault(color.Code), !off.Contains(color.Code), ci * 100);
                    continue;
                }

                for (var si = 0; si < p.Sizes.Count; si++)
                {
                    var key = $"{color.Code}-{p.Sizes[si]}";
                    AddVariant(product, color, p.Sizes[si], p.Stock.GetValueOrDefault(key), !off.Contains(key), ci * 100 + si);
                }
            }

            for (var i = 0; i < p.Images.Count; i++)
            {
                var image = p.Images[i];
                Guid? colorId = image.Count > 1 && colors.TryGetValue(image[1], out var ic) ? ic.Id : null;
                product.Images.Add(ProductImage.Create(product.Id, "/seed/products/" + image[0], colorId, i, i == 0));
            }

            product.RefreshSearch(product.Variants.Select(v => v.Sku));
            product.SetSoldCount(0);
            db.Add(product);
            // Mới nhất có thứ tự ổn định: 00:00 ngày tạo + sortOrder giây.
            db.Entry(product).Property(e => e.CreatedAt).CurrentValue =
                VietnamDates.StartOfDayUtc(todayVn.AddDays(-p.CreatedDaysAgo)).AddSeconds(p.SortOrder);
            products[p.Code] = product;

            void AddVariant(Product owner, Color color, string? size, int stock, bool active, int sortOrder)
            {
                var sku = SalesCodes.Sku(owner.Code, color.Code, size);
                var variant = ProductVariant.Create(owner.Id, color.Id, size, sku, stock, active, sortOrder);
                owner.Variants.Add(variant);
                variants[sku] = (variant, owner, color, category.Id);
            }
        }

        // Mã giảm giá.
        var coupons = new Dictionary<string, Coupon>();
        foreach (var c in seed.Coupons)
        {
            var coupon = Coupon.Create(c.Code, c.Name, c.Type, c.Value, c.MaxDiscount, c.MinOrder,
                c.Scope is null ? null : categories[c.Scope].Id, c.TotalLimit, c.PerCustomer ?? 1,
                SeedDates.Parse(c.Start, timeProvider), SeedDates.Parse(c.End, timeProvider));
            db.Add(coupon);
            db.Entry(coupon).Property(e => e.CreatedAt).CurrentValue = coupon.StartAt;
            coupons[c.Code] = coupon;
        }

        // Điều chỉnh tồn.
        foreach (var a in seed.StockAdjustments.Select(ParseAdjustment))
        {
            var (variant, product, _, _) = variants[a.Sku];
            var by = Staff(a.By);
            db.Add(StockAdjustment.Create(variant.Id, product.Id, a.Before, a.After, a.Reason, a.Note, by.Id, by.Name,
                SeedDates.Parse(a.At, timeProvider)));
        }

        // Khách (thống kê tính sau khi nạp đơn).
        var customers = new Dictionary<string, Customer>();
        foreach (var c in seed.Customers)
        {
            var customer = Customer.Create(c.Phone, c.Name, c.Email, c.Province, c.Ward, c.Address, now);
            customer.SetNote(c.Note);
            customers[c.Phone] = customer;
        }

        // Đơn: thời điểm đặt, sự kiện, mã đơn, mã vận đơn (06 §5.3, §5.4).
        var parsed = seed.Orders.Select((o, index) => ParseOrder(o, index, now)).ToList();
        var orderCodes = new Dictionary<int, string>();
        foreach (var day in parsed.OrderBy(o => o.PlacedAt).ThenBy(o => o.Index).GroupBy(o => VietnamDates.DateOf(o.PlacedAt)))
        {
            var seq = 0;
            foreach (var o in day)
                orderCodes[o.Index] = SalesCodes.OrderCode(day.Key, ++seq);
        }

        var trackingCodes = new Dictionary<int, string>();
        var shipments = parsed
            .SelectMany(o => o.Events.Where(e => e.Kind == "sh").Select(e => new { o.Index, e.At, Carrier = ParseCarrier(e.Text(1)) }))
            .OrderBy(s => s.At).ThenBy(s => orderCodes[s.Index], StringComparer.Ordinal);
        foreach (var group in shipments.GroupBy(s => (s.Carrier, VietnamDates.DateOf(s.At))))
        {
            var seq = 0;
            foreach (var s in group)
                trackingCodes[s.Index] = SalesCodes.TrackingCode(group.Key.Carrier, group.Key.Item2, ++seq);
        }

        var orders = new List<Order>(parsed.Count);
        foreach (var o in parsed)
        {
            var customer = customers[o.Seed.C];
            var province = provinces[customer.ProvinceCode];
            var ward = wards[customer.WardCode];
            var lines = new List<OrderLine>();
            var pricingLines = new List<PricingLine>();
            for (var i = 0; i < o.Seed.It.Count; i++)
            {
                var sku = o.Seed.It[i][0].GetString()!;
                var quantity = o.Seed.It[i][1].GetInt32();
                var (variant, product, color, categoryId) = variants[sku];
                var image = product.Images.FirstOrDefault(im => im.ColorId == color.Id) ?? product.Images.FirstOrDefault(im => im.IsCover);
                lines.Add(OrderLine.Create(variant.Id, product.Id, product.Name, sku, color.Name, variant.Size, image?.Url,
                    product.Price, quantity, i));
                pricingLines.Add(new PricingLine(categoryId, product.Price, quantity));
            }

            Coupon? coupon = o.Seed.Cp is null ? null : coupons[o.Seed.Cp];
            var pricing = OrderPricing.Calculate(pricingLines, province.Zone, coupon is null ? null : CouponRules.SpecOf(coupon));
            var recipient = new OrderRecipient(customer.Name, customer.Phone, customer.Email, province.Code, province.Name,
                ward.Code, ward.Name, customer.AddressLine);
            var order = Order.Place(orderCodes[o.Index], customer.Id, o.PlacedAt,
                o.Seed.Pm == "B" ? PaymentMethod.ChuyenKhoan : PaymentMethod.Cod, recipient, o.Seed.N, lines, pricing, coupon?.Id,
                null, null);

            foreach (var e in o.Events)
            {
                switch (e.Kind)
                {
                    case "cf":
                        order.Confirm(Staff(e.Text(0)), e.At, null);
                        break;
                    case "pd":
                        order.ConfirmPayment(Staff(e.Text(0)), e.At, e.Text(1));
                        break;
                    case "sh":
                        order.Ship(Staff(e.Text(0)), e.At, ParseCarrier(e.Text(1)), trackingCodes[o.Index], e.Int(2), null);
                        order.Shipment!.SetLabelPrintCount(1);
                        break;
                    case "dv":
                        order.Deliver(Staff(e.Text(0)), e.At);
                        break;
                    case "fl":
                        order.DeliveryFailed(Staff(e.Text(0)), e.At, Enum.Parse<DeliveryFailReason>(e.Text(1)), e.OptionalText(2));
                        break;
                    case "rt":
                        order.ReceiveReturn(Staff(e.Text(0)), e.At);
                        break;
                    case "cx":
                        var by = e.Text(0);
                        var actor = by switch { "K" => OrderActor.Customer, "S" => OrderActor.System, _ => Staff(by) };
                        order.Cancel(actor, e.At, Enum.Parse<CancelReason>(e.Text(1)), e.OptionalText(2));
                        break;
                    case "rf":
                        order.Refund(Staff(e.Text(0)), e.At, e.Text(1));
                        break;
                    case "nt":
                        order.AddNote(Staff(e.Text(0)), e.At, e.Text(1));
                        break;
                    default:
                        throw new InvalidOperationException($"Sự kiện '{e.Kind}' không hợp lệ trong {FileName}.");
                }
            }

            db.Add(order);
            db.Entry(order).Property(x => x.CreatedAt).CurrentValue = order.PlacedAt;
            orders.Add(order);
        }

        // Thống kê sau khi nạp: lượt mã (đơn chưa hủy), số đã bán (đơn Đã giao), thống kê khách.
        foreach (var coupon in coupons.Values)
            coupon.SetUsedCount(orders.Count(x => x.CouponId == coupon.Id && x.Status != OrderStatus.DaHuy));

        var sold = orders.Where(x => x.Status == OrderStatus.DaGiao).SelectMany(x => x.Lines)
            .GroupBy(l => l.ProductId).ToDictionary(g => g.Key, g => g.Sum(l => l.Quantity));
        foreach (var product in products.Values)
            product.SetSoldCount(sold.GetValueOrDefault(product.Id));

        var byCustomer = orders.ToLookup(x => x.CustomerId);
        foreach (var customer in customers.Values)
        {
            var list = byCustomer[customer.Id].ToList();
            customer.ApplyStats(
                list.Count,
                list.Count(x => x.Status == OrderStatus.DaGiao),
                list.Count(x => x.Status is OrderStatus.DangHoan or OrderStatus.DaHoan),
                list.Count(x => x.Status == OrderStatus.DaHuy),
                list.Where(x => x.Status == OrderStatus.DaGiao).Sum(x => x.Total),
                list.Count > 0 ? list.Min(x => x.PlacedAt) : null,
                list.Count > 0 ? list.Max(x => x.PlacedAt) : null);
            db.Add(customer);
            db.Entry(customer).Property(x => x.CreatedAt).CurrentValue = customer.FirstOrderAt;
        }

        await db.SaveChangesAsync(ct);
        db.ChangeTracker.Clear();

        // 06 §5.4 bước 5: đơn chuyển khoản đặt quá 24 giờ tự hủy như lúc vận hành (tồn, lượt mã, thống kê khách cập nhật).
        await orderWorkflow.SweepOverdueAsync(ct);
        db.ChangeTracker.Clear();
    }

    public async Task ClearAsync(CancellationToken ct = default)
    {
        // Bảng con trước, bảng cha sau; IgnoreQueryFilters để xóa cả bản ghi đã xóa mềm (06 §3).
        await db.Set<OrderEvent>().ExecuteDeleteAsync(ct);
        await db.Set<Shipment>().ExecuteDeleteAsync(ct);
        await db.Set<OrderLine>().ExecuteDeleteAsync(ct);
        await db.Set<Order>().ExecuteDeleteAsync(ct);
        await db.Set<Customer>().ExecuteDeleteAsync(ct);
        await db.Set<StockAdjustment>().ExecuteDeleteAsync(ct);
        await db.Set<ProductImage>().ExecuteDeleteAsync(ct);
        await db.Set<ProductVariant>().ExecuteDeleteAsync(ct);
        await db.Set<Product>().IgnoreQueryFilters().ExecuteDeleteAsync(ct);
        await db.Set<Coupon>().IgnoreQueryFilters().ExecuteDeleteAsync(ct);
        await db.Set<Category>().IgnoreQueryFilters().ExecuteDeleteAsync(ct);
        await db.Set<Color>().ExecuteDeleteAsync(ct);
        await db.Set<Ward>().ExecuteDeleteAsync(ct);
        await db.Set<Province>().ExecuteDeleteAsync(ct);
    }

    private static string UniqueSlug(string baseSlug, HashSet<string> used)
    {
        var slug = baseSlug;
        for (var n = 2; !used.Add(slug); n++)
            slug = $"{baseSlug}-{n}";
        return slug;
    }

    private static Carrier ParseCarrier(string prefix) => prefix switch
    {
        "GHN" => Carrier.Ghn,
        "GHTK" => Carrier.Ghtk,
        "VTP" => Carrier.Vtp,
        "JT" => Carrier.Jt,
        _ => throw new InvalidOperationException($"Đơn vị vận chuyển '{prefix}' không hợp lệ trong {FileName}.")
    };

    private static SeedStockAdjustment ParseAdjustment(List<JsonElement> row) => new(
        row[0].GetString()!, row[1].GetString()!, row[2].GetInt32(), row[3].GetInt32(),
        Enum.Parse<StockAdjustReason>(row[4].GetString()!), row[5].GetString()!,
        row.Count > 6 && row[6].ValueKind == JsonValueKind.String ? row[6].GetString() : null);

    private ParsedOrder ParseOrder(SeedOrder seed, int index, DateTime now)
    {
        DateTime placedAt;
        if (seed.D is { } d)
        {
            var time = TimeSpan.ParseExact(seed.T.GetString()!, @"hh\:mm", CultureInfo.InvariantCulture);
            placedAt = SeedDates.FromToday(timeProvider, d, time);
        }
        else
        {
            placedAt = now.AddMinutes(seed.T.GetInt32());
        }

        var events = (seed.Ev ?? []).Select(e =>
        {
            var at = e[1].ValueKind == JsonValueKind.String
                ? now.AddMinutes(-int.Parse(e[1].GetString()!.AsSpan(2), CultureInfo.InvariantCulture))
                : placedAt.AddMinutes(e[1].GetInt32());
            return new ParsedEvent(e[0].GetString()!, at, e.Skip(2).ToList());
        }).ToList();
        return new ParsedOrder(index, seed, placedAt, events);
    }

    private sealed record ParsedOrder(int Index, SeedOrder Seed, DateTime PlacedAt, List<ParsedEvent> Events);

    /// <summary>Sự kiện đã tách: loại, thời điểm UTC, các tham số còn lại (người làm, …).</summary>
    private sealed record ParsedEvent(string Kind, DateTime At, List<JsonElement> Args)
    {
        public string Text(int i) => Args[i].ValueKind == JsonValueKind.Number ? Args[i].GetRawText() : Args[i].GetString()!;

        public string? OptionalText(int i) => i < Args.Count && Args[i].ValueKind == JsonValueKind.String ? Args[i].GetString() : null;

        public int Int(int i) => Args[i].GetInt32();
    }
}
