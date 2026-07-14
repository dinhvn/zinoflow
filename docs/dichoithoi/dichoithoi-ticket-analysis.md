# Phân tích tính năng "Vé" điểm đến (dichoithoi) — 13/07/2026

Mục đích: đánh giá lại toàn bộ mô hình dữ liệu + UX của "Vé" dựa trên **dữ liệu
thật** trên `dichoithoi_dev` (272 điểm đến), tìm ra vấn đề thực sự đang tồn
tại, và chốt 1 solution hợp lý — không thiết kế trên giấy.

Trạng thái: **NHÁP PHÂN TÍCH — chờ bạn duyệt trước khi đổi code/schema.**
Trang `/dichoithoi/ve` mới build (xem hội thoại trước) vẫn hoạt động bình
thường trong lúc chờ; doc này KHÔNG có nghĩa nó sai, mà để tìm chỗ cải thiện.

## 1. Có 3 khái niệm "giá/vé" khác nhau, đang tồn tại song song

| # | Field | Ý nghĩa | Nhập bởi | Nơi lưu |
|---|---|---|---|---|
| 1 | `TicketPrice` (text tự do) | Giá vé tại quầy, dạng câu văn tự do | Từ Google Sheet cũ / nhập tay | `v2.DestinationContent.TicketPrice` |
| 2 | `priceBreakdown[]` (structured, Phase 12) | Giá vé tại quầy THEO ĐỐI TƯỢNG (người lớn/trẻ em), số + đơn vị rõ ràng | Nhập tay ở AI tool | `PriceBreakdownJson` |
| 3 | `ticketLinks[]` (Phase M4, thay `bookingUrl`) | Link **mua online** qua OTA (Klook, TripVision...) — affiliate | Nhập tay ở AI tool | `TicketLinksJson` |

(1) và (2) đều mô tả **cùng một thứ** (giá vé tại quầy) — chỉ khác là (1) là
câu văn, (2) là dữ liệu có cấu trúc dùng cho `schema.org/Offer` + bảng hiển
thị đẹp trên `_QuickDecisionCard.cshtml`. Đây là **2 nguồn sự thật cho cùng 1
dữ kiện** — rủi ro lệch nhau nếu chỉ sửa 1 trong 2.

(3) là chuyện khác hẳn: **không phải mọi điểm đến đều bán được vé online** —
chỉ áp dụng cho điểm có sản phẩm thật trên OTA.

## 2. Dữ liệu thật (query trực tiếp `dichoithoi_dev`, 272 điểm đến)

```
total=272
has TicketPrice (text)     = 251  (92%)
  trong đó "Miễn phí"      = 166  (66% của 251)
  trong đó CÓ GIÁ THẬT     =  85  (34% của 251)
has priceBreakdown[]       =   0  (0%)   ← tính năng Phase 12, CHƯA ai dùng
has ticketLinks[]          =   0  (0%)   ← tính năng vừa build, CHƯA ai dùng
has OpeningTime             = 220  (81%)
```

Nhìn 85 dòng có giá thật (đọc mẫu đầy đủ), pattern gần như đồng nhất:

```
Bà Nà Hill        600,000 d; trẻ em 500,000d
Biệt thự Hằng Nga  60,000 d; trẻ em 20,000 d
Đại Nội Huế       200,000 d, trẻ em 40,000d
Fansipan          800,000 d, trẻ em 550,000d
Vinpearl Land NT  800,000 d, trẻ em 600,000d
```

≈ 75-80/85 dòng khớp pattern `<số> d[,;] trẻ em <số> d` (chỉ khác dấu phẩy/
chấm phân cách nghìn, có/không khoảng trắng trước "d", 1 vài lỗi gõ như
"12,0000 d"). Số ít còn lại có ghi chú đặc biệt (vé đò, combo cano, giá theo
xe Jeep khứ hồi, "~72,000,000 d" cho Sơn Đoòng...) — không parse máy được,
cần tay.

**Kết luận quan trọng**: `priceBreakdown[]` — tính năng đã build ở Phase 12
để hiện bảng giá đẹp + `schema.org/Offer` — đang **0% dữ liệu** dù ~85 điểm
đã CÓ SẴN đúng thông tin đó ở dạng text từ lâu. Không phải vì thiếu dữ liệu,
mà vì chưa ai từng nhập lại — tool chưa hỗ trợ chuyển từ (1) sang (2).

## 3. Website thực tế đang làm gì với `ticketLinks[]` (đọc `_QuickDecisionCard.cshtml`)

Logic hiển thị ĐÃ code đúng theo spec (ưu tiên `priceBreakdown` → bảng giá,
`ticketLinks` → nút mua vé kèm so sánh giá quầy/online). Nhưng vì
`ticketLinks[]` = 0% dữ liệu, mọi điểm trả phí (85 điểm) đang fallback vào
**1 link Klook rút gọn CỨNG** giống hệt nhau:

```csharp
// dòng 97, 125 — fallback khi ticketLinks rỗng
"https://shorten.asia/4uU24umn"
```

Link này không trỏ tới đúng sản phẩm vé của từng điểm đến (vd Bà Nà Hill và
Biệt thự Hằng Nga hiện dùng chung 1 link) — vừa **không tối ưu doanh thu**
(không phải link affiliate đúng sản phẩm → conversion thấp/không đúng attribute),
vừa hơi lệch nguyên tắc "CTA trung thực" ở spec §2.3 (nút ghi "Mua vé {Tên
điểm}" nhưng dẫn tới trang chung chung).

## 4. Đánh giá lại trang `/dichoithoi/ve` vừa build dưới ánh sáng dữ liệu thật

Trang hiện liệt kê **toàn bộ 272 điểm đến** để quản lý `ticketLinks[]`. Nhưng:

- 166/272 (61%) là điểm **miễn phí** → không có gì để bán vé online, dòng này
  sẽ **mãi mãi trống**, chỉ gây nhiễu khi lướt danh sách.
- 85/272 (31%) có giá vé thật → đây mới là tập cần ưu tiên nhập `ticketLinks`.
- 21/272 (8%) chưa có `TicketPrice` gì cả → chưa đủ dữ liệu để biết có bán vé
  được không, cần làm `TicketPrice`/`priceBreakdown` trước.

→ Danh sách "phẳng, không filter" hiện tại đúng nhưng **không dẫn hướng công
sức** — không trả lời được câu "nên nhập link cho ai TRƯỚC" giống cách
`coverage-score.ts` đã làm cho nội dung bài viết (ưu tiên theo `ContentTier`,
% hoàn thiện).

## 5. Vấn đề gốc rễ (root cause) tổng hợp

1. **Duplication dữ liệu**: `TicketPrice` (text) và `priceBreakdown[]`
   (structured) mô tả cùng 1 sự thật, không có cầu nối → tính năng structured
   (Phase 12, tốn công build: bảng giá đẹp + `schema.org/Offer`) đang lãng phí
   vì 0% được dùng trong khi dữ liệu nguồn đã có sẵn 85/85.
2. **Trang Vé thiếu ưu tiên**: liệt kê phẳng 272 dòng trong khi chỉ ~85 dòng
   có ý nghĩa thực sự (có giá vé → mới có thể bán online).
3. **CTA "vé" đang không trung thực 100%** ở quy mô lớn: 85 điểm trả phí đều
   trỏ chung 1 link Klook rút gọn không đúng sản phẩm — vấn đề business/nội
   dung, không phải bug code, nhưng đáng để bạn biết vì ảnh hưởng doanh thu
   trực tiếp và nằm ngoài phạm vi 1 dòng code sửa được (cần đi tìm/đăng ký
   sản phẩm đúng trên Klook/TripVision cho từng điểm, hoặc chấp nhận fallback
   chung là tạm thời).

## 6. Đề xuất solution (xếp theo độ ưu tiên/công sức)

### 6.1 [Đề xuất chính] Auto-parse `TicketPrice` → gợi ý `priceBreakdown[]`
Thêm 1 nút "Tách giá vé từ text" trong form sửa điểm đến (hoặc ngay trong
trang `/dichoithoi/ve`): parse `TicketPrice` bằng regex theo pattern đã xác
nhận thật (`<số> đ/d [,;] trẻ em <số> đ/d`) → điền sẵn 2 dòng
`priceBreakdown` (Người lớn / Trẻ em), **người dùng xem/sửa/duyệt rồi mới
lưu** (không tự động ghi thẳng — đúng nguyên tắc "gợi ý rồi duyệt" đã áp dụng
cho `practicalNotes`/`editorialReview`). Parse được ước tính ~75-80/85 dòng
ngay lập tức, phần còn lại (giá đặc biệt, combo) vẫn nhập tay như hiện tại.
→ Kích hoạt luôn tính năng đã build ở Phase 12 mà đang bỏ không, chi phí thấp
(1 regex + 1 nút, không đổi schema).

### 6.2 Lọc/ưu tiên trang `/dichoithoi/ve` theo "có thể bán vé"
Thêm filter mặc định "Chỉ hiện điểm có giá vé" (loại điểm miễn phí khỏi danh
sách mặc định, vẫn cho bật lại xem tất cả) + cột trạng thái rõ 3 nhóm: **Có
giá, chưa có link** (ưu tiên nhập — badge vàng) / **Đã có link** (xanh) /
**Miễn phí — N/A** (xám, ẩn mặc định). Việc này tận dụng đúng cột
`priceBreakdown`/`TicketPrice` đã có, không cần field mới.

### 6.3 [Không làm ngay — ghi nhận] Thay link Klook fallback cứng
Đây là việc **nội dung/kinh doanh** (tìm đúng sản phẩm Klook/TripVision cho
từng điểm nổi bật, ưu tiên nhóm Flagship/lượt xem cao trước), không phải
việc code. Đề xuất: sau khi 6.1+6.2 xong, dùng đúng trang `/dichoithoi/ve`
(đã lọc còn ~85 dòng) làm worklist để bạn tự đi tìm link thật, thay thế dần
link chung. Không cần chờ làm xong toàn bộ mới có giá trị — mỗi link thật
thay vào đều tốt hơn link chung ngay lập tức.

## 7. Việc KHÔNG đề xuất (đã cân nhắc rồi bỏ)

- **Không gộp `TicketPrice` và `priceBreakdown` thành 1 field duy nhất**:
  `TicketPrice` vẫn cần thiết làm câu tóm tắt ngắn hiển thị đầu trang
  (`_QuickDecisionCard` dòng "Giá vé: ..."), còn `priceBreakdown` phục vụ
  bảng chi tiết + schema.org. Xoá 1 trong 2 sẽ mất chỗ dùng của cái kia.
- **Không build bảng/API riêng cho "Vé"** (kiểu Hotel) — đã chốt ở lần trước,
  dữ liệu thật xác nhận lại đúng: không có nhu cầu 1 link vé dùng chung nhiều
  điểm đến, giữ nguyên `ticketLinks[]` gắn theo từng điểm đến.

## 8. Bổ sung yêu cầu thực tế từ bạn (13/07/2026) — mô hình còn thiếu 1 tầng

Sau khi bạn giải thích thực tế nghiệp vụ, phát hiện mô hình dữ liệu hiện tại
(mục 1-7) **còn thiếu 1 tầng quan trọng**: khái niệm **"loại vé"**.

### 8.1 Vấn đề cụ thể

- **Vấn đề 1 (đã đúng sẵn)**: 1 điểm đến có nhiều **nguồn** bán vé (chính chủ,
  Klook, Traveloka...) — đây chính là `ticketLinks[]`, đã là mảng 0-n, không
  cần đổi gì.
- **Vấn đề 2 (CHƯA có trong model)**: 1 điểm đến có thể có nhiều **loại vé**
  khác nhau, không chỉ khác theo đối tượng (người lớn/trẻ em):
  - Dalat Fairytale Land: chỉ 1 loại — "Vé vào cổng" (đã đủ để tham quan trọn
    gói) → đây là **đa số** (xác nhận lại từ dữ liệu thật: ~80/85 điểm có giá
    chỉ là 1 dòng "giá NL; giá TE" đơn giản, không nhắc combo gì thêm).
  - Bà Nà Hills: nhiều loại — "Vé vào cổng" (đã gồm cáp treo 2 chiều), "Combo
    vé + công viên nước Fantasy Park", "Vé xe điện"... — mỗi loại có giá
    riêng theo đối tượng riêng.

  Hiện `priceBreakdown[]` chỉ có `{audience, price, note}` — PHẲNG, không có
  chỗ nhóm theo loại vé. Nếu Bà Nà Hills nhập 6 dòng (3 loại × 2 đối tượng)
  vào cùng 1 mảng phẳng, hiển thị sẽ thành 1 bảng dài lộn xộn, không rõ dòng
  nào thuộc gói nào — và `ticketLinks[]` cũng không biết 1 link Klook cụ thể
  đang bán loại vé nào trong số đó → không so sánh giá quầy vs giá online
  đúng loại được (so sánh sai loại vé = sai lệch, phản tác dụng SEO/uy tín).

### 8.2 Đề xuất model — thêm field `ticketType` (nhóm nhẹ, không lồng cấp)

Thay vì tạo 1 object "category" lồng cấp (mảng-trong-mảng, phức tạp sửa/AI
gợi ý), đề xuất **gắn thêm 1 field `ticketType` (text tự do) vào cả 2 mảng
đã có sẵn** — giữ cấu trúc phẳng, dễ nhập/sửa, dễ nhóm khi hiển thị:

```ts
// priceBreakdownItemSchema — thêm 1 field
{
  ticketType: string,   // "Vé vào cổng" (mặc định), "Combo vé xe điện"...
  audience: string,     // "Người lớn", "Trẻ em"...
  price: number,
  note: string | null,
}

// affiliateLinkItemSchema (dùng chung ticketLinks/hotel/tour) — thêm 1 field
// CHỈ áp dụng cho ticketLinks (hotel/tour bỏ trống, không phá vỡ chỗ dùng chung)
{
  ticketType: string | null,  // khớp voi priceBreakdown.ticketType cua diem den
  provider, label, sourceUrl, affiliateUrl, linkStatus, price, // (giữ nguyên)
}
```

- Điểm chỉ có 1 loại vé (đa số, ~80/85): `ticketType` luôn = `"Vé vào cổng"`
  (mặc định tự điền, người dùng không thấy thêm thao tác nào cả).
- Điểm nhiều loại (Bà Nà Hills...): người dùng tự gõ tên loại vé mới khi thêm
  dòng — không cần danh mục cố định, vì tên loại vé mỗi điểm một khác.
- Backward-compatible: dữ liệu cũ (nếu có) coi `ticketType=null` như
  `"Vé vào cổng"` mặc định.

### 8.3 Đề xuất hiển thị — SEO + thúc đẩy mua online

Group theo `ticketType`, mỗi loại vé render thành **1 khối so sánh giá** (áp
dụng đúng tinh thần TripAdvisor/Klook — người đọc quét nhanh, thấy ngay chỗ
rẻ hơn):

```
Vé vào cổng
  Giá tại quầy: Người lớn 600.000đ · Trẻ em 500.000đ
  Mua online:
    [Klook   — 550.000đ  (rẻ hơn 8%)  ● RẺ NHẤT]  → nút CTA nổi bật nhất
    [Traveloka — 580.000đ (rẻ hơn 3%)]            → nút CTA phụ

Combo vé xe điện
  Giá tại quầy: 150.000đ
  Mua online: [Klook — 140.000đ (rẻ hơn 7%)]
```

- % "rẻ hơn" tính từ `min(priceBreakdown cùng ticketType)` so với
  `link.price` cùng `ticketType` — CHỈ hiện badge khi cả 2 phía đều có số
  thật (không suy diễn, đúng nguyên tắc policy §2.3 hiện có).
- Sắp xếp link trong CÙNG 1 loại vé theo giá tăng dần (khác với quyết định cũ
  "giữ thứ tự người nhập" — lúc đó chưa có `price` để so sánh đáng tin cậy;
  giờ cùng loại vé + có giá thật thì sắp theo giá là hợp lý và đúng mục tiêu
  "giúp người đọc quyết định mua online" bạn vừa nêu).
- SEO: mỗi `ticketType` xuất 1 `schema.org/Offer` riêng (thay vì 1 `Offer`
  chung cho cả điểm đến như hiện tại) — Google Rich Results hỗ trợ nhiều
  `Offer` con trong `AggregateOffer`, đúng khi điểm có nhiều loại vé thật.

### 8.4 Việc CHƯA giải quyết trong đề xuất này (nêu rõ để không hiểu lầm)

- Không tự tìm sản phẩm Klook/Traveloka đúng loại vé — vẫn là việc nhập tay
  (mục 6.3 cũ), model chỉ tạo CHỖ để gắn đúng loại khi có link thật.
- Auto-parse `TicketPrice` (mục 6.1) khi chạy sẽ luôn tạo dòng với
  `ticketType="Vé vào cổng"` — không parse ra được nhiều loại vé từ text tự
  do (Content HTML không có cấu trúc để tách máy, đã kiểm tra thật ở Bà Nà
  Hill: đoạn Content chỉ có văn kể chuyện, không liệt kê giá combo).

## 9. Chốt scope đợt này (13/07/2026) — theo yêu cầu của bạn

Bạn quyết định: **đơn giản trước — chỉ "vé vào cổng" (giá tổng quan nhất),
mở rộng loại vé (combo, vé xe điện...) để sau.**

→ **KHÔNG thêm field `ticketType`** ở mục 8.2 trong đợt này — đó là thiết kế
đón đầu cho nhu cầu chưa cần tới ngay (đúng nguyên tắc "không thiết kế cho
tương lai giả định" — CLAUDE.md). Model giữ nguyên `priceBreakdown[]` phẳng
hiện có (chỉ audience+price+note), coi mỗi điểm chỉ có 1 loại vé ngầm định
= "vé vào cổng". Khi nào thực sự cần multi-loại-vé (vd làm tới Bà Nà Hills),
quay lại mục 8 để thêm field lúc đó — không tốn công sửa lại vì field mới
optional, không phá dữ liệu cũ.

### 9.1 Việc sẽ làm trong đợt này (chỉ 6.1 + 6.2, KHÔNG làm 8.3)

**6.1 — Auto-parse `TicketPrice` (text) → gợi ý `priceBreakdown[]`**
- Làm hoàn toàn ở FE (`destination-price-breakdown-editor.tsx`), regex parse
  ngay trên `content.ticketPrice` đã có sẵn ở trang chi tiết điểm đến —
  **không cần endpoint/schema mới**.
- Quy tắc parse (khớp mẫu thật đã khảo sát ở mục 2): tìm các cụm
  `<số>[.,]*...\s*(đ|d)` trong chuỗi.
  - 2 số tìm được → dòng 1 = "Người lớn", dòng 2 = "Trẻ em".
  - 1 số → 1 dòng "Giá vé" (không giả định người lớn/trẻ em vì có điểm ghi
    giá dùng chung, vd "Chùa Cầu — dùng chung vé phố cổ").
  - 0 hoặc ≥3 số, hoặc chứa "Miễn phí" → KHÔNG tự gợi ý, giữ nhập tay.
  - Luôn chỉ **điền sẵn vào form, người dùng bấm Lưu mới ghi** (gợi ý rồi
    duyệt, đúng nguyên tắc hiện có của `practicalNotes`/`editorialReview`).
- Nút chỉ hiện khi `priceBreakdown` đang rỗng VÀ `content.ticketPrice` có
  giá trị parse được — tránh ghi đè dữ liệu đã có.

**6.2 — Ưu tiên/filter trang `/dichoithoi/ve`**
- **Giới hạn phát hiện được**: `ticketPrice` (text) không có trong mirror
  Postgres → trang danh sách (`/dichoithoi/ve`, dùng `GET /destinations`)
  KHÔNG thể lọc/hiển thị theo `ticketPrice` mà không sửa thêm (thêm cột
  mirror + đồng bộ SQL Server → Postgres, phạm vi lớn hơn "đơn giản trước").
- **Scope rút gọn phù hợp**: lọc/sắp xếp theo field đã CÓ SẴN trong mirror —
  `priceBreakdown.length` (đã có giá) và `ticketLinks.length` (đã có link).
  Filter mặc định: ẩn các điểm có `priceBreakdown` rỗng VÀ `ticketLinks`
  rỗng (chưa có gì để quản lý) — sau khi bạn dùng 6.1 để bổ sung
  `priceBreakdown` cho các điểm có giá thật, danh sách sẽ tự lọc gọn dần,
  không cần đổi gì thêm ở bước này.
- Không kéo `ticketPrice` (text) vào mirror trong đợt này — nếu sau này thấy
  cần, quay lại mục này để làm 1 migration + đồng bộ riêng.

### 9.2 Việc CHƯA làm (dời sau, đúng như bạn chọn)

- 8.2/8.3 (loại vé, badge % rẻ hơn, sắp xếp theo giá, `schema.org/Offer` theo
  từng loại) — chỉ có ý nghĩa khi đã có ≥2 loại vé/điểm hoặc có dữ liệu giá
  online thật (`ticketLinks[].price`) để so sánh; hiện 0% dữ liệu nên làm
  ngay chưa mang lại giá trị đo được.
- 6.3 (thay link Klook fallback cứng) — việc nội dung/kinh doanh, không phải
  code.

## 10. UX khối "Link mua vé" trên trang chi tiết điểm đến (bổ sung 13/07/2026)

Bạn làm rõ thêm hành vi mong muốn — tách bạch 2 khối khác nhau trên trang
chi tiết điểm đến (`/dichoithoi/{slug}`), đúng tinh thần "sửa 1 nơi
(`/dichoithoi/ve`), xem ở nhiều nơi":

1. **"Giá vé theo đối tượng" (`priceBreakdown`, giá tại quầy)** — vẫn giữ
   nguyên chỗ nhập tay TRỰC TIẾP trên trang điểm đến như hiện tại
   (`DestinationPriceBreakdownEditor`), KHÔNG chuyển đi đâu — đây đúng là dữ
   liệu gốc của điểm đến, hợp lý nhập ngay tại đây, khác `ticketLinks` (nhiều
   nguồn, cần trang riêng để nhìn tổng quan toàn hệ thống).
2. **"Link mua vé online" (`ticketLinks`)** — đã chuyển hẳn sang
   `/dichoithoi/ve` (quyết định trước). Trang chi tiết điểm đến hiện đang chỉ
   hiện 1 dòng đếm số link ("Đang có N link vé") — bạn muốn nâng cấp thành:
   - **Có ≥1 link** (`d.ticketLinks.length > 0`) → tự động hiện DANH SÁCH
     ngay tại đây (provider, label, giá nếu có) — CHỈ ĐỌC (xem nhanh không
     cần bấm sang trang khác), không có nút sửa/xoá tại chỗ này (sửa vẫn qua
     `/dichoithoi/ve`, đúng nguyên tắc "1 nơi sửa" đã chốt, tránh 2 chỗ cùng
     ghi gây lệch dữ liệu).
   - **Chưa có link nào** (`length === 0`) → hiện mô tả hướng dẫn ngắn (vd:
     "Điểm này chưa có link mua vé online. Thêm ít nhất 1 link (Klook,
     Traveloka...) để hiện nút 'Mua vé online' trên trang web.") + nút bấm
     rõ ràng "Thêm link vé cho {Tên} →" dẫn sang `/dichoithoi/ve?q={tên}`
     (tái dùng cơ chế auto-mở-dòng-đang-sửa đã có sẵn ở trang `/ve`).
   - Dữ liệu đã có sẵn trong `d.ticketLinks` (nằm trong `destinationDetailSchema`,
     đã fetch cùng trang) — **không cần gọi API thêm, không cần đổi
     backend/schema** — chỉ đổi UI hiển thị tại chỗ đang có dòng đếm hiện tại.

## 11. CHỐT — Hướng B: mirror `ticketPrice` sang Postgres (13/07/2026)

Bạn chọn **Hướng B** (đầy đủ hơn, không rút gọn như mục 9.1 nữa) — mirror
`TicketPrice` sang Postgres để trang `/dichoithoi/ve` thấy được ngay, KHÔNG
phải mở từng trang chi tiết. Đồng thời xác nhận: nhãn đối tượng trong
`priceBreakdown` (`audience`) giữ nguyên **free text** (model hiện tại đã
đúng, không cần field "loại vé" (`ticketType`) riêng — đã loại phương án đó
ở câu hỏi trước) — chỉ cần auto-parse THÔNG MINH hơn để tự nhận diện đúng
nhãn (Người lớn/Trẻ em/tuỳ tên khác) thay vì hardcode cứng 2 nhãn.

### 11.1 Việc cần làm — thêm `ticketPrice` vào mirror (đã đọc code xác nhận khả thi, rủi ro thấp)

Đã kiểm tra `sync-destinations.usecase.ts` + `mssql-site-db.adapter.ts`:
`contentHash` (dùng để phát hiện "sửa ngoài AI tool") CHỈ hash trên
`ContentHtml`, KHÔNG gồm `TicketPrice` — nên thêm field mirror mới này
**không ảnh hưởng** logic phát hiện xung đột hiện có, an toàn.

Các bước (đúng pattern các field mirror khác đã có: `hotelGroupId`,
`contentTier`...):
1. `mssql-site-db.adapter.ts::fetchAllDestinations()` — thêm
   `c.TicketPrice` vào câu `SELECT` (đã JOIN sẵn `v2.DestinationContent c`,
   chỉ thêm 1 cột).
2. `domain/destination-mirror.ts::SiteDestinationRow` — thêm
   `ticketPrice: string | null`.
3. `destination-mirror.entity.ts` — thêm cột `ticketPrice` (nvarchar, nullable).
4. Migration Postgres mới: `AddDestinationTicketPrice` (`npm run migration:generate`).
5. `typeorm-destination-mirror.repository.ts::upsertFromSite` — map thêm field.
6. `packages/contracts/destination.ts::destinationMirrorSchema` — thêm
   `ticketPrice: z.string().nullable()`.
7. `list-destinations.usecase.ts` — đảm bảo field này đi qua response (kiểu
   tương tự các field mirror khác, không cần logic riêng).

Kết quả: field này CHỈ ĐỌC (một chiều SQL Server → Postgres, đúng nguyên tắc
sync hiện có §12.1) — sửa `TicketPrice` vẫn qua đúng chỗ cũ (form nhập
`quickFacts.ticketPrice` lúc viết bài/publish), không thêm chỗ ghi mới.

### 11.2 Auto-parse (6.1) — nhận diện nhãn linh hoạt, không hardcode

Xác nhận: `priceBreakdownItemSchema.audience` là free text sẵn — không đổi
schema. Chỉ nâng cấp thuật toán parse (client-side, ở nút "Tách giá vé từ
text"):

1. Quét toàn bộ cụm `<số tiền> (đ|d)` trong `ticketPrice`.
2. Với mỗi cụm số tìm được, xét cụm từ NGAY TRƯỚC nó (trong đoạn phân tách
   bởi dấu `,`/`;`) làm nhãn ứng viên — vd "trẻ em", "sinh viên", "học sinh",
   "người cao tuổi", "người lớn", "đoàn"... (không giới hạn danh sách cứng,
   chỉ cắt cụm từ trước số làm nhãn thô).
3. Chuẩn hoá nhãn: viết hoa chữ cái đầu, bỏ khoảng trắng thừa; cụm số ĐẦU
   TIÊN không có nhãn phía trước (câu chỉ bắt đầu bằng số luôn) → gán mặc
   định **"Người lớn"** (đúng thực tế 100% mẫu dữ liệu thật đã khảo sát: số
   đầu luôn là giá người lớn/giá chung).
4. Cụm số tiếp theo không có nhãn rõ ràng → gán **"Giá vé {thứ tự}"**
   (không đoán bừa là "Trẻ em" nếu văn bản không ghi rõ).
5. Danh sách nhãn gợi ý CHỈ là điền sẵn vào form — người dùng luôn xem/sửa
   trước khi bấm Lưu (giữ nguyên nguyên tắc "gợi ý rồi duyệt").
6. Chứa "Miễn phí" / không tìm thấy số nào → không hiện nút gợi ý.

### 11.3 Trang `/dichoithoi/ve` — dùng `ticketPrice` mirror mới

- Thêm cột "Giá tại quầy" (raw `ticketPrice` text) cạnh cột "Số link vé".
- Filter mặc định: ẩn điểm `ticketPrice` rỗng HOẶC = "Miễn phí" (những điểm
  này không thể bán vé online) — bật lại xem tất cả bằng 1 toggle.
- Trong nhóm còn lại, ưu tiên nổi bật (sort/badge) những điểm **có giá
  (`ticketPrice`) nhưng CHƯA có `ticketLinks`** — đúng đối tượng cần bạn nhập
  link nhất.

### 11.4 UX khối "Link mua vé" ở trang chi tiết điểm đến — giữ nguyên mục 10

Không đổi gì thêm so với mục 10 đã chốt (danh sách chỉ đọc khi có link, mô
tả + nút khi chưa có).

## 11.5 SỬA LẠI — bạn muốn quản lý Vé giống hệt Hotel/Tour/Vé xe-bay (13/07/2026)

Bạn xác nhận muốn có lý do "báo cáo/thống kê tổng hợp" đã nêu ở phân tích
Affiliate Partner (`dichoithoi-affiliate-provider-management-analysis.md`
§7) — **đảo ngược quyết định trước đó** ("giữ JSON nhúng, không tách
bảng"). Thiết kế lại theo đúng tinh thần Hotel/Tour/Transport.

### Vì sao đổi (khác gì so với lý do "không cần bảng nối" trước đây)

**Làm rõ tránh hiểu lầm**: "1:1" ở đây là quan hệ giữa **1 DÒNG VÉ và điểm
đến nó thuộc về** — KHÔNG phải "1 điểm đến chỉ có 1 vé". 1 điểm đến vẫn có
THOẢI MÁI nhiều dòng vé (Klook, Traveloka, giá gốc...) — đó là quan hệ
1 điểm đến → N dòng vé, không đổi, không giới hạn. Điều duy nhất đúng là
"1:1" là: 1 dòng vé cụ thể (vd "Klook — Bà Nà Hills") luôn thuộc về ĐÚNG 1
điểm đến, không bao giờ dùng lại/gán thêm cho điểm đến khác — khác Hotel:
1 khách sạn CÓ THỂ được gán làm gợi ý cho NHIỀU điểm đến khác nhau (vd
"Mường Thanh Đà Lạt" vừa gợi ý cho "Thác Bạc" vừa cho "Langbiang") — đây
mới là quan hệ N:N thật sự cần bảng nối. Vé không có tình huống đó.

Lý do không cần bảng nối kiểu `hotel_destination_map` vẫn đúng. Nhưng đó
không phải lý do DUY NHẤT để tách bảng:
tách bảng còn cho **từng dòng vé 1 `id` ổn định**, sửa/xoá TỪNG DÒNG qua API
riêng (giống `PATCH /hotels/:id`) — khác hẳn cách hiện tại
(`POST /destinations/:slug/ticket-links` ghi đè NGUYÊN MẢNG mỗi lần lưu, dễ
mất dữ liệu nếu 2 người sửa cùng lúc, không có audit "ai sửa dòng nào"). Đây
đã là hạn chế thật của thiết kế cũ, không phải tưởng tượng.

### Model mới — bảng riêng, KHÔNG cần bảng nối (khác Hotel/Tour ở điểm này)

```sql
CREATE TABLE destination_tickets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_slug  varchar(64) NOT NULL,   -- FK toi mirror destinations.slug — 1 ve LUON thuoc dung 1 diem den (khac Hotel/Tour, khong can bang noi N:N)
  label             varchar(128),            -- nhan hien thi nut, vd "Vé vào cổng qua Klook"
  provider          varchar(64) NOT NULL,    -- BAT BUOC chon tu affiliate_partners (dropdown, dung chung §5 doc Affiliate)
  source_url        varchar(1024) NOT NULL,
  affiliate_url     varchar(1024),
  link_status       varchar(20) NOT NULL DEFAULT 'no-rule',  -- converted | no-rule | manual-override (khong can 'no-link' nhu Bus, ve online luon co link)
  price             numeric(12,0),           -- gia tham khao rieng cua nguon nay (giu nguyen y nghia cu)
  thumbnail_url     varchar(512),            -- anh minh hoa (logo nha cung cap / anh ve) — cung ten field voi Hotel/Tour
  "order"           int NOT NULL DEFAULT 0,  -- thu tu hien thi trong cung 1 diem den (thay cho thu tu mang JSON cu)
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON destination_tickets (destination_slug);
```

**`thumbnail_url` (bổ sung 13/07/2026)** — cùng field đã có sẵn ở Hotel/Tour
(`thumbnail_url`), thêm cho đồng bộ 3 module. **Có hiển thị trên website
dichoithoi hay không QUYẾT ĐỊNH SAU, tuỳ thiết kế** — Phase này chỉ thêm cột
lưu trữ + cho phép nhập ở form (giống cách Hotel/Tour đã làm), KHÔNG kéo
theo việc sửa `_QuickDecisionCard.cshtml` để hiện ảnh — việc đó tách thành
1 quyết định UI riêng, làm sau khi có thiết kế cụ thể.

So với Hotel/Tour: **không có bảng `*_destination_map`** — `destination_slug`
là cột FK trực tiếp (giống cách `transports` dùng `arrival_province_id`
trực tiếp thay vì bảng map) — vì quan hệ thật sự là 1 vé → đúng 1 điểm đến,
không phải N:N.

**Không đề xuất thêm `status` (nháp/published/ẩn) như Hotel/Tour** — Hotel/Tour
cần nháp vì có luồng CÀO tự động (dữ liệu chưa soát), còn vé điểm đến luôn
NHẬP TAY trực tiếp bởi bạn (đã xác nhận ở phân tích trước, không có kế hoạch
cào) → lưu là publish luôn, giữ đúng hành vi hiện tại, đơn giản hơn. Nêu rõ để
bạn quyết ở câu hỏi cuối nếu muốn thêm.

### Đồng bộ xuống SQL Server — đề xuất KHÔNG tạo bảng mới bên đó

Khác Hotel/Tour (có bảng SQL Server riêng `HotelDestinationMap` dù website
không còn query sống nó — giữ phòng khi cần trang riêng). Với Vé, đề xuất
**giữ nguyên cơ chế publish hiện có**: lúc 1 dòng `destination_tickets` được
thêm/sửa/xoá, zinoflow gom tất cả dòng cùng `destination_slug`, tính lại
mảng JSON, ghi đè `DestinationContent.TicketLinksJson` như đang làm — KHÔNG
cần bảng `DestinationTicket` mới bên SQL Server, KHÔNG đổi gì ở website
(`_QuickDecisionCard.cshtml` đọc `extras.TicketLinks` y nguyên).

Lý do đơn giản hơn Hotel/Tour: vé không có nhu cầu "trang riêng độc lập"
(kiểu "khách sạn gần X") như Hotel đang để ngỏ — nếu sau này bạn muốn 1
trang public liệt kê vé (không chắc có giá trị SEO như trang khách sạn),
quay lại làm bảng SQL Server riêng lúc đó, không cần làm trước.

### Tác động tới các quyết định đã chốt trước đó (cần biết)

- **Trang `/dichoithoi/ve` xây trước đó** (đọc qua `GET /destinations`,
  đọc `ticketLinks[]` nhúng) — đổi nguồn dữ liệu sang bảng mới, nhưng GIAO
  DIỆN gần như giữ nguyên (vẫn liệt kê theo điểm đến); khác biệt: nút
  "Sửa"/"Xoá" giờ thao tác theo TỪNG DÒNG (`id` riêng) thay vì thay nguyên
  mảng.
- **UX khối "Link mua vé" ở trang chi tiết điểm đến** (mục 10, đã chốt) —
  không đổi, vẫn đọc danh sách theo `destination_slug`, hiển thị y hệt.
- **Auto-parse (6.1)** và **cột "Giá tại quầy" + filter (11.3)** — không
  đổi, độc lập với việc này (vẫn dùng `priceBreakdown`/`ticketPrice`,
  KHÔNG liên quan bảng `destination_tickets` mới).
- **Migration cần làm thêm**: 1 migration tạo bảng `destination_tickets` +
  1 bước chuyển dữ liệu cũ (đọc `ticketLinks` jsonb đang nhúng trong mirror,
  tách từng phần tử thành 1 dòng) — nhưng đã xác nhận **0/272 điểm có dữ
  liệu ticketLinks thật** (phân tích Vé mục 2) → thực tế KHÔNG có gì để
  chuyển, tạo bảng trống là đủ, không cần viết script migrate dữ liệu.

## 12. Cần bạn xác nhận cuối để bắt đầu implement

1. Đồng ý kế hoạch migration mirror **11.1** (thêm `ticketPrice` vào
   Postgres, chỉ đọc, không ảnh hưởng `contentHash`) không?
2. Đồng ý thuật toán nhận nhãn linh hoạt **11.2** (số đầu = "Người lớn" mặc
   định nếu không có nhãn, số sau không nhãn = "Giá vé {thứ tự}", có nhãn
   thật trong text thì lấy đúng nhãn đó) không?
3. Đồng ý cột + filter mới ở `/dichoithoi/ve` (mục 11.3) không?
4. UX khối "Link mua vé" ở trang chi tiết (mục 10) — vẫn giữ như đã chốt?
5. Đồng ý model bảng riêng `destination_tickets` (mục 11.5) — FK trực tiếp
   `destination_slug`, KHÔNG bảng nối, KHÔNG thêm `status` nháp/published,
   KHÔNG tạo bảng mới bên SQL Server (vẫn bake vào `TicketLinksJson` như
   cũ) không, hay muốn khác (vd có `status` để có thể "ẩn tạm 1 link" không
   xoá hẳn)?

Khi bạn xác nhận, tôi sẽ bắt đầu code theo đúng phạm vi này.
