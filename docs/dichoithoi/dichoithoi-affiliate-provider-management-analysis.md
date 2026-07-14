# Phân tích: quản lý "Đối tác affiliate" (nguồn) — 13/07/2026

Mục đích: bàn cách quản lý tập trung danh sách nguồn/nhà cung cấp affiliate
(Klook, Vexere, Booking.com...) dùng chung cho vé điểm đến / vé xe / vé máy
bay / tour / khách sạn, và cách tạo link affiliate từ link gốc theo từng
mạng affiliate (Accesstrade, bên thứ 3 khác...).

Trạng thái: **NHÁP PHÂN TÍCH — chờ bạn duyệt trước khi đổi code/schema**,
đúng quy trình đang áp dụng cho các module khác trong phiên làm việc này.

## 1. Đã có sẵn những gì (đọc code thật, không đoán)

Cơ chế convert link gốc → link affiliate đã được thiết kế và build từ 07/2026
(`dichoithoi-affiliate-link-conversion-spec.md`), dùng CHUNG cho `ticketLinks[]`
(vé điểm đến), khách sạn, tour. Bảng hiện có:

```sql
affiliate_link_rules (
  id, provider UNIQUE, match_domain, template, placeholder,
  is_active, notes, created_at, updated_at
)
```

- Có sẵn màn quản lý `/dichoithoi/affiliate` — CRUD rule (thêm/sửa/tắt) +
  nút "Áp dụng lại" (1 rule hoặc toàn bộ) qua pg-boss.
- Thuật toán convert (`resolveAffiliateLink` — `affiliate-link-rule.ts`):
  khớp `provider` CHÍNH XÁC (nếu người dùng chỉ định) hoặc tự nhận diện theo
  `matchDomain` từ `sourceUrl` → áp `template` (thay `{placeholder}` bằng
  `sourceUrl`, có/không URL-encode).
- **1 dòng rule = 1 provider = 1 mẫu link** — đã đúng ý "provider" như 1 thực
  thể (không phải chỉ là chuỗi rời rạc), chỉ là đang thiếu vài field hiển
  thị/quản trị mà bạn cần.

## 2. Vấn đề thực tế phát hiện được (đọc UI 3 nơi dùng `provider`)

Cả 3 form nhập link — `destination-ticket-links-editor.tsx` (vé),
`khach-san/page.tsx` (khách sạn), `tour/page.tsx` (tour, cùng pattern) —
đều để **`provider` là ô nhập TEXT TỰ DO**, không phải dropdown:

```tsx
<Input placeholder="provider (vd: klook)" value={form.provider} ... />
```

Hậu quả cụ thể (không phải giả định — suy trực tiếp từ thuật toán
`resolveAffiliateLink`):
- Rule khớp theo provider **CHÍNH XÁC TỪNG KÝ TỰ** (`r.provider ===
  explicitProvider`). Gõ `"Klook"` (viết hoa) trong khi rule lưu `"klook"`
  → KHÔNG khớp → âm thầm rơi vào `linkStatus: "no-rule"`, giữ nguyên
  `sourceUrl` → **mất hoa hồng mà không ai biết**, đúng kịch bản mà chính
  spec §1.3 đã cảnh báo phải tránh ("không âm thầm sai/thiếu hoa hồng") —
  nhưng lại đang xảy ra ở đúng chỗ nhập liệu, vì thiếu ràng buộc.
- Không có nơi nào liệt kê "các provider đang có sẵn" khi nhập — người dùng
  phải nhớ đúng chính tả provider đã tạo rule trước đó.
- Không có khái niệm **nhóm theo mạng affiliate** (Accesstrade quản lý
  nhiều nguồn: Klook, Vexere, Traveloka...) — hiện mỗi provider là 1 dòng
  rời rạc, không biết dòng nào thuộc mạng nào khi nhìn danh sách.
- Không có chỗ lưu thông tin tham khảo (link trang chủ nguồn, mô tả loại
  vé/dịch vụ nguồn đó cung cấp) — hiện `notes` là text tự do, không có cấu
  trúc, không import hàng loạt được.

## 3. SỬA LẠI — bạn chỉ ra đúng: rule nên gắn theo MẠNG, không phải theo từng nguồn

Bạn phản hồi: *"chỉ cần if == accesstrade thì tạo bằng rule A, cái khác tạo
bằng rule B"*. Điều này đúng và làm lộ ra chỗ tôi đề xuất sai ở bản nháp
trước — cần sửa lại tận gốc, không chỉ thêm field hiển thị.

**Vì sao đúng (theo đúng cách Accesstrade hoạt động thực tế)**: link
deep-link của 1 mạng affiliate (Accesstrade, Adpia...) thường dùng CHUNG 1
mẫu wrapper cho MỌI nguồn tham gia mạng đó — vd
`https://go.acesstrade.vn/deep_link/{aff_id}?url={url_enc}` — `aff_id` là
mã của CHÍNH BẠN (publisher), giống nhau dù link đích là Klook hay Vexere;
Accesstrade tự nhận diện nguồn/tính hoa hồng dựa trên domain nằm TRONG
`url` được bọc. Vậy **1 mạng affiliate = 1 rule/template dùng chung cho mọi
nguồn thuộc mạng đó** — không phải 1 nguồn = 1 template riêng như model cũ
đang giả định (sai).

→ Cần đổi thành **model 2 tầng**: `affiliate_networks` (mạng — nơi giữ rule
convert) và `affiliate_partners` (nguồn cụ thể — Klook, Vexere, Booking...,
mỗi nguồn CHỌN thuộc mạng nào).

```sql
-- MANG affiliate (rule convert nam o day, dung chung cho moi nguon cua mang)
CREATE TABLE affiliate_networks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          varchar(64) UNIQUE,   -- "accesstrade" | "direct" | ten mang khac
  name          varchar(128),         -- "AccessTrade Việt Nam"
  template      varchar(1024),        -- mau link CHUNG, vd ".../deep_link/{aff_id}?url={url_enc}"
  placeholder   varchar(16) DEFAULT '{url_enc}',
  is_active     boolean DEFAULT true,
  notes         text,
  created_at, updated_at
);

-- NGUON cu the (Klook, Vexere, Booking...) — day la danh sach ban muon import tu Sheet
CREATE TABLE affiliate_partners (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          varchar(64) UNIQUE,   -- "klook" — khop dung ticketLinks[].provider hien tai
  name          varchar(128),         -- "Klook"
  homepage_url  varchar(512),         -- "https://www.klook.com/"
  description   text,                 -- "vé tham quan, vé xe..."
  network_id    uuid NULL REFERENCES affiliate_networks(id),  -- NULL = chua gan mang / ban tu quan ly rieng
  match_domain  varchar(256) NULL,    -- goi y auto-chon dropdown khi dan link, KHONG dung de convert nua
  is_active     boolean DEFAULT true,
  created_at, updated_at
);
```

**Thuật toán convert v2** (thay hẳn §3 spec cũ):
1. Có `provider` (bắt buộc chọn ở form, mục 5) → tra `affiliate_partners`
   theo `code`.
2. Không tìm thấy partner, hoặc `partner.isActive=false`, hoặc
   `partner.networkId IS NULL` → `linkStatus='no-rule'` (giữ nguyên
   `sourceUrl`, đúng nguyên tắc "không bịa" đã có).
3. Có `networkId` → tra `affiliate_networks`; mạng `isActive=false` →
   cũng `no-rule`.
4. Còn lại → áp `template` của MẠNG (không phải của partner) vào
   `sourceUrl` → `affiliateUrl`, `linkStatus='converted'`.

Ví dụ cụ thể theo đúng câu bạn nói: Klook, Vexere, Traveloka đều
`network_id` trỏ tới dòng "Accesstrade" (1 template A) → tự động dùng
CHUNG 1 rule. Sau này có nguồn đi qua mạng khác (vd nguồn X qua "Adpia")
→ chỉ cần set `network_id` của nguồn X trỏ dòng "Adpia" (rule B) — không
đụng gì tới các nguồn Accesstrade khác.

**`match_domain` vẫn giữ lại ở partner** nhưng đổi vai trò: KHÔNG còn dùng
để chọn template (giờ template lấy theo network) — chỉ dùng để tự động GỢI
Ý sẵn dropdown provider khi người dùng dán 1 `sourceUrl` vào form (tiện,
không bắt buộc).

**Rủi ro migration dữ liệu cũ**: đã xác nhận ở phân tích Vé trước đó —
`ticketLinks[]` đang **0% dữ liệu thật** trên `dichoithoi_dev` (272 điểm),
Hotel/Tour cũng mới build, khả năng cao bảng `affiliate_link_rules` hiện
tại gần như trống hoặc chỉ có vài dòng test → tạo 2 bảng mới sạch, không
cần viết migration chuyển đổi dữ liệu phức tạp từ bảng cũ.

## 4. SỬA LẠI — import Google Sheet PUBLIC, không cần Service Account

Bạn từ chối hướng Service Account (mục 4 bản trước) — đúng là thừa phức
tạp nếu Sheet có thể để public. Bạn sẽ cung cấp 1 link Google Sheet công
khai, đọc thẳng — tôi đã khảo sát cách `zinora` (`apps/ui-react/src/pages/cms`)
đang làm việc này thật trong 1 dự án khác, và đề xuất áp dụng đúng ý tưởng
đó (chỉ khác ngôn ngữ: NestJS thay vì Express, nhưng cùng cơ chế):

**Cách lấy dữ liệu — không cần OAuth/API key/Service Account:**
- Sheet chỉ cần ở chế độ chia sẻ **"Bất kỳ ai có link — Người xem"**
  (không cần "Publish to web").
- Convert URL sheet bạn dán (`https://docs.google.com/spreadsheets/d/<ID>/edit?gid=<GID>#gid=<GID>`)
  thành URL export CSV: `https://docs.google.com/spreadsheets/d/<ID>/export?format=csv&gid=<GID>`
  (tách `<ID>` bằng regex, `gid` mặc định `0` nếu URL không có).
- Backend gọi `fetch` tới URL CSV đó (có timeout + retry theo đúng rule
  chung "external call" của dự án — CLAUDE.md §4), parse bằng package
  `csv-parse`.

**Map cột theo TÊN HEADER, không hardcode vị trí** (giữ nguyên ý tưởng cũ,
đúng cách zinora làm): đọc dòng đầu làm header, chuẩn hoá tên cột (bỏ dấu,
lowercase, khoảng trắng → `_`) rồi khớp với field cần
(`code/name/link/description/network/status`) — cho phép bạn đổi thứ tự
cột hoặc đặt tên hơi khác trong Sheet mà không vỡ import.

**CHỐT: lưu thẳng luôn, không preview** — đúng cách zinora làm. Nút "Đồng bộ
từ Google Sheet" → BE đọc CSV → parse → upsert thẳng vào `affiliate_partners`
theo `code` → trả về `{inserted, updated, skipped}` (kèm lý do skip nếu có,
vd thiếu `code`) hiển thị ngay dạng thông báo kết quả, không có màn xem
trước. Đơn giản hơn, đúng tinh thần "workflow chạy tay thỉnh thoảng, không
cần nặng nề".

## 4.1 SỬA LẠI — gán "mạng affiliate" là bước RIÊNG, sau khi import (không phải lúc import)

Vì import giờ lưu thẳng (không còn màn preview để đặt dropdown), gán mạng
tách thành bước 2 độc lập, làm trong chính màn danh sách đối tác
(`/dichoithoi/affiliate`, tab "Đối tác"):

- Cột "loại affiliate" từ Sheet lưu tạm vào 1 field tham khảo (vd
  `description` nối thêm, hoặc field `rawNetworkLabel` riêng — chỉ để bạn
  đọc gợi nhớ, KHÔNG dùng để suy luận `network_id`).
- Sau khi import, danh sách đối tác hiển thị rõ dòng nào **"Chưa gán
  mạng"** (badge cảnh báo) — mỗi dòng có sẵn **`Select` dropdown "Gán
  mạng"** ngay tại chỗ (liệt kê `affiliate_networks` đã tạo ở mục 3), chọn
  xong lưu ngay (giống pattern inline-edit `DestinationHotelPanel` đã có) —
  không cần vào form sửa riêng.
- Loại bỏ hoàn toàn rủi ro auto-match sai tên mạng — chọn tay dropdown luôn
  đúng 100%, không cần thuật toán so khớp chuỗi.

## 5. Đổi 3 form nhập link — bắt buộc chọn từ danh sách (giữ nguyên như đã chốt)

Thay ô `Input` provider tự do bằng `Select` bắt buộc ở cả 3 nơi:
- `destination-ticket-links-editor.tsx` (vé điểm đến)
- `khach-san/page.tsx` (khách sạn)
- `tour/page.tsx` (tour)

Nguồn dữ liệu: danh sách `affiliate_partners` (`is_active=true`) — group
theo tên mạng (`<optgroup label="Accesstrade">`) để dễ tìm khi danh sách
dài. Dán `sourceUrl` → nếu khớp `match_domain` của 1 partner → tự chọn sẵn
dropdown (gợi ý, vẫn sửa được) → giữ nguyên luồng preview `affiliateUrl`
đã có (`AffiliateUrlPreview`), chỉ đổi API nguồn rule đứng sau.

**Tác dụng phụ tích cực**: loại bỏ hẳn lỗi "gõ sai chính tả provider" đã
nêu ở mục 2 — giá trị luôn lấy từ danh sách có sẵn, không gõ tay.

## 6. Việc KHÔNG đề xuất (đã cân nhắc)

- **Không tự động đồng bộ Sheet theo lịch (cron)** trong đợt này — chỉ nút
  bấm tay + xem preview trước khi lưu, đơn giản hơn và an toàn hơn (tránh
  ghi đè âm thầm nếu ai đó sửa nhầm trên Sheet).
- **Không giới hạn partner nào được dùng ở module nào** (vd không chặn
  "Booking.com" xuất hiện trong dropdown form Vé) — 1 nguồn có thể bán
  nhiều loại dịch vụ (Klook vừa bán vé vừa bán tour), chặn cứng theo module
  dễ sai hơn là để tự do.

## 7. Bối cảnh rộng hơn — vé tham quan/vé xe/vé máy bay/tour/khách sạn: tách bảng theo GÌ? (13/07/2026)

Bạn hỏi: các loại "vé" (tham quan, xe, máy bay) có giống cấu trúc không, hệ
thống đang tách nhiều bảng hay 1 bảng, Tour/Khách sạn ra sao. Đọc lại các
spec đã có (Hotel/Tour đã build 1 phần; Bus/Flight **CHƯA build**, mới ở
dạng phân tích) để trả lời đúng thực tế, không đoán:

**Không tách theo "loại vé"** (vé tham quan khác vé xe khác vé máy bay) —
**tách theo ĐƠN VỊ GẮN** (cái gì sở hữu link đó, quan hệ với điểm đến):

| Loại | Gắn với | Lưu ở đâu | Vì sao |
|---|---|---|---|
| **Vé tham quan** (`ticketLinks[]`) | 1 điểm đến (POI), quan hệ 1:1 | Mảng JSON nhúng thẳng trong bài viết điểm đến (`DestinationContent.TicketLinksJson`) | Không dùng chung giữa nhiều điểm đến, không cần trang quản lý độc lập — đã build |
| **Khách sạn** | NHIỀU điểm đến gần đó, quan hệ N:N | Bảng riêng `hotels` + bảng nối `hotel_destination_map` | 1 khách sạn gợi ý được cho nhiều điểm đến, cần cào/trang quản lý riêng — đã build |
| **Tour** | NHIỀU điểm đến, quan hệ N:N | Bảng riêng `tours` + `tour_destination_map` | Giống hệt lý do của Khách sạn — đã build |
| **Vé máy bay + Vé xe** | 1 TỈNH/THÀNH (không phải 1 điểm đến cụ thể) | **1 bảng DÙNG CHUNG** `transports` (cột `mode`: 1=bay, 2=xe) | Cấu trúc giống hệt nhau (tuyến khởi hành → tỉnh đến, giá tham khảo tĩnh, 2 nguồn nhập tay/cào) — máy bay/xe khách không "hạ cánh" vào 1 điểm tham quan cụ thể như khách sạn, chỉ tới được cấp tỉnh, nên gộp 1 bảng, dùng `province_id` trực tiếp, KHÔNG cần bảng map — **CHƯA build**, mới phân tích ở `dichoithoi-flight-spec.md`/`dichoithoi-bus-spec.md` |

Điểm chung xuyên suốt cả 4 loại: TẤT CẢ đều mang đúng 1 "hình dạng link"
giống hệt nhau — `provider` / `sourceUrl` / `affiliateUrl` / `linkStatus`
(+ `price` tuỳ chọn) — đây chính là lý do `affiliateLinkItemSchema` (dùng
chung, `packages/contracts/dichoithoi/affiliate.ts`) tách riêng khỏi từng
module: bản thân CÁCH CONVERT link giống hệt nhau dù đối tượng sở hữu link
(điểm đến / khách sạn / tour / tuyến bay-xe) khác nhau hoàn toàn.

**Hệ quả quan trọng cho việc đang làm (mục 1-6 ở trên)**: field `provider`
trong TẤT CẢ các bảng trên (kể cả `hotels`/`tours` đã build, và
`transports` chưa build) đều đang/sẽ là `varchar(64)` tự do — tức là lỗi
"gõ sai chính tả provider" nêu ở mục 2 KHÔNG chỉ có ở 3 form đã tìm thấy
(vé/khách sạn/tour), mà **cùng 1 lỗi sẽ lặp lại ở Vé máy bay/Vé xe khi build
sau này** nếu không sửa tận gốc. Vì Bus/Flight chưa build, đây là **cơ hội
làm ĐÚNG ngay từ đầu** (dropdown bắt buộc từ `affiliate_partners`, mục 5)
thay vì phải quay lại sửa như đang làm với 3 module cũ — nên đưa yêu cầu
"provider phải chọn từ danh sách `affiliate_partners`" vào thẳng spec
Bus/Flight trước khi build, không đợi build xong mới sửa.

## 8. Đã chốt toàn bộ (13/07/2026)

1. ✅ Model 2 tầng (mục 3: `affiliate_networks` + `affiliate_partners`)
   thay cho model cũ 1 dòng = 1 nguồn = 1 rule riêng.
2. ✅ Import Google Sheet **public** (mục 4, đọc CSV export qua URL, không
   cần Service Account/OAuth) — bạn cung cấp link Sheet công khai khi tới
   lúc code.
3. ✅ Import **lưu thẳng luôn**, không có màn preview (mục 4) — trả về
   `{inserted, updated, skipped}` sau khi lưu.
4. ✅ Gán "mạng affiliate" là **bước riêng sau import**, dropdown inline
   ngay trong danh sách đối tác (mục 4.1) — không auto-match theo tên.
5. ✅ Đổi 3 form (vé/khách sạn/tour) từ Input tự do → Select bắt buộc
   (mục 5).

Chưa code — chờ lệnh "implement" theo đúng quy trình đang áp dụng trong
phiên làm việc này. Khi bắt đầu code cần bạn cung cấp thêm: link Google
Sheet public (đúng cấu trúc cột `code | name | link | desc | loại
affiliate | status` đã ví dụ ở mục 1 phần đầu doc).