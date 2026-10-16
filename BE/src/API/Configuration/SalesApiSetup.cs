using System.Text.Json;
using System.Text.Json.Serialization;
using API.Filters;

namespace API.Configuration;

/// <summary>
/// Phần API riêng của Website Bán hàng: bộ lọc lỗi có <c>code</c> (404, 429, 07 §2.12) và ghi tiền dạng số nguyên
/// (<c>338000</c> thay vì <c>338000.00</c>, 06 §3 "tiền là số nguyên đồng").
/// </summary>
public static class SalesApiSetup
{
    public static IServiceCollection AddSalesApi(this IServiceCollection services)
    {
        services.Configure<Microsoft.AspNetCore.Mvc.MvcOptions>(options => options.Filters.Add<SalesProblemFilter>());
        services.Configure<Microsoft.AspNetCore.Mvc.JsonOptions>(options =>
            options.JsonSerializerOptions.Converters.Add(new TrimmedDecimalConverter()));
        services.ConfigureHttpJsonOptions(options => options.SerializerOptions.Converters.Add(new TrimmedDecimalConverter()));
        return services;
    }

    /// <summary>Bỏ số 0 thừa sau dấu thập phân khi ghi decimal (giá trị lẻ vẫn giữ nguyên).</summary>
    private sealed class TrimmedDecimalConverter : JsonConverter<decimal>
    {
        public override decimal Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
            reader.TokenType == JsonTokenType.String && decimal.TryParse(reader.GetString(), System.Globalization.NumberStyles.Number,
                System.Globalization.CultureInfo.InvariantCulture, out var parsed)
                ? parsed
                : reader.GetDecimal();

        public override void Write(Utf8JsonWriter writer, decimal value, JsonSerializerOptions options) =>
            writer.WriteNumberValue(value / 1.000000000000000000000000000000000m);
    }
}
