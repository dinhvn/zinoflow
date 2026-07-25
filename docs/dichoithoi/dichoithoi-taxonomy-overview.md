# Dichoithoi — Phân loại điểm đến: Nhóm / Type / Tag (hiện trạng TRƯỚC redesign)

> ⚠️ **ĐÃ HOÀN THÀNH MỤC ĐÍCH BAN ĐẦU (24/07/2026)** — tài liệu này viết ra
> làm input cho việc xin phân tích bên ngoài, việc đó đã xong: xem kết quả +
> bản chốt thiết kế mới ở
> [`phan-tich/dichoithoi-taxonomy-chuan-hoa.md`](phan-tich/dichoithoi-taxonomy-chuan-hoa.md)
> (4 Nhóm/18 Type/17 Tag, CHỐT TRÊN GIẤY, CHƯA MIGRATE). File này **giữ lại
> làm baseline** — số liệu thật (mục 3-5) là nguồn để map slug
> cũ→mới lúc migrate sau này, không phải bản thiết kế đang dùng để tham
> khảo lúc code mới. Đọc `phan-tich/dichoithoi-taxonomy-chuan-hoa.md` nếu
> cần thiết kế hiện hành.

Tài liệu tổng hợp hiện trạng phân loại điểm đến trên dichoithoi.com tại thời
điểm 23/07/2026 (trước khi có đề xuất redesign) — dữ liệu số liệu lấy trực
tiếp từ `dichoithoi_dev` (LocalDB).

**Mục đích ban đầu (đã hoàn thành):**
1. Kiểm tra lại xem cách chia trục Nhóm/Type/Tag hiện tại đã hợp lý chưa.
2. **Xin gợi ý một danh sách Nhóm, Type, Tag hợp lý hơn** (đổi tên, gộp/tách,
   thêm/bớt mục, đổi nhóm cho 1 Type...) — dựa trên thực tế nội dung du lịch
   Việt Nam, tối ưu cho tìm kiếm (search intent) và cấu trúc SEO silo
   `/loai/{nhom}/{loai}`, không chỉ đánh giá tính nhất quán nội bộ.

## 0. Website dichoithoi.com là gì

- **dichoithoi.com** là 1 website **liệt kê/tổng hợp điểm đến du lịch tại
  Việt Nam** — biển, núi, thác, chùa, di tích, khu vui chơi, phố cổ... Mỗi
  điểm đến có 1 trang riêng (bài viết + thông tin thực tế: địa chỉ, giờ mở
  cửa, giá vé, cách di chuyển, mẹo thực tế...).
- Cấu trúc điều hướng chính là **duyệt theo phân loại**: theo tỉnh/thành
  (`/tinh/{slug}`), theo cụm điểm đến trong 1 tỉnh, và theo **loại hình**
  (`/loai/{nhom}/{loai}` — đây chính là chủ đề tài liệu này). Vì trang chủ
  yếu sống nhờ người dùng "duyệt danh mục" để tìm điểm đến phù hợp (không
  chỉ tìm đúng 1 tên cụ thể), cách chia Nhóm/Type/Tag ảnh hưởng trực tiếp
  đến việc người dùng có tìm thấy đúng thứ họ cần hay không, và đến cấu trúc
  SEO silo (pillar → cluster → bài viết).
- **Mô hình kiếm tiền**: affiliate — trang chèn CTA mua vé online, đặt
  khách sạn, tour, sản phẩm liên quan tại mỗi điểm đến. Vì vậy nội dung
  không chỉ để đọc cho vui mà phải giúp người dùng ra quyết định (đi đâu,
  đặt gì) — phân loại rõ ràng, đúng nhu cầu tìm kiếm giúp tăng traffic +
  tỷ lệ chuyển đổi affiliate.
- Nội dung bài viết được soạn bằng AI (có biên tập viên duyệt), viết theo
  văn phong người thật, không phải content spam hàng loạt — phân loại
  Type/Tag cũng được dùng làm input để AI viết bài liên quan/đề xuất đúng
  ngữ cảnh (vd gợi ý "điểm đến liên quan" theo cùng loại hình).

## 1. Bối cảnh — 3 trục phân loại độc lập

Mỗi điểm đến (`v2.Destination`) có `Kind` (province/cluster/poi) xác định vị
trí trong cây phân cấp địa lý (tỉnh → cụm → điểm). Ngoài ra, các POI (điểm
đến cụ thể, không áp dụng cho tỉnh/cụm) còn được phân loại theo 2 trục khác,
độc lập với cây địa lý:

| Trục | Trả lời câu hỏi | Số lượng | Cấu trúc | Bảng SQL |
|---|---|---|---|---|
| **Type** (loại hình) | "Nơi này **là gì**?" — bản chất vật lý | 16 loại, gộp vào 3 nhóm | Phân cấp 2 tầng, mỗi Type thuộc đúng 1 Nhóm | `DestinationTypeGroup`, `DestinationType`, `DestinationTypeMap` (M:N) |
| **Tag** (chủ đề) | "Nơi này **phù hợp trải nghiệm gì**?" — góc nhìn cắt ngang | 9 tag | Phẳng, không phân nhóm | `DestinationTag`, `DestinationTagMap` (M:N) |

Cả Type lẫn Tag đều là quan hệ **nhiều-nhiều** — 1 điểm đến có thể có nhiều
Type và nhiều Tag cùng lúc. Type có thêm `Destination.PrimaryTypeId` (loại
"chính") để hiển thị badge/breadcrumb mà không cần join bảng map.

## 2. Vì sao tách Type và Tag ra 2 hệ thống riêng

Quyết định chốt tháng 07/2026 (`dichoithoi-database-redesign.md` §3.2.1),
xuất phát từ đối chiếu nhu cầu tìm kiếm thật:

- Người dùng tìm kiếm theo 2 tầng khác nhau khi nghĩ về **loại nơi chốn**:
  nhóm lớn (Thiên nhiên / Văn hóa / Vui chơi) → loại cụ thể (thác, chùa,
  phố cổ...). Đây là **trục silo chính**, dùng để dựng URL phân cấp SEO
  `/loai/{nhom}` → `/loai/{nhom}/{loai}` → bài điểm đến.
- Nhưng có những **chủ đề cắt ngang nhiều Type khác nhau** mà cây Type không
  diễn tả được. Ví dụ tag "Di sản — Kỷ lục thế giới" áp dụng cho cả Hang Sơn
  Đoòng (Type=hang-dong) lẫn Vịnh Hạ Long (Type=bien-dao) — 2 loại hình vật
  lý hoàn toàn khác nhau nhưng cùng 1 góc nhìn "đẳng cấp di sản". Nhồi chung
  vào Type sẽ phá vỡ cấu trúc phân cấp (1 điểm không thể "chính" thuộc nhiều
  nhóm cùng lúc).
- Tách Tag ra hệ thống riêng, phẳng, không phân nhóm, để giữ 2 câu hỏi
  "là gì" và "phù hợp trải nghiệm gì" tách bạch, không đá nhau trong 1 cây
  phân cấp.

### Luật chống "tag sprawl" (rút kinh nghiệm từ thin-content kiểu WordPress cũ)

- Từ vựng Tag **đóng** — chỉ tạo/sửa/xóa tay trong CMS (`/dichoithoi/chu-de`),
  không cho nhập tự do khi gán cho điểm đến.
- Tag **không được trùng nghĩa** với Type đã có (CMS cảnh báo khi tên gần
  giống) — tránh cannibalization SEO (vd không tạo tag "thác nước" vì đã có
  `/loai/thien-nhien/thac-ho-suoi`).
- Trang `/chu-de/{slug}` chỉ published + index khi có mô tả đã duyệt **và**
  gắn đủ ≥5 điểm đến — chưa đủ thì `noindex`.

### Lịch sử điều chỉnh — 2 Type từng bị gán sai trục

Giai đoạn B (`phase-b-06-move-experience-types-to-tags.sql`, 17/07/2026) phát
hiện `check-in-song-ao` (Check-in sống ảo) và `nghi-duong` (Nghỉ dưỡng) từng
bị xếp làm **Type** — nhưng đây là góc nhìn *trải nghiệm/mục đích*, không
phải *bản chất vật lý nơi chốn* (một khu nghỉ dưỡng có thể vật lý là biệt
thự, đồi núi hay ven biển). Đã chuyển 2 mục này từ Type sang Tag, di chuyển
nguyên trạng dữ liệu gán (không suy luận lại), xóa Type cũ, và đặt redirect
301 `/loai/{nhom}/check-in-song-ao` → `/chu-de/check-in-song-ao` để giữ SEO
tích lũy (xem `DestinationTypeController.cs`).

## 3. Danh sách Nhóm + Type hiện tại (16 Type, 3 Nhóm)

Số liệu = số POI đã gán Type đó (1 POI có thể đếm ở nhiều Type nếu gán nhiều).

### Nhóm "Thiên nhiên" (`thien-nhien`)
| Type slug | Tên | Số điểm đã gán |
|---|---|---|
| `bien-dao` | Biển - Đảo | 42 |
| `nui-cao-nguyen` | Núi - Cao nguyên | 24 |
| `thac-ho-suoi` | Sông - Suối - Hồ - Thác | 29 |
| `hang-dong` | Hang động | 3 |
| `rung-vuon-quoc-gia` | Rừng - Vườn quốc gia | 13 |
| `dong-que-mien-tay` | Đồng quê - Sông nước miền Tây | 16 |

### Nhóm "Văn hóa - Lịch sử" (`van-hoa-lich-su`)
| Type slug | Tên | Số điểm đã gán |
|---|---|---|
| `di-tich-lich-su` | Di tích lịch sử | 32 |
| `chua-den` | Chùa - Đền - Miếu | 16 |
| `nha-tho` | Nhà thờ | 6 |
| `lang-nghe-truyen-thong` | Làng nghề truyền thống | 7 |
| `bao-tang` | Bảo tàng | 3 |
| `cong-trinh-kien-truc` | Công trình kiến trúc | 49 |

### Nhóm "Vui chơi - Trải nghiệm" (`vui-choi-trai-nghiem`)
| Type slug | Tên | Số điểm đã gán |
|---|---|---|
| `khu-vui-choi` | Khu vui chơi - Giải trí | 30 |
| `cho-pho-dem` | Chợ - Phố đêm | 13 |
| `am-thuc` | Khu - Phố ẩm thực | 5 |
| `pho-co-pho-di-bo` | Phố cổ - Phố đi bộ | 11 |

Ghi chú: `khu-vui-choi`, `check-in-song-ao`, `nghi-duong` từng cùng nhóm này
trước khi 2 mục sau chuyển sang Tag (mục 2).

## 4. Danh sách Tag hiện tại (9 tag)

| Tag slug | Tên | Trạng thái | Số điểm đã gán |
|---|---|---|---|
| `check-in-song-ao` | Check-in sống ảo | published | **103** |
| `bieu-tuong` | Biểu tượng địa phương — Phải ghé | draft | 1 |
| `hoang-so` | Hoang sơ — Ít người biết | draft | 0 |
| `lang-man` | Lãng mạn — Check-in cặp đôi | draft | 0 |
| `mao-hiem` | Mạo hiểm — Trekking — Phượt | draft | 0 |
| `di-san` | Di sản — Kỷ lục thế giới | draft | 0 |
| `van-hoa-dan-toc` | Văn hóa dân tộc thiểu số | draft | 0 |
| `lich-su-chien-tranh` | Lịch sử chiến tranh — Cách mạng | draft | 0 |
| `nghi-duong` | Nghỉ dưỡng | draft | 0 |

Quy trình gán Tag (destination-spec §2.4): AI gợi ý hàng loạt (chỉ trả gợi ý
kèm lý do, không ghi DB) → người dùng duyệt từng dòng → ghi vào
`DestinationTagMap`. Riêng `check-in-song-ao` có 103 điểm là vì được **di
chuyển nguyên trạng** từ Type cũ (không phải qua quy trình AI-duyệt).

## 5. Độ phủ dữ liệu hiện tại (thực trạng, không phải thiết kế)

- Tổng số điểm đến: 272 (bao gồm cả province/cluster).
- Tổng số POI (Kind=poi): 247.
- POI đã có ít nhất 1 Type: 228 / 247 (~92%).
- POI đã có ít nhất 1 Tag: 103 / 247 (~42%) — nhưng toàn bộ 103 này đến từ
  1 tag duy nhất (`check-in-song-ao`, do di chuyển dữ liệu cũ). 8 tag còn lại
  gần như trống (0-1 điểm) vì bước "AI gợi ý gán tag hàng loạt" chưa được
  chạy thật trên toàn bộ 247 POI — mới dừng ở bước seed định nghĩa tag.

## 6. Đánh giá nhanh (tại thời điểm viết tài liệu, 23-24/07/2026 — ĐÃ SUPERSEDED)

> Kết luận dưới đây đã được xử lý trong bản redesign — giữ lại chỉ để biết
> LÝ DO dẫn tới quyết định mới, không phải hướng dẫn còn hiệu lực. Xem
> `phan-tich/dichoithoi-taxonomy-chuan-hoa.md` §2.1 (luật phân định cứng đã
> chốt để xử lý đúng phát hiện overlap dưới đây).

- **Cấu trúc Type (16 loại / 3 nhóm)**: hợp lý, đã dọn sạch 2 mục lệch trục
  (mục 2). Có 1 chỗ chồng lấn thực tế đáng lưu ý: 4 điểm (Bến Ninh Kiều, Chợ
  Đêm Đà Lạt, Phố cổ Hội An, Phố Tây Bùi Viện) được gán **cả 2** Type
  `cho-pho-dem` và `pho-co-pho-di-bo` — xác nhận đây là đa-thành-viên hợp lệ
  theo mô hình M:N, không phải lỗi.
- **Cấu trúc Tag (9 tag)**: bộ từ vựng và luật chống sprawl ổn, nhưng dữ
  liệu gán gần như trống (8/9 tag chưa có điểm nào ngoài 1-2 điểm lẻ tẻ).
  Đây là khoảng trống về **vận hành** (chưa chạy quy trình AI-gán-tag), không
  phải lỗi thiết kế.
- **Chồng lấn nghiêm trọng hơn giữa `cong-trinh-kien-truc` và `di-tich-lich-su`
  (phát hiện thêm 24/07/2026, query trực tiếp `DestinationTypeMap` trên
  `dichoithoi_dev`, chưa có trong bản gốc mục này)**: **18/49 điểm** của
  `cong-trinh-kien-truc` (37%) cũng được gán `di-tich-lich-su`, và **18/32
  điểm** của `di-tich-lich-su` (56%) cũng được gán `cong-trinh-kien-truc`.
  Không phải lỗi gán tay ngẫu nhiên — `PrimaryTypeId` của nhóm trùng chia khá
  đều (8 chọn kiến trúc làm chính, 10 chọn di tích làm chính), tức 2 Type này
  đang mô tả gần cùng 1 tập điểm đến (Địa đạo Củ Chi, Dinh Độc Lập, Dinh Bảo
  Đại 1/2/3, Hoàng thành Thăng Long, Đại Nội Huế, Cầu Long Biên, Nhà thờ Lớn
  Hà Nội, Nhà hát Lớn HN/HCM, Phố cổ Hà Nội, Quảng trường Ba Đình...) từ 2 góc
  nhìn khác nhau. Quy mô overlap này (18 điểm, ~40-56%) lớn hơn nhiều case
  `cho-pho-dem`/`pho-co-pho-di-bo` (4 điểm) đã nêu ở trên — rủi ro
  cannibalization SEO thật giữa 2 trang `/loai/van-hoa-lich-su/cong-trinh-
  kien-truc` và `/loai/van-hoa-lich-su/di-tich-lich-su`, cần bên ngoài phân
  tích đánh giá kỹ khi đề xuất lại danh sách Type.
