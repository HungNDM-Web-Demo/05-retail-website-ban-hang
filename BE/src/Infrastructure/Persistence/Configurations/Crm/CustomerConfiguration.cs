using Domain.Entities.Crm.Customers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations.Crm;

/// <summary>Hồ sơ khách theo số điện thoại (06 §4 <c>Crm_Customers</c>).</summary>
public sealed class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> builder)
    {
        builder.ToTable("Crm_Customers");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Phone).HasMaxLength(Customer.PhoneMaxLength).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(Customer.NameMaxLength).IsRequired();
        builder.Property(x => x.Email).HasMaxLength(Customer.EmailMaxLength);
        builder.Property(x => x.ProvinceCode).HasMaxLength(Customer.CodeMaxLength).IsRequired();
        builder.Property(x => x.WardCode).HasMaxLength(Customer.CodeMaxLength).IsRequired();
        builder.Property(x => x.AddressLine).HasMaxLength(Customer.AddressMaxLength).IsRequired();
        builder.Property(x => x.Note).HasMaxLength(Customer.NoteMaxLength);
        builder.Property(x => x.TotalSpent).HasPrecision(18, 2);
        builder.Ignore(x => x.Tags);

        builder.HasIndex(x => x.Phone).IsUnique();
        builder.HasIndex(x => x.TotalSpent);
        builder.HasIndex(x => x.LastOrderAt);
    }
}
