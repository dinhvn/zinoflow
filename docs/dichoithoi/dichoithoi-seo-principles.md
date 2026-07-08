# Dichoithoi — Nguyên tắc SEO tối thượng (ĐỌC TRƯỚC KHI CODE bất kỳ tính năng nào)

⚠️ **Tài liệu này có độ ưu tiên CAO NHẤT trong toàn bộ mảng dichoithoi** — mọi
quyết định thiết kế/code khác (destination-spec, article-spec, content-seo-ux-
plan...) phải tuân theo tinh thần ở đây. Nếu 1 đề xuất nào đó (kể cả đã viết
trong spec khác) mâu thuẫn với nguyên tắc dưới, nguyên tắc ở đây thắng — dừng
lại và hỏi lại người dùng thay vì âm thầm làm theo spec cũ.

## 0) Vai trò bắt buộc khi làm việc trên dichoithoi

Khi làm bất kỳ việc gì liên quan tới website dichoithoi (thiết kế, code, review,
viết nội dung, chọn cấu trúc dữ liệu), **phải nhập vai**:

> Tôi là chuyên gia thiết kế website chuẩn SEO, mục tiêu website luôn đứng TOP 1
> tìm kiếm Google. Tôi liên tục cập nhật kiến thức SEO mới nhất (Core Web
> Vitals, E-E-A-T, structured data, helpful content) và áp dụng ngay, không
> làm theo thói quen cũ đã lỗi thời. Tôi hành xử như CHÍNH CHỦ SỞ HỮU website
> này — muốn nó tốt nhất, nhanh nhất, SEO cao nhất, đáp ứng đúng nhu cầu người
> đọc thật — vì đó là cách duy nhất website này kiếm được tiền và tôi được tin
> tưởng tiếp tục làm việc.

Đây không phải 1 lần phân tích rồi thôi — đây là **tư duy áp dụng cho MỌI**
tính năng/thông tin mới được thêm vào dichoithoi, mãi mãi, không chỉ lần này.

## 1) Quy trình BẮT BUỘC trước khi thêm bất kỳ tính năng/thông tin hiển thị nào

Trước khi viết code hoặc thiết kế 1 field/1 khối UI/1 trang mới, phải tự trả
lời rõ ràng 3 câu sau (không phải sau khi code xong mới nghĩ tới):

1. **Có thực sự hữu ích cho người đọc thật không?** — không phải "có vẻ hay"
   hay "làm cho đủ" — trả lời được câu hỏi thật của 1 người đang lên kế hoạch
   đi chơi/đi công tác. Nếu không trả lời được lợi ích cụ thể → không làm.
2. **Cấu trúc/cách hiển thị nào chuẩn SEO nhất** cho thông tin này? (heading
   đúng cấp, structured data JSON-LD phù hợp loại nào, có nên tách trang riêng
   hay gộp vào trang có sẵn, vị trí trên trang ảnh hưởng gì tới Core Web
   Vitals).
3. **Cần bổ sung thêm dữ liệu/tín hiệu gì để tăng cơ hội SEO** quanh tính năng
   này — nhưng KHÔNG được vi phạm nguyên tắc "không bịa dữ liệu cứng" (destination-
   spec §3.5) — chỉ đề xuất field/nguồn dữ liệu thật, không suy diễn.

## 2) Nguyên tắc SEO kỹ thuật cốt lõi (kiến thức hiện hành, cập nhật liên tục)

- **E-E-A-T** (Experience, Expertise, Authoritativeness, Trust): nội dung phải
  thể hiện trải nghiệm thật, không chỉ liệt kê dữ liệu khô khan — đây là lý do
  các khối "câu chuyện văn hoá - lịch sử", review thật, tác giả/nguồn tham
  khảo quan trọng ngang dữ liệu có cấu trúc (giá vé, giờ mở cửa).
- **Core Web Vitals là yếu tố xếp hạng chính thức**: LCP < 2.5s, INP < 200ms,
  CLS < 0.1 — MỌI tính năng mới thêm vào phải tự kiểm tra không phá 3 chỉ số
  này (ảnh nặng, JS chặn render, layout nhảy khi load).
- **Mobile-first indexing**: Google index bản mobile là chính — nội dung nào
  quan trọng PHẢI có mặt đầy đủ trên mobile, không được ẩn/rút gọn chỉ vì
  "desktop mới có chỗ hiển thị" (khác việc gấp `<details>` để gọn giao diện —
  đó là UI, nội dung vẫn còn nguyên trong DOM).
- **Structured data (JSON-LD) đầy đủ theo loại trang**: `TouristAttraction`/
  `Place`, `BreadcrumbList`, `FAQPage`, `AggregateRating`, `ItemList`/
  `CollectionPage` — mỗi khi thêm field/khối nội dung mới, luôn tự hỏi "field
  này có schema.org type nào khớp không, đã khai báo JSON-LD chưa".
- **Không trùng lặp nội dung (duplicate content)**: mỗi URL phải có giá trị
  riêng biệt thật sự — đây là lý do quyết định KHÔNG cho `kind=province` có
  trang riêng trùng `/tinh/{slug}` (content-seo-ux-plan §10.6), và lý do mọi
  trang danh mục phải có đoạn giới thiệu riêng, không chỉ là lưới card.
- **Internal linking chủ động**: mọi nội dung mới nên tự tạo cơ hội liên kết
  nội bộ (breadcrumb, related, auto-link khi nhắc tên điểm khác) — không để
  trang nào "mồ côi" (orphan page) không có link trỏ tới.
- **Không nhồi từ khoá (keyword stuffing)** — bị phạt trực tiếp, viết tự
  nhiên, ưu tiên trả lời đúng intent hơn là lặp từ khoá.
- **Semantic HTML đúng chuẩn**: mỗi trang 1 `H1` duy nhất, phân cấp `H2`/`H3`
  hợp lý phản ánh đúng cấu trúc nội dung (không dùng heading để tạo hiệu ứng
  thị giác thay vì đúng vai trò ngữ nghĩa).
- **Tránh "thin content"/"doorway pages"**: không tạo hàng loạt trang gần như
  giống nhau chỉ khác 1-2 biến số (vd nếu sau này có ý tưởng tạo trang combo
  filter tự động) mà không có nội dung khác biệt thật.
- **Tốc độ + kích thước file là ranking factor chính thức** (không chỉ là UX)
  — mọi quyết định kỹ thuật đã chốt ở content-seo-ux-plan §10.5 (bỏ framework
  nặng, Tailwind purge, vanilla JS, SVG, ảnh tối ưu) phục vụ trực tiếp mục
  tiêu SEO này, không chỉ vì "cho nhẹ".
- **Freshness**: nội dung cập nhật thường xuyên có lợi cho ranking, nhất là
  trang mùa vụ/sự kiện — cân nhắc khi thiết kế tần suất rà soát lại nội dung
  cũ (không chỉ tạo mới).
- **Không "intrusive interstitials"**: quá nhiều CTA/quảng cáo che nội dung
  trên màn hình đầu bị Google phạt trực tiếp — đã có giới hạn cụ thể (content-
  seo-ux-plan §9.5, thanh CTA dính đáy không quá 15-20% chiều cao màn hình).
- **Helpful Content / chống spam AI**: Google phạt nội dung AI tạo hàng loạt
  không có giá trị/không qua kiểm duyệt con người — MỌI bài AI viết phải qua
  2-gate review trước publish (đã có sẵn trong ai-content pipeline), không
  được bỏ qua bước này dù có áp lực ra bài nhanh.
- **Chuẩn EEAT cho affiliate**: mọi CTA/link kiếm tiền cần có disclosure rõ
  ràng (`rel="sponsored"`, dòng thông báo) — minh bạch với người đọc VÀ đúng
  yêu cầu Google với nội dung có liên kết thương mại.

## 3) Nội dung AI vs Google — sự thật đã kiểm chứng (07/2026, YẾU TỐ SỐNG CÒN)

⚠️ Phần này được xác minh trực tiếp từ tài liệu chính thức của Google
(`developers.google.com/search/docs/fundamentals/using-gen-ai-content`,
`developers.google.com/search/docs/essentials/spam-policies`,
`developers.google.com/search/docs/fundamentals/creating-helpful-content`,
đọc lại 07/2026) — không suy đoán, không tin đồn SEO. Đọc kỹ trước khi viết
bất kỳ bài AI nào cho dichoithoi.

### 3.1 Sự thật quan trọng nhất — sửa 1 hiểu lầm phổ biến

**Google KHÔNG có "máy dò AI" chấm điểm/phạt nội dung vì nó do AI viết.**
Nguyên văn định hướng chính thức: cách nội dung được TẠO RA (người viết tay,
AI hỗ trợ, AI viết hoàn toàn, tự động hoá) **không phải** là tín hiệu xếp hạng.
Google nói rõ AI hữu ích khi "research chủ đề và thêm cấu trúc cho nội dung
gốc", và tự động hoá đã được dùng lâu nay cho nội dung hữu ích (kết quả thể
thao, thời tiết, transcript).

**Cái BỊ phạt** không phải "dùng AI", mà là chính sách spam tên
**"Scaled content abuse"** (gộp từ chính sách "auto-generated content" cũ,
cập nhật 2024, siết chặt thêm ở đợt cập nhật lõi tháng 3/2026): *"tạo ra rất
nhiều trang với mục đích CHÍNH là thao túng thứ hạng tìm kiếm, không giúp ích
người dùng — bất kể tạo bằng cách nào"*. Nguyên văn ví dụ vi phạm Google liệt
kê: "dùng công cụ AI tạo ra nhiều trang mà không thêm giá trị cho người dùng";
cào feed/kết quả tìm kiếm để tạo nhiều trang giá trị thấp; ghép/nối nội dung
từ nhiều trang khác mà không thêm giá trị; tạo nhiều trang có từ khoá nhưng
nội dung vô nghĩa.

→ Kết luận thực dụng: **KHÔNG cần "che giấu" là AI viết, KHÔNG cần cố làm văn
bản "giống người" để qua mặt 1 detector không tồn tại.** Việc cần làm là đảm
bảo MỖI bài AI viết ra thật sự đáp ứng nhu cầu người đọc, không phải bài thứ
1000 rập khuôn cùng 1 khung không có gì mới.

### 3.2 Khung "Who — How — Why" (tự đánh giá chính thức của Google)

Google công bố 3 câu hỏi để tự đánh giá nội dung có phải "người-đầu-tiên"
(people-first) hay "công cụ-tìm-kiếm-đầu-tiên" (search-engine-first — dấu hiệu
xấu). Áp dụng cho MỌI bài dichoithoi trước khi Approve:

1. **Who (Ai tạo ra)**: có tác giả/nguồn rõ ràng không, có thể hiện chuyên môn/
   trải nghiệm thật không? → khớp thẳng với khối "câu chuyện văn hoá - lịch
   sử" + review thật đã thiết kế (content-seo-ux-plan §5.6).
2. **How (Tạo thế nào)**: có minh bạch về việc dùng tự động hoá/AI không (không
   bắt buộc công khai trên trang, nhưng KHÔNG được tạo cảm giác giả tạo là
   "phóng viên đã đến tận nơi" nếu không có input thật) — đây là lý do
   destination-spec §3.5 cấm AI tự bịa dữ liệu cứng (lat/lng/giá/địa chỉ).
3. **Why (Tạo để làm gì)**: mục đích chính phải là GIÚP NGƯỜI ĐỌC, không phải
   để "hứng traffic tìm kiếm". Dấu hiệu XẤU Google nêu rõ: viết theo số từ cố
   định vì "nghe nói Google thích độ dài đó", sản xuất hàng loạt chủ đề mong
   1 vài bài lên hạng, tóm tắt lại nguồn khác mà không thêm giá trị, dùng
   "automation quy mô lớn" để viết nhiều chủ đề không có chuyên môn thật.

Câu hỏi chất lượng cụ thể Google dùng để tự chấm (áp cho mọi bài dichoithoi):
- Nội dung có cung cấp thông tin/phân tích **gốc** không, hay chỉ tóm tắt lại
  nguồn khác?
- Có mô tả **đầy đủ, toàn diện** về chủ đề không (đúng tinh thần "8 khối nội
  dung đầy đủ" đã thiết kế ở destination-spec §2.2)?
- Người đọc có muốn **lưu lại/giới thiệu cho người khác** không?
- Nội dung có khiến người đọc **tin tưởng** không (ai viết, có vẻ hiểu chủ đề
  thật không)?

### 3.3 Vì sao pipeline hiện tại (2-gate review + quality gates) đã đúng hướng — nhưng cần thêm 1 lớp

Cơ chế đã có (`ai-content` module, `destination-gates.ts`): structure gate
(≥3 section, ≥60 từ/section, FAQ ≥3), SEO gate (từ khoá trong H1/mở bài/meta),
policy gate (cấm claim tuyệt đối kiểu "đẹp nhất Việt Nam", bắt buộc ghi ngày
cập nhật), data gate (không field rỗng/bịa) — đây CHÍNH XÁC là cơ chế chống
"scaled content abuse" và "low-effort content" (SQRG §4.6.5/§4.6.6) mà Google
nói tới, dù lúc thiết kế ban đầu không đặt tên vậy. **Giữ nguyên, không bỏ.**

**Lớp còn thiếu**: chưa có gate kiểm tra **tính nguyên bản** (originality) —
rủi ro thật với AI viết hàng loạt bài cùng khung (vd nhiều điểm đến na ná
nhau) là tạo ra nội dung **trùng lặp NỘI BỘ** (các bài tự giống nhau, chính là
dấu hiệu "scaled content abuse" dù không sao chép từ ngoài). Đề xuất (CHƯA
build, ghi nhận để phân tích/code sau — xem backlog): thêm **gate "originality"**
thứ 5, so sánh đoạn văn mới với các bài ĐÃ publish cùng loại/tỉnh (similarity
threshold, chặn publish nếu quá giống) — đặc biệt áp cho các đoạn dễ bị lặp
khuôn: "câu chuyện văn hoá - lịch sử", "lưu ý thực tế", đoạn giới thiệu trang
cluster/tỉnh.

### 3.4 Kiểm tra TRƯỚC KHI publish — cách làm thực tế

1. **Gate tự động đã có** (structure/SEO/policy/data) — bắt buộc pass 100%,
   không có "publish tạm rồi sửa sau".
2. **Tự kiểm tra trùng lặp NỘI BỘ** (so với bài khác trên chính site mình) —
   cách đơn giản không cần công cụ trả phí: lấy 2-3 câu đặc trưng nhất của bài
   mới, tìm trong chính database các bài đã publish (full-text search hoặc so
   sánh embedding) xem có đoạn gần giống không. Đây là rủi ro THỰC TẾ NHẤT với
   dichoithoi vì nhiều bài cùng khung (destination) dễ lặp công thức.
3. **Tự kiểm tra trùng lặp BÊN NGOÀI** (so với nội dung đã có trên mạng) —
   copy 2-3 câu đặc trưng, tìm kiếm Google để trong ngoặc kép ("..."), nếu ra
   kết quả gần giống y hệt ở nguồn khác → viết lại đoạn đó. Không cần công cụ
   trả phí cho quy mô hiện tại; nếu khối lượng bài tăng nhiều, cân nhắc
   Copyscape/Originality.ai để tự động hoá bước này.
4. **KHÔNG dùng "AI-detector" (GPTZero, Originality.ai...) làm tiêu chuẩn
   pass/fail** — các công cụ này KHÔNG phải thứ Google dùng, và có tỷ lệ sai
   (false positive/negative) đáng kể. Có thể dùng làm gợi ý phụ "đoạn này đọc
   hơi khuôn mẫu, nên biên tập lại cho tự nhiên hơn" — nhưng quyết định cuối
   cùng luôn là con người đọc và duyệt (đúng gate "review con người" đã có).
5. **Kiểm tra kỹ thuật SEO của chính bài đó trước khi bấm Publish**: Rich
   Results Test (structured data JSON-LD hợp lệ), Mobile-Friendly Test,
   PageSpeed Insights cho URL staging nếu có — không chỉ tin thiết kế trên
   giấy (đã nhắc ở content-seo-ux-plan §10.5.1 mục 4, nhưng đó là đo tổng thể
   định kỳ; đây là kiểm tra TỪNG BÀI trước khi publish).
6. **Câu hỏi Who/How/Why (§3.2) là bước duyệt cuối cùng của người review** —
   không chỉ tick "gate pass" mà phải tự hỏi "bài này có thật sự giúp người
   đọc, hay chỉ để có bài mới cho SEO".

### 3.5 Điều KHÔNG được làm (rủi ro thật, đã có tiền lệ Google phạt)

- KHÔNG viết nhiều bài gần giống nhau chỉ đổi tên địa điểm/từ khoá (khuôn mẫu
  cứng) — đúng định nghĩa "scaled content abuse".
- KHÔNG tóm tắt/diễn giải lại nội dung từ 1-2 nguồn có sẵn mà không có thông
  tin/góc nhìn mới — đây là "low-effort content" bị SQRG chấm điểm thấp.
- KHÔNG đặt mục tiêu "ra bài nhanh, nhiều" làm ưu tiên cao hơn "bài này có thật
  sự tốt không" — đúng dấu hiệu xấu "search-engine-first" Google cảnh báo.
- KHÔNG bỏ qua bước review con người dù áp lực tiến độ — đây là lớp bảo vệ
  quan trọng nhất, không phải thủ tục hình thức.
- KHÔNG cố "làm giả" trải nghiệm thật (viết như thể "tôi đã tới tận nơi") khi
  input chỉ là dữ liệu tổng hợp — vi phạm chính tinh thần "Who/How" minh bạch.

## 4) Cách áp dụng khi làm việc

- Trước khi bắt tay code 1 tính năng mới (kể cả nhỏ), trả lời nhanh 3 câu ở
  mục 1 trong phản hồi với người dùng — không âm thầm bỏ qua bước này.
- Khi review lại spec cũ và thấy 1 quyết định có thể tối ưu SEO hơn theo kiến
  thức mới, phải CHỦ ĐỘNG nêu ra (không chờ được hỏi) — đúng tinh thần "chủ sở
  hữu website", không phải chỉ làm đúng những gì được yêu cầu.
- Không lặp lại các nguyên tắc kỹ thuật xuyên suốt đã có ở
  `dichoithoi-system-design.md` §5 (ghi đắt đọc rẻ, không bịa dữ liệu, single-
  writer...) — tài liệu này bổ sung TẦNG TƯ DUY SEO/giá trị người dùng phía
  trên, không thay thế các nguyên tắc kỹ thuật đó.
