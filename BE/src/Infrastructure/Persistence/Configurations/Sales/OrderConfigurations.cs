using Domain.Entities.Crm.Customers;
using Domain.Entities.Sales.Catalog;
using Domain.Entities.Sales.Coupons;
using Domain.Entities.Sales.Orders;
using Domain.Entities.System.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations.Sales;

// Đơn hàng, dòng đơn, dòng thời gian, vận đơn (06 §4). Không có navigation tới sản phẩm, biến thể (bảng xóa mềm) để đơn cũ
// không mất dòng khi sản phẩm bị xóa; tên, màu, size, giá đã được chụp vào dòng.

public sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable("Sales_Orders");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Code).HasMaxLength(Order.CodeMaxLength).IsRequired();
        builder.Property(x => x.TransactionRef).HasMaxLength(Order.RefMaxLength);
        builder.Property(x => x.RefundAmount).HasPrecision(18, 2);
        builder.Property(x => x.RefundRef).HasMaxLength(Order.RefMaxLength);
        builder.Property(x => x.RecipientName).HasMaxLength(Order.NameMaxLength).IsRequired();
        builder.Property(x => x.Phone).HasMaxLength(Order.PhoneMaxLength).IsRequired();
        builder.Property(x => x.Email).HasMaxLength(Order.EmailMaxLength);
        builder.Property(x => x.ProvinceCode).HasMaxLength(Order.CodeShortMaxLength).IsRequired();
        builder.Property(x => x.ProvinceName).HasMaxLength(Order.NameMaxLength).IsRequired();
        builder.Property(x => x.WardCode).HasMaxLength(Order.CodeShortMaxLength).IsRequired();
        builder.Property(x => x.WardName).HasMaxLength(Order.NameMaxLength).IsRequired();
        builder.Property(x => x.AddressLine).HasMaxLength(Order.AddressMaxLength).IsRequired();
        builder.Property(x => x.CustomerNote).HasMaxLength(Order.NoteMaxLength);
        builder.Property(x => x.Subtotal).HasPrecision(18, 2);
        builder.Property(x => x.Discount).HasPrecision(18, 2);
        builder.Property(x => x.ShippingFee).HasPrecision(18, 2);
        builder.Property(x => x.ShippingDiscount).HasPrecision(18, 2);
        builder.Property(x => x.Total).HasPrecision(18, 2);
        builder.Property(x => x.CouponCode).HasMaxLength(Order.CouponCodeMaxLength);
        builder.Property(x => x.CancelNote).HasMaxLength(Order.NoteMaxLength);
        builder.Property(x => x.CancelledByName).HasMaxLength(Order.UserNameMaxLength);
        builder.Property(x => x.ClientRequestId).HasMaxLength(Order.KeyMaxLength);
        builder.Property(x => x.DeviceId).HasMaxLength(Order.KeyMaxLength);
        builder.Ignore(x => x.CodAmount);
        builder.Ignore(x => x.ItemCount);
        builder.Ignore(x => x.IsPendingStatus);

        // 07 §3.6: mọi thay đổi tăng Version; tranh chấp lúc lưu xử lý như lệch version.
        builder.Property(x => x.Version).IsConcurrencyToken();

        builder.HasIndex(x => x.Code).IsUnique();
        // NFR-05: unique, cho phép nhiều null.
        builder.HasIndex(x => x.ClientRequestId).IsUnique();
        builder.HasIndex(x => x.CustomerId);
        builder.HasIndex(x => new { x.Status, x.PlacedAt });
        builder.HasIndex(x => x.PlacedAt);
        builder.HasIndex(x => x.PaymentDueAt);
        builder.HasIndex(x => x.Phone);
        builder.HasIndex(x => x.CouponId);

        builder.HasOne<Customer>()
            .WithMany()
            .HasForeignKey(x => x.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Coupon>()
            .WithMany()
            .HasForeignKey(x => x.CouponId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(x => x.Lines)
            .WithOne()
            .HasForeignKey(x => x.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(x => x.Events)
            .WithOne()
            .HasForeignKey(x => x.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.Shipment)
            .WithOne()
            .HasForeignKey<Shipment>(x => x.OrderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class OrderLineConfiguration : IEntityTypeConfiguration<OrderLine>
{
    public void Configure(EntityTypeBuilder<OrderLine> builder)
    {
        builder.ToTable("Sales_OrderLines", t => t.HasCheckConstraint("CK_Sales_OrderLines_Quantity", "\"Quantity\" >= 1 AND \"Quantity\" <= 10"));
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.ProductName).HasMaxLength(OrderLine.ProductNameMaxLength).IsRequired();
        builder.Property(x => x.Sku).HasMaxLength(OrderLine.SkuMaxLength).IsRequired();
        builder.Property(x => x.ColorName).HasMaxLength(OrderLine.ColorNameMaxLength).IsRequired();
        builder.Property(x => x.Size).HasMaxLength(OrderLine.SizeMaxLength);
        builder.Property(x => x.ImageUrl).HasMaxLength(OrderLine.ImageUrlMaxLength);
        builder.Property(x => x.UnitPrice).HasPrecision(18, 2);
        builder.Ignore(x => x.LineTotal);
        builder.HasIndex(x => x.OrderId);
        builder.HasIndex(x => x.VariantId);
        builder.HasIndex(x => x.ProductId);

        builder.HasOne<ProductVariant>()
            .WithMany()
            .HasForeignKey(x => x.VariantId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Product>()
            .WithMany()
            .HasForeignKey(x => x.ProductId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class OrderEventConfiguration : IEntityTypeConfiguration<OrderEvent>
{
    public void Configure(EntityTypeBuilder<OrderEvent> builder)
    {
        builder.ToTable("Sales_OrderEvents");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.ActorName).HasMaxLength(OrderEvent.ActorNameMaxLength).IsRequired();
        builder.Property(x => x.Content).HasMaxLength(OrderEvent.ContentMaxLength).IsRequired();
        builder.HasIndex(x => new { x.OrderId, x.At });

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(x => x.ActorId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ShipmentConfiguration : IEntityTypeConfiguration<Shipment>
{
    public void Configure(EntityTypeBuilder<Shipment> builder)
    {
        builder.ToTable("Sales_Shipments", t => t.HasCheckConstraint("CK_Sales_Shipments_Weight", "\"WeightGrams\" >= 50 AND \"WeightGrams\" <= 30000"));
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.TrackingCode).HasMaxLength(Shipment.TrackingCodeMaxLength).IsRequired();
        builder.Property(x => x.CodAmount).HasPrecision(18, 2);
        builder.Property(x => x.ShipperNote).HasMaxLength(Shipment.ShipperNoteMaxLength);
        builder.Property(x => x.HandedOverByName).HasMaxLength(Shipment.UserNameMaxLength).IsRequired();
        builder.Property(x => x.FailNote).HasMaxLength(Shipment.FailNoteMaxLength);
        builder.HasIndex(x => x.OrderId).IsUnique();
        builder.HasIndex(x => x.TrackingCode).IsUnique();
        builder.HasIndex(x => x.HandedOverAt);
        builder.HasIndex(x => x.DeliveredAt);
    }
}
