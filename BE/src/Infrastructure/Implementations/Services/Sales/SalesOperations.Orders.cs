using Application.Common.Exceptions;
using Application.Common.Models;
using Application.DTOs.Orders;
using Application.DTOs.Storefront;
using Application.Interfaces.Services.Orders;
using Application.Mappings.Sales;
using Domain.Common;
using Domain.Entities.Crm.Customers;
using Domain.Entities.Sales;
using Domain.Entities.Sales.Coupons;
using Domain.Entities.Sales.Orders;
using Domain.Enums.Sales.Orders;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure.Implementations.Services.Sales;

// Đơn hàng quản trị (07 §2.5, §3.5, §3.6, UC-07…UC-11).
public sealed partial class SalesOperations
{
    /// <summary>Lệch version phát hiện trong transaction; dựng 409 sau khi rollback.</summary>
    private sealed class StaleVersionException : Exception;

    public async Task<PaginatedResult<OrderListItem>> GetPagedAsync(OrderQuery query, CancellationToken ct = default)
    {
        await EnsureSweptAsync(ct);
        var now = Now;
        var duplicates = await OrderListing.LoadDuplicatesAsync(orders.QueryNoTracking(), ct);
        var filtered = OrderListing.Filter(orders.QueryNoTracking(), query, customers.QueryNoTracking(), duplicates.Keys, now, true);
        return await OrderListing.PageAsync(filtered, query, customers.QueryNoTracking(), duplicates, now, ct);
    }

    public async Task<IReadOnlyDictionary<string, int>> GetStatusCountsAsync(OrderQuery query, CancellationToken ct = default)
    {
        await EnsureSweptAsync(ct);
        var duplicates = await OrderListing.LoadDuplicatesAsync(orders.QueryNoTracking(), ct);
        var filtered = OrderListing.Filter(orders.QueryNoTracking(), query, customers.QueryNoTracking(), duplicates.Keys, Now, false);
        var counts = await filtered.GroupBy(o => o.Status).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);
        var result = Enum.GetValues<OrderStatus>().ToDictionary(s => s.ToString(), s => counts.FirstOrDefault(c => c.Key == s)?.Count ?? 0);
        result["TatCa"] = counts.Sum(c => c.Count);
        return result;
    }

    public async Task<OrderDetailDto> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        await EnsureSweptAsync(ct);
        return await ReadDetailAsync(id, ct);
    }

    public async Task<OrderDetailDto> AddNoteAsync(Guid id, AddOrderNoteRequest request, CancellationToken ct = default)
    {
        // Ghi chú không kiểm version, vẫn tăng version (07 §2.5).
        var actor = await StaffActorAsync(ct);
        await unitOfWork.ExecuteInTransactionAsync(async c =>
        {
            var order = await LoadTrackedAsync(id, c) ?? throw SalesProblems.OrderNotFound();
            order.AddNote(actor, Now, request.Content);
            await unitOfWork.SaveChangesAsync(c);
        }, ct);
        return await ReadDetailAsync(id, ct);
    }

    public Task<OrderDetailDto> ConfirmAsync(Guid id, ConfirmOrderRequest request, CancellationToken ct = default) =>
        ActAsync(id, request.Version, (order, actor, _) =>
        {
            order.Confirm(actor, Now, request.Note);
            return Task.CompletedTask;
        }, ct);

    public Task<OrderDetailDto> ConfirmPaymentAsync(Guid id, ConfirmPaymentRequest request, CancellationToken ct = default) =>
        ActAsync(id, request.Version, (order, actor, _) =>
        {
            order.ConfirmPayment(actor, Now, request.TransactionRef!);
            return Task.CompletedTask;
        }, ct);

    public Task<OrderDetailDto> CancelAsync(Guid id, CancelOrderRequest request, CancellationToken ct = default) =>
        ActAsync(id, request.Version, async (order, actor, c) =>
        {
            order.Cancel(actor, Now, request.Reason!.Value, request.Note);
            await ReleaseOnCancelAsync(order, c);
        }, ct);

    public Task<OrderDetailDto> ShipAsync(Guid id, ShipOrderRequest request, CancellationToken ct = default) =>
        WithRetryAsync(s => s.ActAsync(id, request.Version, async (order, actor, c) =>
        {
            if (order.Status != OrderStatus.DaXacNhan)
                throw SalesErrors.InvalidState(order.Status);
            var now = s.Now;
            var tracking = await s.NextTrackingCodeAsync(request.Carrier!.Value, now, c);
            order.Ship(actor, now, request.Carrier.Value, tracking, request.WeightGrams!.Value, request.ShipperNote);
        }, ct));

    public Task<OrderDetailDto> DeliverAsync(Guid id, VersionedRequest request, CancellationToken ct = default) =>
        ActAsync(id, request.Version, async (order, actor, c) =>
        {
            order.Deliver(actor, Now);
            await AddSoldAsync(order, c);
        }, ct);

    public Task<OrderDetailDto> DeliveryFailedAsync(Guid id, DeliveryFailedRequest request, CancellationToken ct = default) =>
        ActAsync(id, request.Version, (order, actor, _) =>
        {
            order.DeliveryFailed(actor, Now, request.Reason!.Value, request.Note);
            return Task.CompletedTask;
        }, ct);

    public Task<OrderDetailDto> ReceiveReturnAsync(Guid id, VersionedRequest request, CancellationToken ct = default) =>
        ActAsync(id, request.Version, async (order, actor, c) =>
        {
            order.ReceiveReturn(actor, Now);
            // BR-13: cộng lại tồn; lượt mã không trả (BR-09).
            foreach (var line in order.Lines)
                await ReturnStockAsync(line.VariantId, line.Quantity, c);
        }, ct);

    public Task<OrderDetailDto> RefundAsync(Guid id, RefundRequest request, CancellationToken ct = default) =>
        ActAsync(id, request.Version, (order, actor, _) =>
        {
            order.Refund(actor, Now, request.RefundRef!);
            return Task.CompletedTask;
        }, ct);

    public async Task<LabelPrintedResult> MarkLabelPrintedAsync(Guid id, CancellationToken ct = default)
    {
        var count = 0;
        await unitOfWork.ExecuteInTransactionAsync(async c =>
        {
            var order = await LoadTrackedAsync(id, c) ?? throw SalesProblems.OrderNotFound();
            count = order.MarkLabelPrinted();
            await unitOfWork.SaveChangesAsync(c);
        }, ct);
        return new LabelPrintedResult { LabelPrintCount = count };
    }

    public async Task<BulkResult> BulkConfirmAsync(BulkConfirmRequest request, CancellationToken ct = default) =>
        await BulkAsync(request.Items, (service, item) => service.ConfirmAsync(item.Id, new ConfirmOrderRequest { Version = item.Version }, ct));

    public async Task<BulkResult> BulkShipAsync(BulkShipRequest request, CancellationToken ct = default)
    {
        var ids = request.Items.Select(i => i.Id).ToList();
        var quantities = await orders.QueryNoTracking().Where(o => ids.Contains(o.Id))
            .Select(o => new { o.Id, Quantity = o.Lines.Sum(l => l.Quantity) })
            .ToDictionaryAsync(o => o.Id, o => o.Quantity, ct);
        return await BulkAsync(request.Items, (service, item) => service.ShipAsync(item.Id, new ShipOrderRequest
        {
            Version = item.Version,
            Carrier = request.Carrier,
            // Khối lượng gợi ý 300 g × số lượng + 100 g (07 §3.9).
            WeightGrams = Math.Clamp(SalesCodes.SuggestWeight(quantities.GetValueOrDefault(item.Id, 1)), SalesRules.MinWeightGrams, SalesRules.MaxWeightGrams)
        }, ct));
    }

    /// <summary>Thao tác hàng loạt (FR-31): mỗi đơn chạy trong scope riêng, lỗi đơn này không ảnh hưởng đơn khác.</summary>
    private async Task<BulkResult> BulkAsync(IReadOnlyList<BulkItem> items, Func<IOrderService, BulkItem, Task<OrderDetailDto>> action)
    {
        var succeeded = new List<Guid>();
        var failed = new List<BulkFailure>();
        foreach (var item in items)
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            try
            {
                await action(scope.ServiceProvider.GetRequiredService<IOrderService>(), item);
                succeeded.Add(item.Id);
            }
            catch (DomainException ex)
            {
                failed.Add(new BulkFailure { Id = item.Id, Code = ex.Extensions.GetValueOrDefault("code") as string ?? "LoiNghiepVu", Message = ex.Message });
            }
            catch (ConflictException ex)
            {
                failed.Add(new BulkFailure { Id = item.Id, Code = ex.Extensions.GetValueOrDefault("code") as string ?? "XungDot", Message = ex.Message });
            }
            catch (CodedNotFoundException ex)
            {
                failed.Add(new BulkFailure { Id = item.Id, Code = ex.Code, Message = ex.Message });
            }
        }

        return new BulkResult { Succeeded = succeeded, Failed = failed };
    }

    /// <summary>
    /// Khung chung của thao tác đổi đơn: quét quá hạn, kiểm version (07 §3.6), chạy thao tác trong transaction, tính lại thống kê
    /// khách, trả chi tiết mới. Tranh chấp lúc lưu xử lý như lệch version.
    /// </summary>
    private async Task<OrderDetailDto> ActAsync(Guid id, int? version, Func<Order, OrderActor, CancellationToken, Task> act, CancellationToken ct)
    {
        await EnsureSweptAsync(ct);
        var actor = await StaffActorAsync(ct);
        try
        {
            await unitOfWork.ExecuteInTransactionAsync(async c =>
            {
                var order = await LoadTrackedAsync(id, c) ?? throw SalesProblems.OrderNotFound();
                if (version is { } v && v != order.Version)
                    throw new StaleVersionException();
                await act(order, actor, c);
                await unitOfWork.SaveChangesAsync(c);
                await RecalculateCustomerAsync(order.CustomerId, c);
            }, ct);
        }
        catch (Exception ex) when (ex is StaleVersionException or DbUpdateConcurrencyException)
        {
            throw await InFreshScopeAsync(s => s.StaleAsync(id, ct));
        }

        return await InFreshScopeAsync(s => s.ReadDetailAsync(id, ct));
    }

    /// <summary>409 <c>DonDaBiHuy</c> khi đơn hiện tại Đã hủy, ngược lại <c>DonDaThayDoi</c> kèm người, giờ của sự kiện mới nhất.</summary>
    private async Task<ConflictException> StaleAsync(Guid id, CancellationToken ct)
    {
        var order = await ReadFullAsync(id, ct) ?? throw SalesProblems.OrderNotFound();
        var detail = await BuildDetailAsync(order, ct);
        var extra = new Dictionary<string, object?> { ["order"] = detail };
        if (order.Status == OrderStatus.DaHuy)
            return SalesProblems.Conflict(SalesErrors.DonDaBiHuy,
                SalesErrors.CancelledMessage(Order.FormatVn(order.CancelledAt ?? order.UpdatedAt ?? Now, "HH:mm")), extra);

        var last = order.Events.Where(e => e.Type != OrderEventType.TinGuiKhach)
            .OrderBy(e => e.At).ThenBy(e => e.Seq).LastOrDefault();
        return SalesProblems.Conflict(SalesErrors.DonDaThayDoi,
            SalesErrors.ChangedMessage(last?.ActorName ?? "người khác", Order.FormatVn(last?.At ?? order.UpdatedAt ?? Now, "HH:mm")), extra);
    }

    // ---------------------------------------------------------------- Sửa đơn (FR-26, BR-15, UC-08)

    private sealed record EditPlan(
        Order Order, List<OrderLine> Lines, PricingResult Pricing, bool CouponRemoved, string? CouponMessage, List<string> Changes,
        OrderRecipient Recipient, List<(Guid VariantId, int Delta, int Held, int NewQuantity)> StockDeltas, Dictionary<Guid, VariantInfo> Info);

    public async Task<EditOrderPreview> PreviewEditAsync(Guid id, EditOrderRequest request, CancellationToken ct = default)
    {
        var order = await ReadFullAsync(id, ct) ?? throw SalesProblems.OrderNotFound();
        var plan = await PlanEditAsync(order, request, ct);
        // Xem trước: báo thiếu tồn ngay để nhân viên sửa trước khi lưu (UC-08 E3).
        var stocks = await LoadStocksAsync(plan.StockDeltas.Select(d => d.VariantId), ct);
        if (plan.StockDeltas.Any(d => d.Delta > 0 && stocks.GetValueOrDefault(d.VariantId) < d.Delta))
            throw await NotEnoughStockAsync(plan.StockDeltas.Select(d => (d.VariantId, d.NewQuantity, d.Held)).ToList(), plan.Info, ct);

        var slugs = await SlugsAsync(plan.Lines.Select(l => l.ProductId), ct);
        return new EditOrderPreview
        {
            Lines = plan.Lines.Select(l => l.ToView(slugs.GetValueOrDefault(l.ProductId))).ToList(),
            Summary = plan.Pricing.ToSummary(),
            CouponRemoved = plan.CouponRemoved,
            CouponMessage = plan.CouponMessage,
            Changes = plan.Changes
        };
    }

    public async Task<OrderDetailDto> EditAsync(Guid id, EditOrderRequest request, CancellationToken ct = default)
    {
        await EnsureSweptAsync(ct);
        var actor = await StaffActorAsync(ct);
        try
        {
            await unitOfWork.ExecuteInTransactionAsync(async c =>
            {
                var order = await LoadTrackedAsync(id, c) ?? throw SalesProblems.OrderNotFound();
                if (request.Version is { } v && v != order.Version)
                    throw new StaleVersionException();
                var plan = await PlanEditAsync(order, request, c);

                // BR-13: trừ hoặc cộng phần chênh lệch; thiếu tồn thì không lưu (TC-30).
                foreach (var delta in plan.StockDeltas.Where(d => d.Delta != 0))
                {
                    if (delta.Delta > 0 && !await TryTakeStockAsync(delta.VariantId, delta.Delta, c))
                        throw await NotEnoughStockAsync(plan.StockDeltas.Select(d => (d.VariantId, d.NewQuantity, d.Held)).ToList(), plan.Info, c);
                    if (delta.Delta < 0)
                        await ReturnStockAsync(delta.VariantId, -delta.Delta, c);
                }

                if (plan.CouponRemoved && order.CouponId is { } couponId)
                    await ReleaseCouponAsync(couponId, c);

                // Đổi số điện thoại → đơn thuộc hồ sơ khách của số mới (FR-34).
                var previousCustomerId = order.CustomerId;
                var customerId = previousCustomerId;
                if (plan.Recipient.Phone != order.Phone)
                {
                    var customer = await customers.Query().FirstOrDefaultAsync(x => x.Phone == plan.Recipient.Phone, c);
                    if (customer is null)
                    {
                        customer = Customer.Create(plan.Recipient.Phone, plan.Recipient.Name, plan.Recipient.Email, plan.Recipient.ProvinceCode,
                            plan.Recipient.WardCode, plan.Recipient.AddressLine, order.PlacedAt);
                        await customers.AddAsync(customer, c);
                    }

                    customerId = customer.Id;
                }

                order.Edit(actor, Now, plan.Recipient, plan.Lines, plan.Pricing, plan.CouponRemoved, plan.Changes, customerId);
                await unitOfWork.SaveChangesAsync(c);
                await RecalculateCustomerAsync(customerId, c);
                if (previousCustomerId != customerId)
                    await RecalculateCustomerAsync(previousCustomerId, c);
            }, ct);
        }
        catch (Exception ex) when (ex is StaleVersionException or DbUpdateConcurrencyException)
        {
            throw await InFreshScopeAsync(s => s.StaleAsync(id, ct));
        }

        return await InFreshScopeAsync(s => s.ReadDetailAsync(id, ct));
    }

    private async Task<Dictionary<Guid, int>> LoadStocksAsync(IEnumerable<Guid> ids, CancellationToken ct)
    {
        var list = ids.Distinct().ToList();
        return await variants.QueryNoTracking().Where(v => list.Contains(v.Id)).ToDictionaryAsync(v => v.Id, v => v.Stock, ct);
    }

    /// <summary>Tính dòng mới, tiền, mã giảm giá còn hợp lệ không, danh sách thay đổi (07 §3.10) cho sửa đơn.</summary>
    private async Task<EditPlan> PlanEditAsync(Order order, EditOrderRequest request, CancellationToken ct)
    {
        order.EnsureEditable();
        if (request.Lines.Count == 0)
            throw SalesErrors.EmptyCart();
        if (request.Lines.Count > SalesRules.MaxCartLines)
            throw SalesErrors.TooManyLines();

        var phone = SalesCodes.NormalizePhone(request.Phone);
        var (province, ward) = await ResolveAddressAsync(request.ProvinceCode, request.WardCode, string.Empty, ct);
        var wanted = request.Lines.GroupBy(l => l.VariantId).Select(g => (VariantId: g.Key, Quantity: g.Sum(l => l.Quantity))).ToList();
        if (wanted.Any(w => w.Quantity > SalesRules.MaxLineQuantity))
            throw OrderListing.Invalid("lines", "Số lượng từ 1 đến 10");

        var oldByVariant = order.Lines.GroupBy(l => l.VariantId).ToDictionary(g => g.Key, g => g.First());
        var info = await LoadVariantsAsync(wanted.Select(w => w.VariantId).Concat(oldByVariant.Keys), ct);

        // Dòng mới phải đang bán; dòng cũ giữ đơn giá đã chụp (BR-25).
        var stopped = wanted.Where(w => !oldByVariant.ContainsKey(w.VariantId)
            && (!info.TryGetValue(w.VariantId, out var v) || !v.IsSellable)).ToList();
        if (stopped.Count > 0)
        {
            var name = info.TryGetValue(stopped[0].VariantId, out var first) ? first.Product.Name : "Sản phẩm";
            throw SalesProblems.Conflict(SalesErrors.SanPhamNgungBan, SalesErrors.DiscontinuedMessage(name),
                new Dictionary<string, object?> { ["variantIds"] = stopped.Select(s => s.VariantId).ToList() });
        }

        var lines = new List<OrderLine>();
        var pricingLines = new List<PricingLine>();
        for (var i = 0; i < wanted.Count; i++)
        {
            var (variantId, quantity) = wanted[i];
            OrderLine line;
            if (oldByVariant.TryGetValue(variantId, out var old))
            {
                line = OrderLine.Create(old.VariantId, old.ProductId, old.ProductName, old.Sku, old.ColorName, old.Size, old.ImageUrl,
                    old.UnitPrice, quantity, i);
            }
            else
            {
                var v = info[variantId];
                line = OrderLine.Create(v.Variant.Id, v.Product.Id, v.Product.Name, v.Variant.Sku, v.Color.Name, v.Variant.Size, v.ImageUrl,
                    v.Product.Price, quantity, i);
            }

            lines.Add(line);
            var categoryId = info.TryGetValue(variantId, out var vi) ? vi.Product.CategoryId : Guid.Empty;
            pricingLines.Add(new PricingLine(categoryId, line.UnitPrice, quantity));
        }

        // Mã giảm giá kiểm lại (BR-15); không hợp lệ thì tự gỡ, báo cho nhân viên.
        var couponRemoved = false;
        string? couponMessage = null;
        CouponSpec? spec = null;
        if (order.CouponId is { } couponId)
        {
            var coupon = await coupons.QueryNoTracking().IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == couponId, ct);
            if (coupon is null || coupon.IsDeleted)
            {
                couponRemoved = true;
                couponMessage = CouponRules.NotFoundMessage;
            }
            else
            {
                // Đơn này đã chiếm một lượt; kiểm như khi chưa tính đơn này.
                coupon.SetUsedCount(coupon.UsedCount - 1);
                var categoryName = coupon.CategoryId is { } cid
                    ? await categories.QueryNoTracking().IgnoreQueryFilters().Where(x => x.Id == cid).Select(x => x.Name).FirstOrDefaultAsync(ct)
                    : null;
                var check = CouponRules.Check(coupon, pricingLines, Now, categoryName);
                if (!check.Ok)
                {
                    couponRemoved = true;
                    couponMessage = check.Message;
                }
                else if (await CountPhoneUsageAsync(phone, coupon.Id, order.Id, ct) >= coupon.PerCustomerLimit)
                {
                    couponRemoved = true;
                    couponMessage = CouponRules.PhoneUsedMessage(coupon.Code);
                }
                else
                {
                    spec = CouponRules.SpecOf(coupon);
                }
            }
        }

        var pricing = OrderPricing.Calculate(pricingLines, province.Zone, spec);
        var recipient = new OrderRecipient(request.RecipientName.Trim(), phone, request.Email, province.Code, province.Name, ward.Code,
            ward.Name, request.AddressLine.Trim());

        // Danh sách thay đổi (07 §3.10).
        string Label(OrderLine l)
        {
            var label = SalesText.VariantLabel(l.ColorName, l.Size);
            var sameLabel = order.Lines.Concat(lines).Where(x => SalesText.VariantLabel(x.ColorName, x.Size) == label)
                .Select(x => x.VariantId).Distinct().Count() > 1;
            return sameLabel ? $"{l.ProductName} {label}" : label;
        }

        var changes = new List<string>();
        var newByVariant = lines.ToDictionary(l => l.VariantId);
        foreach (var old in order.Lines.OrderBy(l => l.SortOrder))
        {
            if (!newByVariant.TryGetValue(old.VariantId, out var now))
                changes.Add($"Bỏ {Label(old)}");
            else if (now.Quantity != old.Quantity)
                changes.Add($"{Label(old)} {old.Quantity} → {now.Quantity}");
        }

        foreach (var added in lines.Where(l => !oldByVariant.ContainsKey(l.VariantId)))
            changes.Add($"Thêm {Label(added)} × {added.Quantity}");
        if (recipient.Name != order.RecipientName || recipient.Phone != order.Phone || recipient.ProvinceCode != order.ProvinceCode
            || recipient.WardCode != order.WardCode || recipient.AddressLine != order.AddressLine
            || (string.IsNullOrWhiteSpace(recipient.Email) ? null : recipient.Email.Trim()) != order.Email)
            changes.Add("Đổi thông tin nhận hàng");
        if (couponRemoved)
            changes.Add($"Gỡ mã {order.CouponCode}");

        var deltas = wanted.Select(w => (w.VariantId, Delta: w.Quantity - (oldByVariant.TryGetValue(w.VariantId, out var o) ? o.Quantity : 0),
                Held: oldByVariant.TryGetValue(w.VariantId, out var h) ? h.Quantity : 0, NewQuantity: w.Quantity))
            .Concat(oldByVariant.Values.Where(o => !newByVariant.ContainsKey(o.VariantId))
                .Select(o => (o.VariantId, Delta: -o.Quantity, Held: o.Quantity, NewQuantity: 0)))
            .ToList();
        return new EditPlan(order, lines, pricing, couponRemoved, couponMessage, changes, recipient, deltas, info);
    }
}
