# Dichoithoi — Chuẩn hoá Nhóm / Type / Tag (bản chốt tổng hợp, 24/07/2026)

Gộp 3 tài liệu phân tích trong thư mục này thành 1 bản thống nhất, đã sửa lỗi
và bổ sung các điểm Claude review phát hiện — **chưa migrate vào code/DB**,
đây là bản để duyệt trước khi lên kế hoạch triển khai. Thiết kế cho quy mô
**toàn quốc, không giới hạn theo 247 điểm hiện có** trên `dichoithoi_dev`
(sẽ xoá production cũ, release hoàn toàn mới — xem quyết định 24/07/2026).

Nguồn gộp:
- `dichoithoi-nhom-type.md` (Gemini) — cấu trúc 4 Nhóm / 18 Type
- `dichoithoi-tag.md` (Gemini) — 16 Tag theo 4 trục
- `dinh-luat-phan-loai.md` (Gemini) — luật phân định cứng di-tich-lich-su/cong-trinh-kiet-tac
- Điều chỉnh của Claude (review 24/07/2026): sửa lỗi chính tả, gỡ cột
  `SecondaryTypeId` không có thật trong schema, làm rõ cơ chế đa-Type qua
  `DestinationTypeMap`.

So với thiết kế cũ đang chạy trên `dichoithoi_dev` (`dichoithoi-taxonomy-overview.md`,
16 Type/3 Nhóm/9 Tag) — thay đổi chính: tách thêm Nhóm "Tâm linh & Tôn giáo",
đổi tên vài Type/Tag cho đúng search intent hơn, thêm luật phân định cứng để
chặn cannibalization đã phát hiện (18/49 điểm `cong-trinh-kien-truc` từng
trùng `di-tich-lich-su`).

---

## 0. Nguyên tắc kỹ thuật nền (giữ nguyên từ thiết kế gốc, không đổi)

- **Type = "là gì"** (bản chất vật lý). Phân cấp 2 tầng Nhóm → Type, mỗi Type
  thuộc đúng **1 Nhóm** (cột `GroupId` trên `DestinationType`). URL:
  `/loai/{nhomSlug}` (trang Nhóm) → `/loai/{nhomSlug}/{typeSlug}` (trang Type).
- **1 điểm đến có thể gán NHIỀU Type** qua bảng M:N `DestinationTypeMap`
  (không giới hạn số lượng, không phải 1-1). `Destination.PrimaryTypeId` chỉ
  là Type "chính" dùng hiển thị badge/breadcrumb mà không cần join bảng map —
  **không có cột `SecondaryTypeId`** trong schema. "Loại phụ" nói trong tài
  liệu Gemini thực chất là: các dòng khác trong `DestinationTypeMap` của
  cùng điểm đến, khác với `PrimaryTypeId`. Khi tài liệu nói "Primary X,
  Secondary Y" — nghĩa là: ghi 2 dòng vào `DestinationTypeMap` (X và Y),
  đặt `PrimaryTypeId = X`.
- **Tag = "phù hợp trải nghiệm gì"** (góc nhìn cắt ngang, không phải bản chất
  vật lý). Bảng phẳng, **không phân cấp trong DB** — 4 "trục" trong tài liệu
  Tag chỉ là cách tư duy khi thiết kế từ vựng, không phải cột/bảng riêng.
  Quan hệ M:N qua `DestinationTagMap`.
- Từ vựng Tag **đóng** — chỉ tạo/sửa/xoá tay trong CMS (`/dichoithoi/chu-de`),
  không cho nhập tự do khi gán cho điểm đến.
- Tag không được trùng nghĩa với Type đã có — tránh cannibalization SEO.
- Trang `/chu-de/{slug}` chỉ published + index khi có mô tả đã duyệt **và**
  gắn đủ ≥5 điểm đến — chưa đủ thì `noindex`.
- Tính năng "kết hợp nhiều Tag → landing page ngách" (nêu trong
  `dichoithoi-tag.md` mục I) **chưa tồn tại** — route hiện tại chỉ có
  `/chu-de/{1-slug}` đơn. Đây là 1 hạng mục build routing/filter riêng,
  **không nằm trong phạm vi chuẩn hoá từ vựng lần này** — ghi nhận làm ý
  tưởng tương lai, không giả định sẽ có sẵn.

---

## 1. Cấu trúc Nhóm + Type (4 Nhóm, 18 Type)

| # | Nhóm | Type | Slug Type | URL |
|:---:|---|---|---|---|
| 1 | Thiên nhiên & Sinh thái (`thien-nhien`) | Biển - Bãi tắm - Đảo | `bien-dao` | `/loai/thien-nhien/bien-dao` |
| 2 | | Núi - Cao nguyên - Đèo | `nui-cao-nguyen` | `/loai/thien-nhien/nui-cao-nguyen` |
| 3 | | Sông - Suối - Hồ - Thác | `thac-ho-suoi` | `/loai/thien-nhien/thac-ho-suoi` |
| 4 | | Hang động | `hang-dong` | `/loai/thien-nhien/hang-dong` |
| 5 | | Rừng - Vườn quốc gia | `rung-vuon-quoc-gia` | `/loai/thien-nhien/rung-vuon-quoc-gia` |
| 6 | | Sinh thái - Đồng quê - Vườn trái cây | `sinh-thai-dong-que` | `/loai/thien-nhien/sinh-thai-dong-que` |
| 7 | Tâm linh & Tôn giáo (`tam-linh-ton-giao`) | Quần thể & Danh thắng tâm linh | `quan-the-tam-linh` | `/loai/tam-linh-ton-giao/quan-the-tam-linh` |
| 8 | | Chùa - Đền - Miếu - Toà thánh | `chua-den-mieu` | `/loai/tam-linh-ton-giao/chua-den-mieu` |
| 9 | | Nhà thờ - Công trình Công giáo | `nha-tho-cong-giao` | `/loai/tam-linh-ton-giao/nha-tho-cong-giao` |
| 10 | Văn hoá - Lịch sử (`van-hoa-lich-su`) | Di tích lịch sử - Thành cổ | `di-tich-lich-su` | `/loai/van-hoa-lich-su/di-tich-lich-su` |
| 11 | | Bảo tàng - Triển lãm | `bao-tang-trien-lam` | `/loai/van-hoa-lich-su/bao-tang-trien-lam` |
| 12 | | Làng nghề truyền thống | `lang-nghe-truyen-thong` | `/loai/van-hoa-lich-su/lang-nghe-truyen-thong` |
| 13 | | Công trình kiến trúc - Biểu tượng | `cong-trinh-kiet-tac` | `/loai/van-hoa-lich-su/cong-trinh-kiet-tac` |
| 14 | Vui chơi & Giải trí (`vui-choi-giai-tri`) | Khu vui chơi - Công viên chủ đề | `khu-vui-choi-cong-vien` | `/loai/vui-choi-giai-tri/khu-vui-choi-cong-vien` |
| 15 | | Nông trại - Vườn hoa - Cắm trại | `nong-trai-vuon-hoa-camping` | `/loai/vui-choi-giai-tri/nong-trai-vuon-hoa-camping` |
| 16 | | Suối khoáng nóng - Onsen - Spa | `khoang-nong-onsen-spa` | `/loai/vui-choi-giai-tri/khoang-nong-onsen-spa` |
| 17 | | Chợ - Phố đêm - Khu ẩm thực | `cho-pho-dem-am-thuc` | `/loai/vui-choi-giai-tri/cho-pho-dem-am-thuc` |
| 18 | | Phố cổ - Phố đi bộ | `pho-co-pho-di-bo` | `/loai/vui-choi-giai-tri/pho-co-pho-di-bo` |

So với bản cũ (16 Type/3 Nhóm): tách Nhóm 2 "Tâm linh & Tôn giáo" mới (kéo
`nha-tho` ra khỏi Văn hoá-Lịch sử, tách `chua-den` cũ thành `quan-the-tam-linh`
+ `chua-den-mieu`); đổi tên `dong-que-mien-tay`→`sinh-thai-dong-que` (bỏ khoá
vùng miền Tây, đã có Làng cổ Đường Lâm/Bắc Bộ trong dữ liệu thật);
`cong-trinh-kien-truc`→`cong-trinh-kiet-tac`; thêm mới `nong-trai-vuon-hoa-camping`,
`khoang-nong-onsen-spa` (chưa có dữ liệu thật trong 247 điểm hiện tại — chấp
nhận vì đánh lại cho quy mô toàn quốc, theo quyết định 24/07/2026).

Mô tả chi tiết từng Type (bản chất vật lý, phạm vi bao phủ, ví dụ POI theo
miền, góc độ affiliate) — xem nguyên văn `dichoithoi-nhom-type.md`, không lặp
lại ở đây để tránh trùng lặp tài liệu; nội dung đó không đổi so với bản gốc.

---

## 2. Luật phân định ranh giới (Validation Rules) — bản chốt

### 2.1 Luật cứng: `di-tich-lich-su` vs `cong-trinh-kiet-tac`

Nguồn: `dinh-luat-phan-loai.md`, tiêu chí khách quan — dựa trên **quyết định
xếp hạng di tích chính thức có thật**, không suy diễn cảm tính.

```
BƯỚC 1 — Có quyết định xếp hạng di tích chính thức không?
  (UNESCO / Di tích Quốc gia đặc biệt / Di tích Quốc gia / Di tích cấp Tỉnh-Thành)

  CÓ:
    - Nếu bản chất là Chùa/Đền/Nhà thờ → Primary = chua-den-mieu / nha-tho-cong-giao,
      thêm dòng di-tich-lich-su vào DestinationTypeMap (loại phụ)
    - Còn lại → Primary = di-tich-lich-su,
      nếu kiến trúc đẹp/độc đáo thì thêm dòng cong-trinh-kiet-tac (loại phụ)

  KHÔNG CÓ:
    - Có giá trị biểu tượng/kiến trúc/kỹ thuật xây dựng rõ (cầu, tháp, biệt thự
      lạ, toà nhà...) → Primary = cong-trinh-kiet-tac
    - Không có → xét Type khác phù hợp hơn (cho-pho-dem-am-thuc, khu-vui-choi-cong-vien...)
```

**Bắt buộc khi gán `di-tich-lich-su`**: ghi kèm căn cứ xếp hạng thật (số
quyết định/năm, nếu tra được) vào ghi chú nội bộ của điểm đến — không suy
diễn "trông có vẻ cổ/lịch sử". Nếu không tra được căn cứ chính thức, **mặc
định KHÔNG gán** `di-tich-lich-su` — an toàn hơn gán nhầm và lặp lại vấn đề
"thùng rác cannibalization" đã phát hiện ở bản cũ. *(Cần quyết định thêm: có
cần 1 field CMS riêng lưu "căn cứ xếp hạng" hay chỉ dùng ghi chú tự do có
sẵn — chưa chốt, để khi lên kế hoạch triển khai.)*

Ma trận kiểm thử (giữ nguyên từ `dinh-luat-phan-loai.md`, đã verify hợp lý):

| POI | Có xếp hạng? | Primary | Loại phụ (thêm dòng TypeMap) |
|---|---|---|---|
| Dinh Độc Lập | CÓ (Di tích Quốc gia đặc biệt) | `di-tich-lich-su` | `cong-trinh-kiet-tac` |
| Bưu điện Trung tâm TP.HCM | CÓ (Di tích Kiến trúc Nghệ thuật cấp Quốc gia) | `di-tich-lich-su` | `cong-trinh-kiet-tac` |
| Cầu Long Biên | CÓ (Di tích Lịch sử cấp Thành phố) | `di-tich-lich-su` | `cong-trinh-kiet-tac` |
| Landmark 81 / Bitexco | KHÔNG | `cong-trinh-kiet-tac` | — |
| Biệt thự Hằng Nga (Crazy House) | KHÔNG | `cong-trinh-kiet-tac` | — |
| Cầu Vàng (Bà Nà Hills) | KHÔNG | `khu-vui-choi-cong-vien` | `cong-trinh-kiet-tac` |
| Chùa Bái Đính cổ | CÓ (Di tích Quốc gia) | `chua-den-mieu` | `di-tich-lich-su` |

### 2.2 Các luật khác (từ `dichoithoi-nhom-type.md`, không đổi)

| Tình huống giao thoa | Quy tắc |
|---|---|
| Núi cảnh quan vs. núi tâm linh | Trekking/ngắm cảnh là chính → `nui-cao-nguyen`; gắn liền quần thể thờ tự/hành hương → `quan-the-tam-linh` |
| Suối tự nhiên vs. suối khoáng Onsen | Suối tắm/rừng tự nhiên → `thac-ho-suoi`; đã quy hoạch Onsen/Spa → `khoang-nong-onsen-spa` |
| POI trong Vườn quốc gia | Primary = bản chất vật lý chính (vd `thac-ho-suoi`), thêm dòng `rung-vuon-quoc-gia` |
| Quần thể tâm linh vs. chùa/đền đơn lẻ | Tổ hợp lớn (cáp treo, nhiều đền/chùa nội khu) → `quan-the-tam-linh`; đứng độc lập → `chua-den-mieu` |
| Nhà thờ kiến trúc đẹp, đông khách check-in | Vẫn giữ Primary = `nha-tho-cong-giao`; yếu tố check-in xử lý bằng Tag `check-in-song-ao`, không đổi Type |
| Công trình biểu tượng trong khu vui chơi có vé | Primary = `khu-vui-choi-cong-vien` (vd Cầu Vàng trong Bà Nà Hills), thêm dòng `cong-trinh-kiet-tac` |
| Bảo tàng đặt trong di tích tổng thể | Di tích tổng thể → Primary `di-tich-lich-su`; phân khu bảo tàng gán thêm dòng `bao-tang-trien-lam` |
| Cắm trại tự do vs. Glamping thương mại | Tự do trong rừng/VQG, không bán vé → `rung-vuon-quoc-gia`/`thac-ho-suoi`; khu Glamping quy hoạch có bán vé/gói → `nong-trai-vuon-hoa-camping` |
| Chợ đêm nằm trong phố cổ | Primary = `pho-co-pho-di-bo` (không gian vật lý rộng hơn), thêm dòng `cho-pho-dem-am-thuc` |

**Còn thiếu, chưa có luật cứng** (ghi nhận, không tự suy diễn thêm): `chua-den-mieu`
vs `di-tich-lich-su` khi ngôi chùa rất cổ nhưng **chưa/không** có xếp hạng di
tích chính thức — luật §2.1 hiện chỉ xử lý rõ trường hợp CÓ xếp hạng. Xử lý
khi gặp ca thực tế phát sinh, không bịa trước.

---

## 3. Bộ Tag (17 Tag, 4 trục tư duy — DB vẫn phẳng, không phân bảng)

Đã sửa lỗi chính tả `lich-su-chien-trang` → `lich-su-chien-tranh` (24/07/2026).
Đã chốt 2 điểm mở ở bản trước (xem §4 lý do): giữ tag #15 nghĩa **rộng**
(không thu hẹp còn riêng UNESCO) và **giữ lại** tag "Biểu tượng địa phương"
từ bộ 9 tag cũ (Gemini không đưa vào bộ 16, thêm lại thành tag #17).

| # | Tag Slug | Tên hiển thị | Trục | Giá trị SEO/Affiliate chính |
|:---:|---|---|---|---|
| 1 | `phu-hop-gia-dinh` | Phù hợp gia đình & trẻ nhỏ | Đối tượng | Tour gia đình, vé công viên, xe đưa đón |
| 2 | `lang-man-cap-doi` | Lãng mạn — Phù hợp cặp đôi | Đối tượng | Combo tiệc tối, resort đôi, honeymoon |
| 3 | `nhom-ban-teambuilding` | Tụ tập nhóm bạn — Team building | Đối tượng | Thuê villa, xe đông chỗ, chèo SUP, BBQ |
| 4 | `nghi-duong-chua-lanh` | Nghỉ dưỡng — Chữa lành — Thư giãn | Đối tượng | Voucher Onsen, Spa, Resort 4-5 sao |
| 5 | `check-in-song-ao` | Check-in sống ảo — Góc chụp đẹp | Trải nghiệm | Bắt trend giới trẻ, điểm view xinh |
| 6 | `san-may-hoang-hon` | Săn mây — Ngắm hoàng hôn & bình minh | Trải nghiệm | Từ khoá trend vùng cao & biển đảo |
| 7 | `hoang-so-kham-pha` | Hoang sơ — Vắng người — Yêu thiên nhiên | Trải nghiệm | Khách thích khám phá điểm đến ngách |
| 8 | `mao-hiem-trekking` | Mạo hiểm — Trekking — Phượt | Trải nghiệm | Tour leo núi, đồ phượt, thuê xe máy |
| 9 | `cam-trai-dieu-da` | Cắm trại — Glamping — Dã ngoại | Trải nghiệm | Bán gói Glamping, thuê lều trại |
| 10 | `di-choi-ban-dem` | Vui chơi ban đêm — Nightlife | Bối cảnh | Night tour, show diễn, pub, ăn đêm |
| 11 | `du-lich-cuoi-tuan` | Đi về trong ngày — Du lịch cuối tuần | Bối cảnh | Dã ngoại ngắn ngày gần đô thị lớn |
| 12 | `canh-sac-theo-mua` | Mùa hoa — Cảnh sắc theo mùa | Bối cảnh | Trend mùa lúa/hoa/nước nổi |
| 13 | `am-thuc-dac-san` | Ẩm thực & Đặc sản địa phương | Giá trị | Food tour, voucher nhà hàng, quà đặc sản |
| 14 | `van-hoa-ban-dia` | Văn hoá bản địa — Bản làng & Phong tục | Giá trị | Trải nghiệm đời sống dân tộc, lễ hội |
| 15 | `di-san-ky-luc` | Di sản — Kỷ lục thế giới | Giá trị | SEO Authority, hút khách quốc tế (UNESCO + kỷ lục không-UNESCO, vd Sơn Đoòng) |
| 16 | `lich-su-chien-tranh` | Lịch sử chiến tranh — Hoài niệm | Giá trị | Điểm di tích giáo dục, tri ân lịch sử |
| 17 | `bieu-tuong` | Biểu tượng địa phương — Phải ghé | Giá trị | Giữ lại từ bộ 9 tag cũ — điểm mang tính đại diện/must-see của địa phương, không trùng nghĩa "di sản xếp hạng" (#15) hay "check-in" (#5) |

Nguyên tắc gán: 1–4 Tag/điểm đến (không tràn lan), không trùng nghĩa với
Type. Chi tiết dấu hiệu gán từng Tag + ví dụ POI theo miền — xem nguyên văn
`dichoithoi-tag.md`, không lặp lại ở đây.

So với 9 Tag cũ đang chạy trên `dichoithoi_dev`: đổi tên `hoang-so`→`hoang-so-kham-pha`,
`lang-man`→`lang-man-cap-doi`, `mao-hiem`→`mao-hiem-trekking`,
`di-san`→`di-san-ky-luc` (giữ nguyên nghĩa rộng, chỉ đổi slug — xem quyết định
§4), `van-hoa-dan-toc`→`van-hoa-ban-dia`, `nghi-duong`→`nghi-duong-chua-lanh`;
**giữ lại** `bieu-tuong` thành tag #17 (xem §4); **thêm mới**
`nhom-ban-teambuilding`, `san-may-hoang-hon`, `cam-trai-dieu-da`,
`di-choi-ban-dem`, `du-lich-cuoi-tuan`, `canh-sac-theo-mua`, `am-thuc-dac-san`.
Đổi slug không phát sinh chi phí redirect vì production sẽ xoá và release mới
hoàn toàn (quyết định 24/07/2026) — chỉ cần rà URL thật lúc chuẩn bị release
để quyết định có cần redirect hay không.

---

## 4. Quyết định các việc mở (chốt 24/07/2026)

Người dùng phản hồi "ok" cho bản trước — dưới đây là quyết định cho 4 việc mở,
theo hướng an toàn/ít rủi ro nhất khi chưa có thêm dữ liệu thật để kiểm chứng
(có thể lật lại nếu thấy sai khi bắt đầu nhập liệu thật):

1. **Tag di sản — GIỮ nghĩa rộng, chỉ đổi slug**: `di-san` → `di-san-ky-luc`
   (không dùng `di-san-unesco`). Lý do: thu hẹp còn riêng UNESCO sẽ loại bỏ
   các điểm có kỷ lục Việt Nam/thế giới nhưng không phải UNESCO (vd hang có
   kỷ lục riêng trong khi UNESCO công nhận cả 1 Vườn quốc gia) — mất phạm vi
   mà không có lợi ích rõ ràng đổi lại.
2. **Tag `bieu-tuong` — GIỮ LẠI**, thêm thành tag #17. Lý do: khác nghĩa với
   `di-san-ky-luc` (không cần được xếp hạng/công nhận chính thức, chỉ cần là
   biểu tượng/must-see của địa phương — vd 1 quán cà phê nổi tiếng không có
   danh hiệu gì) và khác `check-in-song-ao` (không nhất thiết "ăn ảnh", có
   thể nổi tiếng vì lý do khác). Không thấy Gemini giải thích lý do bỏ trong
   `dichoithoi-tag.md` → coi là thiếu sót, không phải chủ ý.
3. **KHÔNG thêm field CMS mới** cho "căn cứ xếp hạng di tích". Lý do: chưa có
   nhu cầu tra cứu lại hàng loạt căn cứ này; dùng ô ghi chú tự do sẵn có của
   điểm đến là đủ cho quy mô hiện tại — tránh thêm field/migration cho nhu
   cầu chưa xác nhận (đúng nguyên tắc không over-engineer). Nếu sau này thấy
   biên tập viên hay tra lại/tranh cãi căn cứ, mở lại quyết định này.
4. **KHÔNG thêm luật cứng riêng** cho `chua-den-mieu` vs `di-tich-lich-su`
   (chùa cổ, chưa xếp hạng). Lý do: giữ nguyên nguyên tắc "không bịa luật cho
   ca chưa gặp thật" đã áp dụng nhất quán ở §2.1 — nếu chùa chưa có xếp hạng,
   mặc định `chua-den-mieu` là Primary (đúng bản chất tôn giáo), không cần
   luật thêm. Chỉ mở lại khi gặp ca thực tế gây tranh cãi.

**Trạng thái**: đây là bản CHỐT thiết kế (giấy) — **CHƯA migrate vào DB/code**.
Việc tiếp theo khi bắt đầu nhập liệu thật: đưa bảng Nhóm/Type/Tag này vào
`dichoithoi-database-redesign.md` §3.2/§3.2.1 (thay bảng seed cũ), viết lại
seed script `DestinationTypeGroup`/`DestinationType`/`DestinationTag`, cập
nhật prompt AI gán Type/Tag theo luật §2, và đồng bộ lại
`dichoithoi-taxonomy-overview.md`.
