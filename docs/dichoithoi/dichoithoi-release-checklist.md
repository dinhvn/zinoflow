# Checklist Release dichoithoi.com

Chiến lược release đã chốt (07/2026, xem `dichoithoi-golive-runbook.md`):
**xoá sạch production hiện tại, đưa nguyên code + database mới từ local lên**
— KHÔNG migrate-tại-chỗ. Checklist này dùng CHO chiến lược đó, chạy theo thứ
tự, không bỏ bước.

## 1) Trước khi xoá production (chuẩn bị + lưới an toàn)

- [ ] **Backup production hiện tại trước khi xoá** — dù sẽ xoá, vẫn backup
      để có đường lùi nếu phát hiện vấn đề sau release (DB + toàn bộ ảnh
      upload qua FTP thực tế trên production, không chỉ code).
- [ ] Rà xem có ảnh/nội dung nào **chỉ tồn tại trên production** mà local
      chưa có không (ví dụ ảnh upload trực tiếp qua CMS cũ `CmsDiChoiThoi.Web`,
      hoặc chỉnh sửa tay trên production DB) — nếu có, kéo về local trước khi
      xoá, kẻo mất vĩnh viễn.
- [ ] `CmsDiChoiThoi.Web` (CMS cũ) — xác nhận không còn ai dùng để tạo/sửa dữ
      liệu nữa trước khi xoá production (2 route `import_destination`/
      `import_tour` vẫn ghi vào bảng v1; cờ `IsLegacyImportLocked` đã có sẵn
      trong code nếu cần khoá tạm trước khi xoá hẳn).
- [ ] Chuẩn bị sẵn giá trị thật cho production trong `.env` (zinoflow
      `apps/api/.env`) và `appsettings.*.json` (`DiChoiThoi.Web`): connection
      string SQL Server thật (`sql5059.site4now.net`), `DICHOITHOI_FTP_*`,
      `DICHOITHOI_SITE_BASE_URL`/`DICHOITHOI_IMAGE_BASE_URL` đổi từ
      `localhost` sang `https://dichoithoi.com` — dò lại TOÀN BỘ biến có tiền
      tố `DICHOITHOI_LOCAL_*`/`localhost` trong `.env`, đảm bảo không còn giá
      trị dev nào lọt lên production.
- [ ] Bảng v1 khác chưa audit trong phiên 07/2026 này — nếu vẫn còn dùng
      (Hotel/HotelGroup/DestinationGroup/DestinationReview/Province qua
      `HotelRepository` và các nơi khác), xác nhận có cần mang theo lên
      production mới không, hay cũng bỏ luôn.
- [ ] **Backup DB production cũ giữ riêng 1 bản để đối chiếu URL** (khác bản
      backup lưới-an-toàn ở trên, dùng bản này để so sánh, không phục hồi) —
      đợt này là nâng cấp kiến trúc lớn (tổ chức lại cấu trúc dữ liệu điểm
      đến), slug/URL mới nhiều khả năng khác cũ và **không còn liên kết
      trực tiếp trong DB mới** (không có cột legacy-slug/FK về ID cũ). Lúc
      release, sẽ yêu cầu Claude đọc DB cũ (bản backup này) + DB mới, so
      sánh slug, ra danh sách slug cũ không còn tồn tại ở DB mới — làm cơ sở
      redirect ở bước 3. Không tự map bằng suy diễn máy móc — Claude đề xuất
      map (theo tên/toạ độ/nội dung), người dùng duyệt từng dòng trước khi
      áp dụng.

## 2) Đưa code + database mới lên

- [ ] Deploy `DiChoiThoi.Web` build Release (`dotnet publish -c Release`) lên
      hosting SmarterASP — không deploy bản Debug.
- [ ] Đưa database mới (từ `dichoithoi_dev` local) lên SQL Server production
      — restore/import nguyên schema v2 + dữ liệu.
- [ ] Deploy `zinoflow/apps/api` với `.env` production đã chuẩn bị ở bước 1,
      restart API.
- [ ] Đồng bộ ảnh: production dùng FTP thật (`DICHOITHOI_FTP_*`), khác cơ chế
      ghi file cục bộ đang dùng ở local dev (`DICHOITHOI_LOCAL_WEB_ROOT`) —
      xác nhận toàn bộ ảnh hero/gallery/nội dung bài viết đã có trên FTP
      production, không chỉ nằm trong thư mục local.
- [ ] DNS/Cloudflare: nếu domain trỏ qua Cloudflare (xem mục theo dõi
      `dichoithoi-phase17-cloudflare-followup`), xác nhận DNS + cache rule
      vẫn đúng sau khi đổi hạ tầng.

## 3) Ngay sau khi lên (smoke test)

- [ ] Spot-check 10 URL `/diem-den/{slug}` ngẫu nhiên (đủ loại: province/
      cluster/poi, có gallery/không có gallery) — trang load đúng, không lỗi
      500/404.
- [ ] Trang chủ, `/tinh`, `/loai`, `/cam-nang` load được, menu/breadcrumb
      đúng.
- [ ] Ảnh hero + gallery + lightbox hiển thị đúng (không vỡ, không lệch cỡ —
      xem lại bug đã sửa 07/2026 về `HeroImage`/nhánh v1 cũ).
- [ ] Form/CMS zinoflow (`localhost:3005` trỏ production) — thử sửa 1 điểm
      đến, xác nhận ghi thẳng lên site đúng và **cache tự purge** (đã sửa bug
      quên purge cache cho thumbnail/gallery 07/2026 — verify lại 1 lần trên
      production thật).
- [ ] Sitemap.xml sinh đúng, không thiếu URL so với trước khi xoá.
- [ ] robots.txt đúng cho production (không còn `Disallow: /` kiểu môi
      trường staging/dev).
- [ ] **So DB cũ (backup) vs DB mới → danh sách slug mất → redirect** — quy
      trình lúc release (yêu cầu Claude thực hiện):
      1. Claude đọc bản backup DB cũ (giữ riêng ở bước 1) + DB mới, liệt kê
         toàn bộ slug `/diem-den/{slug}` cũ không còn tồn tại ở DB mới.
      2. Với mỗi slug mất, Claude đề xuất map sang URL mới tương ứng (match
         theo tên/toạ độ/nội dung — không suy máy móc 1-1 vì kiến trúc đã
         đổi); slug **map được** → redirect 301 sang URL điểm đến mới.
      3. Slug **không map được** (điểm đến đã gộp/xoá hẳn trong đợt tổ chức
         lại) → redirect 301 về trang danh mục/tỉnh gần nhất tương ứng (đã
         chốt: ưu tiên giữ SEO equity ở mức tỉnh/loại thay vì về trang chủ
         hoặc để 404 thật).
      4. Toàn bộ danh sách map (kể cả bước 3) phải qua **người dùng duyệt
         từng dòng** trước khi áp dụng redirect — Claude không tự publish.
      - Việc này làm **trước khi** chạy mục "Redirect 301" ở phần Check SEO
        bên dưới — mục đó chỉ verify lại redirect đã cấu hình còn hoạt động
        đúng trên domain thật.

## 4) Check SEO tổng quát

Tham chiếu bắt buộc: `docs/dichoithoi/dichoithoi-seo-principles.md` (3-câu-hỏi
checklist) và mục "SEO on-page" của skill `qa-audit` (repo dichoithoi) — chạy
lại trên **domain production thật**, không chỉ trên local:

- [ ] **Kiểm tra Google Search Console — mục "Manual Actions" — TRƯỚC KHI
      release, không phải sau khi thấy traffic giảm mới đi tìm nguyên nhân**
      (29/07/2026, ghi nhận từ câu hỏi "production cũ 247 điểm, traffic
      <100/ngày, có bị Google đánh flag không"). Sự thật đã xác minh qua
      tài liệu chính thức Google (`support.google.com/webmasters/answer/9044175`):
      **CHỈ có 1 loại "flag" chính thức duy nhất là Manual Action** (do người
      review thật xác nhận vi phạm spam policy) — traffic thấp/nội dung cũ/ít
      cập nhật **không phải** 1 dạng phạt riêng, chỉ là hệ quả xếp hạng thấp.
      Nếu Manual Actions rỗng (khả năng cao với case này) → không có gì phải
      "gỡ" trước khi release. Nếu CÓ action đang treo → phải fix + gửi
      reconsideration request và đợi Google duyệt TRƯỚC khi release (không
      để lẫn vào cùng đợt big-change, sẽ khó tách nguyên nhân nếu ranking có
      vấn đề sau đó).
- [ ] **Chấp nhận trước: ranking có thể dao động vài tuần đầu sau release,
      đây là hành vi bình thường, không phải dấu hiệu xấu** — trích Google
      (`developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes`):
      *"visibility có thể dao động tạm thời trong lúc chuyển đổi... thứ hạng
      sẽ ổn định dần theo thời gian"*; site cỡ vừa có thể mất "vài tuần" để
      phần lớn trang được index lại đầy đủ. Không hoảng khi thấy traffic dip
      ngay sau release — chỉ cần lo lắng nếu KHÔNG hồi phục sau nhiều tuần
      (khi đó mới đi tìm lỗi kỹ thuật thật, ví dụ redirect sai/thiếu).
- [ ] Redirect 301 giữ **tối thiểu 1 năm** cho toàn bộ slug cũ đã map (không
      gỡ sớm) — để tín hiệu/trust tích luỹ nhiều năm của domain cũ chuyển hết
      sang URL mới, đúng khuyến nghị chính thức Google ở nguồn trên. Xem danh
      sách map slug cũ→mới đã duyệt ở mục 1/3 phía trên.
- [ ] **Rà lại toàn bộ checklist ở
      `docs/dichoithoi/dichoithoi-google-seo-guidelines.md` §9** (checklist áp
      dụng nhanh, tổng hợp từ 16 chính sách spam + structured data + sitemap +
      Core Web Vitals + duplicate content + §8 site relaunch) — đối chiếu với
      TOÀN BỘ thay đổi của đợt release này (không chỉ tính năng vừa code xong
      lúc review, vì release có thể gộp nhiều thay đổi tích luỹ từ nhiều
      phiên làm việc khác nhau mà không có ai rà tổng lại 1 lần).
- [ ] Mỗi trang đúng 1 `<h1>`, khớp chủ đề trang.
- [ ] `<link rel="canonical">` trỏ đúng domain production (`https://dichoithoi.com/...`),
      không còn sót `localhost`/domain staging.
- [ ] `og:image`/JSON-LD `image` là URL tuyệt đối trỏ đúng domain production
      (không phải `localhost:5176`).
- [ ] JSON-LD từng loại trang (`TouristAttraction`/`TouristDestination`,
      `BreadcrumbList`, `FAQPage`, `AggregateRating`...) parse hợp lệ qua
      Google Rich Results Test — kiểm tra thật bằng công cụ, không chỉ đếm số
      thẻ `<script type="application/ld+json">`.
- [ ] Redirect 301 cho URL/slug cũ đã đổi vẫn hoạt động đúng trên domain
      thật (khác local, DNS/cache có thể ảnh hưởng).
- [ ] Submit lại sitemap.xml mới trong Google Search Console sau khi domain
      trỏ vào production mới (nếu hạ tầng đổi IP/host).
- [ ] Không có nội dung trùng lặp/thin content phát sinh do lỗi migrate dữ
      liệu (xem mục "Rà data" bên dưới).
- [ ] **Rà cụm mỏng trước khi mở index (chốt 27/07/2026, chuẩn hoá Atlas
      257 cụm)** — sau đợt làm mới toàn bộ điểm đến, cụm nào lúc release
      vẫn còn quá mỏng (gợi ý ngưỡng: <5 điểm con hoặc chưa có mô tả/nội
      dung đọc được) thì để `noindex`/ẩn khỏi sitemap, KHÔNG đưa 257 trang
      cụm rỗng lên cùng lúc — đúng mẫu "scaled content abuse" Google phạt
      (dichoithoi-seo-principles §3). Xem
      `chuan-hoa-du-lieu/phan-tich-hien-trang-va-dinh-huong.md` §5/§7.

## 5) Kiểm tra tốc độ

- [ ] Chạy PageSpeed Insights/Lighthouse trên **URL production thật** (API
      PageSpeed không chạy được với localhost) cho tối thiểu 3 trang mẫu:
      trang chủ, 1 trang `/diem-den/{slug}` có nhiều ảnh, 1 trang danh sách
      `/loai` hoặc `/tinh`.
- [ ] Xác nhận nén Brotli hoạt động trên response động:
      `curl -sI -H "Accept-Encoding: br" https://dichoithoi.com/` → phải thấy
      `Content-Encoding: br`.
- [ ] Xác nhận static asset (`MapStaticAssets`) có cache dài hạn + đã
      fingerprint (chỉ đúng ở Release build/Production — khác biểu hiện lúc
      `dotnet run` Development).
- [ ] LCP (ảnh hero) < 2.5s — kiểm tra hero dùng đúng file cỡ lớn
      (`-hero.webp`, không phải bản 400px `-thumb.webp` — đúng bug đã sửa
      07/2026), có `fetchpriority="high"` + `loading="eager"` cho ảnh đầu
      tiên.
- [ ] Đăng ký lại Azure Pipeline đo Lighthouse định kỳ
      (`.azuredevops/lighthouse-check.yml`) nếu domain/host đổi — xem
      `dichoithoi-phase17-cloudflare-followup` (memory) cho các việc thủ công
      còn tồn đọng (Cloudflare account, Azure Function warm-up, đăng ký
      Pipeline) — PHẢI làm trước hoặc ngay sau release, không phải "để sau".

## 6) Rà data

- [ ] So `COUNT(*)` mọi bảng chính giữa local (nguồn) và production (đích)
      sau khi đưa DB lên — không lệch dòng nào ngoài dự kiến.
- [ ] Rà toàn bộ điểm đến **thiếu ảnh đại diện** (gate đã có sẵn trong CMS —
      `missingThumbnail` chặn publish, nhưng dữ liệu cũ có thể lọt qua nếu
      import ngoài luồng CMS) — không được để trống khi lên production thật.
- [ ] Rà ảnh gallery/hero có path hợp lệ thật sự tồn tại trên FTP production
      (không chỉ đúng trong DB) — ảnh "path đúng nhưng file không có" sẽ vỡ
      âm thầm, khó phát hiện qua smoke test nhanh.
- [ ] Rà trùng lặp slug/URL sau migrate (2 điểm đến khác nhau vô tình cùng
      slug, hoặc slug đổi tay không đồng bộ redirect).
- [ ] Rà điểm đến có `contentState` là `dang-soan`/chưa qua hết quality gates
      nhưng lỡ có `siteId` (đã tồn tại trên site) — không để bài chưa đạt gate
      hiển thị công khai.
- [ ] Rà dữ liệu quick-facts rỗng bất thường (giá vé/giờ mở cửa) so với kỳ
      vọng — nếu tỷ lệ rỗng sau migrate cao hơn hẳn trước (đã audit local
      07/2026: OpeningTime rỗng 50/272, TicketPrice rỗng 20/272, dùng làm mốc
      so sánh) thì có khả năng migrate sai chỗ.

## 7) Theo dõi sau release

- [ ] Theo dõi log lỗi (500/exception) trong 24-48h đầu — traffic thật lộ ra
      case chưa test.
- [ ] Theo dõi Google Search Console — lỗi crawl, giảm impression bất
      thường (dấu hiệu SEO bị ảnh hưởng bởi việc đổi hạ tầng).
- [ ] Xác nhận backup bước 1 vẫn giữ ít nhất 1-2 tuần trước khi coi
      production cũ là "an toàn để xoá vĩnh viễn" (không giữ mãi, nhưng đừng
      xoá backup ngay ngày release).
