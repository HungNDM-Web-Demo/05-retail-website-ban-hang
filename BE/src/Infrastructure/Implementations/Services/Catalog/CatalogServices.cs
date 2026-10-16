using Application.Common.Exceptions;
using Application.Common.Models;
using Application.DTOs.Catalog;
using Application.DTOs.Uploads;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Catalog;
using Application.Interfaces.Services.Common;
using Application.Interfaces.Services.Uploads;
using Application.Mappings.Sales;
using Domain.Entities.Sales;
using Domain.Entities.Sales.Catalog;
using Domain.Entities.Sales.Locations;
using Domain.Entities.Sales.Orders;
using Domain.Entities.System.Users;
using Domain.Enums.Sales.Catalog;
using FluentValidation;
using FluentValidation.Results;
using Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Catalog;

/// <summary>34 tỉnh/thành kèm phường/xã (07 §2.1).</summary>
public sealed class ProvinceService(IGenericRepository<Province> provinces) : IProvinceService
{
    public async Task<IReadOnlyList<ProvinceDto>> GetAllAsync(CancellationToken ct = default)
    {
        var list = await provinces.QueryNoTracking().Include(p => p.Wards).OrderBy(p => p.SortOrder).ToListAsync(ct);
        return list.Select(p => new ProvinceDto
        {
            Code = p.Code,
            Name = p.Name,
            Zone = p.Zone,
            Wards = p.Wards.OrderBy(w => w.Code, StringComparer.Ordinal).Select(w => new WardDto { Code = w.Code, Name = w.Name }).ToList()
        }).ToList();
    }
}

/// <summary>Danh mục (07 §2.3, FR-16).</summary>
public sealed class CategoryService(
    IGenericRepository<Category> categories,
    IGenericRepository<Product> products,
    IUnitOfWork unitOfWork) : ICategoryService
{
    public async Task<IReadOnlyList<CategoryDto>> GetAllAsync(CancellationToken ct = default)
    {
        var counts = await products.QueryNoTracking().GroupBy(p => p.CategoryId)
            .Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count, ct);
        var list = await categories.QueryNoTracking().OrderBy(c => c.SortOrder).ThenBy(c => c.Name).ToListAsync(ct);
        return list.Select(c => c.ToDto(counts.GetValueOrDefault(c.Id))).ToList();
    }

    public async Task<CategoryDto> CreateAsync(SaveCategoryRequest request, CancellationToken ct = default)
    {
        var (code, slug) = await CheckUniqueAsync(request, null, ct);
        var maxSort = await categories.QueryNoTracking().MaxAsync(c => (int?)c.SortOrder, ct) ?? 0;
        var category = Category.Create(code, request.Name, slug, request.ImageUrl, request.Color, request.IsVisible, maxSort + 10);
        await categories.AddAsync(category, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return category.ToDto(0);
    }

    public async Task<CategoryDto> UpdateAsync(Guid id, SaveCategoryRequest request, CancellationToken ct = default)
    {
        var category = await categories.Query().FirstOrDefaultAsync(c => c.Id == id, ct) ?? throw SalesProblems.CategoryNotFound();
        var (code, slug) = await CheckUniqueAsync(request, id, ct);
        category.Update(code, request.Name, slug, request.ImageUrl, request.Color, request.IsVisible);
        await unitOfWork.SaveChangesAsync(ct);
        return category.ToDto(await products.QueryNoTracking().CountAsync(p => p.CategoryId == id, ct));
    }

    public async Task SetVisibilityAsync(Guid id, bool isVisible, CancellationToken ct = default)
    {
        var category = await categories.Query().FirstOrDefaultAsync(c => c.Id == id, ct) ?? throw SalesProblems.CategoryNotFound();
        category.SetVisible(isVisible);
        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task ReorderAsync(IReadOnlyList<Guid> ids, CancellationToken ct = default)
    {
        var all = await categories.Query().ToListAsync(ct);
        if (ids.Count != all.Count || ids.Distinct().Count() != all.Count || all.Any(c => !ids.Contains(c.Id)))
            throw new ValidationException([new ValidationFailure("ids", "Danh sách phải gồm đủ mọi danh mục")]);
        for (var i = 0; i < ids.Count; i++)
            all.First(c => c.Id == ids[i]).SetSortOrder((i + 1) * 10);
        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var category = await categories.Query().FirstOrDefaultAsync(c => c.Id == id, ct) ?? throw SalesProblems.CategoryNotFound();
        var count = await products.QueryNoTracking().CountAsync(p => p.CategoryId == id, ct);
        if (count > 0)
            throw SalesErrors.Business(SalesErrors.DanhMucConSanPham, SalesErrors.CategoryHasProductsMessage(count),
                new Dictionary<string, object?> { ["productCount"] = count });
        categories.Delete(category);
        await unitOfWork.SaveChangesAsync(ct);
    }

    private async Task<(string Code, string Slug)> CheckUniqueAsync(SaveCategoryRequest request, Guid? id, CancellationToken ct)
    {
        var code = request.Code.Trim().ToUpperInvariant();
        if (await categories.AnyAsync(c => c.Code == code && c.Id != id, ct))
            throw new ConflictException("Mã danh mục đã tồn tại", "code");
        var slug = string.IsNullOrWhiteSpace(request.Slug) ? SalesCodes.Slugify(request.Name) : SalesCodes.Slugify(request.Slug);
        if (string.IsNullOrWhiteSpace(request.Slug))
        {
            var baseSlug = slug;
            for (var n = 2; await categories.AnyAsync(c => c.Slug == slug && c.Id != id, ct); n++)
                slug = $"{baseSlug}-{n}";
        }
        else if (await categories.AnyAsync(c => c.Slug == slug && c.Id != id, ct))
        {
            throw new ConflictException("Đường dẫn đã được dùng", "slug");
        }

        return (code, slug);
    }
}

/// <summary>Màu dùng chung (07 §2.3); không đổi mã (SKU đã sinh).</summary>
public sealed class ColorService(IGenericRepository<Color> colors, IUnitOfWork unitOfWork) : IColorService
{
    public async Task<IReadOnlyList<ColorDto>> GetAllAsync(CancellationToken ct = default) =>
        (await colors.QueryNoTracking().OrderBy(c => c.SortOrder).ThenBy(c => c.Name).ToListAsync(ct)).Select(c => c.ToDto()).ToList();

    public async Task<ColorDto> CreateAsync(SaveColorRequest request, CancellationToken ct = default)
    {
        var code = request.Code.Trim().ToUpperInvariant();
        var name = request.Name.Trim();
        if (await colors.AnyAsync(c => c.Code == code, ct))
            throw new ConflictException("Mã màu đã tồn tại", "code");
        if (await colors.AnyAsync(c => c.Name == name, ct))
            throw new ConflictException("Tên màu đã tồn tại", "name");
        var maxSort = await colors.QueryNoTracking().MaxAsync(c => (int?)c.SortOrder, ct) ?? 0;
        var color = Color.Create(code, name, request.Hex, maxSort + 10);
        await colors.AddAsync(color, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return color.ToDto();
    }

    public async Task<ColorDto> UpdateAsync(Guid id, SaveColorRequest request, CancellationToken ct = default)
    {
        var color = await colors.Query().FirstOrDefaultAsync(c => c.Id == id, ct) ?? throw new NotFoundException("Không tìm thấy màu");
        var name = request.Name.Trim();
        if (await colors.AnyAsync(c => c.Name == name && c.Id != id, ct))
            throw new ConflictException("Tên màu đã tồn tại", "name");
        color.Update(name, request.Hex);
        await unitOfWork.SaveChangesAsync(ct);
        return color.ToDto();
    }
}

/// <summary>Sản phẩm, lưới biến thể (07 §3.12), ảnh, điều chỉnh tồn (FR-17…FR-20, BR-23, BR-24, BR-27).</summary>
public sealed class ProductService(
    IGenericRepository<Product> products,
    IGenericRepository<ProductVariant> variants,
    IGenericRepository<ProductImage> images,
    IGenericRepository<Category> categories,
    IGenericRepository<Color> colors,
    IGenericRepository<OrderLine> orderLines,
    IGenericRepository<StockAdjustment> adjustments,
    IGenericRepository<User> users,
    IImageInspector imageInspector,
    IFileStorage fileStorage,
    ICurrentUserService currentUser,
    IUnitOfWork unitOfWork,
    TimeProvider time) : IProductService
{
    public async Task<PaginatedResult<ProductListItem>> GetPagedAsync(ProductQuery query, CancellationToken ct = default)
    {
        var q = products.QueryNoTracking();
        if (query.CategoryId is { } categoryId)
            q = q.Where(p => p.CategoryId == categoryId);
        if (query.Status is { } status)
            q = q.Where(p => p.IsHidden == (status == ProductStatus.An));
        if (query.GetSearchTerm() is { } term)
        {
            var pattern = LikePattern.Contains(SalesCodes.SearchText(term));
            q = q.Where(p => AppDbFunctions.Matches(p.NameSearch, pattern));
        }

        var low = SalesRules.LowStockMax;
        switch (query.StockStatus)
        {
            case StockStatus.HetHang:
                q = q.Where(p => !p.Variants.Any(v => v.IsActive && v.Stock > 0));
                break;
            case StockStatus.SapHet:
                q = q.Where(p => p.Variants.Any(v => v.IsActive && v.Stock > 0) && p.Variants.Any(v => v.IsActive && v.Stock <= low));
                break;
            case StockStatus.ConHang:
                q = q.Where(p => p.Variants.Any(v => v.IsActive) && !p.Variants.Any(v => v.IsActive && v.Stock <= low));
                break;
        }

        var sortBy = string.IsNullOrWhiteSpace(query.SortBy) ? "sortOrder" : query.SortBy.Trim().ToLowerInvariant();
        var desc = string.IsNullOrWhiteSpace(query.SortDir) ? sortBy != "sortorder" && sortBy != "name" && sortBy != "code" : query.IsDescending();
        IOrderedQueryable<Product> ordered = sortBy switch
        {
            "name" => desc ? q.OrderByDescending(p => p.Name) : q.OrderBy(p => p.Name),
            "code" => desc ? q.OrderByDescending(p => p.Code) : q.OrderBy(p => p.Code),
            "price" => desc ? q.OrderByDescending(p => p.Price) : q.OrderBy(p => p.Price),
            "soldcount" => desc ? q.OrderByDescending(p => p.SoldCount) : q.OrderBy(p => p.SoldCount),
            "createdat" => desc ? q.OrderByDescending(p => p.CreatedAt) : q.OrderBy(p => p.CreatedAt),
            "totalstock" => desc
                ? q.OrderByDescending(p => p.Variants.Where(v => v.IsActive).Sum(v => v.Stock))
                : q.OrderBy(p => p.Variants.Where(v => v.IsActive).Sum(v => v.Stock)),
            _ => desc ? q.OrderByDescending(p => p.SortOrder) : q.OrderBy(p => p.SortOrder)
        };

        var page = await ordered.ThenBy(p => p.Code).Include(p => p.Variants).Include(p => p.Images).AsSplitQuery()
            .ToPaginatedResultAsync(query, ct);
        var categoryNames = await CategoryNamesAsync(ct);
        return page.Map(items => items.Select(p => ToListItem(p, categoryNames)).ToList());
    }

    public async Task<ProductDto> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var product = await products.QueryNoTracking().Include(p => p.Variants).Include(p => p.Images).AsSplitQuery()
            .FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw SalesProblems.ProductNotFound();
        return await ToDtoAsync(product, ct);
    }

    public Task<ProductDto> CreateAsync(SaveProductRequest request, CancellationToken ct = default) => SaveAsync(null, request, ct);

    public Task<ProductDto> UpdateAsync(Guid id, SaveProductRequest request, CancellationToken ct = default) => SaveAsync(id, request, ct);

    public async Task SetHiddenAsync(Guid id, bool isHidden, CancellationToken ct = default)
    {
        var product = await products.Query().FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw SalesProblems.ProductNotFound();
        product.SetHidden(isHidden);
        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var product = await products.Query().FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw SalesProblems.ProductNotFound();
        if (await orderLines.AnyAsync(l => l.ProductId == id, ct))
            throw SalesErrors.Business(SalesErrors.SanPhamDaCoTrongDon, SalesErrors.ProductOrderedMessage);
        products.Delete(product);
        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task<UploadedImage> UploadImageAsync(Stream content, long sizeBytes, CancellationToken ct = default)
    {
        if (sizeBytes <= 0)
            throw FileError("Chưa chọn file ảnh.");
        if (sizeBytes > Application.Constants.UploadLimits.MaxImageBytes)
            throw FileError("Ảnh tối đa 2 MB.");

        using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, ct);
        if (buffer.Length > Application.Constants.UploadLimits.MaxImageBytes)
            throw FileError("Ảnh tối đa 2 MB.");
        var image = imageInspector.Inspect(buffer.GetBuffer().AsSpan(0, (int)buffer.Length));
        if (image is null || image.Format == ImageFormat.Svg)
            throw FileError("Chỉ nhận ảnh JPG, PNG hoặc WebP.");

        buffer.Position = 0;
        var url = await fileStorage.SaveAsync(buffer, "products", image.Extension, ct);
        return new UploadedImage { Url = url, Width = image.Width, Height = image.Height, SizeBytes = buffer.Length };
    }

    public async Task<ProductVariantDto> AdjustStockAsync(Guid productId, Guid variantId, StockAdjustmentRequest request, CancellationToken ct = default)
    {
        var variant = await variants.Query().FirstOrDefaultAsync(v => v.Id == variantId && v.ProductId == productId, ct)
            ?? throw new NotFoundException("Không tìm thấy biến thể");
        if (!await products.AnyAsync(p => p.Id == productId, ct))
            throw SalesProblems.ProductNotFound();

        var userId = currentUser.UserId;
        var byName = userId is null
            ? currentUser.Username ?? "Nhân viên"
            : await users.QueryNoTracking().IgnoreQueryFilters().Where(u => u.Id == userId).Select(u => u.FullName).FirstOrDefaultAsync(ct)
              ?? currentUser.Username ?? "Nhân viên";
        var before = variant.Stock;
        variant.SetStock(request.NewStock!.Value);
        await adjustments.AddAsync(StockAdjustment.Create(variant.Id, productId, before, variant.Stock, request.Reason!.Value, request.Note,
            userId, byName, time.GetUtcNow().UtcDateTime), ct);
        await unitOfWork.SaveChangesAsync(ct);

        var color = await colors.QueryNoTracking().FirstAsync(c => c.Id == variant.ColorId, ct);
        return variant.ToDto(color, await orderLines.AnyAsync(l => l.VariantId == variant.Id, ct));
    }

    public async Task<IReadOnlyList<StockAdjustmentDto>> GetStockAdjustmentsAsync(Guid productId, CancellationToken ct = default)
    {
        var product = await products.QueryNoTracking().IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == productId, ct)
            ?? throw SalesProblems.ProductNotFound();
        var list = await adjustments.QueryNoTracking().Where(a => a.ProductId == productId).OrderByDescending(a => a.At).ToListAsync(ct);
        var variantIds = list.Select(a => a.VariantId).Distinct().ToList();
        var variantMap = await variants.QueryNoTracking().Where(v => variantIds.Contains(v.Id)).ToDictionaryAsync(v => v.Id, ct);
        var colorMap = await colors.QueryNoTracking().ToDictionaryAsync(c => c.Id, c => c.Name, ct);
        return list.Where(a => variantMap.ContainsKey(a.VariantId))
            .Select(a => a.ToDto(variantMap[a.VariantId], product.Name, colorMap.GetValueOrDefault(variantMap[a.VariantId].ColorId, string.Empty)))
            .ToList();
    }

    /// <summary>Lưu sản phẩm và lưới biến thể theo 07 §2.4, §3.12.</summary>
    private async Task<ProductDto> SaveAsync(Guid? id, SaveProductRequest request, CancellationToken ct)
    {
        var code = request.Code.Trim().ToUpperInvariant();
        var colorMap = await colors.QueryNoTracking().ToDictionaryAsync(c => c.Id, ct);
        if (!await categories.AnyAsync(c => c.Id == request.CategoryId, ct))
            throw new ValidationException([new ValidationFailure("categoryId", "Chọn danh mục")]);
        if (request.ColorIds.Any(c => !colorMap.ContainsKey(c)))
            throw new ValidationException([new ValidationFailure("colorIds", "Màu không tồn tại")]);

        // Lưới = colorIds × sizes (không size: một biến thể mỗi màu); variants phải đúng lưới.
        var sizes = request.Sizes.Select(s => s.Trim()).Where(s => s.Length > 0).Distinct().ToList();
        var colorIds = request.ColorIds.Distinct().ToList();
        var grid = colorIds.SelectMany((c, ci) => sizes.Count == 0
            ? Enumerable.Repeat((ColorId: c, Size: (string?)null, Sort: ci * 100), 1)
            : sizes.Select((s, si) => (ColorId: c, Size: (string?)s, Sort: ci * 100 + si))).ToList();
        var inputs = request.Variants.ToDictionary(v => (v.ColorId, string.IsNullOrWhiteSpace(v.Size) ? null : v.Size.Trim()), v => v);
        if (inputs.Count != grid.Count || grid.Any(g => !inputs.ContainsKey((g.ColorId, g.Size))))
            throw new ValidationException([new ValidationFailure("variants", "Lưới biến thể không khớp màu và size")]);
        if (inputs.Values.All(v => !v.IsActive))
            throw SalesErrors.Business(SalesErrors.CanItNhatMotBienThe, SalesErrors.NeedVariantMessage);

        Product? product = null;
        if (id is { } existingId)
        {
            product = await products.Query().Include(p => p.Variants).Include(p => p.Images).AsSplitQuery()
                .FirstOrDefaultAsync(p => p.Id == existingId, ct) ?? throw SalesProblems.ProductNotFound();
        }

        if (await products.AnyAsync(p => p.Code == code && p.Id != id, ct))
            throw new ConflictException("Mã sản phẩm đã tồn tại", "code");

        var ordered = product is null
            ? new HashSet<Guid>()
            : (await orderLines.QueryNoTracking().Where(l => l.ProductId == product.Id).Select(l => l.VariantId).Distinct().ToListAsync(ct)).ToHashSet();
        if (product is not null && product.Code != code && ordered.Count > 0)
            throw new ValidationException([new ValidationFailure("code", "Sản phẩm đã có trong đơn, không đổi mã được")]);

        // Slug (BR-24): trống thì tự sinh và thêm hậu tố; nhập tay mà trùng thì báo lỗi.
        string slug;
        if (string.IsNullOrWhiteSpace(request.Slug))
        {
            var baseSlug = SalesCodes.Slugify(request.Name);
            slug = baseSlug;
            for (var n = 2; await products.AnyAsync(p => p.Slug == slug && p.Id != id, ct); n++)
                slug = $"{baseSlug}-{n}";
        }
        else
        {
            slug = SalesCodes.Slugify(request.Slug);
            if (await products.AnyAsync(p => p.Slug == slug && p.Id != id, ct))
                throw new ConflictException("Đường dẫn đã được dùng", "slug");
        }

        var sizeChart = SalesMappings.SerializeSizeChart(request.SizeChart);
        if (product is null)
        {
            var maxSort = await products.QueryNoTracking().IgnoreQueryFilters().MaxAsync(p => (int?)p.SortOrder, ct) ?? 0;
            product = Product.Create(code, request.Name, slug, request.CategoryId, request.Price, request.ListPrice, request.Description,
                sizeChart, request.IsFeatured, request.IsHidden, maxSort + 10);
            await products.AddAsync(product, ct);
        }
        else
        {
            product.Update(code, request.Name, slug, request.CategoryId, request.Price, request.ListPrice, request.Description,
                sizeChart, request.IsFeatured, request.IsHidden);
        }

        // Biến thể cũ không còn trong lưới: chưa có trong đơn thì xóa cứng; đã có → 400 BienTheDaCoTrongDon.
        var removed = product.Variants.Where(v => !grid.Any(g => g.ColorId == v.ColorId && g.Size == v.Size)).ToList();
        var blocked = removed.Where(v => ordered.Contains(v.Id)).Select(v => v.Sku).ToList();
        if (blocked.Count > 0)
            throw SalesErrors.Business(SalesErrors.BienTheDaCoTrongDon, SalesErrors.VariantOrderedMessage(blocked[0]),
                new Dictionary<string, object?> { ["skus"] = blocked });
        foreach (var v in removed)
        {
            product.Variants.Remove(v);
            variants.Delete(v);
        }

        foreach (var g in grid)
        {
            var input = inputs[(g.ColorId, g.Size)];
            var sku = SalesCodes.Sku(code, colorMap[g.ColorId].Code, g.Size);
            var existing = product.Variants.FirstOrDefault(v => v.ColorId == g.ColorId && v.Size == g.Size);
            if (existing is not null)
            {
                existing.SetActive(input.IsActive);
                existing.SetSortOrder(g.Sort);
                existing.SetSku(sku);
                continue;
            }

            product.Variants.Add(ProductVariant.Create(product.Id, g.ColorId, g.Size, sku, input.InitialStock ?? 0, input.IsActive, g.Sort));
        }

        var skus = product.Variants.Select(v => v.Sku).ToList();
        var ownIds = product.Variants.Select(v => v.Id).ToList();
        var clash = await variants.QueryNoTracking().Where(v => skus.Contains(v.Sku) && !ownIds.Contains(v.Id))
            .Select(v => v.Sku).FirstOrDefaultAsync(ct);
        if (clash is not null)
            throw new ConflictException($"SKU {clash} đã tồn tại", "variants");

        // Ảnh: thay cả bộ theo thứ tự gửi lên; đúng một ảnh đại diện, không chọn thì ảnh đầu.
        foreach (var old in product.Images.ToList())
        {
            product.Images.Remove(old);
            images.Delete(old);
        }

        var coverIndex = Math.Max(0, request.Images.FindIndex(i => i.IsCover));
        for (var i = 0; i < request.Images.Count; i++)
        {
            var image = request.Images[i];
            var colorId = image.ColorId is { } cid && colorMap.ContainsKey(cid) ? cid : (Guid?)null;
            product.Images.Add(ProductImage.Create(product.Id, image.Url, colorId, i, i == coverIndex));
        }

        product.RefreshSearch(skus);
        await unitOfWork.SaveChangesAsync(ct);
        return await GetByIdAsync(product.Id, ct);
    }

    private async Task<Dictionary<Guid, string>> CategoryNamesAsync(CancellationToken ct) =>
        await categories.QueryNoTracking().IgnoreQueryFilters().ToDictionaryAsync(c => c.Id, c => c.Name, ct);

    private static ProductListItem ToListItem(Product p, IReadOnlyDictionary<Guid, string> categoryNames)
    {
        var active = p.Variants.Where(v => v.IsActive).Select(v => v.Stock).ToList();
        return new ProductListItem
        {
            Id = p.Id,
            Code = p.Code,
            Name = p.Name,
            Slug = p.Slug,
            CategoryId = p.CategoryId,
            CategoryName = categoryNames.GetValueOrDefault(p.CategoryId, string.Empty),
            Price = p.Price,
            ListPrice = p.ListPrice,
            CoverUrl = CoverOf(p),
            Status = p.Status,
            IsFeatured = p.IsFeatured,
            TotalStock = active.Sum(),
            VariantCount = p.Variants.Count,
            OutOfStockCount = active.Count(s => s <= 0),
            LowStockCount = active.Count(s => s is > 0 and <= SalesRules.LowStockMax),
            StockStatus = SalesMappings.ProductStockStatusOf(active),
            SoldCount = p.SoldCount,
            CreatedAt = p.CreatedAt
        };
    }

    private static string? CoverOf(Product p) =>
        (p.Images.FirstOrDefault(i => i.IsCover) ?? p.Images.MinBy(i => i.SortOrder))?.Url;

    private async Task<ProductDto> ToDtoAsync(Product p, CancellationToken ct)
    {
        var categoryNames = await CategoryNamesAsync(ct);
        var colorMap = await colors.QueryNoTracking().ToDictionaryAsync(c => c.Id, ct);
        var ordered = (await orderLines.QueryNoTracking().Where(l => l.ProductId == p.Id).Select(l => l.VariantId).Distinct().ToListAsync(ct))
            .ToHashSet();
        var item = ToListItem(p, categoryNames);
        var sortedVariants = p.Variants.OrderBy(v => v.SortOrder).ToList();
        return new ProductDto
        {
            Id = item.Id,
            Code = item.Code,
            Name = item.Name,
            Slug = item.Slug,
            CategoryId = item.CategoryId,
            CategoryName = item.CategoryName,
            Price = item.Price,
            ListPrice = item.ListPrice,
            CoverUrl = item.CoverUrl,
            Status = item.Status,
            IsFeatured = item.IsFeatured,
            TotalStock = item.TotalStock,
            VariantCount = item.VariantCount,
            OutOfStockCount = item.OutOfStockCount,
            LowStockCount = item.LowStockCount,
            StockStatus = item.StockStatus,
            SoldCount = item.SoldCount,
            CreatedAt = item.CreatedAt,
            Description = p.Description,
            SizeChart = SalesMappings.ParseSizeChart(p.SizeChartJson),
            ColorIds = sortedVariants.Select(v => v.ColorId).Distinct().ToList(),
            Sizes = sortedVariants.OrderBy(v => v.SortOrder % 100).Select(v => v.Size).OfType<string>().Distinct().ToList(),
            Images = p.Images.OrderBy(i => i.SortOrder).Select(i => i.ToDto()).ToList(),
            Variants = sortedVariants.Where(v => colorMap.ContainsKey(v.ColorId))
                .Select(v => v.ToDto(colorMap[v.ColorId], ordered.Contains(v.Id))).ToList(),
            EverOrdered = ordered.Count > 0,
            UpdatedAt = p.UpdatedAt
        };
    }

    private static ValidationException FileError(string message) => new([new ValidationFailure("file", message)]);
}
