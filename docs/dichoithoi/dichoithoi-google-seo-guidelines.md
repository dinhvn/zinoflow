# Dichoithoi — Quy tắc SEO sống còn từ tài liệu chính thức Google

⚠️ Tài liệu này là **bản tổng hợp đầy đủ** các chính sách/nguyên tắc SEO
chính thức của Google, đọc trực tiếp từ `developers.google.com/search/docs`
ngày 29/07/2026 — không suy đoán, không tin đồn cộng đồng SEO. Mục đích: có
1 nơi duy nhất tra cứu "làm gì thì bị Google phạt, làm gì thì được lợi thật"
khi thiết kế/code bất kỳ tính năng nào cho dichoithoi.com.

Quan hệ với các doc khác:
- `dichoithoi-seo-principles.md` — vai trò/tư duy bắt buộc + checklist 3 câu
  hỏi trước khi code, ĐỌC TRƯỚC tài liệu này. Mục §3 của doc đó (AI content
  vs Google) đã trích 1 phần nội dung trùng ở đây (khung Who/How/Why) —
  không lặp lại, xem chi tiết ở §7 dưới.
- `dichoithoi-content-freshness-plan.md` — 1 tính năng cụ thể (badge cập
  nhật nội dung) áp dụng trực tiếp §6 và §7.4 dưới đây làm căn cứ thiết kế.
- Khi 2 tài liệu mâu thuẫn: `dichoithoi-seo-principles.md` thắng về TƯ DUY/
  QUY TRÌNH, tài liệu này thắng về SỰ THẬT/TRÍCH DẪN CHÍNH THỨC (nếu phát
  hiện lệch, phải sửa lại `dichoithoi-seo-principles.md` cho khớp, không âm
  thầm giữ 2 bản khác nhau).

Nguồn đã đọc trực tiếp (giữ nguyên URL để tra lại khi cần, Google có thể cập
nhật nội dung theo thời gian — nếu nghi ngờ đã lỗi thời, đọc lại từ URL gốc
trước khi tin vào tóm tắt dưới đây):
- `developers.google.com/search/docs/essentials` — yêu cầu kỹ thuật nền tảng
- `developers.google.com/search/docs/essentials/spam-policies` — 16 chính
  sách spam
- `developers.google.com/search/docs/fundamentals/creating-helpful-content`
  — helpful content, khung Who/How/Why, cảnh báo date-spam
- `developers.google.com/search/docs/fundamentals/using-gen-ai-content` —
  nội dung AI (đã trích đầy đủ ở `dichoithoi-seo-principles.md` §3, không
  lặp lại ở đây)
- `developers.google.com/search/docs/appearance/structured-data/sd-policies`
  — quy tắc chung structured data
- `developers.google.com/search/docs/appearance/structured-data/article` —
  `datePublished`/`dateModified`
- `developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap`
  — `<lastmod>`
- `developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls`
  — duplicate content/canonical
- `developers.google.com/search/docs/appearance/page-experience` — Core Web
  Vitals, HTTPS, mobile, interstitials
- `developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes`
  — chuyển đổi URL/cấu trúc lớn (redirect, thời gian ổn định lại thứ hạng)
- `support.google.com/webmasters/answer/9044175` — Manual Actions (loại
  "flag" chính thức duy nhất Google có)

## 1) Nguyên tắc nền tảng (Search Essentials)

Để 1 trang có cơ hội xuất hiện trên Google, phải đạt yêu cầu kỹ thuật tối
thiểu TRƯỚC KHI bàn tới nội dung hay hay dở:
- Google crawl được (không chặn nhầm ở `robots.txt`, không lỗi HTTP status
  khi Googlebot truy cập).
- Index được (không dính `noindex` nhầm, không bị chặn bởi lỗi kỹ thuật).
- Trả về HTTP status hợp lệ.
- Tôn trọng chỉ dẫn `robots.txt`.

→ Đây là điều kiện CẦN, không phải điều kiện ĐỦ — đạt yêu cầu này không
đảm bảo được index hay xếp hạng tốt, chỉ là "không tự loại mình khỏi cuộc
chơi". Với dichoithoi: mỗi khi thêm route/trang mới, luôn tự hỏi "trang này
có vô tình bị noindex/chặn robots.txt không" trước khi lo tới nội dung.

Google nói rõ: **xuất hiện trên Google Search là MIỄN PHÍ** — không có "trả
tiền để index nhanh hơn/hạng cao hơn" chính thống, cảnh giác mọi dịch vụ
quảng cáo kiểu này.

## 2) 16 chính sách spam chính thức (VI PHẠM = bị phạt thứ hạng hoặc gỡ khỏi index)

Đây là danh sách ĐẦY ĐỦ Google công bố tại `spam-policies` — không phải suy
diễn. Với mỗi mục, ghi chú áp dụng thực tế cho dichoithoi nếu có rủi ro.

| # | Chính sách | Định nghĩa ngắn | Rủi ro với dichoithoi |
|---|---|---|---|
| 1 | **Cloaking** | Cho người dùng xem nội dung khác với nội dung cho Googlebot xem | Không áp dụng hiện tại — không có logic phân biệt user-agent |
| 2 | **Doorway abuse** | Nhiều trang/site gần giống nhau chỉ khác URL, cùng dẫn về 1 đích, để chiếm nhiều truy vấn | ⚠️ RỦI RO THẬT nếu sau này tạo trang combo filter tự động (đã cảnh báo ở `dichoithoi-seo-principles.md` §2 mục "thin content/doorway") |
| 3 | **Expired domain abuse** | Mua lại domain hết hạn chỉ để tận dụng uy tín cũ, nội dung mới không liên quan | Không áp dụng |
| 4 | **Hacked content** | Nội dung bị chèn qua lỗ hổng bảo mật | Thuộc phạm vi bảo mật hạ tầng, không phải nội dung — xem CLAUDE.md §7 |
| 5 | **Hidden text/link abuse** | Chữ/link ẩn (trắng trên nền trắng, font-size=0) chỉ để nhồi từ khoá | Không áp dụng — nhưng PHẢI tự kiểm tra mỗi khi thêm UI có `<details>`/collapse: nội dung gấp lại vẫn phải NẰM TRONG DOM và hiển thị được khi mở, không phải "ẩn vĩnh viễn nhưng vẫn đếm là nội dung" |
| 6 | **Keyword stuffing** | Nhồi từ khoá không tự nhiên | Đã có nguyên tắc ở `dichoithoi-seo-principles.md` §2 |
| 7 | **Link spam** | Mua/bán link, trao đổi link ồ ạt, tạo link tự động | Áp dụng cho link affiliate — không tham gia link exchange network, không mua backlink hàng loạt |
| 8 | **Machine-generated traffic** | Gửi truy vấn tự động tới Google, cào kết quả tìm kiếm | Không áp dụng |
| 9 | **Malicious practices** | Malware, phần mềm không mong muốn, hijack nút back | Không áp dụng |
| 10 | **Misleading functionality** | Hứa 1 tính năng nhưng không thực hiện (vd nút "tạo mã giảm giá" giả) | ⚠️ Kiểm tra khi làm module Sim/khuyến mãi — mọi CTA phải dẫn tới hành động thật |
| 11 | **Scaled content abuse** | Tạo hàng loạt trang chủ yếu để thao túng thứ hạng, ít giá trị người dùng thật — **bao gồm rõ "dùng công cụ AI tạo nhiều trang không thêm giá trị"** | ⚠️ RỦI RO CAO NHẤT với dichoithoi (pipeline AI viết hàng loạt điểm đến) — đã có cơ chế chống ở `dichoithoi-seo-principles.md` §3.3 (2-gate review + 4 quality gate + đề xuất gate originality) |
| 12 | **Scraping** | Lấy nội dung từ site khác qua tự động hoá, không thêm giá trị | Cấm tuyệt đối — pipeline AI phải sinh nội dung gốc, không tóm tắt/paraphrase 1-2 nguồn |
| 13 | **Site reputation abuse** | Đăng nội dung bên thứ 3 trên site uy tín có sẵn chỉ để lợi dụng tín hiệu xếp hạng | Không áp dụng (dichoithoi không nhận đăng bài thuê) |
| 14 | **Sneaky redirects** | Redirect người dùng sang nội dung khác hẳn nội dung Google thấy | Không áp dụng |
| 15 | **Thin affiliation** | Nội dung affiliate chỉ copy mô tả sản phẩm, không có giá trị/góc nhìn gốc | ⚠️ Áp dụng trực tiếp cho link Hotel/Tour/Product affiliate — mọi trang có CTA thương mại phải có nội dung gốc bao quanh (kinh nghiệm thực tế, so sánh, lưu ý), không chỉ nhúng link |
| 16 | **User-generated spam** | Spam do người dùng đăng qua kênh cộng đồng (forum, comment) | Áp dụng nếu sau này mở comment/review công khai — cần kiểm duyệt trước khi hiển thị |

**Mục #11 (Scaled content abuse)** và **#15 (Thin affiliation)** là 2 rủi ro
THỰC TẾ NHẤT với mô hình kinh doanh dichoithoi (AI viết hàng loạt + affiliate)
— ưu tiên rà soát 2 mục này mỗi khi có tính năng mới liên quan nội dung/CTA.

## 3) Structured data (JSON-LD) — quy tắc chung, không chỉ riêng loại schema

Từ `sd-policies` (áp dụng cho MỌI loại JSON-LD, không chỉ `Article`):
- **Chỉ markup nội dung THỰC SỰ hiển thị cho người đọc trên trang** — không
  markup dữ liệu không có trên trang (vi phạm nếu, ví dụ, gắn `FAQPage`
  JSON-LD với câu hỏi không hiện trên UI).
- **Không markup nội dung giả/gây hiểu lầm** — review giả, dữ liệu không
  liên quan tới nội dung chính trang. Đã áp dụng đúng ở quyết định KHÔNG
  gắn `AggregateRating`/`Review` cho điểm chấm nội bộ admin (xem
  `dichoithoi-seo-principles.md` §2).
- **Structured data phải phản ánh đúng TRỌNG TÂM trang** — ví dụ site hướng
  dẫn không được gắn nhãn `Recipe` nếu nội dung không phải công thức nấu ăn.
- Có markup đúng KHÔNG đảm bảo được rich result — Google tự quyết định hiển
  thị, không phải "làm đúng là chắc chắn lên rich snippet".
- Vi phạm → hậu quả là **manual action** (gỡ rich result, có thể ảnh hưởng
  toàn site nếu vi phạm nghiêm trọng — đã có tiền lệ thật với sao vàng review
  giả, xem `dichoithoi-seo-principles.md` §2).

### 3.1 `datePublished`/`dateModified` (loại `Article`/`CreativeWork`/`WebPage`)

- Định dạng ISO 8601, nên kèm timezone (mặc định lấy theo Googlebot nếu bỏ
  trống — không đáng tin, luôn set rõ).
- `dateModified` = "thời điểm bài viết được sửa **gần nhất**" — không có
  ràng buộc kỹ thuật bắt phải khớp % với nội dung thật (Google không "chấm
  điểm tự động" trường này riêng lẻ), NHƯNG rủi ro thật nằm ở §7 dưới (Google
  đối chiếu tín hiệu freshness tổng thể, không chỉ tin 1 field JSON-LD).
- `TouristAttraction`/`Place` (loại schema đang dùng cho trang điểm đến)
  **không có** thuộc tính `dateModified` trong vocab schema.org — đây là lý
  do kỹ thuật bắt buộc phải tách riêng khối `WebPage` để mang `dateModified`
  (đã implement, xem `SchemaUtil.cs` → `CreateDestinationWebPageJsonLD`,
  29/07/2026) thay vì gắn sai kiểu lên `TouristAttraction`.

## 4) Sitemap — `<lastmod>` phải "verifiably accurate"

Trích nguyên văn quan trọng nhất từ `build-sitemap`:

> Google uses the `<lastmod>` value **if it's consistently and verifiably
> accurate** (for example by comparing to the last modification of the page).

Nghĩa là: Google **tự đối chiếu** giá trị `lastmod` bạn khai với thời điểm
trang thực sự đổi (qua HTTP header, nội dung HTML, tín hiệu khác) — nếu phát
hiện `lastmod` không khớp thực tế (khai đổi liên tục nhưng nội dung không
đổi), Google **ngừng tin cậy** giá trị này cho toàn site, không chỉ 1 trang.
→ Đây là căn cứ trực tiếp quyết định KHÔNG dùng `v2.Destination.UpdatedAt`
(cột bị nhiều thao tác không-phải-nội-dung đụng vào — đổi slug, tính lại
khoảng cách, đổi thumbnail) làm nguồn `lastmod`, phải tách cột
`ContentUpdatedAt` riêng chỉ bump khi nội dung thật đổi (xem
`dichoithoi-content-freshness-plan.md` §1).

Google cũng nói rõ: **cập nhật không đáng kể KHÔNG được tính** — nguyên văn
ví dụ "cập nhật năm bản quyền ở footer không phải là thay đổi đáng kể".

## 5) Core Web Vitals / Page Experience — thứ tự ưu tiên thật

Từ `page-experience` — 1 điểm hay bị hiểu sai:

> Beyond Core Web Vitals, other page experience aspects **don't directly
> help your website rank higher** in search results.
> [...] we aim to feature the most relevant content, **even if the page
> experience is sub-par**.

Nghĩa là: **độ liên quan/chất lượng nội dung LUÔN thắng page experience** —
Core Web Vitals (LCP/INP/CLS) là tín hiệu xếp hạng chính thức DUY NHẤT trong
nhóm này có tác động trực tiếp; HTTPS/mobile-friendly/không xen ngang quá
mức là điều kiện "không bị trừ điểm" chứ không phải "có thêm điểm". Kết
luận thực dụng: KHÔNG hy sinh chất lượng/độ đầy đủ nội dung để chạy theo tối
ưu tốc độ cực đoan (vd cắt bớt nội dung thật để giảm dung lượng trang) —
ngược lại, ranking tiến độ Core Web Vitals vẫn là việc BẮT BUỘC làm tốt
(không phải optional) vì nó ảnh hưởng trực tiếp, chỉ là không phải yếu tố
duy nhất/quan trọng nhất.

Ngưỡng chính thức (không đổi so với thiết kế đã chốt ở
`dichoithoi-seo-principles.md` §2): LCP < 2.5s, INP < 200ms, CLS < 0.1.

## 6) Duplicate content & canonical

Từ `consolidate-duplicate-urls`:
- 3 cách báo hiệu canonical, xếp theo độ mạnh: **redirect** (mạnh nhất) >
  `rel="canonical"` (mạnh) > có mặt trong sitemap (**tín hiệu yếu**, chỉ hỗ
  trợ chứ không quyết định).
- Lỗi thường gặp cần tránh: dùng `robots.txt`/URL removal tool để xử lý
  duplicate (sai công cụ); khai `rel="canonical"` khác nhau ở nhiều nơi cho
  cùng 1 trang; dùng URL tương đối thay vì tuyệt đối; đặt `rel="canonical"`
  ngoài `<head>`; dùng `noindex` thay cho canonical (2 mục đích khác nhau);
  để JavaScript đổi lại thẻ canonical sau khi trang đã load.
- Áp dụng trực tiếp cho quyết định đã có: KHÔNG tạo route riêng cho
  `kind=province` trùng nội dung `/tinh/{slug}` (`dichoithoi-seo-principles.md`
  §2) — đúng tinh thần "1 URL = 1 nội dung, không tạo duplicate rồi mới lo
  canonical".

## 7) "Helpful content" — nguyên văn cảnh báo date-spam (căn cứ trực tiếp cho content-freshness-plan)

Đây là phần quan trọng nhất trả lời đúng câu hỏi "Google xác định nội dung
update có giá trị không, để không bị coi là spam" — trích nguyên văn từ
`creating-helpful-content`:

> [Red flag] Are you changing the date of a page to make it appear fresh,
> **when content has not been substantively changed**?

Google liệt kê đây là 1 trong các **dấu hiệu xấu** ("search-engine-first"
content) cùng nhóm với: viết theo số từ cố định vì nghe nói Google thích độ
dài đó (nguyên văn: *"No, we don't."*), sản xuất hàng loạt chủ đề mong 1-2
bài lên hạng, tóm tắt lại nguồn khác không thêm giá trị, dùng automation quy
mô lớn viết nhiều chủ đề không có chuyên môn thật (nhóm này đã trích đầy đủ ở
`dichoithoi-seo-principles.md` §3.2).

**→ Kết luận trực tiếp cho `dichoithoi-content-freshness-plan.md`:** thiết
kế 2 cột `ContentUpdatedAt`/`LastVerifiedAt` tách biệt — chỉ bump
`ContentUpdatedAt` (đổ vào badge + `dateModified` + `lastmod`) khi nội dung
**THẬT SỰ đổi** (so sánh giá trị field hoặc AI phân loại `ContentHtml`) —
chính là cơ chế kỹ thuật để KHÔNG BAO GIỜ vi phạm đúng câu cảnh báo trên.
Ngược lại, nếu (giả sử) làm phiên bản đơn giản hơn "cứ publish là bump ngày"
thì đây sẽ là vi phạm helpful-content-guidance **trực tiếp, nguyên văn**,
không phải suy diễn — rủi ro không chỉ ở 1 trang mà ảnh hưởng đánh giá
"search-engine-first" cho CẢ SITE (Google đánh giá theo pattern hành vi
site, không chỉ từng trang lẻ).

### 7.1 Câu hỏi tự chấm đầy đủ (nhóm Content & Quality, 12 câu — bản đầy đủ hơn phần đã trích ở seo-principles.md)

Ngoài 4 câu đã có ở `dichoithoi-seo-principles.md` §3.2, Google còn hỏi:
- Nội dung có lỗi chính tả/dàn trang cẩu thả không?
- Nội dung có được sản xuất/biên tập cẩn thận, hay trông như "sản xuất hàng
  loạt cho nhiều site không đầu tư"?
- Tiêu đề/title có phóng đại/giật tít gây thất vọng khi đọc nội dung thật
  không?
- Đây có phải trang bạn muốn bookmark, chia sẻ, hay giới thiệu bạn bè không?

## 8) Site relaunch/big-change — "flag" thật sự là gì, và điều gì bình thường

Ghi nhận từ câu hỏi thật (29/07/2026): production cũ chỉ 247 điểm đến, nhiều
năm gần như không cập nhật, traffic <100 lượt/ngày — lo bị Google "đánh
flag" khi làm big-change tổ chức lại toàn bộ site.

### 8.1 Chỉ có 1 loại "flag" chính thức: Manual Action

Traffic thấp/nội dung cũ/ít cập nhật **không phải** 1 dạng phạt — chỉ là hệ
quả của xếp hạng thấp (do nội dung mỏng/thiếu tín hiệu), không phải nguyên
nhân riêng biệt cần "gỡ". Loại phạt CHÍNH THỨC duy nhất Google ghi nhận là
**Manual Action** (`support.google.com/webmasters/answer/9044175`) — do
người review thật xác nhận vi phạm spam policy (§2), xem/kiểm tra ở Search
Console mục "Manual Actions". Không có action nào ở đó → không có gì phải
xử lý trước khi release liên quan tới "lịch sử xấu" của site cũ.

### 8.2 Big-change tổ chức lại + nội dung khoa học hơn là hướng ĐÚNG

Đúng tinh thần helpful content (§7) — cải thiện độ đầy đủ/cấu trúc/tín hiệu
E-E-A-T là điều Google khuyến khích, không phải rủi ro. Rủi ro thật nằm ở
CÁCH triển khai (§8.3-8.4), không nằm ở việc "dám thay đổi lớn".

### 8.3 Khi đổi URL/slug hàng loạt — trích nguyên văn `site-move-with-url-changes`

> [...] visibility of your content in Search may fluctuate temporarily
> during the move. This is normal and a site's rankings will settle down
> over time.

- Redirect 301 (server-side) là cách chính thức, giữ **tối thiểu 1 năm**
  không gỡ sớm — để tín hiệu/trust tích luỹ nhiều năm chuyển hết sang URL
  mới. Site cỡ vừa "có thể mất vài tuần" để phần lớn trang được index lại.
- Lỗi thường gặp cần tránh: quên gỡ `noindex`/chặn `robots.txt` cũ sau khi
  chuyển; redirect về URL không tồn tại hoặc không liên quan (kể cả redirect
  hàng loạt về trang chủ); quên cập nhật sitemap URL mới.
- Dao động thứ hạng vài tuần đầu sau release là **hành vi bình thường**,
  không phải dấu hiệu bị phạt — chỉ cần lo nếu KHÔNG hồi phục sau nhiều
  tuần, khi đó mới đi tìm lỗi kỹ thuật thật (redirect sai/thiếu, noindex
  sót).

### 8.4 Mở index hàng loạt trang mới cùng lúc — nối lại đúng rủi ro #11 ở §2

Tung nhiều trang mới cùng lúc (vd hàng trăm cụm/điểm đến) mà một phần còn
mỏng/chưa đủ nội dung → rơi đúng mẫu "Scaled content abuse" (§2 #11), dù
không cố ý. Cách xử lý đã áp dụng: `noindex` cho phần còn mỏng, chỉ mở index
dần khi đủ chất lượng — xem `dichoithoi-release-checklist.md` mục "Rà cụm
mỏng trước khi mở index".

## 9) Checklist áp dụng nhanh khi review 1 tính năng mới (tổng hợp từ toàn bộ tài liệu trên)

1. Trang/route mới có bị chặn `robots.txt`/`noindex` nhầm không? (§1)
2. Có rơi vào 16 nhóm spam nào không, đặc biệt #11 Scaled content abuse và
   #15 Thin affiliation nếu liên quan AI hoặc affiliate? (§2)
3. JSON-LD thêm mới có đúng loại schema, chỉ markup nội dung thực sự hiển
   thị, không bịa dữ liệu? (§3)
4. Nếu có trường ngày tháng (`lastmod`/`dateModified`/badge hiển thị) — có
   PHẢI là thay đổi nội dung thật mới được bump không, hay đang tự động hoá
   vô điều kiện? (§4, §7 — vi phạm trực tiếp nếu sai)
5. Có ảnh hưởng LCP/INP/CLS không (ảnh nặng, JS chặn render, layout nhảy)?
   (§5)
6. Có tạo URL trùng nội dung với URL đã có không, đã xử lý canonical đúng
   cách chưa? (§6)
7. Nếu là nội dung AI — có pass đủ 2-gate review + trả lời được Who/How/Why
   không, hay chỉ để "có bài mới"? (§7, xem đầy đủ ở
   `dichoithoi-seo-principles.md` §3)
8. Nếu đang release/đổi URL hàng loạt — đã kiểm tra Manual Actions, có kế
   hoạch redirect 301 giữ ≥1 năm, không mở index hàng loạt trang còn mỏng
   chưa? (§8)
