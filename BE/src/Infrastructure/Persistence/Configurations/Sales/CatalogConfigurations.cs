using Domain.Entities.Sales.Catalog;
using Domain.Entities.Sales.Coupons;
using Domain.Entities.Sales.Locations;
using Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations.Sales;

// Danh mục hành chính, danh mục, màu, sản phẩm, ảnh, biến thể, điều chỉnh tồn, mã giảm giá (06 §4).
// Id sinh ở code nên khai báo ValueGeneratedNever để EF coi bản ghi con mới thêm qua navigation là Added.

public sealed class ProvinceConfiguration : IEntityTypeConfiguration<Province>
{
    public void Configure(EntityTypeBuilder<Province> builder)
    {
        builder.ToTable("Sales_Provinces");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Code).HasMaxLength(Province.CodeMaxLength).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(Province.NameMaxLength).IsRequired();
        builder.HasIndex(x => x.Code).IsUnique();

        builder.HasMany(x => x.Wards)
            .WithOne()
            .HasForeignKey(x => x.ProvinceId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class WardConfiguration : IEntityTypeConfiguration<Ward>
{
    public void Configure(EntityTypeBuilder<Ward> builder)
    {
        builder.ToTable("Sales_Wards");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Code).HasMaxLength(Ward.CodeMaxLength).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(Ward.NameMaxLength).IsRequired();
        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasIndex(x => x.ProvinceId);
    }
}

public sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.ToTable("Sales_Categories");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Code).HasMaxLength(Category.CodeMaxLength).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(Category.NameMaxLength).IsRequired();
        builder.Property(x => x.Slug).HasMaxLength(Category.SlugMaxLength).IsRequired();
        builder.Property(x => x.ImageUrl).HasMaxLength(Category.ImageUrlMaxLength);
        builder.Property(x => x.Color).HasMaxLength(Category.ColorMaxLength).IsRequired();
        builder.HasIndex(x => x.Code).IsUnique().WhereNotDeleted();
        builder.HasIndex(x => x.Slug).IsUnique().WhereNotDeleted();
    }
}

public sealed class ColorConfiguration : IEntityTypeConfiguration<Color>
{
    public void Configure(EntityTypeBuilder<Color> builder)
    {
        builder.ToTable("Sales_Colors");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Code).HasMaxLength(Color.CodeMaxLength).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(Color.NameMaxLength).IsRequired();
        builder.Property(x => x.Hex).HasMaxLength(Color.HexMaxLength).IsRequired();
        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasIndex(x => x.Name).IsUnique();
    }
}

public sealed class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.ToTable("Sales_Products");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Code).HasMaxLength(Product.CodeMaxLength).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(Product.NameMaxLength).IsRequired();
        builder.Property(x => x.Slug).HasMaxLength(Product.SlugMaxLength).IsRequired();
        builder.Property(x => x.NameSearch).HasMaxLength(Product.NameSearchMaxLength).IsRequired();
        builder.Property(x => x.Price).HasPrecision(18, 2);
        builder.Property(x => x.ListPrice).HasPrecision(18, 2);
        builder.Property(x => x.Description);
        builder.Property(x => x.SizeChartJson);
        builder.Ignore(x => x.Status);

        builder.HasIndex(x => x.Code).IsUnique().WhereNotDeleted();
        builder.HasIndex(x => x.Slug).IsUnique().WhereNotDeleted();
        builder.HasIndex(x => x.NameSearch);
        builder.HasIndex(x => new { x.IsHidden, x.CategoryId });
        builder.HasIndex(x => x.CategoryId);

        builder.HasOne<Category>()
            .WithMany()
            .HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(x => x.Images)
            .WithOne()
            .HasForeignKey(x => x.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(x => x.Variants)
            .WithOne()
            .HasForeignKey(x => x.ProductId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ProductImageConfiguration : IEntityTypeConfiguration<ProductImage>
{
    public void Configure(EntityTypeBuilder<ProductImage> builder)
    {
        builder.ToTable("Sales_ProductImages");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Url).HasMaxLength(ProductImage.UrlMaxLength).IsRequired();
        builder.HasIndex(x => x.ProductId);

        builder.HasOne<Color>()
            .WithMany()
            .HasForeignKey(x => x.ColorId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ProductVariantConfiguration : IEntityTypeConfiguration<ProductVariant>
{
    public void Configure(EntityTypeBuilder<ProductVariant> builder)
    {
        // BR-13: tồn không âm; service trừ bằng câu cập nhật có điều kiện, CHECK là lớp bảo vệ cuối.
        builder.ToTable("Sales_ProductVariants", t => t.HasCheckConstraint("CK_Sales_ProductVariants_Stock", "\"Stock\" >= 0"));
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Size).HasMaxLength(ProductVariant.SizeMaxLength);
        builder.Property(x => x.Sku).HasMaxLength(ProductVariant.SkuMaxLength).IsRequired();
        builder.HasIndex(x => x.Sku).IsUnique();
        builder.HasIndex(x => new { x.ProductId, x.ColorId, x.Size }).IsUnique();
        builder.HasIndex(x => x.ColorId);

        builder.HasOne<Color>()
            .WithMany()
            .HasForeignKey(x => x.ColorId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class StockAdjustmentConfiguration : IEntityTypeConfiguration<StockAdjustment>
{
    public void Configure(EntityTypeBuilder<StockAdjustment> builder)
    {
        builder.ToTable("Sales_StockAdjustments", t => t.HasCheckConstraint("CK_Sales_StockAdjustments_After", "\"After\" >= 0"));
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Note).HasMaxLength(StockAdjustment.NoteMaxLength);
        builder.Property(x => x.ByName).HasMaxLength(StockAdjustment.ByNameMaxLength).IsRequired();
        builder.HasIndex(x => x.VariantId);
        builder.HasIndex(x => x.ProductId);

        builder.HasOne<ProductVariant>()
            .WithMany()
            .HasForeignKey(x => x.VariantId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<Product>()
            .WithMany()
            .HasForeignKey(x => x.ProductId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class CouponConfiguration : IEntityTypeConfiguration<Coupon>
{
    public void Configure(EntityTypeBuilder<Coupon> builder)
    {
        builder.ToTable("Sales_Coupons");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Code).HasMaxLength(Coupon.CodeMaxLength).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(Coupon.NameMaxLength).IsRequired();
        builder.Property(x => x.Value).HasPrecision(18, 2);
        builder.Property(x => x.MaxDiscount).HasPrecision(18, 2);
        builder.Property(x => x.MinOrder).HasPrecision(18, 2);
        builder.HasIndex(x => x.Code).IsUnique().WhereNotDeleted();

        builder.HasOne<Category>()
            .WithMany()
            .HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
