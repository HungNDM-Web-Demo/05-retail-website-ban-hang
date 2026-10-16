using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using Domain.Enums.Sales.Orders;

namespace Domain.Entities.Sales;

/// <summary>
/// Mã chứng từ, slug, SKU, chuỗi tìm không dấu, che số điện thoại, QR chuyển khoản giả lập (07 §3.9, §3.12, BR-10, BR-17, BR-24).
/// </summary>
public static partial class SalesCodes
{
    /// <summary>Mã đơn <c>DH</c> + <c>yyMMdd</c> (ngày đặt giờ Việt Nam) + 4 số (BR-10).</summary>
    public static string OrderPrefix(DateOnly vietnamDate) =>
        "DH" + vietnamDate.ToString("yyMMdd", CultureInfo.InvariantCulture);

    public static string OrderCode(DateOnly vietnamDate, int sequence) =>
        OrderPrefix(vietnamDate) + sequence.ToString("0000", CultureInfo.InvariantCulture);

    /// <summary>Mã vận đơn: tiền tố đơn vị + <c>yyMMdd</c> (ngày bàn giao) + 4 số thứ tự trong ngày của đơn vị (BR-17).</summary>
    public static string TrackingPrefix(Carrier carrier, DateOnly vietnamDate) =>
        SalesText.CarrierPrefix(carrier) + vietnamDate.ToString("yyMMdd", CultureInfo.InvariantCulture);

    public static string TrackingCode(Carrier carrier, DateOnly vietnamDate, int sequence) =>
        TrackingPrefix(carrier, vietnamDate) + sequence.ToString("0000", CultureInfo.InvariantCulture);

    /// <summary>Số thứ tự 4 chữ số cuối mã (đơn, vận đơn); không đọc được thì 0.</summary>
    public static int SequenceOf(string code) =>
        code.Length >= 4 && int.TryParse(code[^4..], NumberStyles.None, CultureInfo.InvariantCulture, out var n) ? n : 0;

    /// <summary>Khối lượng gợi ý = 300 g × tổng số lượng + 100 g, làm tròn tới 50 g (UC-10 bước 2).</summary>
    public static int SuggestWeight(int totalQuantity) =>
        (int)Math.Round((totalQuantity * 300 + 100) / 50m, MidpointRounding.AwayFromZero) * 50;

    /// <summary>Bỏ dấu tiếng Việt (đ → d), giữ hoa thường.</summary>
    public static string RemoveDiacritics(string value)
    {
        var normalized = value.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(normalized.Length);
        foreach (var c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark)
                continue;
            builder.Append(c switch { 'đ' => 'd', 'Đ' => 'D', _ => c });
        }

        return builder.ToString().Normalize(NormalizationForm.FormC);
    }

    /// <summary>Chuỗi tìm: bỏ dấu, chữ thường, gộp khoảng trắng (FR-06).</summary>
    public static string SearchText(string value) =>
        WhitespaceRegex().Replace(RemoveDiacritics(value).ToLowerInvariant(), " ").Trim();

    /// <summary>
    /// Slug (BR-24): bỏ dấu (đ → d), chữ thường, ký tự khác chữ số thành <c>-</c>, gộp <c>-</c> liên tiếp, bỏ <c>-</c> đầu cuối.
    /// "Áo sơ mi linen" → <c>ao-so-mi-linen</c>.
    /// </summary>
    public static string Slugify(string value)
    {
        var slug = NonAlphaNumericRegex().Replace(RemoveDiacritics(value).ToLowerInvariant(), "-").Trim('-');
        return slug.Length == 0 ? "san-pham" : slug;
    }

    /// <summary>SKU = mã sản phẩm + <c>-</c> + mã màu (+ <c>-</c> + size) (BR-24).</summary>
    public static string Sku(string productCode, string colorCode, string? size) =>
        string.IsNullOrEmpty(size) ? $"{productCode}-{colorCode}" : $"{productCode}-{colorCode}-{size}";

    /// <summary>Chuẩn hóa số điện thoại: bỏ khoảng trắng, dấu chấm, gạch; <c>+84</c>/<c>84</c> đầu thành <c>0</c>.</summary>
    public static string NormalizePhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone))
            return string.Empty;

        var digits = PhoneNoiseRegex().Replace(phone.Trim(), string.Empty);
        if (digits.StartsWith("+84", StringComparison.Ordinal))
            digits = "0" + digits[3..];
        else if (digits.StartsWith("84", StringComparison.Ordinal) && digits.Length == 11)
            digits = "0" + digits[2..];
        return digits;
    }

    /// <summary>Số di động 10 số <c>^0(3|5|7|8|9)\d{8}$</c> (BR-07).</summary>
    public static bool IsValidPhone(string phone) => MobileRegex().IsMatch(phone);

    /// <summary>3 số đầu + <c>****</c> + 3 số cuối, vd <c>0901000001</c> → <c>090****001</c> (BR-28).</summary>
    public static string MaskPhone(string phone) =>
        phone.Length < 7 ? phone : phone[..3] + "****" + phone[^3..];

    /// <summary>Tên ngân hàng theo BIN (07 §3.9), dùng chung bảng với FE <c>vietqr.ts</c>.</summary>
    public static string BankName(string bin) => bin switch
    {
        "970422" => "MB Bank",
        "970436" => "Vietcombank",
        "970407" => "Techcombank",
        "970418" => "BIDV",
        "970415" => "VietinBank",
        "970405" => "Agribank",
        "970416" => "ACB",
        _ => $"Ngân hàng {bin}"
    };

    /// <summary>QR chuyển khoản giả lập <c>VIETQR|{bankBin}|{bankAccount}|{amount}|{mã đơn}</c> (BR-12).</summary>
    public static string QrPayload(string bankBin, string bankAccount, decimal amount, string orderCode) =>
        $"VIETQR|{bankBin}|{bankAccount}|{decimal.Round(amount, 0).ToString("0", CultureInfo.InvariantCulture)}|{orderCode}";

    /// <summary>Mã giao dịch ngân hàng 6–30 chữ và số (BR-12).</summary>
    public static bool IsValidTransactionRef(string value) => TransactionRefRegex().IsMatch(value);

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespaceRegex();

    [GeneratedRegex("[^a-z0-9]+")]
    private static partial Regex NonAlphaNumericRegex();

    [GeneratedRegex(@"[\s.\-()]")]
    private static partial Regex PhoneNoiseRegex();

    [GeneratedRegex(@"^0(3|5|7|8|9)\d{8}$")]
    private static partial Regex MobileRegex();

    [GeneratedRegex("^[A-Za-z0-9]{6,30}$")]
    private static partial Regex TransactionRefRegex();
}
