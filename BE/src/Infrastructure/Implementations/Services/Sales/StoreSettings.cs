using Application.Interfaces.Repositories;
using Domain.Entities.System.Settings;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Sales;

/// <summary>Thông tin cửa hàng lưu ở <c>System_Settings</c> nhóm "Thương hiệu", "Cửa hàng" (06 §3).</summary>
internal sealed record StoreSettings(
    string Name, string? Tagline, string LogoUrl, string PrimaryColor, string Hotline, string? Email, string Address,
    string WorkingHours, string BankBin, string BankAccount, string BankAccountName)
{
    public static async Task<StoreSettings> ReadAsync(IGenericRepository<Setting> settings, CancellationToken ct)
    {
        var values = await settings.QueryNoTracking()
            .Where(s => s.Key.StartsWith("Store.") || s.Key.StartsWith("Brand."))
            .ToDictionaryAsync(s => s.Key, s => s.Value, ct);
        string Get(string key, string fallback) => values.TryGetValue(key, out var v) && !string.IsNullOrWhiteSpace(v) ? v : fallback;
        string? Optional(string key) => values.TryGetValue(key, out var v) && !string.IsNullOrWhiteSpace(v) ? v : null;

        return new StoreSettings(
            Get("Store.Name", "Nhà Sợi"),
            Optional("Store.Tagline"),
            Get("Brand.LogoUrl", "/logo/logo-mark.svg"),
            Get("Brand.PrimaryColor", "#1E40AF"),
            Get("Store.Hotline", string.Empty),
            Optional("Store.Email"),
            Get("Store.Address", string.Empty),
            Get("Store.WorkingHours", "8h–21h hằng ngày"),
            Get("Store.BankBin", "970422"),
            Get("Store.BankAccount", string.Empty),
            Get("Store.BankAccountName", string.Empty));
    }
}
