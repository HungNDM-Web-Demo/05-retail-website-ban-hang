using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_Sales : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Crm_Customers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Phone = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Email = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ProvinceCode = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    WardCode = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    AddressLine = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    OrderCount = table.Column<int>(type: "integer", nullable: false),
                    DeliveredCount = table.Column<int>(type: "integer", nullable: false),
                    ReturnCount = table.Column<int>(type: "integer", nullable: false),
                    CancelledCount = table.Column<int>(type: "integer", nullable: false),
                    TotalSpent = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    FirstOrderAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastOrderAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Crm_Customers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Sales_Categories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Slug = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    ImageUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Color = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    IsVisible = table.Column<bool>(type: "boolean", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sales_Categories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Sales_Colors",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(4)", maxLength: 4, nullable: false),
                    Name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Hex = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sales_Colors", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Sales_Provinces",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Zone = table.Column<int>(type: "integer", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sales_Provinces", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Sales_Coupons",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Value = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    MaxDiscount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    MinOrder = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CategoryId = table.Column<Guid>(type: "uuid", nullable: true),
                    TotalLimit = table.Column<int>(type: "integer", nullable: true),
                    PerCustomerLimit = table.Column<int>(type: "integer", nullable: false),
                    UsedCount = table.Column<int>(type: "integer", nullable: false),
                    StartAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsPaused = table.Column<bool>(type: "boolean", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sales_Coupons", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Sales_Coupons_Sales_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "Sales_Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Sales_Products",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Slug = table.Column<string>(type: "character varying(220)", maxLength: 220, nullable: false),
                    NameSearch = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    CategoryId = table.Column<Guid>(type: "uuid", nullable: false),
                    Price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ListPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    Description = table.Column<string>(type: "text", nullable: true),
                    SizeChartJson = table.Column<string>(type: "text", nullable: true),
                    IsFeatured = table.Column<bool>(type: "boolean", nullable: false),
                    IsHidden = table.Column<bool>(type: "boolean", nullable: false),
                    SoldCount = table.Column<int>(type: "integer", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sales_Products", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Sales_Products_Sales_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "Sales_Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Sales_Wards",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProvinceId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sales_Wards", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Sales_Wards_Sales_Provinces_ProvinceId",
                        column: x => x.ProvinceId,
                        principalTable: "Sales_Provinces",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Sales_Orders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlacedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    PaymentMethod = table.Column<int>(type: "integer", nullable: false),
                    PaymentStatus = table.Column<int>(type: "integer", nullable: false),
                    PaymentDueAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TransactionRef = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    PaidAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RefundAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    RefundRef = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    RefundedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RecipientName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Phone = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: false),
                    Email = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ProvinceCode = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    ProvinceName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    WardCode = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    WardName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    AddressLine = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CustomerNote = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Subtotal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Discount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ShippingFee = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ShippingDiscount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Total = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CouponId = table.Column<Guid>(type: "uuid", nullable: true),
                    CouponCode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    CancelReason = table.Column<int>(type: "integer", nullable: true),
                    CancelNote = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CancelledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CancelledById = table.Column<Guid>(type: "uuid", nullable: true),
                    CancelledByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    ClientRequestId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    DeviceId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sales_Orders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Sales_Orders_Crm_Customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Crm_Customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Sales_Orders_Sales_Coupons_CouponId",
                        column: x => x.CouponId,
                        principalTable: "Sales_Coupons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Sales_ProductImages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    Url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ColorId = table.Column<Guid>(type: "uuid", nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    IsCover = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sales_ProductImages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Sales_ProductImages_Sales_Colors_ColorId",
                        column: x => x.ColorId,
                        principalTable: "Sales_Colors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Sales_ProductImages_Sales_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Sales_Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Sales_ProductVariants",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    ColorId = table.Column<Guid>(type: "uuid", nullable: false),
                    Size = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    Sku = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Stock = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sales_ProductVariants", x => x.Id);
                    table.CheckConstraint("CK_Sales_ProductVariants_Stock", "\"Stock\" >= 0");
                    table.ForeignKey(
                        name: "FK_Sales_ProductVariants_Sales_Colors_ColorId",
                        column: x => x.ColorId,
                        principalTable: "Sales_Colors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Sales_ProductVariants_Sales_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Sales_Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Sales_OrderEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    At = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ActorType = table.Column<int>(type: "integer", nullable: false),
                    ActorId = table.Column<Guid>(type: "uuid", nullable: true),
                    ActorName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    FromStatus = table.Column<int>(type: "integer", nullable: true),
                    ToStatus = table.Column<int>(type: "integer", nullable: true),
                    Content = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Seq = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sales_OrderEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Sales_OrderEvents_Sales_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Sales_Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Sales_OrderEvents_System_Users_ActorId",
                        column: x => x.ActorId,
                        principalTable: "System_Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Sales_Shipments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    Carrier = table.Column<int>(type: "integer", nullable: false),
                    TrackingCode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    WeightGrams = table.Column<int>(type: "integer", nullable: false),
                    CodAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ShipperNote = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    HandedOverAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    HandedOverById = table.Column<Guid>(type: "uuid", nullable: true),
                    HandedOverByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    DeliveredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FailedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FailReason = table.Column<int>(type: "integer", nullable: true),
                    FailNote = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ReturnedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LabelPrintCount = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sales_Shipments", x => x.Id);
                    table.CheckConstraint("CK_Sales_Shipments_Weight", "\"WeightGrams\" >= 50 AND \"WeightGrams\" <= 30000");
                    table.ForeignKey(
                        name: "FK_Sales_Shipments_Sales_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Sales_Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Sales_OrderLines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    VariantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Sku = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    ColorName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Size = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    ImageUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    UnitPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sales_OrderLines", x => x.Id);
                    table.CheckConstraint("CK_Sales_OrderLines_Quantity", "\"Quantity\" >= 1 AND \"Quantity\" <= 10");
                    table.ForeignKey(
                        name: "FK_Sales_OrderLines_Sales_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Sales_Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Sales_OrderLines_Sales_ProductVariants_VariantId",
                        column: x => x.VariantId,
                        principalTable: "Sales_ProductVariants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Sales_OrderLines_Sales_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Sales_Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Sales_StockAdjustments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    VariantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    Before = table.Column<int>(type: "integer", nullable: false),
                    After = table.Column<int>(type: "integer", nullable: false),
                    Reason = table.Column<int>(type: "integer", nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ById = table.Column<Guid>(type: "uuid", nullable: true),
                    ByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    At = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sales_StockAdjustments", x => x.Id);
                    table.CheckConstraint("CK_Sales_StockAdjustments_After", "\"After\" >= 0");
                    table.ForeignKey(
                        name: "FK_Sales_StockAdjustments_Sales_ProductVariants_VariantId",
                        column: x => x.VariantId,
                        principalTable: "Sales_ProductVariants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Sales_StockAdjustments_Sales_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Sales_Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Crm_Customers_LastOrderAt",
                table: "Crm_Customers",
                column: "LastOrderAt");

            migrationBuilder.CreateIndex(
                name: "IX_Crm_Customers_Phone",
                table: "Crm_Customers",
                column: "Phone",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Crm_Customers_TotalSpent",
                table: "Crm_Customers",
                column: "TotalSpent");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_Categories_Code",
                table: "Sales_Categories",
                column: "Code",
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_Categories_Slug",
                table: "Sales_Categories",
                column: "Slug",
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_Colors_Code",
                table: "Sales_Colors",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Sales_Colors_Name",
                table: "Sales_Colors",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Sales_Coupons_CategoryId",
                table: "Sales_Coupons",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_Coupons_Code",
                table: "Sales_Coupons",
                column: "Code",
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_OrderEvents_ActorId",
                table: "Sales_OrderEvents",
                column: "ActorId");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_OrderEvents_OrderId_At",
                table: "Sales_OrderEvents",
                columns: new[] { "OrderId", "At" });

            migrationBuilder.CreateIndex(
                name: "IX_Sales_OrderLines_OrderId",
                table: "Sales_OrderLines",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_OrderLines_ProductId",
                table: "Sales_OrderLines",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_OrderLines_VariantId",
                table: "Sales_OrderLines",
                column: "VariantId");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_Orders_ClientRequestId",
                table: "Sales_Orders",
                column: "ClientRequestId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Sales_Orders_Code",
                table: "Sales_Orders",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Sales_Orders_CouponId",
                table: "Sales_Orders",
                column: "CouponId");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_Orders_CustomerId",
                table: "Sales_Orders",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_Orders_PaymentDueAt",
                table: "Sales_Orders",
                column: "PaymentDueAt");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_Orders_Phone",
                table: "Sales_Orders",
                column: "Phone");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_Orders_PlacedAt",
                table: "Sales_Orders",
                column: "PlacedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_Orders_Status_PlacedAt",
                table: "Sales_Orders",
                columns: new[] { "Status", "PlacedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Sales_ProductImages_ColorId",
                table: "Sales_ProductImages",
                column: "ColorId");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_ProductImages_ProductId",
                table: "Sales_ProductImages",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_Products_CategoryId",
                table: "Sales_Products",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_Products_Code",
                table: "Sales_Products",
                column: "Code",
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_Products_IsHidden_CategoryId",
                table: "Sales_Products",
                columns: new[] { "IsHidden", "CategoryId" });

            migrationBuilder.CreateIndex(
                name: "IX_Sales_Products_NameSearch",
                table: "Sales_Products",
                column: "NameSearch");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_Products_Slug",
                table: "Sales_Products",
                column: "Slug",
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_ProductVariants_ColorId",
                table: "Sales_ProductVariants",
                column: "ColorId");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_ProductVariants_ProductId_ColorId_Size",
                table: "Sales_ProductVariants",
                columns: new[] { "ProductId", "ColorId", "Size" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Sales_ProductVariants_Sku",
                table: "Sales_ProductVariants",
                column: "Sku",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Sales_Provinces_Code",
                table: "Sales_Provinces",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Sales_Shipments_DeliveredAt",
                table: "Sales_Shipments",
                column: "DeliveredAt");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_Shipments_HandedOverAt",
                table: "Sales_Shipments",
                column: "HandedOverAt");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_Shipments_OrderId",
                table: "Sales_Shipments",
                column: "OrderId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Sales_Shipments_TrackingCode",
                table: "Sales_Shipments",
                column: "TrackingCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Sales_StockAdjustments_ProductId",
                table: "Sales_StockAdjustments",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_StockAdjustments_VariantId",
                table: "Sales_StockAdjustments",
                column: "VariantId");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_Wards_Code",
                table: "Sales_Wards",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Sales_Wards_ProvinceId",
                table: "Sales_Wards",
                column: "ProvinceId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Sales_OrderEvents");

            migrationBuilder.DropTable(
                name: "Sales_OrderLines");

            migrationBuilder.DropTable(
                name: "Sales_ProductImages");

            migrationBuilder.DropTable(
                name: "Sales_Shipments");

            migrationBuilder.DropTable(
                name: "Sales_StockAdjustments");

            migrationBuilder.DropTable(
                name: "Sales_Wards");

            migrationBuilder.DropTable(
                name: "Sales_Orders");

            migrationBuilder.DropTable(
                name: "Sales_ProductVariants");

            migrationBuilder.DropTable(
                name: "Sales_Provinces");

            migrationBuilder.DropTable(
                name: "Crm_Customers");

            migrationBuilder.DropTable(
                name: "Sales_Coupons");

            migrationBuilder.DropTable(
                name: "Sales_Colors");

            migrationBuilder.DropTable(
                name: "Sales_Products");

            migrationBuilder.DropTable(
                name: "Sales_Categories");
        }
    }
}
