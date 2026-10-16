using API.Base;
using API.Filters;
using Application.Common.Models;
using Application.Constants;
using Application.DTOs.Catalog;
using Application.DTOs.Uploads;
using Application.Interfaces.Services.Catalog;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Catalog;

/// <summary>Danh mục hành chính 34 tỉnh/thành kèm phường/xã (07 §2.1). Công khai.</summary>
[Route("api/provinces")]
[AllowAnonymous]
public sealed class ProvincesController(IProvinceService service) : BaseApiController
{
    [HttpGet]
    [PublicRateLimit(Application.Interfaces.Services.Storefront.PublicRatePolicies.Read)]
    public async Task<ActionResult<IReadOnlyList<ProvinceDto>>> GetAll(CancellationToken ct) => Ok(await service.GetAllAsync(ct));
}

/// <summary>Danh mục sản phẩm (07 §2.3, FR-16).</summary>
[Route("api/categories")]
public sealed class CategoriesController(ICategoryService service) : BaseApiController
{
    [HttpGet]
    [AuthorizePermission(ProjectPermissions.Products.View)]
    public async Task<ActionResult<IReadOnlyList<CategoryDto>>> GetAll(CancellationToken ct) => Ok(await service.GetAllAsync(ct));

    [HttpPost]
    [AuthorizePermission(ProjectPermissions.Products.Create)]
    public async Task<ActionResult<CategoryDto>> Create(SaveCategoryRequest request, CancellationToken ct)
    {
        var created = await service.CreateAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, created);
    }

    [HttpPut("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Products.Update)]
    public async Task<ActionResult<CategoryDto>> Update(Guid id, SaveCategoryRequest request, CancellationToken ct) =>
        Ok(await service.UpdateAsync(id, request, ct));

    [HttpPatch("{id:guid}/visibility")]
    [AuthorizePermission(ProjectPermissions.Products.Update)]
    public async Task<IActionResult> SetVisibility(Guid id, VisibilityRequest request, CancellationToken ct)
    {
        await service.SetVisibilityAsync(id, request.IsVisible, ct);
        return NoContent();
    }

    [HttpPut("order")]
    [AuthorizePermission(ProjectPermissions.Products.Update)]
    public async Task<IActionResult> Reorder(ReorderRequest request, CancellationToken ct)
    {
        await service.ReorderAsync(request.Ids, ct);
        return NoContent();
    }

    /// <summary>Còn sản phẩm → 400 <c>DanhMucConSanPham</c> kèm <c>productCount</c>.</summary>
    [HttpDelete("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Products.Delete)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return NoContent();
    }
}

/// <summary>Màu dùng chung (07 §2.3); không đổi mã.</summary>
[Route("api/colors")]
public sealed class ColorsController(IColorService service) : BaseApiController
{
    [HttpGet]
    [AuthorizePermission(ProjectPermissions.Products.View)]
    public async Task<ActionResult<IReadOnlyList<ColorDto>>> GetAll(CancellationToken ct) => Ok(await service.GetAllAsync(ct));

    [HttpPost]
    [AuthorizePermission(ProjectPermissions.Products.Create)]
    public async Task<ActionResult<ColorDto>> Create(SaveColorRequest request, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, await service.CreateAsync(request, ct));

    [HttpPut("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Products.Update)]
    public async Task<ActionResult<ColorDto>> Update(Guid id, SaveColorRequest request, CancellationToken ct) =>
        Ok(await service.UpdateAsync(id, request, ct));
}

/// <summary>Sản phẩm, biến thể, tồn kho (07 §2.4, FR-17…FR-20).</summary>
[Route("api/products")]
public sealed class ProductsController(IProductService service) : BaseApiController
{
    [HttpGet]
    [AuthorizePermission(ProjectPermissions.Products.View)]
    public async Task<ActionResult<PaginatedResult<ProductListItem>>> GetPaged([FromQuery] ProductQuery query, CancellationToken ct) =>
        Ok(await service.GetPagedAsync(query, ct));

    [HttpGet("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Products.View)]
    public async Task<ActionResult<ProductDto>> Get(Guid id, CancellationToken ct) => Ok(await service.GetByIdAsync(id, ct));

    [HttpPost]
    [AuthorizePermission(ProjectPermissions.Products.Create)]
    public async Task<ActionResult<ProductDto>> Create(SaveProductRequest request, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, await service.CreateAsync(request, ct));

    [HttpPut("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Products.Update)]
    public async Task<ActionResult<ProductDto>> Update(Guid id, SaveProductRequest request, CancellationToken ct) =>
        Ok(await service.UpdateAsync(id, request, ct));

    [HttpPatch("{id:guid}/hidden")]
    [AuthorizePermission(ProjectPermissions.Products.Update)]
    public async Task<IActionResult> SetHidden(Guid id, HiddenRequest request, CancellationToken ct)
    {
        await service.SetHiddenAsync(id, request.IsHidden, ct);
        return NoContent();
    }

    /// <summary>Đã có trong đơn → 400 <c>SanPhamDaCoTrongDon</c> (TC-23).</summary>
    [HttpDelete("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Products.Delete)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return NoContent();
    }

    /// <summary>Tải ảnh sản phẩm (multipart <c>file</c>, JPG/PNG/WebP ≤ 2 MB).</summary>
    [HttpPost("images")]
    [AuthorizePermission(ProjectPermissions.Products.Create, ProjectPermissions.Products.Update)]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(UploadLimits.MaxImageRequestBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = UploadLimits.MaxImageRequestBytes)]
    public async Task<ActionResult<UploadedImage>> UploadImage(IFormFile? file, CancellationToken ct)
    {
        await using var content = file?.OpenReadStream() ?? Stream.Null;
        var image = await service.UploadImageAsync(content, file?.Length ?? 0, ct);
        return Created(image.Url, image);
    }

    [HttpPost("{id:guid}/variants/{variantId:guid}/stock-adjustments")]
    [AuthorizePermission(ProjectPermissions.Products.AdjustStock)]
    public async Task<ActionResult<ProductVariantDto>> AdjustStock(Guid id, Guid variantId, StockAdjustmentRequest request, CancellationToken ct) =>
        Ok(await service.AdjustStockAsync(id, variantId, request, ct));

    [HttpGet("{id:guid}/stock-adjustments")]
    [AuthorizePermission(ProjectPermissions.Products.View)]
    public async Task<ActionResult<IReadOnlyList<StockAdjustmentDto>>> StockAdjustments(Guid id, CancellationToken ct) =>
        Ok(await service.GetStockAdjustmentsAsync(id, ct));
}
