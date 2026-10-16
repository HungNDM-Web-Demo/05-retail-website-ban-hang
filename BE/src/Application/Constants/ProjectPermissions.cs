namespace Application.Constants;

/// <summary>
/// Mã quyền nghiệp vụ của Website Bán hàng (02-SRS §7, 07-DANH-SACH-API §1). Tách khỏi <see cref="Permissions"/> (quyền nền)
/// để không sửa file nền. Mỗi mã phải có trong FE/src/mock/seed/project.json và FE src/config/permissions.ts;
/// test <c>PermissionAndRoleTests</c> kiểm tra việc này.
/// </summary>
public static class ProjectPermissions
{
    public static class Products
    {
        public const string View = "products.view";
        public const string Create = "products.create";
        public const string Update = "products.update";
        public const string Delete = "products.delete";
        public const string AdjustStock = "products.adjust-stock";
    }

    public static class Orders
    {
        public const string View = "orders.view";
        public const string Confirm = "orders.confirm";
        public const string ConfirmPayment = "orders.confirm-payment";
        public const string Update = "orders.update";
        public const string Cancel = "orders.cancel";
        public const string Ship = "orders.ship";
        public const string Refund = "orders.refund";
    }

    public static class Coupons
    {
        public const string View = "coupons.view";
        public const string Create = "coupons.create";
        public const string Update = "coupons.update";
        public const string Delete = "coupons.delete";
    }

    public static class Customers
    {
        public const string View = "customers.view";
        public const string Update = "customers.update";
    }

    public static class Reports
    {
        /// <summary>Báo cáo và các thẻ doanh thu ở Tổng quan (07 §5 quyết định 1).</summary>
        public const string View = "reports.view";
    }
}
