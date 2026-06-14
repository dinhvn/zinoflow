# Laruki & Dochoi3s — AI Content Integration Spec (phân tích 14/06/2026)

Tính năng: dùng AI tool tạo/cập nhật nội dung bài viết cho **laruki.com** và **dochoi3s.com**,
rồi **đẩy nội dung vào CMS cũ** (`khuyenmai`). CMS **giữ nguyên** chức năng replace tag + publish
lên WordPress. Đây là luồng KHÁC HẲN dichoithoi (dichoithoi ghi thẳng DB production, bỏ CMS).

Nguồn đã đọc (14/06/2026): `D:\Gits\mmo\khuyenmai`
- `CmsKhuyenMai.Web/Controllers/WordpressController.cs`
- `CmsKhuyenMai.Service/Services/Wordpress/WordpressService.cs`
- `CmsKhuyenMai.Service/Services/Content/ContentService.cs::ReplaceCodeTagAsync`
- `CmsKhuyenMai.Service/Utilities/ContentUtil.cs` (parse tag)
- `KhuyenMai.Common/Data/WordpressPost.cs` (bảng đích), `Enums/ContentDataType.cs`, `Enums/PostContentType.cs`

## 1) Luồng hiện tại (thủ công) — đã verify từ source

```
[B1] Tạo 1 post trên WordPress admin (laruki/dochoi3s) — post rỗng/khung
[B2] CMS "Init Auto Post": load post từ WP API về, lưu thành 1 dòng WordpressPost trong DB CMS
       (FixedContent = post.Content.Rendered; CMS gỡ <p> quanh tag: <p>[tag]</p> -> [tag])
[B3] CMS "Auto Post Detail": người dùng sửa nội dung + chèn TAG theo cú pháp [Type_Param:value],
       chọn PostType / Category / Supplier / PostSettingCode, bật IsReadyAuto
[B4] CMS "Publish": đọc nội dung, REPLACE tag bằng dữ liệu thật (sản phẩm/affiliate/...),
       ghép bài hoàn chỉnh rồi UPDATE ngược lên WordPress post (WordPressPCL Posts.UpdateAsync)
```

Sản phẩm/khuyến mãi được CMS **cào tự động hằng ngày**; cập nhật bài chạy theo **lịch tự động hoặc tay**
(`AutoPostDate`, `SchedulerType`, `wordpress_publish_all`).

### 1.1 Cơ chế TAG (cốt lõi — AI tool KHÔNG đụng vào)
- Tag nằm trong nội dung dạng `[Type_Param:value;Param2:v1,v2]`. Parse bằng regex `\[(.+?)\]`
  (`ContentUtil.GetReplaceList`).
- `Type` ∈ `ContentDataType`: **SellerList, ProductList, Product, DateTime, QA, Link, SaleList**.
  Ví dụ người dùng nêu: `[ProductList_ProductTag:innisfree-jeju]`, `[ProductList_SupplierCode:juno,ely]`.
- Khi publish (`ContentService.ReplaceCodeTagAsync`), CMS thay tag bằng HTML thật (danh sách sản phẩm,
  link affiliate kèm UTM, ...) từ dữ liệu đã cào. **Tag trong DB CMS giữ nguyên** — chỉ thay lúc publish.
- ⚠️ Ràng buộc HTML: tag KHÔNG được bọc trong `<p>` (CMS chủ động gỡ `<p>[tag]</p>` → `[tag]`).

### 1.2 Bảng đích `WordpressPost` (DB CMS, SQL Server site4now.net)
| Cột | Vai trò | AI tool ghi? |
|---|---|---|
| Id | PK CMS | (đọc) |
| SiteId | 1=Laruki, 2=Dochoi3s | (đọc) |
| PostId | id post bên WordPress | (đọc) |
| Title | tiêu đề | ✅ có thể |
| **FixedContent** | **thân bài (chứa tag)** — phần chính người dùng soạn | ✅ **AI ghi vào đây** |
| TopDescription | mô tả đầu bài | ✅ tùy chọn |
| FotterDescription | mô tả cuối bài | ✅ tùy chọn |
| Excerpt | mô tả ngắn (≤512) | ✅ tùy chọn |
| PostType, CategoryCode, SupplierCode, PostSettingCode, BrandCodes | cấu hình replace tag | ❌ người dùng (CMS) |
| ContentTags | JSON tóm tắt tag (CMS tự sinh) | ❌ CMS |
| IsReadyAuto, SchedulerType, AutoPostDate | cờ publish/lịch | ❌ người dùng (CMS) |
| Link, DatePublished, PublishError | trạng thái publish | ❌ CMS |

Bài publish cuối = `TopDescription + AutoContent(tag đã thay) + FixedContent(tag đã thay) + FotterDescription`.

## 2) Vai trò AI tool (đã chốt 14/06/2026)

**AI tool là NGUỒN SỰ THẬT của nội dung.** CMS thu hẹp còn 2 việc: **(a) Init** (đăng ký mapping
post WordPress ↔ CMS) và **(b) Publish** (replace tag → đẩy lên WordPress). **Người dùng KHÔNG còn
sửa content trong CMS** — mọi soạn thảo/cập nhật ở AI tool, để đồng bộ 1 luồng.

### 2.1 AI ghi gì — DUY NHẤT 1 content
- AI sinh **một content duy nhất** chứa **toàn bộ bài** (bỏ tách Top/Footer — đó là cách chia của CMS
  cũ; WordPress chỉ có 1 mục `content`). Ghi vào `WordpressPost.FixedContent`
  (TopDescription/FotterDescription sẽ bỏ dần).
- AI sinh **HTML đã sanitize** (tái dùng `ExportDraftHtmlUseCase`), hợp `disable_wp_auto_p` của theme
  (HTML đủ thẻ `<p>`). Riêng dòng chứa TAG **không bọc `<p>`** (CMS yêu cầu — §1.1).

### 2.2 Tag: AI gợi ý + bảo toàn khi cập nhật (phương án Y)
- AI **chủ động gợi ý + chèn tag** (`[ProductList_...]`, `[SellerList_...]`, ...) vào đúng vị trí hợp lý
  trong bài. Người dùng có thể **cung cấp trước thông tin tag** (supplier/product code, loại block muốn có)
  để AI đặt cho khớp ngữ cảnh.
- AI tool quản lý tag như **dữ liệu có cấu trúc** (loại + tham số + vị trí trong bài), không chỉ chuỗi
  nhúng → khi **cập nhật/viết lại**, AI **giữ nguyên các tag đã có** và viết lại văn xuôi quanh chúng
  (phương án Y). Không bao giờ làm mất tag (vì content + tag đều nằm trong AI tool, có version history).
- AI **không bịa dữ liệu sản phẩm/giá** — số liệu thật do CMS replace tag lúc publish (dữ liệu cào hằng ngày).

### 2.3 Cơ chế tích hợp AI tool ↔ CMS (đã chốt: **Phương án R — ghi thẳng SQL Server**)
**AI tool CHỈ đọc/ghi DB CMS (SQL Server), KHÔNG bao giờ chạm WordPress.** CMS giữ vai Init + Publish;
việc tạo post WordPress xảy ra **lúc publish đầu tiên** (không cần API CMS mới).

- **Cập nhật bài (sửa content):** AI tool `UPDATE WordpressPost SET FixedContent, Title, Excerpt... WHERE Id`.
- **Tạo bài mới:** AI tool `INSERT WordpressPost` với **PostId = 0** (chưa có WP post), Link = "" tạm,
  Title + FixedContent từ bài AI, IsReadyAuto = true.
- **Publish (sửa nhẹ CMS — việc bên repo khuyenmai):** `CreateContentAndPublishPostAsync` thêm nhánh:
  nếu `PostId == 0` → `client.Posts.CreateAsync` (tạo WP draft) → lưu PostId + Link về `WordpressPost`;
  nếu đã có PostId → `Posts.UpdateAsync` như cũ. Replace tag vẫn chạy như hiện tại.
- Adapter phía AI tool: DataSource `mssql` thứ 2 trong infrastructure (giống publisher dichoithoi),
  lazy connect + timeout + retry. Connection string là secret (env `KHUYENMAI_DB_*`).

Hệ quả: luồng **một chiều ghi** — AI tool soạn (mới/sửa) → ghi thẳng SQL Server → người dùng vào CMS bấm
**Publish** (lần đầu tự tạo WP post, lần sau update). Hết copy-paste, hết đồng bộ id tay.

## 3) UI trong AI tool

### 3.1 Menu tách theo site (giống yêu cầu)
```
├─ Laruki                /laruki        (list bài + tạo/cập nhật content)
├─ Dochoi3s              /dochoi3s      (list bài + tạo/cập nhật content)
```
Hai site **luồng giống hệt nhau**, chỉ khác **template/prompt pack** (§4). Có thể dùng chung 1 route
`/cms-content/[site]` + component dùng chung, tách hiển thị theo `siteCode` — tránh nhân đôi code.

### 3.2 Màn list (mirror từ CMS)
- Lấy danh sách bài từ CMS `WordpressPost` (theo SiteId) về **mirror** trong Postgres (giống dichoithoi):
  Title, Link, PostType, trạng thái nội dung (đã có bài AI / chưa), DateUpdated, IsReadyAuto.
- Filter theo PostType / category / có tag / chưa có content AI. Search theo tên.
- Nút: **Đồng bộ từ CMS**, (giai đoạn 2) tạo bài mới.

### 3.3 Màn detail
- Thông tin bài (Title, Link, PostType, tag hiện có trong FixedContent — chỉ đọc để tham khảo).
- Khu **"Viết bài bằng AI"**: ô nhập **mô tả/ngữ cảnh** để AI gen (giống dichoithoi: userNotes + URL nguồn),
  chọn provider/model (đã có), chọn template theo PostType.
- Nút **Tạo bài AI** / **Cập nhật bài** → generate qua pipeline ai-content → review/duyệt →
  **Ghi vào CMS** (FixedContent). Sau bước này người dùng sang CMS chèn tag + publish như cũ.
- Preview HTML sẽ ghi; cảnh báo nếu nội dung lỡ bọc `<p>` quanh chỗ dự định chèn tag.

## 4) Template tạo content khác nhau theo site

- Tái dùng hệ **prompt template** đã build (`/prompts`, bảng `prompt_templates` + DEFAULT_PROMPTS):
  thêm articleType riêng cho khuyenmai theo `PostContentType` (DSKhuyenMai, TopProduct, Product,
  MaGiamGia, ...) và/hoặc theo site.
- Mỗi site có giọng + rule riêng (laruki: fashion/beauty — tránh claim y khoa; dochoi3s: kids/toy —
  nhấn độ tuổi/an toàn) → đi vào **SiteProfile** (spec chính §19) cùng prompt pack.
- AI **không sinh số liệu sản phẩm/giá** (cái đó là việc của tag + dữ liệu cào) — chỉ viết phần văn xuôi
  giới thiệu/đánh giá/hướng dẫn quanh các block sản phẩm.
- **Nguồn tham khảo (đặc biệt dochoi3s):** prompt cho phép người dùng **cấp trước URL tham khảo
  (có thể là trang tiếng Anh)**; tái dùng `ReferenceFetcher` (đã có ở dichoithoi: fetch text + SSRF guard,
  cắt ~8k ký tự) đưa vào `sourceContext`, **kết hợp kiến thức nền của model**, prompt ép viết hợp
  niche đồ chơi (độ tuổi, an toàn, kỹ năng) và **xuất tiếng Việt có dấu** dù nguồn tiếng Anh.
- **Tag trong TIÊU ĐỀ:** title cũng có thể chứa tag ngày (`[Year]`, `[MonthYear]` — `DateTime`) — quan sát
  thực tế từ DB. AI giữ/đặt được các tag này trong tiêu đề (phương án Y áp cho cả Title).

## 5) Luồng "tạo bài MỚI" (đã chốt: tạo WP post khi publish lần đầu)

```
[AI tool] soạn bài mới (prose + tag) → duyệt
   → INSERT WordpressPost (PostId=0, Title, FixedContent, IsReadyAuto=true) thẳng SQL Server
   → lưu mirror Postgres (đánh dấu "chưa publish, chưa có WP post")
[CMS]  người dùng bấm Publish
   → thấy PostId==0 → Posts.CreateAsync (tạo WP draft) → lưu PostId+Link
   → replace tag → đẩy nội dung lên WP → cập nhật DatePublished
[Lần publish sau] PostId đã có → Posts.UpdateAsync như cũ
```
Không tạo tay trên wp-admin, không đồng bộ id tay. Việc duy nhất bên repo khuyenmai: thêm nhánh
"create-if-missing" trong method publish (§2.3).

## 6b) Ngoài phạm vi MVP (giai đoạn sau)
- **Tự động publish**: giữ ở CMS (lịch + nút). Giai đoạn sau AI tool có thể gọi API publish.
- **Ảnh featured**: chờ Image Tool.
- **Bỏ hẳn Top/FooterDescription** bên CMS (gộp về 1 content) — việc bên repo khuyenmai, làm song song.

## 6) Quyết định

Đã chốt (14/06/2026):
- ✅ AI tool là nguồn sự thật content; CMS chỉ Init + Publish; **người dùng không sửa content trong CMS**.
- ✅ AI sinh **1 content duy nhất** (bỏ Top/Footer); ghi `FixedContent`.
- ✅ Tag: **AI gợi ý + chèn** (người dùng cấp trước thông tin tag); cập nhật theo **phương án Y** (giữ tag, viết lại prose quanh).
- ✅ Mỗi site 1 menu, dùng chung component, **template/prompt pack khác nhau**.

Đã chốt thêm (cùng ngày):
- ✅ **Tích hợp = ghi thẳng SQL Server** (phương án R). AI tool không chạm WordPress.
- ✅ **Bài mới**: INSERT PostId=0, CMS tạo WP post lúc publish lần đầu (sửa nhẹ method publish bên khuyenmai).
- ✅ **Mirror Postgres** danh sách `WordpressPost` per site (như dichoithoi) để list/filter/trạng thái.

Còn cần làm/chốt:
1. ✅ **Kết nối** SQL Server CMS từ local — XÁC NHẬN OK (14/06/2026, `pnpm check:khuyenmai`):
   đọc được `WordpressPost` (Laruki 110 bài, Dochoi3s 11 bài), tiếng Việt có dấu đúng.
   Env `KHUYENMAI_DB_*` (trong `.env`, gitignored).
2. **Sửa CMS** (repo khuyenmai, song song): nhánh create-if-missing trong `CreateContentAndPublishPostAsync`.
3. **Schema tag có cấu trúc trong AI tool**: chốt tham số theo từng `ContentDataType`
   (ProductList/SellerList: SupplierCode, SellerCode, ProductTag, BrandCode, Format...; Product; Link; QA; DateTime; SaleList)
   để render ra chuỗi `[Type_Param:value;...]` chuẩn + bảo toàn khi viết lại (phương án Y).
4. **Prompt pack / template** riêng laruki vs dochoi3s theo `PostContentType` (tái dùng màn `/prompts`).

## 7) So sánh nhanh với dichoithoi (để định hình kỳ vọng)
| | dichoithoi | laruki / dochoi3s |
|---|---|---|
| Đích ghi | DB website production (bỏ CMS) | **DB CMS cũ** (CMS giữ vai trò) |
| AI ghi gì | toàn bộ bài + metadata + auto-link | **chỉ văn xuôi FixedContent** |
| Tag/replace | không có | **CMS giữ** (AI không đụng) |
| Publish lên web | AI tool publish | **CMS publish** (tag-replace → WP) |
| Quan hệ/related | AI tool tính | không (việc của CMS/WP) |
| Độ phức tạp tích hợp | cao | **thấp** (chỉ đọc/ghi 1 bảng) |
