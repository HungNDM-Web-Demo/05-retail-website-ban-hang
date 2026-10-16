using Application.Common.Exceptions;
using Application.DTOs.Storefront;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Storefront;
using Application.Mappings.Sales;
using Domain.Entities.Sales;
using Domain.Entities.Sales.Catalog;
using Domain.Entities.System.Settings;
using Infrastructure.Implementations.Services.Sales;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Storefront;

/// <summary>
/// Cửa hàng công khai, phần đọc (07 §2.2, §3.8; FR-04…FR-07). Danh mục sản phẩm của demo nhỏ (vài chục sản phẩm) nên nạp
/// sản phẩm đang bán vào bộ nhớ rồi lọc, sắp xếp đúng quy tắc 07 §3.8 (khớp handler mock của FE).
/// </summary>
public sealed class StorefrontService(
    IGenericRepository<Product> products,
    IGenericRepository<Category> categories,
    IGenericRepository<Color> colors,
    IGenericRepository<Setting> settings) : IStorefrontService
{
    private const int DefaultPageSize = 24;
    private const int MaxPageSize = 48;
    private static readonly string[] SizeOrder = ["S", "M", "L", "XL", "26", "27", "28", "29", "30", "31", "32"];

    public async Task<PublicStoreInfo> GetStoreAsync(CancellationToken ct = default)
    {
        var store = await StoreSettings.ReadAsync(settings, ct);
        return new PublicStoreInfo
        {
            Name = store.Name,
            Tagline = store.Tagline,
            LogoUrl = store.LogoUrl,
            PrimaryColor = store.PrimaryColor,
            Hotline = store.Hotline,
            Email = store.Email,
            Address = store.Address,
            WorkingHours = store.WorkingHours,
            BankBin = store.BankBin,
            BankName = SalesCodes.BankName(store.BankBin),
            BankAccount = store.BankAccount,
            BankAccountName = store.BankAccountName,
            FreeShipThreshold = SalesRules.FreeShipThreshold,
            ShippingFees = new Dictionary<string, decimal> { ["TpHcm"] = SalesRules.FeeTpHcm, ["TinhKhac"] = SalesRules.FeeOther },
            PaymentHours = SalesRules.PaymentHours
        };
    }

    public async Task<PublicHome> GetHomeAsync(CancellationToken ct = default)
    {
        var catalog = await LoadAsync(ct);
        var cards = catalog.Products.Select(catalog.Card).ToList();
        return new PublicHome
        {
            Banners = [],
            Categories = catalog.PublicCategories(),
            Featured = cards.Where(c => c.IsFeatured).Take(8).ToList(),
            Newest = cards.OrderByDescending(c => c.CreatedAt).Take(8).ToList(),
            OnSale = cards.Where(c => c.DiscountPercent is > 0).OrderByDescending(c => c.DiscountPercent).Take(8).ToList()
        };
    }

    public async Task<IReadOnlyList<PublicCategory>> GetCategoriesAsync(CancellationToken ct = default) =>
        (await LoadAsync(ct)).PublicCategories();

    public async Task<PublicProductListResult> GetProductsAsync(PublicProductQuery query, CancellationToken ct = default)
    {
        var catalog = await LoadAsync(ct);
        IEnumerable<Product> source = catalog.Products;
        PublicCategory? category = null;
        if (!string.IsNullOrWhiteSpace(query.Category))
        {
            var found = catalog.Categories.Values.FirstOrDefault(c => c.Slug == query.Category.Trim())
                ?? throw SalesProblems.CategoryNotFound();
            source = source.Where(p => p.CategoryId == found.Id);
            category = found.ToPublic(catalog.Products.Count(p => p.CategoryId == found.Id));
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = SalesCodes.SearchText(query.Search);
            source = source.Where(p => p.NameSearch.Contains(term, StringComparison.Ordinal));
        }

        // facets tính trước khi lọc màu, size, giá (07 §3.8).
        var baseList = source.ToList();
        var activeVariants = baseList.SelectMany(p => p.Variants.Where(v => v.IsActive)).ToList();
        var facets = new PublicProductFacets
        {
            Colors = activeVariants.Select(v => v.ColorId).Distinct().Where(catalog.Colors.ContainsKey)
                .Select(id => catalog.Colors[id]).OrderBy(c => c.SortOrder).Select(c => c.ToPublic()).ToList(),
            Sizes = activeVariants.Select(v => v.Size).OfType<string>().Distinct().OrderBy(SizeRank).ToList(),
            MinPrice = baseList.Count == 0 ? 0 : baseList.Min(p => p.Price),
            MaxPrice = baseList.Count == 0 ? 0 : baseList.Max(p => p.Price)
        };

        var colorCodes = Split(query.Colors).Select(c => c.ToUpperInvariant()).ToHashSet();
        var sizes = Split(query.Sizes).Select(s => s.ToUpperInvariant()).ToHashSet();
        var inStock = query.InStock == true;
        var filtered = baseList.Where(p =>
            (query.MinPrice is null || p.Price >= query.MinPrice) && (query.MaxPrice is null || p.Price <= query.MaxPrice)
            && ((colorCodes.Count == 0 && sizes.Count == 0 && !inStock)
                // Khớp khi có một biến thể bật cùng lúc thỏa màu, size, còn hàng (UC-01 bước 4).
                || p.Variants.Any(v => v.IsActive
                    && (colorCodes.Count == 0 || (catalog.Colors.TryGetValue(v.ColorId, out var c) && colorCodes.Contains(c.Code)))
                    && (sizes.Count == 0 || (v.Size is not null && sizes.Contains(v.Size.ToUpperInvariant())))
                    && (!inStock || v.Stock > 0))));

        var cards = filtered.Select(catalog.Card).ToList();
        var sortOrder = catalog.Products.ToDictionary(p => p.Id, p => p.SortOrder);
        IEnumerable<PublicProductCard> sorted = (query.Sort ?? "newest") switch
        {
            "bestselling" => cards.OrderByDescending(c => c.SoldCount).ThenBy(c => sortOrder[c.Id]),
            "priceAsc" => cards.OrderBy(c => c.Price).ThenBy(c => sortOrder[c.Id]),
            "priceDesc" => cards.OrderByDescending(c => c.Price).ThenBy(c => sortOrder[c.Id]),
            // newest: hết hàng xếp cuối (BR-02).
            _ => cards.OrderBy(c => c.IsOutOfStock).ThenByDescending(c => c.CreatedAt).ThenBy(c => sortOrder[c.Id])
        };

        var page = Math.Max(1, query.Page ?? 1);
        var pageSize = Math.Clamp(query.PageSize ?? DefaultPageSize, 1, MaxPageSize);
        return new PublicProductListResult
        {
            Items = sorted.Skip((page - 1) * pageSize).Take(pageSize).ToList(),
            Page = page,
            PageSize = pageSize,
            TotalCount = cards.Count,
            Facets = facets,
            Category = category
        };
    }

    public async Task<IReadOnlyList<PublicSuggestion>> SuggestAsync(string? search, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(search) || search.Trim().Length < 2)
            return [];
        var catalog = await LoadAsync(ct);
        var term = SalesCodes.SearchText(search);
        return catalog.Products
            .Where(p => p.NameSearch.Contains(term, StringComparison.Ordinal))
            .OrderByDescending(p => p.SoldCount).ThenBy(p => p.SortOrder)
            .Take(5)
            .Select(p => new PublicSuggestion { Slug = p.Slug, Name = p.Name, CoverUrl = Cover(p), Price = p.Price, ListPrice = p.ListPrice })
            .ToList();
    }

    public async Task<PublicProductLookup> GetProductAsync(string slug, CancellationToken ct = default)
    {
        var catalog = await LoadAsync(ct);
        var product = await products.QueryNoTracking().IgnoreQueryFilters().Include(p => p.Images).Include(p => p.Variants).AsSplitQuery()
            .Where(p => p.Slug == slug).OrderBy(p => p.IsDeleted).FirstOrDefaultAsync(ct)
            ?? throw SalesProblems.ProductNotFound();

        var related = catalog.Products.Where(p => p.CategoryId == product.CategoryId && p.Id != product.Id)
            .OrderByDescending(p => p.SoldCount).ThenBy(p => p.SortOrder).Take(8).Select(catalog.Card).ToList();
        var allCategories = await categories.QueryNoTracking().IgnoreQueryFilters().ToDictionaryAsync(c => c.Id, ct);
        var category = allCategories.GetValueOrDefault(product.CategoryId);

        // BR-23: sản phẩm ẩn (hoặc danh mục ẩn, đã xóa) → "Sản phẩm ngừng kinh doanh" kèm sản phẩm liên quan.
        if (!catalog.Products.Any(p => p.Id == product.Id))
        {
            return new PublicProductLookup
            {
                Discontinued = new PublicDiscontinued
                {
                    Name = product.Name,
                    Slug = product.Slug,
                    CategoryName = category?.Name ?? string.Empty,
                    CategorySlug = category?.Slug ?? string.Empty,
                    CoverUrl = Cover(product)
                },
                Related = related
            };
        }

        var card = catalog.Card(product);
        var sortedVariants = product.Variants.OrderBy(v => v.SortOrder).ToList();
        var detail = new PublicProductDetail
        {
            Id = card.Id,
            Code = card.Code,
            Slug = card.Slug,
            Name = card.Name,
            CategorySlug = card.CategorySlug,
            CategoryName = card.CategoryName,
            Price = card.Price,
            ListPrice = card.ListPrice,
            DiscountPercent = card.DiscountPercent,
            CoverUrl = card.CoverUrl,
            HoverUrl = card.HoverUrl,
            Colors = card.Colors,
            IsOutOfStock = card.IsOutOfStock,
            SoldCount = card.SoldCount,
            IsFeatured = card.IsFeatured,
            CreatedAt = card.CreatedAt,
            Description = product.Description,
            SizeChart = SalesMappings.ParseSizeChart(product.SizeChartJson),
            Images = product.Images.OrderBy(i => i.SortOrder).Select(i => new PublicProductImage
            {
                Url = i.Url,
                ColorCode = i.ColorId is { } cid && catalog.Colors.TryGetValue(cid, out var c) ? c.Code : null,
                IsCover = i.IsCover
            }).ToList(),
            Sizes = sortedVariants.OrderBy(v => v.SortOrder % 100).Select(v => v.Size).OfType<string>().Distinct().ToList(),
            Variants = sortedVariants.Where(v => v.IsActive && catalog.Colors.ContainsKey(v.ColorId)).Select(v => new PublicVariant
            {
                Id = v.Id,
                Sku = v.Sku,
                ColorCode = catalog.Colors[v.ColorId].Code,
                Size = v.Size,
                Stock = v.Stock,
                StockStatus = SalesMappings.StockStatusOf(v.Stock)
            }).ToList(),
            Related = related
        };
        return new PublicProductLookup { Product = detail, Related = related };
    }

    // ---------------------------------------------------------------- Nạp danh mục đang bán

    private sealed record Catalog(List<Product> Products, Dictionary<Guid, Category> Categories, Dictionary<Guid, Color> Colors)
    {
        public IReadOnlyList<PublicCategory> PublicCategories() =>
            Categories.Values.OrderBy(c => c.SortOrder)
                .Select(c => c.ToPublic(Products.Count(p => p.CategoryId == c.Id)))
                .Where(c => c.ProductCount > 0)
                .ToList();

        public PublicProductCard Card(Product p)
        {
            var category = Categories.GetValueOrDefault(p.CategoryId);
            var active = p.Variants.Where(v => v.IsActive).OrderBy(v => v.SortOrder).ToList();
            var images = p.Images.OrderBy(i => i.SortOrder).ToList();
            return new PublicProductCard
            {
                Id = p.Id,
                Code = p.Code,
                Slug = p.Slug,
                Name = p.Name,
                CategorySlug = category?.Slug ?? string.Empty,
                CategoryName = category?.Name ?? string.Empty,
                Price = p.Price,
                ListPrice = p.ListPrice,
                DiscountPercent = SalesMappings.DiscountPercent(p.Price, p.ListPrice),
                CoverUrl = Cover(p),
                HoverUrl = images.FirstOrDefault(i => i.Url != Cover(p))?.Url,
                Colors = active.Select(v => v.ColorId).Distinct().Where(Colors.ContainsKey).Select(id => Colors[id].ToPublic()).ToList(),
                IsOutOfStock = active.All(v => v.Stock <= 0),
                SoldCount = p.SoldCount,
                IsFeatured = p.IsFeatured,
                CreatedAt = p.CreatedAt
            };
        }
    }

    /// <summary>Sản phẩm đang bán (chưa ẩn, danh mục đang hiển thị) theo <c>sortOrder</c>.</summary>
    private async Task<Catalog> LoadAsync(CancellationToken ct)
    {
        var visible = await categories.QueryNoTracking().Where(c => c.IsVisible).ToDictionaryAsync(c => c.Id, ct);
        var visibleIds = visible.Keys.ToList();
        var list = await products.QueryNoTracking().Include(p => p.Images).Include(p => p.Variants).AsSplitQuery()
            .Where(p => !p.IsHidden && visibleIds.Contains(p.CategoryId))
            .OrderBy(p => p.SortOrder)
            .ToListAsync(ct);
        var colorMap = await colors.QueryNoTracking().ToDictionaryAsync(c => c.Id, ct);
        return new Catalog(list, visible, colorMap);
    }

    private static string? Cover(Product p) => (p.Images.FirstOrDefault(i => i.IsCover) ?? p.Images.MinBy(i => i.SortOrder))?.Url;

    private static int SizeRank(string size)
    {
        var i = Array.IndexOf(SizeOrder, size);
        return i < 0 ? 100 : i;
    }

    private static IEnumerable<string> Split(string? value) =>
        string.IsNullOrWhiteSpace(value) ? [] : value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}
