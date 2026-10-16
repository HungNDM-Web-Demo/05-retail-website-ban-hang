using Application.Common.Time;
using Application.DTOs.Reports;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Orders;
using Application.Interfaces.Services.Sales;
using Domain.Entities.Sales;
using Domain.Entities.Sales.Catalog;
using Domain.Entities.Sales.Coupons;
using Domain.Entities.Sales.Orders;
using Domain.Enums.Sales.Orders;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Sales;

/// <summary>
/// Tổng quan, báo cáo (07 §2.8, §3.13, BR-22). Ngày theo giờ Việt Nam. Doanh thu thuần theo ngày giao (<c>DeliveredAt</c>) của đơn
/// Đã giao; giá trị đặt hàng theo ngày đặt, trừ đơn Đã hủy. Dữ liệu demo nhỏ nên đọc các cột cần rồi gộp trong bộ nhớ
/// (cùng một cách tính trên mọi provider).
/// </summary>
public sealed class ReportService(
    IGenericRepository<Order> orders,
    IGenericRepository<Product> products,
    IGenericRepository<ProductVariant> variants,
    IGenericRepository<Color> colors,
    IGenericRepository<Coupon> coupons,
    IOrderWorkflow workflow,
    TimeProvider time) : IReportService
{
    private DateTime Now => time.GetUtcNow().UtcDateTime;

    private sealed record Row(
        Guid Id, DateTime PlacedAt, OrderStatus Status, PaymentStatus PaymentStatus, PaymentMethod PaymentMethod, decimal Subtotal,
        decimal Discount, decimal ShippingDiscount, decimal Total, string ProvinceCode, string ProvinceName, Guid? CouponId,
        string? CouponCode, CancelReason? CancelReason, DateTime? HandedOverAt, DateTime? DeliveredAt, DeliveryFailReason? FailReason)
    {
        public decimal Net => Subtotal - Discount;
        public bool IsReturn => Status is OrderStatus.DangHoan or OrderStatus.DaHoan;
    }

    /// <summary>Đơn đặt trong [from, to) hoặc giao xong trong [from, to).</summary>
    private Task<List<Row>> RowsAsync(DateTime from, DateTime to, CancellationToken ct) =>
        orders.QueryNoTracking()
            .Where(o => (o.PlacedAt >= from && o.PlacedAt < to)
                || (o.Status == OrderStatus.DaGiao && o.Shipment != null && o.Shipment.DeliveredAt >= from && o.Shipment.DeliveredAt < to))
            .Select(o => new Row(o.Id, o.PlacedAt, o.Status, o.PaymentStatus, o.PaymentMethod, o.Subtotal, o.Discount, o.ShippingDiscount,
                o.Total, o.ProvinceCode, o.ProvinceName, o.CouponId, o.CouponCode, o.CancelReason,
                o.Shipment != null ? (DateTime?)o.Shipment.HandedOverAt : null,
                o.Shipment != null ? o.Shipment.DeliveredAt : null,
                o.Shipment != null ? o.Shipment.FailReason : null))
            .ToListAsync(ct);

    private static bool In(DateTime? at, DateTime from, DateTime to) => at is { } t && t >= from && t < to;

    private static bool DeliveredIn(Row r, DateTime from, DateTime to) => r.Status == OrderStatus.DaGiao && In(r.DeliveredAt, from, to);

    private static double Rate(int part, int total) => total == 0 ? 0 : Math.Round(part * 100.0 / total, 1, MidpointRounding.AwayFromZero);

    private static double ReturnRate(IReadOnlyCollection<Row> placed)
    {
        var returns = placed.Count(r => r.IsReturn);
        return Rate(returns, placed.Count(r => r.Status == OrderStatus.DaGiao) + returns);
    }

    /// <summary>Khoảng ngày bắt buộc; vắng thì mặc định 30 ngày tới hôm nay.</summary>
    private (DateOnly From, DateOnly To) ParseRange(DateRangeQuery query)
    {
        OrderListing.ParseRange(query.From, query.To, "from", "to");
        var today = VietnamDates.Today(time);
        var to = VietnamDates.TryParse(query.To, out var t) ? t : today;
        var from = VietnamDates.TryParse(query.From, out var f) ? f : to.AddDays(-29);
        if (from > to)
            throw OrderListing.Invalid("to", "Ngày kết thúc phải sau ngày bắt đầu");
        return (from, to);
    }

    public async Task<DashboardTodo> GetTodoAsync(CancellationToken ct = default)
    {
        await workflow.EnsureSweptAsync(ct);
        var now = Now;
        var slowBefore = now.AddDays(-SalesRules.SlowDeliveryDays);
        var counts = await orders.QueryNoTracking().GroupBy(o => o.Status).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);
        int Count(OrderStatus s) => counts.FirstOrDefault(c => c.Key == s)?.Count ?? 0;
        return new DashboardTodo
        {
            ChoXacNhan = Count(OrderStatus.ChoXacNhan),
            ChoThanhToan = Count(OrderStatus.ChoThanhToan),
            ChoBanGiao = Count(OrderStatus.DaXacNhan),
            DangHoan = Count(OrderStatus.DangHoan),
            GiaoCham = await orders.QueryNoTracking().CountAsync(o => o.Status == OrderStatus.DangGiao && o.Shipment != null
                && o.Shipment.HandedOverAt < slowBefore, ct),
            CanHoanTien = await orders.QueryNoTracking().CountAsync(o => o.Status == OrderStatus.DaHuy
                && o.PaymentStatus == PaymentStatus.CanHoanTien, ct),
            AsOf = now
        };
    }

    public async Task<DashboardSales> GetSalesAsync(CancellationToken ct = default)
    {
        await workflow.EnsureSweptAsync(ct);
        var now = Now;
        var today = VietnamDates.Today(time);
        var todayStart = VietnamDates.StartOfDayUtc(today);
        var yesterdayStart = VietnamDates.StartOfDayUtc(today.AddDays(-1));
        var start30 = VietnamDates.StartOfDayUtc(today.AddDays(-29));
        var end = VietnamDates.EndOfDayExclusiveUtc(today);
        var rows = await RowsAsync(start30, end, ct);

        SalesFigures Figures(DateTime from, DateTime to) => new()
        {
            NetRevenue = rows.Where(r => DeliveredIn(r, from, to)).Sum(r => r.Net),
            OrderValue = rows.Where(r => In(r.PlacedAt, from, to) && r.Status != OrderStatus.DaHuy).Sum(r => r.Total),
            NewOrders = rows.Count(r => In(r.PlacedAt, from, to))
        };

        var placed30 = rows.Where(r => In(r.PlacedAt, start30, end)).ToList();
        var series = Enumerable.Range(0, 30).Select(i =>
        {
            var day = today.AddDays(i - 29);
            var (from, to) = (VietnamDates.StartOfDayUtc(day), VietnamDates.EndOfDayExclusiveUtc(day));
            return new SeriesPoint
            {
                Date = VietnamDates.Format(day),
                OrderValue = rows.Where(r => In(r.PlacedAt, from, to) && r.Status != OrderStatus.DaHuy).Sum(r => r.Total),
                NetRevenue = rows.Where(r => DeliveredIn(r, from, to)).Sum(r => r.Net)
            };
        }).ToList();

        var top = (await TopRowsAsync(rows.Where(r => DeliveredIn(r, start30, end)).ToList(), null, false, ct))
            .OrderByDescending(r => r.Quantity).ThenByDescending(r => r.NetRevenue).Take(5).ToList();
        var topIds = top.Select(t => t.ProductId).ToList();
        var covers = await products.QueryNoTracking().IgnoreQueryFilters().Where(p => topIds.Contains(p.Id))
            .Select(p => new { p.Id, Cover = p.Images.OrderByDescending(i => i.IsCover).ThenBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault() })
            .ToDictionaryAsync(p => p.Id, p => p.Cover, ct);

        // Biến thể bật của sản phẩm đang bán: sắp hết 1–5 (ít nhất trước), hết hàng 0.
        var stock = await variants.QueryNoTracking().Where(v => v.IsActive && v.Stock <= SalesRules.LowStockMax)
            .Join(products.QueryNoTracking().Where(p => !p.IsHidden), v => v.ProductId, p => p.Id,
                (v, p) => new { v.Id, v.ProductId, v.Sku, v.ColorId, v.Size, v.Stock, p.Name, p.SortOrder, VariantSort = v.SortOrder })
            .ToListAsync(ct);
        var colorNames = await colors.QueryNoTracking().ToDictionaryAsync(c => c.Id, c => c.Name, ct);
        var stockItems = stock.OrderBy(s => s.Stock).ThenBy(s => s.SortOrder).ThenBy(s => s.VariantSort).Select(s => new
        {
            s.Stock,
            Item = new LowStockItem
            {
                ProductId = s.ProductId,
                VariantId = s.Id,
                Sku = s.Sku,
                ProductName = s.Name,
                ColorName = colorNames.GetValueOrDefault(s.ColorId, string.Empty),
                Size = s.Size,
                Stock = s.Stock
            }
        }).ToList();

        return new DashboardSales
        {
            Today = Figures(todayStart, now.AddTicks(1)),
            YesterdaySamePeriod = Figures(yesterdayStart, now.AddDays(-1).AddTicks(1)),
            CancelRate30d = Rate(placed30.Count(r => r.Status == OrderStatus.DaHuy), placed30.Count),
            ReturnRate30d = ReturnRate(placed30),
            Series30d = series,
            TopProducts30d = top.Select(t => new DashboardTopProduct
            {
                ProductId = t.ProductId,
                Code = t.Code,
                Name = t.Name,
                CoverUrl = covers.GetValueOrDefault(t.ProductId),
                Quantity = t.Quantity,
                NetRevenue = t.NetRevenue
            }).ToList(),
            LowStock = stockItems.Where(s => s.Stock > 0).Select(s => s.Item).ToList(),
            OutOfStock = stockItems.Where(s => s.Stock <= 0).Select(s => s.Item).ToList(),
            AsOf = now
        };
    }

    public async Task<RevenueReport> GetRevenueAsync(DateRangeQuery query, CancellationToken ct = default)
    {
        await workflow.EnsureSweptAsync(ct);
        var (from, to) = ParseRange(query);
        var length = to.DayNumber - from.DayNumber + 1;
        var prevFrom = from.AddDays(-length);
        var rows = await RowsAsync(VietnamDates.StartOfDayUtc(prevFrom), VietnamDates.EndOfDayExclusiveUtc(to), ct);

        RevenueTotals Totals(DateOnly a, DateOnly b)
        {
            var (start, end) = (VietnamDates.StartOfDayUtc(a), VietnamDates.EndOfDayExclusiveUtc(b));
            var placed = rows.Where(r => In(r.PlacedAt, start, end) && r.Status != OrderStatus.DaHuy).ToList();
            var value = placed.Sum(r => r.Total);
            return new RevenueTotals
            {
                OrderValue = value,
                NetRevenue = rows.Where(r => DeliveredIn(r, start, end)).Sum(r => r.Net),
                OrderCount = placed.Count,
                AvgOrderValue = placed.Count == 0 ? 0 : Math.Round(value / placed.Count, 0, MidpointRounding.AwayFromZero)
            };
        }

        var days = Enumerable.Range(0, length).Select(i =>
        {
            var day = from.AddDays(i);
            var t = Totals(day, day);
            return new RevenueDay { Date = VietnamDates.Format(day), OrderValue = t.OrderValue, NetRevenue = t.NetRevenue, OrderCount = t.OrderCount, AvgOrderValue = t.AvgOrderValue };
        }).ToList();
        var previousDays = Enumerable.Range(0, length).Select(i =>
        {
            var day = prevFrom.AddDays(i);
            var t = Totals(day, day);
            return new SeriesPoint { Date = VietnamDates.Format(day), OrderValue = t.OrderValue, NetRevenue = t.NetRevenue };
        }).ToList();

        return new RevenueReport { Days = days, Totals = Totals(from, to), Previous = Totals(prevFrom, from.AddDays(-1)), PreviousDays = previousDays };
    }

    public async Task<TopProductsReport> GetTopProductsAsync(TopProductsQuery query, CancellationToken ct = default)
    {
        await workflow.EnsureSweptAsync(ct);
        var (from, to) = ParseRange(query);
        var (start, end) = (VietnamDates.StartOfDayUtc(from), VietnamDates.EndOfDayExclusiveUtc(to));
        var rows = (await RowsAsync(start, end, ct)).Where(r => DeliveredIn(r, start, end)).ToList();
        var byVariant = string.Equals(query.GroupBy, "variant", StringComparison.OrdinalIgnoreCase);
        var result = await TopRowsAsync(rows, query.CategoryId, byVariant, ct);
        var totalNet = result.Sum(r => r.NetRevenue);
        return new TopProductsReport
        {
            GroupBy = byVariant ? "variant" : "product",
            Rows = result.OrderByDescending(r => r.NetRevenue).ThenByDescending(r => r.Quantity).Select(r => new TopProductRow
            {
                Key = r.Key,
                ProductId = r.ProductId,
                Code = r.Code,
                Name = r.Name,
                Sku = r.Sku,
                ColorName = r.ColorName,
                Size = r.Size,
                Quantity = r.Quantity,
                NetRevenue = r.NetRevenue,
                Share = totalNet == 0 ? 0 : Math.Round((double)(r.NetRevenue / totalNet * 100), 1, MidpointRounding.AwayFromZero)
            }).ToList(),
            TotalQuantity = result.Sum(r => r.Quantity),
            TotalNetRevenue = totalNet
        };
    }

    private sealed record TopRow(string Key, Guid ProductId, string Code, string Name, string? Sku, string? ColorName, string? Size, int Quantity, decimal NetRevenue);

    /// <summary>
    /// Số lượng, doanh thu thuần theo sản phẩm hoặc biến thể của các đơn đã giao: thành tiền dòng − phần giảm giá phân bổ
    /// (07 §3.13, quyết định 19).
    /// </summary>
    private async Task<List<TopRow>> TopRowsAsync(List<Row> delivered, Guid? categoryId, bool byVariant, CancellationToken ct)
    {
        var ids = delivered.Select(r => r.Id).ToList();
        var lines = await orders.QueryNoTracking().Where(o => ids.Contains(o.Id)).SelectMany(o => o.Lines)
            .Select(l => new { l.OrderId, l.ProductId, l.VariantId, l.ProductName, l.Sku, l.ColorName, l.Size, l.UnitPrice, l.Quantity, l.SortOrder })
            .ToListAsync(ct);
        var productInfo = await products.QueryNoTracking().IgnoreQueryFilters()
            .Select(p => new { p.Id, p.Code, p.Name, p.CategoryId }).ToDictionaryAsync(p => p.Id, ct);
        var scopes = await coupons.QueryNoTracking().IgnoreQueryFilters().ToDictionaryAsync(c => c.Id, c => c.CategoryId, ct);
        var discountOf = delivered.ToDictionary(r => r.Id, r => (r.Discount, Scope: r.CouponId is { } cid ? scopes.GetValueOrDefault(cid) : null));

        var items = new List<(Guid ProductId, Guid VariantId, string Sku, string ColorName, string? Size, int Quantity, decimal Net)>();
        foreach (var group in lines.GroupBy(l => l.OrderId))
        {
            var ordered = group.OrderBy(l => l.SortOrder).ToList();
            var pricing = ordered.Select(l => new PricingLine(productInfo.TryGetValue(l.ProductId, out var p) ? p.CategoryId : Guid.Empty, l.UnitPrice, l.Quantity)).ToList();
            var (discount, scope) = discountOf[group.Key];
            var allocated = OrderPricing.AllocateDiscount(pricing, discount, scope);
            for (var i = 0; i < ordered.Count; i++)
            {
                var l = ordered[i];
                items.Add((l.ProductId, l.VariantId, l.Sku, l.ColorName, l.Size, l.Quantity, l.UnitPrice * l.Quantity - allocated[i]));
            }
        }

        if (categoryId is { } cat)
            items = items.Where(i => productInfo.TryGetValue(i.ProductId, out var p) && p.CategoryId == cat).ToList();

        return byVariant
            ? items.GroupBy(i => i.VariantId).Select(g =>
            {
                var f = g.First();
                var p = productInfo.GetValueOrDefault(f.ProductId);
                return new TopRow(g.Key.ToString(), f.ProductId, p?.Code ?? string.Empty, p?.Name ?? string.Empty, f.Sku, f.ColorName, f.Size,
                    g.Sum(x => x.Quantity), g.Sum(x => x.Net));
            }).ToList()
            : items.GroupBy(i => i.ProductId).Select(g =>
            {
                var p = productInfo.GetValueOrDefault(g.Key);
                return new TopRow(g.Key.ToString(), g.Key, p?.Code ?? string.Empty, p?.Name ?? string.Empty, null, null, null,
                    g.Sum(x => x.Quantity), g.Sum(x => x.Net));
            }).ToList();
    }

    public async Task<OrderStatusReport> GetOrderStatusAsync(OrderStatusReportQuery query, CancellationToken ct = default)
    {
        await workflow.EnsureSweptAsync(ct);
        var (from, to) = ParseRange(query);
        var (start, end) = (VietnamDates.StartOfDayUtc(from), VietnamDates.EndOfDayExclusiveUtc(to));
        var placed = (await RowsAsync(start, end, ct)).Where(r => In(r.PlacedAt, start, end))
            .Where(r => query.PaymentMethod is null || r.PaymentMethod == query.PaymentMethod).ToList();
        var cancelled = placed.Count(r => r.Status == OrderStatus.DaHuy);
        var returns = placed.Count(r => r.IsReturn);
        return new OrderStatusReport
        {
            OrderCount = placed.Count,
            CancelledCount = cancelled,
            CancelRate = Rate(cancelled, placed.Count),
            ReturnCount = returns,
            ReturnRate = ReturnRate(placed),
            CancelReasons = placed.Where(r => r.Status == OrderStatus.DaHuy && r.CancelReason is not null)
                .GroupBy(r => r.CancelReason!.Value).Select(g => new ReasonCount<CancelReason> { Reason = g.Key, Count = g.Count() })
                .OrderByDescending(r => r.Count).ToList(),
            FailReasons = placed.Where(r => r.FailReason is not null)
                .GroupBy(r => r.FailReason!.Value).Select(g => new ReasonCount<DeliveryFailReason> { Reason = g.Key, Count = g.Count() })
                .OrderByDescending(r => r.Count).ToList(),
            ByPaymentMethod = placed.GroupBy(r => r.PaymentMethod).OrderBy(g => g.Key).Select(g => new PaymentMethodRate
            {
                PaymentMethod = g.Key,
                OrderCount = g.Count(),
                CancelRate = Rate(g.Count(r => r.Status == OrderStatus.DaHuy), g.Count()),
                ReturnRate = ReturnRate(g.ToList())
            }).ToList()
        };
    }

    public async Task<IReadOnlyList<ProvinceReportRow>> GetProvincesAsync(DateRangeQuery query, CancellationToken ct = default)
    {
        await workflow.EnsureSweptAsync(ct);
        var (from, to) = ParseRange(query);
        var (start, end) = (VietnamDates.StartOfDayUtc(from), VietnamDates.EndOfDayExclusiveUtc(to));
        var rows = await RowsAsync(start, end, ct);
        return rows.GroupBy(r => r.ProvinceCode).Select(g =>
        {
            var placed = g.Where(r => In(r.PlacedAt, start, end)).ToList();
            return new ProvinceReportRow
            {
                ProvinceCode = g.Key,
                ProvinceName = g.First().ProvinceName,
                OrderCount = placed.Count,
                NetRevenue = g.Where(r => DeliveredIn(r, start, end)).Sum(r => r.Net),
                ReturnRate = ReturnRate(placed)
            };
        }).OrderByDescending(r => r.OrderCount).ThenByDescending(r => r.NetRevenue).ToList();
    }

    public async Task<IReadOnlyList<CouponReportRow>> GetCouponsAsync(CouponReportQuery query, CancellationToken ct = default)
    {
        await workflow.EnsureSweptAsync(ct);
        var (from, to) = ParseRange(query);
        var (start, end) = (VietnamDates.StartOfDayUtc(from), VietnamDates.EndOfDayExclusiveUtc(to));
        var rows = await RowsAsync(start, end, ct);
        return rows.Where(r => In(r.PlacedAt, start, end) && r.CouponId is not null && r.Status != OrderStatus.DaHuy)
            .Where(r => query.CouponId is null || r.CouponId == query.CouponId)
            .GroupBy(r => r.CouponId!.Value)
            .Select(g => new CouponReportRow
            {
                CouponId = g.Key,
                Code = g.First().CouponCode ?? string.Empty,
                UsedCount = g.Count(),
                DiscountTotal = g.Sum(r => r.Discount + r.ShippingDiscount),
                OrderValue = g.Sum(r => r.Total)
            })
            .OrderByDescending(r => r.UsedCount).ToList();
    }
}
