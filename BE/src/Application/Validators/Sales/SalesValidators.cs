using System.Text.RegularExpressions;
using Application.DTOs.Catalog;
using Application.DTOs.Coupons;
using Application.DTOs.Customers;
using Application.DTOs.Orders;
using Application.DTOs.Storefront;
using Application.Validators.Common;
using Domain.Entities.Sales;
using Domain.Enums.Sales.Catalog;
using Domain.Enums.Sales.Coupons;
using Domain.Enums.Sales.Orders;
using FluentValidation;

namespace Application.Validators.Sales;

// Kiểm dữ liệu gửi lên theo trường (07 §2.12 "Câu theo trường"). Quy tắc cần đọc DB (phường thuộc tỉnh, trùng mã, giỏ trống
// kèm code) nằm ở service.

/// <summary>Câu lỗi và quy tắc dùng lại (BR-07, BR-12, BR-17, BR-27).</summary>
public static partial class SalesRulesValidation
{
    public const string FullNameMessage = "Họ tên từ 2 đến 100 ký tự";
    public const string PhoneMessage = "Số điện thoại không hợp lệ";
    public const string EmailMessage = "Email chưa đúng định dạng";
    public const string ProvinceMessage = "Vui lòng chọn tỉnh/thành";
    public const string WardMessage = "Vui lòng chọn phường/xã";
    public const string AddressMessage = "Địa chỉ chi tiết từ 5 đến 200 ký tự";
    public const string NoteMessage = "Ghi chú tối đa 500 ký tự";
    public const string QuantityMessage = "Số lượng từ 1 đến 10";
    public const string TransactionEmptyMessage = "Nhập mã giao dịch ngân hàng";
    public const string TransactionFormatMessage = "Mã giao dịch gồm 6–30 chữ và số";
    public const string ReasonMessage = "Chọn lý do";
    public const string OtherNoteMessage = "Nhập ghi chú cho lý do Khác";
    public const string WeightMessage = "Khối lượng từ 50 đến 30.000 g";
    public const string NewStockMessage = "Tồn mới là số nguyên từ 0";
    public const string InternalNoteMessage = "Nhập ghi chú, tối đa 500 ký tự";

    public static IRuleBuilderOptions<T, string> ValidRecipientName<T>(this IRuleBuilder<T, string> rule) =>
        rule.Must(v => v is not null && v.Trim().Length is >= 2 and <= 100).WithMessage(FullNameMessage);

    public static IRuleBuilderOptions<T, string> ValidMobile<T>(this IRuleBuilder<T, string> rule) =>
        rule.Must(v => SalesCodes.IsValidPhone(SalesCodes.NormalizePhone(v))).WithMessage(PhoneMessage);

    public static IRuleBuilderOptions<T, string?> ValidOptionalEmail<T>(this IRuleBuilder<T, string?> rule) =>
        rule.Must(v => string.IsNullOrWhiteSpace(v) || (v.Trim().Length <= 200 && EmailRegex().IsMatch(v.Trim())))
            .WithMessage(EmailMessage);

    public static IRuleBuilderOptions<T, string> ValidAddressLine<T>(this IRuleBuilder<T, string> rule) =>
        rule.Must(v => v is not null && v.Trim().Length is >= 5 and <= 200).WithMessage(AddressMessage);

    public static IRuleBuilderOptions<T, int> ValidLineQuantity<T>(this IRuleBuilder<T, int> rule) =>
        rule.InclusiveBetween(1, SalesRules.MaxLineQuantity).WithMessage(QuantityMessage);

    public static IRuleBuilderOptions<T, string?> ValidTransactionRef<T>(this IRuleBuilder<T, string?> rule) =>
        rule.Must(v => !string.IsNullOrWhiteSpace(v)).WithMessage(TransactionEmptyMessage)
            .Must(v => SalesCodes.IsValidTransactionRef(v!.Trim())).WithMessage(TransactionFormatMessage);

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex EmailRegex();

    [GeneratedRegex("^#[0-9A-Fa-f]{6}$")]
    public static partial Regex HexColorRegex();
}

public sealed class CartLineInputValidator : AppValidator<CartLineInput>
{
    public CartLineInputValidator() => RuleFor(x => x.Quantity).ValidLineQuantity();
}

public sealed class CartCheckRequestValidator : AppValidator<CartCheckRequest>
{
    public CartCheckRequestValidator() => RuleForEach(x => x.Lines).SetValidator(new CartLineInputValidator());
}

public sealed class CheckoutQuoteRequestValidator : AppValidator<CheckoutQuoteRequest>
{
    public CheckoutQuoteRequestValidator() => RuleForEach(x => x.Lines).SetValidator(new CartLineInputValidator());
}

public sealed class PlaceOrderRequestValidator : AppValidator<PlaceOrderRequest>
{
    public PlaceOrderRequestValidator()
    {
        RuleFor(x => x.ClientRequestId).Must(v => !string.IsNullOrWhiteSpace(v) && v.Trim().Length <= 64)
            .WithMessage("Thiếu mã yêu cầu đặt hàng");
        RuleFor(x => x.Shipping).NotNull().WithMessage(SalesRulesValidation.FullNameMessage);
        When(x => x.Shipping is not null, () =>
        {
            RuleFor(x => x.Shipping.FullName).ValidRecipientName().OverridePropertyName("shipping.fullName");
            RuleFor(x => x.Shipping.Phone).ValidMobile().OverridePropertyName("shipping.phone");
            RuleFor(x => x.Shipping.Email).ValidOptionalEmail().OverridePropertyName("shipping.email");
            RuleFor(x => x.Shipping.ProvinceCode).NotEmpty().WithMessage(SalesRulesValidation.ProvinceMessage)
                .OverridePropertyName("shipping.provinceCode");
            RuleFor(x => x.Shipping.WardCode).NotEmpty().WithMessage(SalesRulesValidation.WardMessage)
                .OverridePropertyName("shipping.wardCode");
            RuleFor(x => x.Shipping.AddressLine).ValidAddressLine().OverridePropertyName("shipping.addressLine");
            RuleFor(x => x.Shipping.Note).MaximumLength(500).WithMessage(SalesRulesValidation.NoteMessage)
                .OverridePropertyName("shipping.note");
        });
        RuleForEach(x => x.Lines).ChildRules(line => line.RuleFor(l => l.Quantity).ValidLineQuantity());
        RuleFor(x => x.PaymentMethod).NotNull().WithMessage("Chọn phương thức thanh toán");
    }
}

public sealed class OrderLookupRequestValidator : AppValidator<OrderLookupRequest>
{
    public OrderLookupRequestValidator()
    {
        RuleFor(x => x.Code).NotEmpty().WithMessage("Nhập mã đơn hàng");
        RuleFor(x => x.Phone).NotEmpty().WithMessage(SalesRulesValidation.PhoneMessage);
    }
}

public sealed class PublicCancelRequestValidator : AppValidator<PublicCancelRequest>
{
    public PublicCancelRequestValidator()
    {
        RuleFor(x => x.Phone).NotEmpty().WithMessage(SalesRulesValidation.PhoneMessage);
        RuleFor(x => x.Reason).Must(r => r is CancelReason.KhachDoiY or CancelReason.DatTrung or CancelReason.Khac)
            .WithMessage(SalesRulesValidation.ReasonMessage);
        RuleFor(x => x.Note).Must(n => !string.IsNullOrWhiteSpace(n)).When(x => x.Reason == CancelReason.Khac)
            .WithMessage(SalesRulesValidation.OtherNoteMessage);
        RuleFor(x => x.Note).MaximumLength(500).WithMessage(SalesRulesValidation.NoteMessage);
    }
}

public sealed class AddOrderNoteRequestValidator : AppValidator<AddOrderNoteRequest>
{
    public AddOrderNoteRequestValidator() =>
        RuleFor(x => x.Content).Must(v => !string.IsNullOrWhiteSpace(v) && v.Trim().Length <= 500)
            .WithMessage(SalesRulesValidation.InternalNoteMessage);
}

public sealed class ConfirmOrderRequestValidator : AppValidator<ConfirmOrderRequest>
{
    public ConfirmOrderRequestValidator() => RuleFor(x => x.Note).MaximumLength(500).WithMessage(SalesRulesValidation.NoteMessage);
}

public sealed class ConfirmPaymentRequestValidator : AppValidator<ConfirmPaymentRequest>
{
    public ConfirmPaymentRequestValidator() => RuleFor(x => x.TransactionRef).ValidTransactionRef();
}

public sealed class RefundRequestValidator : AppValidator<RefundRequest>
{
    public RefundRequestValidator() => RuleFor(x => x.RefundRef).ValidTransactionRef();
}

public sealed class CancelOrderRequestValidator : AppValidator<CancelOrderRequest>
{
    public CancelOrderRequestValidator()
    {
        // QuaHanThanhToan chỉ hệ thống dùng (07 §2.5).
        RuleFor(x => x.Reason).Must(r => r is not null && r != CancelReason.QuaHanThanhToan)
            .WithMessage(SalesRulesValidation.ReasonMessage);
        RuleFor(x => x.Note).Must(n => !string.IsNullOrWhiteSpace(n)).When(x => x.Reason == CancelReason.Khac)
            .WithMessage(SalesRulesValidation.OtherNoteMessage);
        RuleFor(x => x.Note).MaximumLength(500).WithMessage(SalesRulesValidation.NoteMessage);
    }
}

public sealed class ShipOrderRequestValidator : AppValidator<ShipOrderRequest>
{
    public ShipOrderRequestValidator()
    {
        RuleFor(x => x.Carrier).NotNull().WithMessage("Chọn đơn vị vận chuyển");
        RuleFor(x => x.WeightGrams).Must(w => w is >= SalesRules.MinWeightGrams and <= SalesRules.MaxWeightGrams)
            .WithMessage(SalesRulesValidation.WeightMessage);
        RuleFor(x => x.ShipperNote).MaximumLength(200).WithMessage("Ghi chú cho shipper tối đa 200 ký tự");
    }
}

public sealed class DeliveryFailedRequestValidator : AppValidator<DeliveryFailedRequest>
{
    public DeliveryFailedRequestValidator()
    {
        RuleFor(x => x.Reason).NotNull().WithMessage(SalesRulesValidation.ReasonMessage);
        RuleFor(x => x.Note).Must(n => !string.IsNullOrWhiteSpace(n)).When(x => x.Reason == DeliveryFailReason.Khac)
            .WithMessage(SalesRulesValidation.OtherNoteMessage);
        RuleFor(x => x.Note).MaximumLength(500).WithMessage(SalesRulesValidation.NoteMessage);
    }
}

public sealed class EditOrderRequestValidator : AppValidator<EditOrderRequest>
{
    public EditOrderRequestValidator()
    {
        RuleFor(x => x.RecipientName).ValidRecipientName();
        RuleFor(x => x.Phone).ValidMobile();
        RuleFor(x => x.Email).ValidOptionalEmail();
        RuleFor(x => x.ProvinceCode).NotEmpty().WithMessage(SalesRulesValidation.ProvinceMessage);
        RuleFor(x => x.WardCode).NotEmpty().WithMessage(SalesRulesValidation.WardMessage);
        RuleFor(x => x.AddressLine).ValidAddressLine();
        RuleForEach(x => x.Lines).ChildRules(line => line.RuleFor(l => l.Quantity).ValidLineQuantity());
    }
}

public sealed class BulkShipRequestValidator : AppValidator<BulkShipRequest>
{
    public BulkShipRequestValidator() => RuleFor(x => x.Carrier).NotNull().WithMessage("Chọn đơn vị vận chuyển");
}

public sealed class StockAdjustmentRequestValidator : AppValidator<StockAdjustmentRequest>
{
    public StockAdjustmentRequestValidator()
    {
        RuleFor(x => x.NewStock).Must(v => v is >= 0).WithMessage(SalesRulesValidation.NewStockMessage);
        RuleFor(x => x.Reason).NotNull().WithMessage(SalesRulesValidation.ReasonMessage);
        RuleFor(x => x.Note).Must(n => !string.IsNullOrWhiteSpace(n)).When(x => x.Reason == StockAdjustReason.Khac)
            .WithMessage(SalesRulesValidation.OtherNoteMessage);
        RuleFor(x => x.Note).MaximumLength(500).WithMessage(SalesRulesValidation.NoteMessage);
    }
}

public sealed class SaveCategoryRequestValidator : AppValidator<SaveCategoryRequest>
{
    public SaveCategoryRequestValidator()
    {
        RuleFor(x => x.Code).Must(v => v is not null && CategoryCodeRegex().IsMatch(v.Trim().ToUpperInvariant()))
            .WithMessage("Mã danh mục gồm 2 chữ in hoa");
        RuleFor(x => x.Name).Must(v => v is not null && v.Trim().Length is >= 2 and <= 100)
            .WithMessage("Tên danh mục từ 2 đến 100 ký tự");
        RuleFor(x => x.Slug).MaximumLength(120).WithMessage("Đường dẫn tối đa 120 ký tự");
        RuleFor(x => x.Color).Must(v => v is not null && SalesRulesValidation.HexColorRegex().IsMatch(v.Trim()))
            .WithMessage("Màu dạng #RRGGBB");
        RuleFor(x => x.ImageUrl).MaximumLength(500).WithMessage("Đường dẫn ảnh tối đa 500 ký tự");
    }

    private static Regex CategoryCodeRegex() => new("^[A-Z]{2}$");
}

public sealed class SaveColorRequestValidator : AppValidator<SaveColorRequest>
{
    public SaveColorRequestValidator()
    {
        RuleFor(x => x.Code).Must(v => v is not null && ColorCodeRegex().IsMatch(v.Trim().ToUpperInvariant()))
            .WithMessage("Mã màu gồm 2 chữ in hoa");
        RuleFor(x => x.Name).Must(v => v is not null && v.Trim().Length is >= 2 and <= 50)
            .WithMessage("Tên màu từ 2 đến 50 ký tự");
        RuleFor(x => x.Hex).Must(v => v is not null && SalesRulesValidation.HexColorRegex().IsMatch(v.Trim()))
            .WithMessage("Màu dạng #RRGGBB");
    }

    private static Regex ColorCodeRegex() => new("^[A-Z]{2}$");
}

public sealed class SaveProductRequestValidator : AppValidator<SaveProductRequest>
{
    public SaveProductRequestValidator()
    {
        RuleFor(x => x.Code).Must(v => v is not null && ProductCodeRegex().IsMatch(v.Trim().ToUpperInvariant()))
            .WithMessage("Mã sản phẩm gồm 2 chữ in hoa và 3 số");
        RuleFor(x => x.Name).Must(v => v is not null && v.Trim().Length is >= 2 and <= 200)
            .WithMessage("Tên sản phẩm từ 2 đến 200 ký tự");
        RuleFor(x => x.Slug).MaximumLength(220).WithMessage("Đường dẫn tối đa 220 ký tự");
        RuleFor(x => x.CategoryId).NotEmpty().WithMessage("Chọn danh mục");
        RuleFor(x => x.Price).Must(p => p > 0 && p % 1000 == 0).WithMessage("Giá bán là bội số của 1.000 ₫");
        RuleFor(x => x.ListPrice).Must((r, lp) => lp is null || (lp % 1000 == 0 && lp > r.Price))
            .WithMessage("Giá gốc phải lớn hơn giá bán");
        RuleFor(x => x.Images).Must(i => i.Count <= SalesRules.MaxProductImages).WithMessage("Tối đa 8 ảnh");
        RuleFor(x => x.ColorIds).Must(c => c.Count > 0).WithMessage("Chọn ít nhất một màu");
        RuleForEach(x => x.Variants).ChildRules(v =>
            v.RuleFor(x => x.InitialStock).Must(s => s is null or >= 0).WithMessage(SalesRulesValidation.NewStockMessage));
    }

    private static Regex ProductCodeRegex() => new(@"^[A-Z]{2}\d{3}$");
}

public sealed class SaveCouponRequestValidator : AppValidator<SaveCouponRequest>
{
    public SaveCouponRequestValidator()
    {
        RuleFor(x => x.Code).Must(v => v is not null && CouponCodeRegex().IsMatch(v.Trim().ToUpperInvariant()))
            .WithMessage("Mã 4–20 ký tự chữ in hoa và số");
        RuleFor(x => x.Name).Must(v => v is not null && v.Trim().Length is >= 2 and <= 200)
            .WithMessage("Tên mã từ 2 đến 200 ký tự");
        RuleFor(x => x.Type).NotNull().WithMessage("Chọn kiểu mã");
        RuleFor(x => x.Value).InclusiveBetween(1, 50).When(x => x.Type == CouponType.PhanTram)
            .WithMessage("Phần trăm từ 1 đến 50");
        RuleFor(x => x.MaxDiscount).Must(m => m is > 0).When(x => x.Type == CouponType.PhanTram)
            .WithMessage("Nhập mức giảm tối đa cho mã phần trăm");
        RuleFor(x => x.MaxDiscount).Must(m => m is null || m % 1000 == 0).When(x => x.Type == CouponType.PhanTram)
            .WithMessage("Mức giảm tối đa là bội số của 1.000 ₫");
        RuleFor(x => x.Value).Must(v => v > 0 && v % 1000 == 0).When(x => x.Type == CouponType.SoTien)
            .WithMessage("Số tiền giảm là bội số của 1.000 ₫");
        RuleFor(x => x.MinOrder).GreaterThanOrEqualTo(0).WithMessage("Đơn tối thiểu từ 0 ₫");
        RuleFor(x => x.PerCustomerLimit).GreaterThanOrEqualTo(1).WithMessage("Lượt mỗi khách từ 1");
        RuleFor(x => x.TotalLimit).Must(t => t is null or >= 1).WithMessage("Tổng lượt từ 1 hoặc để trống");
        RuleFor(x => x.StartAt).NotNull().WithMessage("Chọn thời điểm bắt đầu");
        RuleFor(x => x.EndAt).NotNull().WithMessage("Chọn thời điểm kết thúc")
            .Must((r, end) => r.StartAt is null || end > r.StartAt)
            .WithMessage("Thời điểm kết thúc phải sau thời điểm bắt đầu");
    }

    private static Regex CouponCodeRegex() => new("^[A-Z0-9]{4,20}$");
}

public sealed class UpdateCustomerNoteRequestValidator : AppValidator<UpdateCustomerNoteRequest>
{
    public UpdateCustomerNoteRequestValidator() =>
        RuleFor(x => x.Note).MaximumLength(1000).WithMessage("Ghi chú tối đa 1.000 ký tự");
}
