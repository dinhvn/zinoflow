# Dichoithoi — Chuyển DB website từ SQL Server sang PostgreSQL (GĐ0-3 xong 27/09/2026 — GĐ4 + GĐ5 làm LÚC RELEASE)

## Tiến độ

| Giai đoạn | Trạng thái | Ghi chú |
|---|---|---|
| S — Đổi mật khẩu bị lộ | ⏸ Người dùng chọn GIỮ NGUYÊN (26/09/2026) | Quyết định của người dùng, không nhắc lại |
| 0 — Xuất schema + danh mục | ✅ Xong 26/09/2026 | `dichoithoi/scripts/postgres-migration/sqlserver-export/` |
| 1 — EF Core Migrations | ✅ Xong 27/09/2026 | `dichoithoi/DiChoiThoi.Common/Migrations/`, DB local `dichoithoi_dev` trên PG 18 |
| 2 — .NET chạy PG | ✅ Xong 27/09/2026 | Website + CMS cũ build và chạy trên PG local; appsettings.Release.json chờ GĐ4 |
| 3 — 5 adapter zinoflow | ✅ Xong 27/09/2026 | `pg-*` + module kết nối dùng chung + 23 test tích hợp |
| 4 — SmarterASP + docs | ⏸ Làm lúc release (người dùng chốt 27/09/2026) | Các bước đã ghi vào `dichoithoi-release-checklist.md` §1-§3 |
| 5 — Gỡ SQL Server | ⏸ Sau release | Chỉ làm khi site PG chạy ổn trên production |

## Bắt đầu trên Mac (đọc mục này đầu tiên)

1. Máy Mac đã khôi phục theo `migration-mac-2026-09-26/HUONG-DAN-KHOI-PHUC-TREN-MAC.md`
   (Postgres zinoflow, `.env`, memory). **Không cần** Docker SQL Server: Giai đoạn 0 đã
   xuất đủ những gì cần đọc từ SQL Server.
2. `git pull` cả `zinoflow` (main) lẫn `dichoithoi` (develop).
3. Mở Claude Code trong zinoflow, nói: *"tiếp tục plan chuyển dichoithoi sang Postgres"*.
   Claude sẽ đọc file này qua memory `dichoithoi-postgres-migration-plan-open`.
4. ✅ (27/09/2026) Đã chốt Q1-Q4 và xong Giai đoạn 1. Tiếp theo là Giai đoạn 2 và 3 (làm song song được).
5. ✅ Đã cài .NET SDK 9 và dotnet-ef. `brew install --cask dotnet-sdk` cần sudo và lại cài bản 10,
   nên dùng script chính thức: `curl -sSL https://dot.net/v1/dotnet-install.sh | bash -s -- --channel 9.0`
   (cài vào `~/.dotnet`, cần thêm `DOTNET_ROOT` + PATH vào shell profile).
   DB `dichoithoi_dev` dùng chung server PG 18 với zinoflow nhưng tách database, giữ đúng
   ranh giới "schema owned by dichoithoi".
6. ✅ (27/09/2026) Xong Giai đoạn 1-3: zinoflow publish vào `dichoithoi_dev` (PG local), website .NET
   chạy trên Mac (`dotnet run --project DiChoiThoi.Web`, cổng 5176). Việc còn lại: GĐ4 (DB PG trên
   SmarterASP + sửa tài liệu lệch) và GĐ5 (gỡ SQL Server).

Ghi 26/09/2026. Bối cảnh: người dùng đổi máy dev sang Mac (không có SQL Server
LocalDB) và hosting SmarterASP có PostgreSQL 18 (có remote connection). Sau khi
phân tích, đã chốt hướng: **dichoithoi chuyển sang PostgreSQL trước go-live**,
**khuyenmai (laruki/dochoi3s) giữ SQL Server**. Không đổi DB chỉ để giải quyết
Mac (Docker SQL Server giải quyết được trong 15 phút). Lý do đổi là giá trị dài
hạn: toàn hệ thống dùng 1 loại DB, dev chạy native trên Mac, và thời điểm này
rẻ nhất (release = xoá sạch rồi thay mới, xem memory
`dichoithoi-release-strategy-wipe-and-replace`).

## Hiện trạng đã audit (26/09/2026, trên máy Windows)

**Dữ liệu (`dichoithoi_dev`, LocalDB SQL Server 2019, collation `SQL_Latin1_General_CP1_CI_AS`):**
- 26 bảng: 19 `v2.*` + 7 `dbo.*` (v1). **0** stored procedure, view, trigger hay
  full-text index. 10 cột identity, 13 FK, 50 default constraint, 0 check/computed.
- Kiểu cột: nvarchar 125, int 54, varchar 34, tinyint 14, datetime2 13, decimal 13,
  bit 12, datetime 6, smallint 5, money 2.
- `v2.Destination` = **1 dòng** (Thác Triệu Hải). Người dùng xác nhận 26/09 là
  **xoá được, sẽ publish lại** từ zinoflow. Mirror Postgres của zinoflow có 3290
  điểm, trong đó chỉ 1 có `site_id`. `v2.Hotel`/`v2.Tour`/`v2.Article`/`v2.Transport` = 0 dòng.
- Dữ liệu danh mục cần giữ: `v2.Province` 34, `v2.DestinationType` 18,
  `v2.DestinationTag` 17, `v2.DestinationTypeGroup` 4.

**.NET (`D:\Gits\mmo\dichoithoi`, net9.0, EF Core 9 DB-first, mapping bằng attribute `[Table]`/`[Column]`):**
- `UseSqlServer` ở `DiChoiThoi.Web/Program.cs:21` và `CmsDiChoiThoi.Web/Program.cs:19`.
- **KHÔNG có EF migration và KHÔNG có file DDL** của schema `v2` trong repo nào.
  DDL chỉ nằm rải rác dạng đoạn mẫu trong khoảng 10 spec markdown
  (`dichoithoi-database-redesign.md`, `-article-spec.md`, `-bus-spec.md`...).
- Các bảng `v2.DestinationRelation`, `v2.Transport`, `v2.TransportStop` có trong DB
  (zinoflow ghi vào) nhưng **không có entity EF**. Website không đọc trực tiếp các bảng này.
- `[Column(TypeName=...)]` riêng của SQL Server: 22 `nvarchar(max)`, 9 `datetime`,
  2 `money`, cùng nhiều `decimal(p,s)` (decimal dùng được nguyên trên PG).
- Raw SQL: chỉ `DBCC CHECKIDENT` ở `CmsDiChoiThoi.Service/Repositories/Destination/DestinationRepository.cs:48`
  và `CmsDiChoiThoi.Service/Repositories/Tour/TourRepository.cs:30`.
- Tìm kiếm ở website public (`DiChoiThoi.Service/Repositories/Destination/DestinationRepository.cs:253-256,418`)
  chạy **trong bộ nhớ C#** trên `NameUnaccented` (`OrdinalIgnoreCase`), nên **không phụ thuộc DB**.
  Các ô tìm `x.Name.Contains(keyword)` chạy dưới DB chỉ có ở CMS legacy và
  `DiChoiThoi.Service/.../HotelRepository.cs:62`, `SimRepository.cs:28`.
  Sang PG các chỗ này sẽ **phân biệt hoa/thường**.
- `DateTime.Now` 18 chỗ, `DateTime.UtcNow` 3 chỗ.
- Trang chủ (`DiChoiThoi.Web/Controllers/HomeController.cs:56-57,440`) vẫn đọc bảng v1
  `dbo.Hotel`/`dbo.HotelGroup` qua `DiChoiThoi.Service/Repositories/Hotel/HotelRepository.cs`.
- DbContext khai báo 19 bảng `dbo`, nhưng DB chỉ có 7. Các entity `Sim`, `Supplier*`,
  `FixedProduct`, `Tour/TourDetail`, `User`, `Area`, `District`, `MyTourHotelSetting`
  **không có bảng**, chỉ được `CmsDiChoiThoi` (CMS .NET cũ) dùng. Nghĩa là CMS cũ đã hỏng sẵn ở dev.
- **Lộ secret:** `DiChoiThoi.Common/DbEntities/TestDbContext.cs:60` ghi cứng connection
  string production (site4now, có mật khẩu) và file này đã commit vào git.

**zinoflow (`apps/api`):**
- 5 adapter ghi DB site, mỗi cái tự tạo connection pool và tự đọc 7 biến `DICHOITHOI_DB_*`:
  | Adapter | Dòng | Cú pháp riêng SQL Server |
  |---|---|---|
  | `destination/.../mssql-site-db.adapter.ts` | 1229 | SCOPE_IDENTITY, STRING_AGG ×2, SYSUTCDATETIME ×9, TOP(@) |
  | `hotel/.../mssql-hotel-site-db.adapter.ts` | 225 | MERGE, SCOPE_IDENTITY, SYSUTCDATETIME, TOP(@) |
  | `tour/.../mssql-tour-site-db.adapter.ts` | 228 | MERGE, SCOPE_IDENTITY, SYSUTCDATETIME, TOP(@) |
  | `transport/.../mssql-transport-site-db.adapter.ts` | 237 | transaction, SCOPE_IDENTITY, SYSUTCDATETIME |
  | `article/.../mssql-article-site-db.adapter.ts` | 193 | SCOPE_IDENTITY, SYSUTCDATETIME ×4 |
- Adapter được bind qua port (`destination.module.ts:303`, `hotel.module.ts:53`,
  `tour.module.ts:49`, `transport.module.ts:39`, `article.module.ts:60`), nên
  **use case không phải sửa**, chỉ thay lớp infrastructure.
- Không có test tích hợp nào cho các adapter mssql.
- `cms-content/.../khuyenmai/mssql-cms-db.adapter.ts` thuộc khuyenmai: **giữ nguyên**, nên package `mssql` vẫn phải ở lại.
- 3 script trong `apps/api/scripts` dùng `mssql`.

**Lệch tài liệu (không phải bug):** `.github/copilot-instructions.md` §1 ("UPSERT
into that site's SQL Server DB"), `.env.example` dòng 46-53 (LocalDB),
`dichoithoi-release-checklist.md` (3 chỗ), `dichoithoi-golive-runbook.md` (6 chỗ),
memory `dichoithoi-localdb-encoding-bug` (sẽ không còn áp dụng).

**Lỗ hổng thật (cần sửa, độc lập với việc đổi DB):**
1. Schema `v2` không được quản lý phiên bản. Plan này đóng lỗ hổng đó ở Giai đoạn 1.
2. Lộ mật khẩu DB production trong git: đổi mật khẩu ngay, xem Giai đoạn S.

## Quyết định trước Giai đoạn 1 — ĐÃ CHỐT 27/09/2026: cả 4 theo đề xuất (Q1-Q4 = A)

| # | Câu hỏi | Lựa chọn | Đề xuất |
|---|---|---|---|
| Q1 | Cách đặt tên bảng/cột trên PG | **A.** snake_case (`v2.destination.province_id`) qua `EFCore.NamingConventions`. **B.** giữ PascalCase (`"v2"."Destination"."ProvinceId"`) | **A.** Đằng nào 5 adapter cũng phải viết lại toàn bộ SQL. PascalCase trên PG bắt buộc đặt tên trong ngoặc kép ở mọi câu SQL, quên một chỗ là lỗi "relation does not exist". Phía .NET không bị ảnh hưởng vì EF tự map |
| Q2 | CMS .NET cũ (`CmsDiChoiThoi.Web`) | **A.** Chỉ đổi provider cho build được, không chuyển các bảng không tồn tại. **B.** Gỡ hẳn project | **A** trong plan này (giữ phạm vi gọn). Gỡ CMS cũ là việc riêng, vì zinoflow đã thay nó |
| Q3 | `dbo.Hotel`/`dbo.HotelGroup` trên trang chủ | **A.** Tạo 2 bảng rỗng trên PG để trang chủ chạy như cũ. **B.** Bỏ khối khách sạn v1 khỏi trang chủ | **A** trong plan này. Việc bỏ khối v1 nên gộp vào đợt redesign trang chủ (memory `dichoithoi-homepage-footer-redesign-idea`) |
| Q4 | Kiểu cột ngày giờ | **A.** `timestamptz`: lưu UTC, .NET đổi sang giờ VN khi hiển thị. **B.** `timestamp` (không múi giờ), giữ đúng ngữ nghĩa `datetime` hiện tại | **A.** zinoflow vốn ghi UTC (`SYSUTCDATETIME`). Npgsql 6+ mặc định theo hướng này. Cái giá: phải rà 18 chỗ `DateTime.Now` và mọi chỗ hiển thị ngày (badge ContentUpdatedAt/LastVerifiedAt) |

## Các giai đoạn

### Giai đoạn S — Đổi mật khẩu DB bị lộ — ⏸ NGƯỜI DÙNG CHỌN GIỮ NGUYÊN (26/09/2026)

Người dùng đã biết rủi ro và quyết định giữ mật khẩu hiện tại. Không tự sửa, không nhắc lại
mỗi phiên. Vẫn giữ nội dung dưới đây để làm khi người dùng yêu cầu.

- Đổi mật khẩu user `DB_A5DA02_dichoithoi_admin` trên SmarterASP.
- Xoá `TestDbContext.cs`, hoặc bỏ `OnConfiguring` ghi cứng. Mật khẩu cũ vẫn nằm trong lịch sử git, nên đổi mật khẩu là bắt buộc, không thể thay bằng việc xoá file.
- **Phụ thuộc:** không.
- **DoD:** đăng nhập bằng mật khẩu cũ bị từ chối. `grep -r "Password=" --include=*.cs` trong repo dichoithoi ra 0 kết quả.

### Giai đoạn 0 — Trích xuất những gì cần SQL Server — ✅ XONG 26/09/2026

**Kết quả:** script `dichoithoi/scripts/postgres-migration/export-sqlserver-schema.ps1`,
output ở `sqlserver-export/`, đã commit trong repo dichoithoi (xem README cùng thư mục,
có bảng chuyển kiểu SQL Server → PG).
- Xuất TOÀN BỘ 26 bảng (không chỉ 21), để quyết định Q2/Q3 có đủ dữ liệu:
  278 cột, 41 index, 13 FK, 0 check, 10 identity, 50 default.
- Danh mục: Province 34, TypeGroup 4, Type 18, Tag 17. Đã kiểm tra tiếng Việt có dấu đúng.
- Phát hiện thêm: filtered index `IX_v2Destination_Priority (Priority, Order) WHERE [Priority]<=(2)`
  trên `v2.Destination`.
  Phải tái tạo bằng partial index (`HasFilter`) ở Giai đoạn 1.
- Các giá trị default gặp: `((0))`, `((1))`, `((3))`, `(getdate())`, `(sysutcdatetime())`,
  `(N'')`, `('no-rule')`.

Việc ban đầu (giữ để tham chiếu):
- Xuất metadata schema của 19 bảng `v2` + `dbo.Hotel` + `dbo.HotelGroup` ra JSON:
  cột, kiểu, nullable, default, PK, FK, index, identity. Truy vấn từ `sys.*`.
- Xuất dữ liệu danh mục ra JSON: `v2.Province`, `v2.DestinationTypeGroup`,
  `v2.DestinationType`, `v2.DestinationTag`.
- Lưu vào `D:\Gits\mmo\migration-mac-2026-09-26\postgres-migration\`.
- **Phụ thuộc:** không. Đây là việc duy nhất **bắt buộc** làm trên Windows, vì Mac sẽ không có SQL Server.
- **DoD:** file JSON có đủ 21 bảng. Số dòng danh mục khớp 34/4/18/17. Một cột mẫu (`v2.Destination.Slug`) có đúng kiểu/độ dài/unique index như trong DB.

### Giai đoạn 1 — Đưa schema vào EF Core Migrations (repo dichoithoi, trên Mac) — ✅ XONG 27/09/2026

**Kết quả** (repo dichoithoi, tất cả nằm trong `DiChoiThoi.Common`):
- Package: `Npgsql.EntityFrameworkCore.PostgreSQL` 9.0.4, `EFCore.NamingConventions` 9.0.0,
  `Microsoft.EntityFrameworkCore.Design`. Nâng các package EF từ 9.0.0 lên 9.0.1, vì Npgsql 9.0.4 yêu cầu tối thiểu 9.0.1.
- `DbEntities/DiChoiThoiPostgresOptions.cs`: extension `UseDiChoiThoiPostgres(connStr)` (Npgsql +
  snake_case + bảng history `__ef_migrations_history`) và design-time factory cho `dotnet ef`.
  **Ở GĐ 2, 2 file `Program.cs` PHẢI gọi extension này**, không gọi thẳng `UseNpgsql`. Nếu không,
  tên cột sẽ lệch với migration.
- `DbEntities/DiChoiThoiDbContext.Postgres.cs`: default, index (có INCLUDE + partial index), FK,
  loại 17 entity v1 không có bảng khỏi migration (Q2), cấu hình `dbo.Hotel`/`HotelGroup` (Q3).
  **Lưu ý:** `EFCore.NamingConventions` KHÔNG đổi tên bảng đã khai báo tường minh bằng `[Table("Destination")]`,
  nó chỉ đổi tên cột. Vì vậy file này tự đổi tên bảng sang snake_case (chỉ khi provider là Npgsql).
- Entity mới: `V2DestinationRelation`, `V2Transport`, `V2TransportStop`. Bỏ các `TypeName`
  `nvarchar(max)`/`datetime`, đổi `money` thành `decimal(19, 4)`.
- Migration `InitialPostgres` + `SeedCatalog`. Migration seed đọc 4 file JSON của GĐ 0 (nhúng làm
  embedded resource ở `Migrations/Seed/`), giữ nguyên Id rồi `setval` sequence lên `max(id)`.
- `scripts/postgres-migration/compare-pg-schema.py`: đối chiếu DB PG với `schema.json`. GĐ 4 dùng lại để
  kiểm tra DB trên SmarterASP.

**Tên trên PG (GĐ 3 cần biết khi viết lại adapter zinoflow):**
- Bảng `v2.*` thành snake_case, vd `v2.destination`, `v2.destination_content`, `v2.hotel_destination_map`.
  `dbo.Hotel`/`dbo.HotelGroup` thành `public.hotel`/`public.hotel_group`.
- Cột: `ProvinceId` thành `province_id`, `NameUnaccented` thành `name_unaccented`. Cột `order` là từ khoá SQL,
  nên phải viết `"order"`.
- `tinyint` thành `smallint`, `bit` thành `boolean` (adapter phải gửi `true/false`, không gửi `1/0`),
  ngày giờ thành `timestamptz`.

**Khác biệt có chủ ý so với SQL Server** (ngoài bảng chuyển kiểu):
- Bỏ cột `v2.DestinationContent.ItineraryJson`: đã ngừng đọc/ghi từ 07/2026, xem
  zinoflow migration `1782070000000-DestinationDropItinerary`.
- EF tự tạo thêm 3 index trên cột FK (`destination_tag_map.tag_id`, `hotel.province_id`, `tour.province_id`).
- Không chuyển các bảng v1 `dbo.Destination` (271 dòng), `DestinationDetail`, `DestinationReview` (74 dòng),
  `Province`, `DestinationGroup`: website không đọc các bảng này, chỉ CMS cũ dùng (Q2).
  Dữ liệu vẫn còn trong `.bak` ngày 26/09.

**Lệnh:**
```bash
cd dichoithoi
dotnet ef database update --context DiChoiThoiDbContext --project DiChoiThoi.Common --startup-project DiChoiThoi.Common
python3 scripts/postgres-migration/compare-pg-schema.py        # phải in "KHOP"
# DB khác: ConnectionStrings__DiChoiThoiDb="Host=...;Database=...;Username=...;Password=..." dotnet ef database update ...
```

Việc ban đầu (giữ để tham chiếu):
- Thêm `Npgsql.EntityFrameworkCore.PostgreSQL` 9.x (+ `EFCore.NamingConventions` nếu Q1 = A).
- Bổ sung entity còn thiếu: `V2DestinationRelation`, `V2Transport`, `V2TransportStop`.
  Lấy định nghĩa từ metadata ở Giai đoạn 0, không lấy từ doc markdown.
- Thay `TypeName`: `nvarchar(max)` thành `text`, `datetime` thành `timestamptz` (theo Q4), `money` thành `numeric(19,4)`.
- Giữ nguyên unique index, FK và default của Giai đoạn 0, bằng Fluent API trong `OnModelCreating`.
- `dotnet ef migrations add InitialPostgres`. **Từ đây dichoithoi là nơi duy nhất sở hữu schema**,
  đúng nguyên tắc "schema owned by dichoithoi" trong copilot-instructions.
- Seed dữ liệu danh mục từ JSON của Giai đoạn 0: dùng `HasData` hoặc một script seed riêng.
- **Phụ thuộc:** Giai đoạn 0 (metadata + dữ liệu danh mục), cùng các quyết định Q1/Q3/Q4.
- **DoD:** `dotnet ef database update` trên PG 18 local tạo đủ schema. Một script
  so sánh cột/kiểu/nullable/unique giữa `information_schema` của PG và JSON Giai đoạn 0
  chỉ ra khác biệt đúng với các thay đổi kiểu có chủ ý. Số dòng danh mục 34/4/18/17.

### Giai đoạn 2 — Website .NET chạy trên PG (repo dichoithoi) — ✅ XONG 27/09/2026

**Kết quả:**
- 2 file `Program.cs` gọi `UseDiChoiThoiPostgres(connStr)`. `appsettings.json` + `appsettings.Development.json`
  của cả Web lẫn CMS trỏ `dichoithoi_dev` local. **`appsettings.Release.json` chưa đổi**: vẫn là
  SQL Server site4now, chờ GĐ4 có DB PG trên SmarterASP (đang giữ mật khẩu cũ theo quyết định GĐ S).
- `DBCC CHECKIDENT` (2 chỗ, CMS cũ): bỏ hẳn, vì `DestinationDetail`/`TourDetail` không có bảng trên PG (Q2).
- `EF.Functions.ILike` ở `HotelRepository` + `SimRepository` của website. CMS cũ giữ nguyên `Contains` (Q2).
- `DateTime.Now`: website chỉ dùng cho `lastmod` sitemap (không ghi DB), nên giữ nguyên. CMS cũ ghi
  `Hotel.InsertDate/BookingDate`, đổi sang `UtcNow` (Npgsql từ chối ghi `Kind=Local` vào `timestamptz`).
- Hiển thị ngày: thêm `DateUtil.ToVietnamTime`, dùng cho badge "Cập nhật tháng M/yyyy" và JSON-LD
  `dateModified`/`datePublished` (Schema.NET chỉ in phần ngày, nên phải đổi sang ngày VN trước khi in).
  Lỗi lệch ngày ở JSON-LD có từ bản SQL Server, lần này sửa luôn.
- **DoD đã kiểm tra (curl trên website local, 27/09):** trang chủ, `/diem-den`, `/diem-den/thac-trieu-hai`,
  `/tinh/lam-dong`, `/loai`, `/loai/thien-nhien`, `/loai/thien-nhien/thac-ho-suoi`, `/cam-nang`,
  `/khach-san` trả 200, log không có exception. Tìm "trieu hai", "TRIỆU HẢI", "triệu hải", "Triệu Hải"
  cho cùng kết quả. Với `content_updated_at` = 00:30 ngày 01/09 giờ VN, badge hiện "tháng 9/2026",
  JSON-LD in `2026-09-01` (trước khi sửa: tháng 8 / `2026-08-31`).
- **Lưu ý cache:** index tìm kiếm website nằm trong IMemoryCache. Publish điểm đầu tiên khi website
  đang chạy thì phải gọi `/api/remove-cache/search_index` hoặc restart mới thấy trong ô tìm kiếm.
  Đây là hành vi có sẵn, không do đổi DB.

Việc ban đầu (giữ để tham chiếu):
- `UseSqlServer` thành `UseNpgsql` ở 2 file `Program.cs`. Connection string trong appsettings.
- Thay `DBCC CHECKIDENT` (2 chỗ) bằng lệnh reset sequence của PG, hoặc bỏ nếu thuộc CMS cũ (Q2).
- Các ô tìm kiếm chạy dưới DB: dùng `EF.Functions.ILike` để giữ hành vi không phân biệt hoa/thường.
- Rà 18 chỗ `DateTime.Now`: chỗ nào ghi DB thì đổi sang `UtcNow`. Mọi chỗ hiển thị ngày đổi sang giờ VN (UTC+7).
- **Phụ thuộc:** Giai đoạn 1.
- **DoD (xem bằng mắt qua Playwright, trên Mac):** trang chủ, trang tỉnh, trang cụm,
  trang điểm đến, trang tìm kiếm và `/cam-nang` render không lỗi.
  Tìm "da lat", "ĐÀ LẠT" và "đà lạt" ra cùng kết quả.
  Một điểm có ContentUpdatedAt = 23:30 giờ VN hiển thị đúng ngày, không bị lệch sang hôm sau.

### Giai đoạn 3 — Viết lại 5 adapter zinoflow sang `pg` — ✅ XONG 27/09/2026

**Kết quả** (`apps/api`):
- `modules/shared/dichoithoi-site-db/`: `DichoithoiSiteDbConnection` (Global module, 1 pool `pg`
  max 5, timeout kết nối 15s / statement 30s, retry 1s/3s **chỉ** khi lỗi kết nối, `transaction()`)
  + `bindNamedParams` (giữ cú pháp `@name` trong SQL cho dễ đọc, đổi sang `$1..$n`).
- 5 adapter `pg-*` thay `mssql-*` (đã xoá). Biến `DICHOITHOI_DB_HOST/NAME/USER/PASSWORD` được thay bằng
  `DICHOITHOI_DATABASE_URL`. Đã cập nhật `.env.example` và `production-endpoint-warning.ts`, và viết lại
  `scripts/check-dichoithoi-connection.ts` (`pnpm check:dichoithoi`) cho PG.
- **Khác hành vi có chủ ý:**
  - Gắn khách sạn/tour vào slug không tồn tại giờ báo lỗi rõ ràng. Bản cũ để SQL Server báo lỗi NOT NULL mơ hồ.
  - Điểm dừng tuyến xe sai slug thì rollback cả transaction và không retry. Bản cũ retry 3 lần một lỗi dữ liệu.
  - Quan hệ "mentioned" dùng `ON CONFLICT DO NOTHING`, nên không còn lỗi PK khi đã có quan hệ nhập tay cùng loại.
  - `ContentHash` giờ là SHA-256 trên UTF-8 (bản cũ hash UTF-16). Publish và sync dùng chung một biểu thức nên vẫn khớp nhau.
  - `ORDER BY rating DESC NULLS LAST` / `price_from NULLS FIRST` để giữ đúng thứ tự NULL như SQL Server.
- **Test tích hợp:** 5 file `*.integration.spec.ts`, 23 test, chạy trên DB riêng `dichoithoi_test`
  (tạo bằng migration dichoithoi, xem `docs/runbook.md`). Advisory lock giúp các suite chạy lần lượt dù
  Jest chạy song song. Không đặt `DICHOITHOI_TEST_DATABASE_URL` thì test tự skip.
- **DoD đã kiểm tra (27/09):** qua API zinoflow (cùng endpoint UI gọi):
  - Publish lại Thác Triệu Hải: tạo `v2.destination` id=1 + nội dung, tiếng Việt đúng.
  - Tạo và gắn 1 khách sạn + 1 tour thử: PG có đủ dòng, card JSON được bake sẵn, trang website hiện cả 2 card.
    Gỡ gắn thì card về `[]`. Dữ liệu thử đã xoá khỏi cả 2 DB.
  - `POST /api/destinations/sync`: kết quả `unchanged: 1`, hash mirror khớp PG.
  - typecheck 4 package sạch, jest 546/546.
  - **Chưa chạy đầu-cuối qua UI cho tuyến xe và bài cẩm nang:** tuyến xe cần ≥2 cụm/tỉnh đã lên
    website (hiện chỉ có 1 POI), bài cẩm nang cần 1 job AI đã duyệt. Hai adapter này được kiểm tra
    bằng test tích hợp trên PG thật (replaceStops/rollback, POI kế thừa cụm cha, upsert bài + map).
    Sẽ kiểm tra lại qua UI khi publish lại dữ liệu thật.
- `mirror`: điểm Thác Triệu Hải trước giữ `site_id=277` (Id SQL Server cũ). Đã đặt về NULL để publish tạo
  lại trên PG (người dùng đã đồng ý xoá rồi publish lại, xem "Hiện trạng").
- Còn dùng `mssql`: `scripts/clone-dichoithoi-to-localdb.ts` (không còn ý nghĩa, xoá ở GĐ5) và
  toàn bộ phần khuyenmai (giữ nguyên).

Việc ban đầu (giữ để tham chiếu):
- Một module kết nối dùng chung cho DB site (pool `pg`, 1 biến `DICHOITHOI_DATABASE_URL`),
  thay cho 7 biến × 5 file hiện tại. Bỏ nhánh msnodesqlv8/LocalDB.
- Chuyển cú pháp:
  - `SCOPE_IDENTITY()` thành `RETURNING id`
  - `MERGE` thành `INSERT ... ON CONFLICT DO UPDATE`
  - `SYSUTCDATETIME()` thành `now()`
  - `TOP (@n)` thành `LIMIT $n`
  - `STRING_AGG` giữ nguyên (PG có hàm này, nhưng kiểm tra lại cú pháp `WITHIN GROUP`)
  - tham số `@name` thành `$1`
- Port không đổi, nên các use case không phải sửa. Đổi tên file `mssql-*` thành `pg-*`.
- Viết **test tích hợp** cho từng adapter, chạy với PG local thật (hiện chưa có test nào).
- Cập nhật `.env.example` và `production-endpoint-warning.ts`.
- 3 script `apps/api/scripts` dùng `mssql` sửa dần khi cần dùng lại, không chặn plan.
- **Phụ thuộc:** Giai đoạn 1 (schema phải tồn tại). **Làm song song với Giai đoạn 2 được.**
- **DoD:** từ UI zinoflow, publish lại Thác Triệu Hải (điểm đã biết kết quả đúng),
  gắn 1 khách sạn, 1 tour, 1 tuyến xe, 1 bài cẩm nang. Query PG thấy đủ dòng, tiếng Việt có dấu đúng.
  Trang trên website local hiển thị đúng. `POST /api/destinations/sync` đồng bộ lại mirror.
  `pnpm -r typecheck` và jest pass.

### Giai đoạn 4 — Thử trên SmarterASP PG + cập nhật tài liệu — ⏸ LÀM LÚC RELEASE

**Quyết định 27/09/2026:** người dùng dời GĐ4 sang lúc release, không dựng DB thử trên SmarterASP
trước. Đến lúc release thì đi theo `dichoithoi-release-checklist.md`: các bước PG đã được ghi thẳng vào
§1 (chuẩn bị), §2 (đưa DB lên), §3 (smoke test). Trước lúc đó, dev chạy hoàn toàn trên PG local
(`dichoithoi_dev`).

Tóm tắt những việc sẽ làm lúc release (chi tiết + lệnh nằm trong checklist):
1. Tạo DB PostgreSQL 18 trên SmarterASP. Kiểm tra kết nối từ xa từ máy Mac, giới hạn số kết nối
   (pool zinoflow đang là 5: `POOL_MAX_CONNECTIONS` trong `dichoithoi-site-db.connection.ts`), SSL.
2. Đưa DB: `pg_dump -Fc dichoithoi_dev` rồi `pg_restore` lên SmarterASP. Bản dump có sẵn schema, danh mục,
   dữ liệu đã publish và `__ef_migrations_history`, nên các migration sau này chạy tiếp được.
3. Đổi cấu hình production: `appsettings.Release.json` của `DiChoiThoi.Web` + `CmsDiChoiThoi.Web`
   (hiện VẪN là connection string SQL Server site4now, chạy với Npgsql sẽ lỗi ngay khi khởi động) và
   `DICHOITHOI_DATABASE_URL` trong `.env` production của zinoflow.
4. Smoke test: `pnpm check:dichoithoi`, `POST /api/destinations/sync`, các trang chính trên domain thật.
5. Sửa tài liệu còn lệch: phần "golive runbook" cũ (lệnh `sqlcmd`, đã có ghi chú đầu file),
   memory `dichoithoi-localdb-encoding-bug` (đánh dấu không còn áp dụng).
6. Giữ bản `.bak` SQL Server production cũ (backup trước khi xoá) để đối chiếu slug và làm redirect.

Kế hoạch ban đầu (giữ để tham chiếu):
- Tạo DB PG 18 trên SmarterASP. Kiểm tra: kết nối từ xa từ máy Mac, giới hạn số kết nối
  (điều chỉnh pool size), và DB có cho tạo extension không (chỉ cần nếu sau này dùng `unaccent`).
- Chạy migration từ local lên DB đó. Trỏ zinoflow vào, publish 1 điểm, rồi deploy website bản thử.
- Sửa các chỗ "lệch tài liệu" liệt kê ở trên. Viết lại phần DB trong release checklist:
  `pg_dump`/`pg_restore` thay cho `.bak`. Cập nhật memory `dichoithoi-localdb-encoding-bug`
  (đánh dấu không còn áp dụng).
- **Phụ thuộc:** Giai đoạn 2 + 3.
- **DoD:** website bản thử trên SmarterASP render trang điểm đến vừa publish từ Mac.
  Release checklist không còn bước nào của SQL Server cho dichoithoi.

### Giai đoạn 5 — Gỡ SQL Server khỏi dichoithoi — ⏸ SAU RELEASE

Làm sau khi GĐ4 xong và site PG chạy ổn trên production ít nhất 1 thời gian. Trước lúc đó, code
`mssql` còn sót (`scripts/clone-dichoithoi-to-localdb.ts`, package `Microsoft.EntityFrameworkCore.SqlServer`)
không ảnh hưởng gì vì không còn nơi nào gọi tới.

- Xoá các adapter `mssql-*` của dichoithoi, cùng `DICHOITHOI_DB_HOST/USER/...` và
  package `Microsoft.EntityFrameworkCore.SqlServer`.
- Giữ lại `.bak` ngày 26/09 và bản backup Atlas 27/07 làm lưu trữ.
- **Phụ thuộc:** Giai đoạn 4 đạt DoD.
- **DoD:** `grep -ri "mssql\|SqlServer\|localdb"` trong code dichoithoi và 5 module zinoflow ra 0 kết quả
  (trừ adapter khuyenmai). Build + test pass.

## Làm ở máy nào

- **Giai đoạn 0: trên máy Windows (✅ đã xong 26/09/2026).** Giai đoạn 0 là
  việc duy nhất cần SQL Server để đọc schema. Làm xong thì Mac **không cần cài Docker SQL Server**.
- **Giai đoạn 1-5: trên Mac.** Đó chính là môi trường đích (PG native). Không nên bắt đầu
  trên Windows rồi dừng giữa chừng lúc chuyển máy.
- Trong thời gian làm Giai đoạn 1-3 trên Mac: zinoflow vẫn chạy bình thường, chỉ các thao tác
  publish sang site bị lỗi. Chấp nhận được vì site chưa go-live.

## Ước lượng

Giai đoạn 0: khoảng 1 giờ. Giai đoạn 1: nửa ngày. Giai đoạn 2: nửa ngày đến 1 ngày.
Giai đoạn 3: 1-2 ngày (phần lớn thời gian là adapter destination 1229 dòng + test tích hợp).
Giai đoạn 4: nửa ngày. Tổng khoảng 3-4 ngày làm tập trung.
