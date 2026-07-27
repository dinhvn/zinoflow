# Làm mới toàn bộ Điểm đến theo Atlas — phân tích 2 phương án

Ghi 27/07/2026. Trạng thái: **ĐÃ CHỐT PHƯƠNG ÁN A (27/07/2026, người dùng
quyết sau khi xem đủ so sánh + khuyến nghị B) — chưa build, chưa có plan
implement.** Tiếp nối `phan-tich-hien-trang-va-dinh-huong.md` (cùng thư
mục). Các điều kiện an toàn bắt buộc khi viết plan cho A: xem §6.

Bối cảnh: Atlas có 257 cụm, ước ~2.500+ điểm khi lấp đầy (AI tìm thật cho
cụm Bảo Lộc ra 22 ứng viên — trung bình có thể còn cao hơn 10/cụm). Dữ liệu
hiện tại chỉ có 308 POI (247 đã publish) — quá nhỏ so với đích. Người dùng
đề xuất: backup 308 điểm cũ → xoá sạch → nạp 257 cụm → AI tìm điểm con từng
cụm → xây tính năng mới đối chiếu backup, khớp thì khôi phục data cũ (có
duyệt).

## 1) Giá trị đang nằm trong 308 POI cũ (đo thật trên `dichoithoi_dev` 27/07/2026)

| Loại dữ liệu | Số POI có | Ghi chú |
|---|---|---|
| Bài viết đầy đủ (`draft_article` 8 khối) | 247 | Công AI viết + NGƯỜI DUYỆT TAY từng bài — đắt nhất |
| Ảnh đại diện | 248 | File thật trên hosting + token trong DB |
| Toạ độ (lat/lng từ Google Maps URL) | 306 | AI tìm điểm mới KHÔNG trả toạ độ (đã chốt không thêm lat/lng) |
| Type / Tag đã gán | 246 / 252 | Đợt taxonomy redesign 24/07/2026 |
| Khoảng cách đường bộ thật (`poi_distances`) | 2.524 dòng | API OpenRouteService trả phí, tính lại tốn tiền + thời gian |
| Giờ mở cửa / giá vé / đánh giá biên tập / tóm tắt AI | 2-3 mỗi loại | Mới bắt đầu, ít |

Điểm mấu chốt: **AI tìm điểm mới chỉ trả về tên + mô tả 1 câu + địa chỉ +
độ ưu tiên** (thiết kế đã chốt). Mọi thứ trong bảng trên KHÔNG tự sinh lại
được — nếu mất là mất công thật, tiền thật.

## 2) Phương án A — Wipe & restore (đề xuất gốc của người dùng)

Backup 308 POI ra bảng riêng → clear toàn bộ → nạp 257 cụm → AI tìm điểm
từng cụm → tính năng MỚI đối chiếu điểm AI tìm được với backup, khớp thì
khôi phục data cũ vào (hiện bảng duyệt). Chi tiết người dùng bổ sung
27/07/2026: backup vào **1 bảng tạm**, ảnh cũng backup ra **thư mục tạm**
riêng.

Điểm hợp lý của ý tưởng: xuất phát từ nhận định đúng — cấu trúc cũ bẩn
(141 POI treo tỉnh, cụm chia sai), muốn kết quả cuối "sạch như mới".

Chi phí/rủi ro thật khi soi kỹ:

1. **Tính năng "đối chiếu backup → khôi phục" phải XÂY MỚI toàn bộ** (bảng
   backup, luồng so khớp, UI duyệt khôi phục, logic merge từng cột) — trong
   khi cơ chế `orphan-match` của tính năng tìm điểm con (build + verify
   27/07/2026) đã làm ĐÚNG việc này: fuzzy-match điểm AI tìm được với điểm
   có sẵn chưa gán cụm, hiện bảng duyệt, người dùng tick thì gắn điểm CŨ
   (giữ nguyên toàn bộ data giàu) vào cụm mới. Phương án A xây lại một bản
   phức tạp hơn của thứ vừa build xong, dùng 1 lần rồi bỏ.
2. **Xoá sạch không chỉ chạm 1 bảng**: `deleteCascade` hiện tại phải dọn
   relations, poi/cluster distances, hotel/tour map, vé, staging AI,
   products.tags — và 247 điểm đã publish còn nằm bên SQL Server
   (`v2.Destination` + Content + TypeMap/TagMap...) phải xoá cả 2 DB. Mọi
   sai sót giữa chừng (wipe xong, restore lỗi) đều không có đường lùi ngoài
   bản backup — và khôi phục từ backup qua matching TÊN là khôi phục có tổn
   hao: điểm nào AI không tìm ra hoặc đặt tên lệch quá ngưỡng fuzzy sẽ
   "mồ côi trong backup", dễ bị bỏ quên vĩnh viễn.
3. **Thứ tự ngược với giá trị**: phải chờ AI chạy xong cụm nào mới biết
   điểm cũ nào "được phép sống lại" ở cụm đó — tức 247 bài viết đã duyệt
   tay bị đưa vào trạng thái chết tạm thời hàng loạt, phục hồi nhỏ giọt.

## 3) Phương án B — Giữ nguyên data, tách cha rồi để orphan-match gắn lại (khuyến nghị)

Cùng kết quả cuối (cấu trúc 100% theo Atlas, điểm lấp bằng AI), nhưng không
xoá gì:

1. Chuẩn hoá nền tỉnh (34 node, thống nhất hệ mã — bước 1 lộ trình doc
   trước, bắt buộc với MỌI phương án).
2. Nạp 257 cụm từ sheet (cụm trùng slug với 8 cụm đang có thì giữ/đối
   chiếu, không tạo trùng).
3. **Tách cha các POI gắn sai** (1 câu UPDATE, không mất data): 141 POI
   đang treo tỉnh + con của 4 cụm ngoài Atlas + con Đà Lạt cần chia lại →
   `parentSlug = NULL` (thành orphan có chủ đích). POI đang nằm đúng cụm
   khớp Atlas (vd 14 con Bảo Lộc) giữ nguyên, khỏi duyệt lại.
4. Chạy "Tìm điểm con trong cụm bằng AI" lần lượt 257 cụm — cơ chế sẵn có
   tự phân 3 nhóm: điểm cũ khớp → `orphan-match` (tick là gắn lại, GIỮ
   nguyên bài viết/ảnh/toạ độ/Type/Tag); điểm đã đúng cụm →
   `existing-in-cluster` (bỏ qua); còn lại → `new` (tạo draft mới).
5. Kết thúc: query POI còn `parentSlug NULL` = danh sách điểm cũ không
   khớp đâu cả → người dùng rà tay lần cuối (giữ chỗ khác / xoá hẳn).
   Không điểm nào "chết âm thầm" — orphan còn sống trong CMS, nhìn thấy
   được, khác hẳn nằm trong bảng backup không ai mở.

An toàn bổ sung (nên làm dù chọn phương án nào): trước bước 3 chạy
`pg_dump` Postgres + backup SQL Server 1 phát làm lưới an toàn — chi phí
~0, không cần xây tính năng khôi phục.

### Việc CẦN BỔ SUNG NHỎ để phương án B chạy trơn (gap thật, đã soi code)

- **`orphan-match` hiện chỉ so với POI `parentSlug IS NULL` cùng tỉnh**
  (`find-cluster-poi-candidates.usecase.ts`). POI đang gắn NHẦM cụm khác
  cùng tỉnh (vd điểm thuộc Đức Trọng nhưng đang nằm dưới Đà Lạt, nếu chưa
  tách cha ở bước 3) sẽ bị coi là "new" → tạo trùng. Hai cách xử lý: (i)
  kỷ luật tách cha đủ hết ở bước 3 (không cần sửa code), hoặc (ii) mở
  rộng match thêm nhóm "đang thuộc cụm khác cùng tỉnh → đề xuất chuyển
  cụm" (sửa nhỏ 1 use case + 1 badge UI). Khuyến nghị (ii) cho chắc —
  lưới đỡ khi bước 3 sót.
- Khi tick `orphan-match`, hiện GIỮ nguyên mô tả/priority cũ của điểm —
  cân nhắc thêm lựa chọn "cập nhật mô tả/priority theo bản AI mới" ngay
  trên bảng duyệt (sửa nhỏ). Không bắt buộc.
- 257 lần bấm nút theo từng cụm là chấp nhận được (mỗi lần đều phải duyệt
  bảng nên "từng cụm" là đơn vị tự nhiên); nếu sau này mỏi tay mới cân
  nhắc chế độ hàng loạt, đừng làm trước.

## 4) So sánh nhanh

| Tiêu chí | A — Wipe & restore | B — Tách cha + orphan-match |
|---|---|---|
| Kết quả cuối (cấu trúc Atlas, điểm AI lấp) | Đạt | Đạt (giống nhau) |
| Code phải xây mới | Bảng backup + luồng khôi phục + UI duyệt riêng (dùng 1 lần) | 1-2 chỉnh nhỏ vào tính năng sẵn có |
| Rủi ro mất 247 bài viết/ảnh/toạ độ/Type/Tag | Có thật (điểm không match nằm chết trong backup) | Không (data không rời chỗ, chỉ đổi cha) |
| `poi_distances` 2.524 dòng (API trả phí) | Mất theo wipe, tính lại | Giữ nguyên |
| Trạng thái giữa chừng | Site trống hàng loạt, hồi phục nhỏ giọt | Điểm cũ sống liên tục, gắn dần |
| Đường lùi khi sự cố | Chỉ còn bản backup | Mọi bước đảo ngược được từng phần |

**Khuyến nghị: phương án B.** Không phải vì nhanh hơn — vì cùng đạt đúng
kết quả cuối mà không đặt 247 bài viết đã duyệt tay + 2.524 dòng khoảng
cách trả phí vào thế phải "hồi sinh qua matching tên". Ý tưởng gốc của
phương án A (đối chiếu + duyệt khôi phục) không bị bỏ — nó chính là
`orphan-match` đang chạy thật, chỉ khác là data đứng yên thay vì đi vòng
qua bảng backup.

## 5) Quyết định

**27/07/2026 — người dùng CHỐT phương án A** (wipe & restore qua bảng
backup tạm + thư mục ảnh tạm), sau khi đã xem đầy đủ so sánh và khuyến
nghị B ở trên. Phân tích B giữ lại trong doc làm bối cảnh, không thực thi.

Các câu hỏi §7 doc `phan-tich-hien-trang-va-dinh-huong.md` VẪN đang chờ
chốt trước khi viết plan implement.

## 6) Điều kiện an toàn BẮT BUỘC khi viết plan cho phương án A

Chốt A không xoá bỏ các rủi ro ở §2 — plan implement phải thiết kế để bù
lại từng rủi ro:

1. **Backup phải trọn vẹn bảng destinations**: bảng tạm copy NGUYÊN dòng
   (đủ mọi cột: draft_article, gallery, hero_image_meta, types, tags,
   opening_hours, price_breakdown, practical_notes, editorial_review,
   external_review_urls, ai_reference_summary cả 2 cột,
   ai_notes/ai_reference_urls, ticket_links, google_maps_url, lat/lng,
   meta_title, content_hash...). Các bảng vệ tinh (poi_distances,
   relations, vé, staging AI) KHÔNG cần backup vào bảng tạm — chốt
   27/07/2026: wipe sạch cùng lúc, xem mục 6-7; lưới cuối pg_dump (mục 6)
   vẫn giữ được bản sao nếu cần truy lại.
2. **Ảnh**: copy toàn bộ thư mục ảnh điểm đến sang thư mục tạm TRƯỚC khi
   wipe (local dev: `DICHOITHOI_LOCAL_WEB_ROOT`; nếu chạm production sau
   này: FTP). Path trong bản backup phải khớp lại được với file trong thư
   mục tạm.
3. **Khôi phục tái dùng fuzzy-match sẵn có** (`isLikelySameDestinationName`,
   ngưỡng lỏng) — KHÔNG viết thuật toán so khớp mới; so cả tên + toạ độ
   (backup có lat/lng, điểm AI chỉ có tên/địa chỉ → toạ độ dùng chiều
   backup→điểm-mới khi nghi trùng).
4. **Chống chết âm thầm — yêu cầu cứng**: phải có màn "backup còn lại"
   liệt kê điểm backup CHƯA được khôi phục vào đâu, đếm rõ, người dùng
   xử lý từng dòng (khôi phục tay / bỏ hẳn) — coi là một phần của
   Definition of Done, không phải tính năng phụ.
5. **Khôi phục là MERGE có duyệt**: điểm AI mới (tên/mô tả/priority/địa
   chỉ) + data giàu từ backup (bài viết/ảnh/toạ độ/Type/Tag/khoảng
   cách...) — bảng duyệt phải cho thấy 2 phía trước khi ghi.
6. **Wipe 2 DB đúng thứ tự + lưới cuối**: `pg_dump` Postgres + backup SQL
   Server NGAY trước wipe (ngoài bảng tạm — phòng chính bảng tạm/script
   backup có bug); wipe cả SQL Server (`v2.Destination` + Content +
   TypeMap/TagMap/SlugRedirect...) lẫn Postgres. Phạm vi wipe (chốt
   27/07/2026): **sạch toàn bộ** — destinations + relations +
   poi/cluster_distances + vé + staging AI + mọi bảng vệ tinh — theo
   cascade logic sẵn có (`deleteCascade`), không DELETE tay từng bảng.
7. **poi_distances KHÔNG khôi phục** (chốt 27/07/2026): người dùng tự tính
   lại trong CMS bằng nút sẵn có ("Tính khoảng cách" theo cụm/điểm —
   OpenRouteService) sau khi cây mới ổn định — chấp nhận tốn API tính lại,
   đổi lấy khỏi phải viết logic map khoảng cách theo cặp slug cũ→mới.
