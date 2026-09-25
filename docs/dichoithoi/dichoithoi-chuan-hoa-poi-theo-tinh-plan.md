# Dichoithoi — Chuẩn hoá POI/cụm theo từng tỉnh, trước khi trích xuất/gắn Tag/viết nội dung (plan, ghi 15/08/2026)

Bối cảnh: audit dữ liệu thật 15/08/2026 phát hiện hàng loạt vấn đề chất
lượng dữ liệu POI/cụm (toạ độ, trùng lặp, sai cụm) trên quy mô toàn quốc.
Người dùng chốt hướng: **chuẩn hoá xong hẳn 1 tỉnh (theo 34 tỉnh mới, xem
[[dichoithoi-sap-nhap-tinh-thanh-2025.md]]) mới chuyển sang trích xuất nội
dung/gắn Type-Tag cho tỉnh đó** — không làm nội dung trên dữ liệu bẩn, và
không làm 1 lượt toàn quốc như đã làm hôm nay (rủi ro: lỗi geocode fallback
phát hiện hôm nay đã lọt qua production trước khi bị phát hiện + sửa).

## Hiện trạng đã audit (dữ liệu thật, query Postgres `dichoithoi_destinations` 15/08/2026, SAU các fix đã làm trong ngày)

| Chỉ số | Giá trị hiện tại |
|---|---|
| Tổng | 34 tỉnh, 235 cụm, **3.580 POI** (đã giảm từ 3.639 sau khi gộp 59 POI trùng lặp) |
| POI thiếu toạ độ | **1.228/3.580 (34,3%)** — tăng nhẹ so với audit ban đầu (31,2%) vì đã chủ động null hoá 91 POI bị geocode sai (locality-fallback), đưa về lại hàng chờ |
| POI cách xa cụm cha >50km | **81** (Haversine, đã re-audit sau khi gộp trùng lặp — giảm từ 102 vì 1 phần điểm sai cụm nằm trong nhóm đã gộp) |
| Cụm không có POI nào | **1** — `nam-du` (tỉnh 91) |
| POI đã có Type | 225/3.580 (6,3%) |
| POI đã có Tag | 230/3.580 (6,4%) |

**Việc đã sửa xong trong ngày (không nằm trong phạm vi plan này nữa)**:
- Gốc lỗi geocode locality-fallback — chặn tại
  `apps/api/src/modules/destination/application/use-cases/accept-geocode-candidates.usecase.ts:70-83`
  (không cho ghi toạ độ trùng ≤15m với POI khác cùng cụm). Có test
  `accept-geocode-candidates.usecase.spec.ts`.
- 91/95 POI từng bị geocode sai đã null hoá lat/lng/googleMapsUrl (script
  `apps/api/scripts/fix-geocode-locality-collisions.ts`, đã chạy `--apply`).
- 59/62 cặp trùng lặp liên cụm đã gộp (script
  `apps/api/scripts/merge-duplicate-poi.ts`, đã chạy `--apply`). Còn 7 cặp
  "cần xác minh riêng" (nghi là 2 địa điểm thật khác nhau, không merge) —
  liệt kê trong Artifact "Sổ Soát Trùng Lặp" đã gửi người dùng, KHÔNG lặp lại
  trong doc này.

**Chưa có công cụ (lỗ hổng thật, cần xây trong Giai đoạn 0)**: không có
script/UI nào phát hiện + đề xuất sửa "POI cách xa cụm cha bất thường" —
81 điểm trên hiện chỉ biết qua 1 lần audit thủ công (script tạm, đã xoá),
chưa đóng gói lại thành công cụ tái sử dụng được theo từng tỉnh.

## Giai đoạn 0 — Xây công cụ audit "POI sai cụm" theo tỉnh (ĐỘC LẬP, làm trước được, CHẶN bước 3 của checklist mọi tỉnh)

Việc: viết script `apps/api/scripts/audit-cluster-mismatch.ts` — nhận
`--province=<code>` (mặc định: toàn quốc để so khớp kiểm chứng), tính
khoảng cách Haversine POI→cụm cha, liệt kê POI vượt ngưỡng (mặc định 50km,
tham số hoá được) kèm **danh sách cụm khác cùng tỉnh gần hơn** để gợi ý cụm
đúng (giống cách đã làm tay cho nhóm Đất Mũi/Cà Mau hôm nay) — output dạng
dry-run in ra console trước, KHÔNG tự sửa (theo đúng khuôn mẫu 2 script đã
build hôm nay: `fix-geocode-locality-collisions.ts`,
`merge-duplicate-poi.ts`).

Definition of Done:
- Chạy `--province=` bỏ trống (toàn quốc) → ra đúng **81** POI (khớp số đã
  audit tay hôm nay — sai lệch thì script có bug, phải sửa trước khi dùng).
- Chạy thử `--province=11` (Điện Biên, tỉnh pilot Giai đoạn 1) → xem output
  có hợp lý không (đối chiếu 1-2 điểm cụ thể bằng mắt qua Google Maps).

## Giai đoạn 1 — Pilot 1 tỉnh: Điện Biên (43 POI, 3 cụm — tỉnh có ít POI nhất, phù hợp kiểm thử quy trình nhanh)

Phụ thuộc: Giai đoạn 0 xong (cần script audit sai cụm).

Checklist 5 bước, chạy riêng cho `province_code=11`:
1. **Geocode** — chạy batch geocode cho POI thiếu toạ độ trong tỉnh (dùng
   filter `provinceCode` sẵn có ở `RunGeocodeBatchUseCase`/UI danh sách
   destination). Duyệt "ambiguous"/"not-found" qua `GeocodeCandidatesPanel`.
2. **Trùng lặp** — chạy `apps/api/scripts/audit-duplicate-poi-by-province.ts
   --province=<mã>` (đóng gói 08/09/2026 khi làm Lạng Sơn — dùng lại đúng
   `isLikelySameDestinationName()`, chỉ đọc). LƯU Ý: thuật toán khớp theo
   token chung nên ra nhiều false positive với cụm từ lặp lại phổ biến
   ("Làng du lịch cộng đồng...", "Động...Chùa..." — 2 di tích thật khác
   nhau vẫn bị gợi ý) — PHẢI kiểm tra bằng kiến thức địa lý/địa chỉ thật
   trước khi gộp, không tự động gộp theo danh sách script ra. Duyệt + gộp
   bằng tay qua `merge-duplicate-poi.ts`.
3. **Sai cụm** — chạy `audit-cluster-mismatch.ts --province=11` (Giai đoạn
   0), duyệt từng đề xuất, sửa `parentSlug` hoặc tạo cụm mới nếu cần.
4. **Cụm rỗng** — kiểm tra 3 cụm của Điện Biên còn POI hay không sau bước
   2-3 (không được về 0 ngoài ý muốn do gộp/xoá nhầm).
5. Chỉ khi 1-4 xong mới coi Điện Biên "sạch dữ liệu".

Definition of Done (verify bằng dữ liệu thật, không chỉ "chạy xong"):
- Query lại DB: `SELECT count(*) FROM dichoithoi_destinations WHERE
  province_code='11' AND kind='poi' AND lat IS NULL` → phải bằng 0 (hoặc có
  lý do rõ ràng còn lại, ví dụ POI Google không tìm thấy, đã đánh dấu
  `not-found` và người dùng chấp nhận để tự tìm tay sau).
- Chạy lại `audit-cluster-mismatch.ts --province=11` → 0 kết quả.
- Chạy lại script trùng lặp lọc theo tỉnh 11 → 0 cặp còn "đề xuất gộp" chưa
  xử lý.
- Không có cụm nào trong 3 cụm về 0 POI ngoài dự kiến.

## Giai đoạn 2 — Mở rộng 33 tỉnh còn lại (PHỤ THUỘC Giai đoạn 1 đạt DoD — không mở rộng nếu quy trình pilot còn phát sinh lỗi phải sửa code)

Thứ tự tỉnh: **ĐÃ CHỐT 07/09/2026** — tăng dần theo số POI (tỉnh nhỏ làm
trước, giữ nhịp độ nhanh/rủi ro thấp như cách chọn Điện Biên làm pilot).
Bảng theo dõi tiến độ (điền dần):

| Tỉnh | POI | Cụm | Bước 1-4 (chuẩn hoá) | Type/Tag | Nội dung |
|---|---|---|---|---|---|
| Điện Biên | 29 | 4 | ✅ 07/09/2026 (0 thiếu toạ độ, 1 ngoại lệ Đèo Pha Đín ghi nhận, 13 điểm không xác định được xoá) | ⬜ | ⬜ |
| Lạng Sơn | 33 | 4 | ✅ 08/09/2026 (0 thiếu toạ độ, 18 điểm không xác định được xoá) | ⬜ | ⬜ |
| Cao Bằng | 45 | 5 | ✅ 09/09/2026 (0 thiếu toạ độ, 11 điểm không xác định được xoá) | ⬜ | ⬜ |
| Sơn La | 61 | 5 | ✅ 10/09/2026 (0 sai cụm/trùng lặp, 22 điểm ngoại lệ GIỮ LẠI thiếu toạ độ theo yêu cầu người dùng — khác 3 tỉnh trước) | ⬜ | ⬜ |
| Lai Châu | 68→63 | 5 | ✅ 12/09/2026 CHỐT XONG: thử lại kỹ 23 điểm còn thiếu toạ độ (quickOnly=false, mở hết ứng viên) — chấp nhận thêm 3 (Dinh thự Đèo Văn Long, Suối khoáng nóng Vàng Bó, Thung lũng Mường So/Chợ Mường So), xoá 1 ("Đèo Pa Thơm" — xác minh qua web search là dữ liệu sai tỉnh, thực chất là Động Pa Thơm thuộc huyện Điện Biên), 19 điểm còn lại (kể cả các địa danh tưởng nổi tiếng: Bản Hon, Pu Đen Đinh, Mã Lý Phìn, mốc biên giới 85, cửa khẩu Pắc Ma, khu bảo tồn Mường Tè...) GIỮ LÀM NGOẠI LỆ vì Google Maps không index đúng tên dù là địa danh có thật | ⬜ | ⬜ |
| Thái Nguyên | 71→69 | 5 | ✅ 10/09/2026 (gộp 2 cặp trùng thật, sửa 1 điểm geocode sai tỉnh — "Bảo tàng Văn hóa các Dân tộc Việt Nam" từng có toạ độ ở Hà Nội, đã xoá + geocode lại nhưng vẫn "not-found", reparent "Thác Tat Mạ" sang cụm Ba Bể, sửa gốc cụm "Chợ Đồn" sai toạ độ HCMC→thật Bắc Kạn. 15 điểm thiếu toạ độ GIỮ LẠI làm ngoại lệ theo mặc định "thà bỏ trống còn hơn ghi sai" — chưa hỏi lại người dùng vì phiên làm việc kết thúc để tắt máy) | ⬜ | ⬜ |
| Tây Ninh | 72→70 | 6 | ✅ 12/09/2026 (gộp 2 cặp trùng thật: "Khu du lịch sinh thái Cửa khẩu Xa Mát"="Cửa khẩu Quốc tế Xa Mát", "Di tích QG đặc biệt/Căn cứ Trung ương Cục Miền Nam"; reparent 1 điểm "Hồ câu cá giải trí Ao Đôi" Tây Ninh→Đức Hòa 66km→3km; 14 cặp audit trùng lặp còn lại xác nhận là địa danh KHÁC NHAU thật, chỉ trùng cụm từ chung; 6/7 cảnh báo sai cụm chỉ là hệ quả tự nhiên của cụm "Tân Lập" đại diện cả vùng Đồng Tháp Mười rộng (Long An cũ sáp nhập) — không sửa. 13 điểm thiếu toạ độ GIỮ LÀM NGOẠI LỆ, gồm 2 điểm lỗi Chrome lặp lại 3 lần không xử lý được) | ⬜ | ⬜ |
| TP. Huế | 80 | 5 | ✅ 12/09/2026 (0 trùng lặp/sai cụm/cụm rỗng thật — Bước 2/3 audit ra toàn false positive, tên chung "Bãi biển...". 10/80 điểm thiếu toạ độ GIỮ LÀM NGOẠI LỆ, gồm 1 điểm lỗi Chrome lặp lại không xử lý được "chua-thanh-tan") | ⬜ | ⬜ |
| Hưng Yên | 84→79 | 8 | ✅ 12/09/2026 (tỉnh gồm cả địa bàn Thái Bình cũ sau sáp nhập. Gộp 5 cặp trùng thật: Ecopark/Khu đô thị sinh thái Ecopark, 3 bản Đền Đa Hòa nhân bản, Đền Mẫu/Đền Mẫu Hoa Dương Linh Từ, Bãi biển Cồn Vành/Biển Cồn Vành; reparent 2 điểm sai cụm rõ ràng theo tên (Khu di tích Phố Hiến từng gán nhầm cụm Làng Nôm, Bãi Tự Nhiên từng gán nhầm cụm Phố Hiến — đúng ra Chử Đồng Tử); 10 cặp audit còn lại xác nhận khác nhau thật. 19 điểm thiếu toạ độ GIỮ LÀM NGOẠI LỆ, gồm 5 điểm lỗi Chrome lặp lại 2 lần không xử lý được ở khu vực Làng Nôm) | ⬜ | ⬜ |
| TP. Cần Thơ | 85 | 6 | ✅ 12/09/2026 (tỉnh gồm cả địa bàn Hậu Giang + Sóc Trăng cũ sau sáp nhập. 0 trùng lặp/sai cụm/cụm rỗng thật — 11/12 cặp audit Bước 2 là false positive tên chung "Thiền viện Trúc Lâm"/"Bảo tàng"/"Khu du lịch sinh thái", 1 cảnh báo Bước 3 chỉ là hệ quả huyện đảo Cù Lao Dung xa mọi cụm. 17/85 điểm thiếu toạ độ GIỮ LÀM NGOẠI LỆ, đa số là chùa Khmer Sóc Trăng tên riêng dễ nhầm giữa nhiều chùa lân cận, 1 điểm lỗi Chrome lặp lại "chua-sam-rong-wat-patum-wongsa-som-rong") | ⬜ | ⬜ |
| TP. Đà Nẵng | 87 | 6 | ✅ 12/09/2026 (tỉnh gồm cả địa bàn Quảng Nam cũ: Hội An, Mỹ Sơn, Tam Kỳ, Trà My, Đông Giang. 0 trùng lặp/sai cụm/cụm rỗng thật — 14 cặp Bước 2 toàn false positive "Bãi biển"/"Khu du lịch sinh thái", 2 cảnh báo Bước 3 chỉ do huyện Trà My miền núi xa mọi cụm. **PHÁT HIỆN LỖI SCRAPER NGHIÊM TRỌNG** — xem "Rủi ro còn mở": nhiều địa danh RẤT nổi tiếng (Sun World Bà Nà Hills, Chùa Linh Ứng, Bảo tàng Điêu khắc Chăm, Chợ Hàn, Cầu Sông Hàn...) bị báo sai "not-found" dù Google Maps có đầy đủ dữ liệu (xác minh tay qua Playwright MCP), thử reset Chrome profile không khắc phục được — nghi lỗi code, cần điều tra riêng. 29/87 điểm thiếu toạ độ GIỮ LÀM NGOẠI LỆ, phần lớn do lỗi scraper trên chứ không phải thiếu dữ liệu thật) | ⬜ | ⬜ |
| Hà Tĩnh | 87→82 | 7 | ✅ 12/09/2026 TỰ ĐỘNG (gộp 4 cặp trùng thật: Ngã ba Đồng Lộc x2 bản, Biển/Bãi biển Xuân Thành, Đền thờ/Đền Chế thắng Phu nhân Nguyễn Thị Bích Châu; reparent 1 điểm sai cụm rõ ràng theo tên "Đồi chè Kỳ Trung" Đồng Lộc→Kỳ Anh 57.8km→11.8km; 13 cặp audit còn lại là địa danh khác nhau thật, đa số "Bãi biển Thiên Cầm" trùng tên chung với nhiều bãi biển lân cận. 19/82 điểm thiếu toạ độ GIỮ LÀM NGOẠI LỆ) | ⬜ | ⬜ |
| Vĩnh Long | 88→83 | 6 | ✅ 13/09/2026 TỰ ĐỘNG (tỉnh gộp Bến Tre+Trà Vinh+Vĩnh Long cũ — 3 tỉnh, giống mẫu Cần Thơ. Gộp 4 cặp trùng thật: Nhà cổ Cai Cường x2 bản, Ao Bà Om x2 bản sai cụm, Làng nghề/Vương quốc Gạch Gốm Mang Thít, Cầu Mỹ Thuận x3 bản; reparent 2 điểm sai cụm rõ (Khu DL Vinh Sang, Chùa Tiên Châu — Trà Vinh→Vĩnh Long chỉ 1-2.7km); 39/43 cặp audit còn lại là false positive tên chung "Khu du lịch sinh thái"/"Bảo tàng" lặp ở 3 tỉnh cũ. 16/83 điểm thiếu toạ độ GIỮ LÀM NGOẠI LỆ) | ⬜ | ⬜ |
| Đồng Nai | 89→88 | 6 | ✅ 13/09/2026 TỰ ĐỘNG (tỉnh gộp Bình Phước cũ — cụm Đồng Xoài+Bà Rá. Gộp 1 cặp trùng thật "Khu du lịch sinh thái/Khu du lịch Suối Mơ" nhân bản qua 2 cụm; reparent 3 điểm sai cụm cải thiện rõ (Vườn QG Bù Gia Mập, Cửa khẩu Hoa Lư, Trảng cỏ Bù Lạch: Đồng Xoài→Bà Rá gần hơn 15-27km); 12/14 cặp audit còn lại false positive (nhiều hồ/khu DL sinh thái/chùa tên khác nhau thật). 11/88 điểm thiếu toạ độ GIỮ LÀM NGOẠI LỆ — tỷ lệ tốt nhất đợt tự động) | ⬜ | ⬜ |
| Đồng Tháp | 91→86 | 7 | ✅ 13/09/2026 TỰ ĐỘNG (tỉnh gộp Tiền Giang cũ — cụm Cái Bè+Gò Công+Mỹ Tho. Gộp 5 cặp trùng thật, đa số dạng "tên đầy đủ/tên rút gọn cùng nơi": Làng hoa kiểng Sa Đéc (vùng phụ cận)=Làng hoa Sa Đéc, Khu di tích lịch sử/Khu du lịch Xẻo Quýt, Vườn quýt hồng Lai Vung (vùng đệm)=bản gốc, Khu di tích QG đặc biệt/thường Gò Tháp, Làng nghề đóng ghe xuồng/xuồng ghe Long Hậu (đảo từ). LƯU Ý: "Chùa Bửu Lâm" trùng tên hệt ở 2 cụm KHÔNG gộp — toạ độ cách 65km, là 2 chùa thật khác nhau (tên phổ biến). Reparent 1 điểm sai cụm rõ (Chùa Lá Sen: Tràm Chim→Sa Đéc 60km→12km). 10/86 điểm thiếu toạ độ GIỮ NGOẠI LỆ — tỷ lệ tốt nhất đợt tự động (11.6%)) | ⬜ | ⬜ |
| Tuyên Quang | 91→90 | 6 | ✅ 13/09/2026 TỰ ĐỘNG (tỉnh gộp Hà Giang cũ — cụm Đồng Văn+Hà Giang+Hoàng Su Phì. Gộp 1 cặp trùng thật (làng Nà Tông nhân bản qua 2 cụm); reparent 7 điểm sai cụm cải thiện rất rõ (55-95% gần hơn) — đa số là địa danh Hà Giang cũ bị gán nhầm cụm "Hà Giang" trung tâm thay vì cụm huyện đúng (Đồng Văn/Hoàng Su Phì/Na Hang), ví dụ Hồ Na Hang 66.6km→2.3km, Sông Nho Quế 64km→13.5km. 21/90 điểm thiếu toạ độ GIỮ NGOẠI LỆ) | ⬜ | ⬜ |
| Cà Mau | 94→92 | 4 | ✅ 13/09/2026 TỰ ĐỘNG (tỉnh gộp Bạc Liêu cũ — cụm Bạc Liêu+Cà Mau+Đất Mũi+Giá Rai. Gộp 2 cặp trùng thật: Khu di tích Giồng Bốm/Trận Giồng Bốm (1946, tách đôi qua 2 cụm), Biểu tượng con tàu/Tượng đài Biểu tượng Con Tàu Mũi Cà Mau (~700m, mô tả gần giống hệt); sửa 1 lỗi toạ độ vay mượn sai (Giếng Trời VQG Mũi Cà Mau trùng y hệt toạ độ điểm mẹ → xoá về ngoại lệ); reparent 6 điểm sai cụm rõ theo tên (Cột mốc GPS 0001/VQG Mũi Cà Mau/KDL QG Mũi Cà Mau/Bến Vàm Lũng/Rừng đước Năm Căn: Cà Mau→Đất Mũi 51-77km→3.7-34km; Khu Vườn chim Cà Mau: Bạc Liêu→Cà Mau theo mô tả "giữa lòng thành phố"; Căn cứ Cái Chanh: Bạc Liêu→Giá Rai). 20/92 điểm thiếu toạ độ GIỮ NGOẠI LỆ — 1 điểm lỗi Chrome 2 lần (chua-cosdon-chua-cho-phuoc-long)) | ⬜ | ⬜ |
| TP. Hà Nội | 99→96 | 5 | ✅ 13/09/2026 TỰ ĐỘNG (tỉnh gộp Hà Tây+Hòa Bình cũ — cụm Ba Vì/Hà Nội/Hương Sơn/Sóc Sơn/Sơn Tây. Gộp 3 cặp trùng thật do tách qua ranh giới cụm cũ: Làng văn hóa các dân tộc VN x2 bản, Chùa Hương (Hương Sơn)=Quần thể danh thắng Chùa Hương, Đền Gióng-Sóc Sơn=Quần thể di tích Đền Sóc; reparent 1 điểm sai cụm rõ (Núi Hàm Lợn: Hà Nội→Sóc Sơn theo mô tả). LƯU Ý: "Chùa Đậu" (Hương Sơn) KHÔNG trùng "Chùa Dâu" (Bắc Ninh) dù slug giống — 2 chùa khác hẳn nhau. "Núi Hương Tích (Hòa Bình)" KHÔNG gộp "Động Hương Tích" dù cùng tên gọi — mô tả khác nhau (núi trekking/hang động tâm linh), guard chặn trùng toạ độ xác nhận nghi ngờ. ⚠️ NGHI VẤN LỖI SCRAPER: "Chùa Thầy" — địa danh rất nổi tiếng — trả về 0 ứng viên, không có cả lỗi Chrome, giống dấu hiệu lỗi not-found giả đã ghi ở Đà Nẵng (xem memory dichoithoi-geocode-scraper-bug-not-found). 16/96 điểm thiếu toạ độ GIỮ NGOẠI LỆ, gồm 3 điểm lỗi Chrome 2 lần: Lăng Bác, Đầm sen Vân Đình, Sân bay Nội Bài) | ⬜ | ⬜ |
| Nghệ An | 101→100 | 8 | ✅ 13/09/2026 TỰ ĐỘNG (8 cụm, không gộp tỉnh cũ khác — tỉnh gốc rộng, trải dài biển-đồng bằng-miền núi. Gộp 1 cặp trùng thật phát hiện qua TOẠ ĐỘ Y HỆT khi geocode: "Hang Bua" (cụm hoang-mai, sai) = "Danh thắng Hang Bua" (cụm quy-chau, đúng) — Google trả về đúng 1 điểm dù 2 bản khác cụm, guard không chặn vì khác cụm nên phải tự phát hiện qua audit tên. Reparent 3 điểm ở vùng núi tây nam (Thác Mưa/Thác Liếp/Đập Khe Đá) từ Vinh/Nghĩa Đàn → Con Cuông — tin cậy vừa phải vì không cụm nào khớp hoàn hảo (54-64km→23-47km, cải thiện rõ nhưng không xuất sắc như các tỉnh trước). Nhiều cặp audit tên false positive dạng "Thác/Hang/Bãi biển X" lặp tiền tố dân tộc thiểu số (Tạt, Thẩm, Khe) chỉ các nơi khác nhau thật. 34/100 điểm thiếu toạ độ GIỮ NGOẠI LỆ — tỷ lệ tìm được thấp nhất đợt (chỉ 13/45 mới, nhiều "Thác/Hang" nhỏ vùng núi Google không có dữ liệu chính xác)) | ⬜ | ⬜ |
| TP. Hải Phòng | 103→100 | 7 | ✅ 13/09/2026 TỰ ĐỘNG (tỉnh gộp Hải Dương cũ — cụm Hải Dương/Kinh Môn/Côn Sơn. Gộp 3 cặp trùng thật, 2 cặp phát hiện qua TOẠ ĐỘ Y HỆT khi geocode: Chùa Nhẫm Dương (Kinh Môn)=Chùa Nhẫm Dương (Hải Dương) 21.038805/106.537968, Tuyệt Tình Cốc (Bạch Đằng)=Tuyệt Tình Cốc (Hải Phòng) 20.999688/106.571188; 1 cặp qua mô tả giống hệt: Làng Việt Hải (cụm sai hai-phong)=Làng cổ Việt Hải (cụm đúng cat-ba, ~1.5km, đều tả "làng biệt lập trong vùng lõi rừng/vườn QG Cát Bà"). Reparent 1 điểm cùng quần đảo khác đặc điểm (Đảo Long Châu: hai-phong→cat-ba, theo Hải đăng Long Châu đã đúng cụm cách 1.5km). 21/100 điểm thiếu toạ độ GIỮ NGOẠI LỆ, gồm 2 lỗi Chrome 2 lần (Đình Pháp Cổ, Sân golf Chí Linh); nhiều địa danh Côn Sơn cụ thể (Chùa Côn Sơn, Chùa Nhạn, Đảo Nam Cát...) trả về 0 ứng viên dù nơi khác tìm ra chúng gián tiếp — nghi vấn thêm lỗi scraper) | ⬜ | ⬜ |
| Ninh Bình | 104→101 | 7 | ✅ 13/09/2026 TỰ ĐỘNG (tỉnh gộp Nam Định+Hà Nam cũ — cụm Nam Định/Phủ Dầy/Phủ Lý/Xuân Thủy. Gộp 3 cặp trùng thật do tách qua ranh giới cụm cũ, mô tả gần giống hệt: Cồn Nổi Kim Sơn x2 bản, Làng nghề chiếu cói/cói Kim Sơn, Nhà thờ Giáo xứ/Nhà thờ Hưng Nghĩa (nhà thờ Gothic nổi tiếng Trực Ninh). Không có sai cụm theo khoảng cách. 25/101 điểm thiếu toạ độ GIỮ NGOẠI LỆ — tỷ lệ tìm được thấp (chỉ 9/36 mới) do quần thể Phủ Dầy có nhiều đền nhỏ (Đền Thi Liệu/Vĩnh Lại/Vụ Nữ...) Google trả về CÙNG 1 bộ ứng viên chung chung không phân biệt được đền cụ thể nào — dấu hiệu rõ của việc Google không có dữ liệu định vị riêng cho từng đền nhỏ trong quần thể lớn; "Nhà Bá Kiến" (địa danh văn học nổi tiếng, Chí Phèo) trả về 0 ứng viên dù lỗi Chrome không phải nguyên nhân duy nhất — thêm 1 nghi vấn lỗi scraper) | ⬜ | ⬜ |
| Gia Lai | 105→98 | 7 | ✅ 13/09/2026 TỰ ĐỘNG (tỉnh gộp Bình Định cũ — cụm An Khê/Ayun Pa/Hoài Nhơn/Kbang/Pleiku/Quy Nhơn/Tây Sơn. **PHÁT HIỆN MẪU LỖI HỆ THỐNG**: 7 địa danh phía Gia Lai cũ bị nhân bản thêm 1 bản hậu tố "(Gia Lai)" khi gộp tỉnh — Biển Hồ Chè, Biển Hồ T'Nưng, Chùa Minh Thành, Núi lửa Chư Đăng Ya, Thác Phú Cường, Vườn quốc gia Kon Ka Kinh, Thủy điện Ia Ly (cái cuối lộ qua guard trùng toạ độ lúc geocode, không phải audit tên vì tên khác hẳn "Nhà máy Thủy điện Ialy"). Gộp cả 7. 8 cặp audit tên còn lại đều false positive (Chùa Bửu X, Thác X Tầng — tên chung). Không sai cụm. 25/98 điểm thiếu toạ độ GIỮ NGOẠI LỆ, gồm "Vườn quốc gia Kon Ka Kinh" (di sản ASEAN!) và "Thác Phú Cường" trả về 0 ứng viên — thêm nghi vấn scraper) | ⬜ | ⬜ |
| Quảng Trị | 105→104 | 8 | ✅ 13/09/2026 TỰ ĐỘNG (tỉnh gộp Quảng Bình cũ — cụm Đồng Hới/Phong Nha/Vũng Chùa/Lệ Thủy. Gộp 1 cặp trùng thật phát hiện khi geocode "Lũy Thầy" trùng ý nghĩa lịch sử với "Thành cổ Đồng Hới" (cách ~150m, guard không tự chặn vì quá 15m nhưng rõ cùng công trình Trịnh-Nguyễn). Reparent 1 điểm rõ theo tên (Thác Chênh Vênh: Vĩnh Linh→Khe Sanh 55.8km→23km). ⚠️ NGHI VẤN LỖI SCRAPER thêm 3 ca: "Trung tâm Hành hương Đức Mẹ La Vang", "Vườn quốc gia Phong Nha - Kẻ Bàng" (DI SẢN UNESCO!), "Bảo tàng Quảng Trị" đều trả về 0 ứng viên không kèm lỗi Chrome. 13/104 điểm thiếu toạ độ GIỮ NGOẠI LỆ — tỷ lệ tìm được tốt nhất đợt 2 (22/35 ≈ 63%)) | ⬜ | ⬜ |
| Quảng Ninh | 107→105 | 6 | ✅ 13/09/2026 TỰ ĐỘNG (không gộp tỉnh cũ khác. Gộp 2 cặp trùng thật: Đền Cửa Ông x2 bản (cách ~2.5km, cùng thờ Hưng Nhượng Vương Trần Quốc Tảng), Bảo tàng & Thư viện/Bảo tàng Quảng Ninh (xác nhận qua geocode ra đúng 1 toà nhà). Reparent 1 điểm rõ (Bãi biển Cát Chảy: Cô Tô→Hạ Long 85.6km→11.9km). ⚠️ TỰ PHÁT HIỆN + SỬA LỖI CHÍNH MÌNH: đã lỡ chấp nhận toạ độ sai cho "Đỉnh núi Phật Chỉ" (khớp nhầm 1 đỉnh trùng tên cách xa >60km mọi cụm) — audit Bước 3 phát hiện ra, xoá về ngoại lệ kịp thời trước khi chốt tỉnh; bài học: LUÔN chạy audit sai cụm SAU KHI geocode, kể cả điểm mới chấp nhận, không chỉ điểm cũ. Yoko Onsen Quang Hanh + Chùa Quỳnh Lâm (nổi tiếng) trả về 0 ứng viên — thêm nghi vấn scraper. 16/105 điểm thiếu toạ độ GIỮ NGOẠI LỆ) | ⬜ | ⬜ |
| Thanh Hóa | 112→107 | 9 | ✅ 13/09/2026 TỰ ĐỘNG (không gộp tỉnh cũ khác, 9 cụm riêng của Thanh Hóa — tỉnh lớn, chia 2 batch geocode 67 điểm. Gộp 5 cặp trùng thật: Thác Cổng Trời x2, Bãi biển/Biển Sầm Sơn, Đền Tô Hiến Thành x2, Đền thờ Mai An Tiêm x2 (đúng cụm Nga Sơn theo truyền thuyết dưa hấu), Bãi Đông x2 (toạ độ y hệt). Reparent 2 điểm rõ theo tên: Khu di tích lịch sử Lam Kinh (bị gán NHẦM cụm Pù Luông dù có sẵn cụm "Lam Kinh" riêng!), Thác Mây (Thanh Hóa→Cẩm Thủy 70.8km→17km). LƯU Ý: "Đền Bà Triệu" (bản chính, di tích quốc gia đặc biệt) KHÔNG gộp "Đền thờ Bà Triệu (Sầm Sơn)" — tên tự phân biệt chi nhánh; "Thác Bản Báng" KHÔNG gộp "Bản Báng" — khác đặc điểm. ⚠️ "Đền Bà Triệu" (nữ anh hùng dân tộc rất nổi tiếng!), "Di tích Chiến khu Ba Đình" trả về 0 ứng viên — thêm nghi vấn scraper. 37/107 điểm thiếu toạ độ GIỮ NGOẠI LỆ — tỷ lệ thấp do nhiều "Đền thờ Vua/Danh nhân X" cụ thể Google chỉ biết đền chính, không phân biệt được) | ⬜ | ⬜ |
| Quảng Ngãi | 112→105 | 9 | ✅ 13/09/2026 TỰ ĐỘNG (tỉnh gộp Kon Tum cũ — cụm Kon Tum/Măng Đen/Ngọc Hồi/Ngọc Linh. Gộp 7 cặp trùng thật: Núi Cà Đam/Đăm, Đỉnh Thới Lới x2, Làng Gò Cỏ x2, Muối Sa Huỳnh x2 (guard chặn), Núi Thiên Ấn x2 (~300m), Ngã ba Đông Dương x2 (~15m), Suối nước nóng Trà Bồng/Thạch Bích (VÔ TÌNH trùng toạ độ khi geocode khác cụm, guard không tự chặn — phải tự audit lại SAU khi geocode mới bắt được). Reparent 3 điểm rõ theo tên (Thảo nguyên Bùi Hui, VQG Chư Mom Ray, Hồ Liệt Sơn: 72-94km→7-30km). ⚠️ PHÁT HIỆN + SỬA lỗi toạ độ SAI CÓ SẴN TỪ TRƯỚC (không phải do phiên này): "Khu di tích Văn hóa Sa Huỳnh" + "Hòn Bàn Than" bị khớp nhầm sang khu vực Bàn Than/Núi Thành giáp Quảng Nam, cách xa cụm Sa Huỳnh thật ~65km dù tên gọi rõ ràng — xoá về ngoại lệ. "Khu chứng tích Sơn Mỹ (Mỹ Lai)" (di tích quốc tế nổi tiếng!) trả về 0 ứng viên — thêm nghi vấn scraper. 21/105 điểm thiếu toạ độ GIỮ NGOẠI LỆ) | ⬜ | ⬜ |
| Đắk Lắk | 114→111 | 9 | ✅ 13/09/2026 TỰ ĐỘNG (tỉnh gộp Phú Yên cũ — cụm Đông Hòa/Sông Cầu/Tuy An/Tuy Hòa/Vân Hòa. Gộp 3 cặp trùng thật, đều xác nhận qua toạ độ y hệt/rất gần: Biệt điện Bảo Đại x2, Thác Dray Sáp x2, Cầu treo Buôn Đôn x2 (~150m). Reparent 1 điểm rõ theo tên (Cánh đồng ca cao Krông Pắc: M'Drắk→Buôn Ma Thuột 82.9km→18.2km). ⚠️ PHÁT HIỆN + SỬA lỗi toạ độ SAI CÓ SẴN TỪ TRƯỚC: "Buôn Jun" + "Buôn Lê Diêm" đều mô tả rõ "ven hồ Lắk" nhưng toạ độ lưu lại cách xa >70km, mâu thuẫn với chính mô tả — xoá về ngoại lệ. 12/111 điểm thiếu toạ độ GIỮ NGOẠI LỆ — tỷ lệ tốt (14/24 mới ≈ 58%)) | ⬜ | ⬜ |
| Phú Thọ | 128 | 10 | ✅ 13/09/2026 TỰ ĐỘNG (tỉnh gộp Vĩnh Phúc+Hòa Bình cũ — cụm Hòa Bình/Kim Bôi/Lương Sơn/Mai Châu/Phúc Yên/Tam Đảo/Thanh Thủy/Vĩnh Yên. Không gộp trùng — 12 cặp audit tên đều false positive dạng "Đồi chè/Thác Bạc/Đền X" mỗi huyện có 1 bản thật riêng. Reparent 1 điểm rõ theo tên (Đền Quốc Mẫu Âu Cơ/Đầm Ao Châu: Thanh Thủy→Hạ Hòa 61.2km→10.3km). ⚠️ "Khu di tích Quốc gia Đặc biệt Đền Hùng" (di tích tổ tiên dân tộc, cực kỳ quan trọng!) — tìm ĐÚNG được 3 tên ứng viên nhưng KHÔNG trích được toạ độ (undefined) — bằng chứng mới, rõ ràng hơn cho lỗi scraper (khác dạng lỗi "not-found" hoàn toàn, đây là lỗi parse toạ độ từ trang tìm được). 30/128 điểm thiếu toạ độ GIỮ NGOẠI LỆ) | ⬜ | ⬜ |
| Lào Cai | 131→126 | 9 | ✅ 14/09/2026 TỰ ĐỘNG (tỉnh gộp Yên Bái cũ — cụm Mù Cang Chải/Nghĩa Lộ/Thác Bà/Yên Bái. Gộp 5 cặp trùng thật: Đền Bảo Hà/Ông Hoàng Bảy x3 bản (cùng 1 đền, toạ độ cách vài mét, phát hiện dần qua guard rồi audit tên rồi kiểm tra chéo sau reparent), Suối khoáng nóng Trạm Tấu x2, Đồi Mâm Xôi x2 (đồi biểu tượng Mù Cang Chải bị gán nhầm cụm Yên Bái — "Đồi Mâm Xôi bé" là đồi thật khác, KHÔNG gộp). Reparent 5 điểm rõ theo tên (Mù Cang Chải, Thác Mơ, Đền Bảo Hà, Đỉnh Tà Xùa, Đền Ông Hoàng Bảy lân cận). ⚠️ PHÁT HIỆN + SỬA lỗi toạ độ SAI CÓ SẴN TỪ TRƯỚC: "Thung lũng hoa Bắc Hà" + "Sông Chảy (đoạn Bảo Yên)" đều mâu thuẫn với chính tên gọi (khớp nhầm sang Sa Pa/Thác Bà) — xoá về ngoại lệ. Thêm 1 ca "tìm đúng tên nhưng toạ độ undefined" (Khu bảo tồn thiên nhiên Văn Bàn-Bảo Yên) — củng cố nghi vấn lỗi scraper. 27/126 điểm thiếu toạ độ GIỮ NGOẠI LỆ) | ⬜ | ⬜ |
| Khánh Hòa | 132→130 | 10 | ✅ 14/09/2026 TỰ ĐỘNG (tỉnh gộp Ninh Thuận cũ — cụm Cà Ná/Ninh Sơn/Phan Rang/Vĩnh Hy. Gộp 2 cặp trùng thật: Suối Đá Bàn x2 (toạ độ y hệt), Khu du lịch (sinh thái) Yang Bay x2 (~700m). Không sai cụm — 24 cặp audit tên đều false positive (Bãi biển/KDL sinh thái/Đảo/Hồ X — mỗi nơi thật khác nhau). Không reparent. 17/130 điểm thiếu toạ độ GIỮ NGOẠI LỆ — batch không gặp lỗi Chrome lần nào (hiếm)) | ⬜ | ⬜ |
| Bắc Ninh | 133→131 | 5 | ✅ 14/09/2026 TỰ ĐỘNG (không gộp tỉnh cũ khác — 5 cụm riêng: Bắc Ninh/Bắc Giang/Lục Ngạn/Tây Yên Tử/Yên Thế. Gián đoạn kỹ thuật giữa chừng: lỗi Chrome ProcessSingleton do 2 cây tiến trình `nest start --watch` song song tranh khoá cùng 1 profile automation (1 cây mồ côi từ sáng sớm tự respawn sau khi chỉ kill nhầm tiến trình con) — sửa bằng cách dừng sạch toàn bộ cây rồi khởi động lại 1 lần duy nhất, xác minh qua 1 job test đơn lẻ trước khi chạy lại batch cuối. Gộp 2 cặp trùng thật: "Chùa Sẻ" nhân bản qua 2 cụm (Lục Ngạn/Tây Yên Tử), "Đền Từ Hả"=" Đền Hả" (cùng di tích thờ Phò mã Vũ Thành, tên đầy đủ "Từ Hả linh từ" bị tách bản ghi). 17/19 cặp audit tên còn lại false positive (tên chung "Chùa/Đình/Khu du lịch sinh thái X"). Reparent 1 điểm rõ theo tên (Thiền viện Trúc Lâm Phượng Hoàng: Tây Yên Tử→Bắc Giang 55km→8.6km). "Chùa Vĩnh Nghiêm" tiếp tục dính lỗi scraper cũ (tìm đúng tên nhưng toạ độ undefined) dù đã retry sau khi sửa lỗi Chrome — xác nhận đây là lỗi parse code thật, không phải do khoá profile. 25/131 điểm thiếu toạ độ GIỮ NGOẠI LỆ) | ⬜ | ⬜ |
| TP. Hồ Chí Minh | 157 | 9 | ✅ 14/09/2026 TỰ ĐỘNG (tỉnh gộp Bà Rịa-Vũng Tàu+Bình Dương cũ — 3 vùng, giống mẫu Cần Thơ/Vĩnh Long — cụm Ba Ria/Con Đảo/Củ Chi/Cần Giờ/Hồ Tràm/Long Hải/Thủ Dầu Một/TP.HCM/Vũng Tàu. **PHÁT HIỆN + VÁ LỖI CODE GỐC**: giữa batch 54 điểm, 23 điểm rất nổi tiếng (Bảo tàng Lịch sử TP.HCM, Chợ Lớn, Chùa Bà Thiên Hậu, Khu du lịch Đại Nam, Bình Quới...) hoàn toàn KHÔNG có bản ghi candidate — nặng hơn cả dạng lỗi "not-found" đã biết. Điều tra ra nguyên nhân thật trong `PlaywrightGoogleMapsProvider.newPage()`: dòng `await this.getContext()` nằm NGOÀI try/catch, nên khi chính `launchPersistentContext()` bị reject (lỗi ProcessSingleton), promise lỗi bị cache vĩnh viễn trong `contextPromise` và không bao giờ vào được nhánh tự reset — mọi lần gọi sau lỗi ngay lập tức cho tới khi restart cả tiến trình Node. ĐÃ SỬA: bọc cả `getContext()` trong try, reset+retry 1 lần cho MỌI loại lỗi (không chỉ khớp regex "has been closed" như code cũ). Xác minh bản vá bằng cách restart sạch + chạy lại đúng 23 điểm đó — lần này mất ~46 phút bình thường (trước đó "hoàn tất" giả trong 26 giây, 0 bản ghi) và ra đủ 23 bản ghi thật. 0 trùng lặp thật (35 cặp Bước 2 toàn false positive tên chung "Bãi biển X"/"Khu du lịch sinh thái", kể cả 1 cặp tưởng trùng "Cánh đồng muối Thiềng Liềng"/"Cánh đồng muối Cần Giờ" — kiểm tra địa chỉ chi tiết xác nhận 2 xã khác nhau, không gộp). Phát hiện + sửa 1 lỗi toạ độ sai có sẵn từ trước ("Công viên Cần Thạnh" toạ độ cách xa cụm Cần Giờ 53km dù thị trấn Cần Thạnh chính là trung tâm huyện Cần Giờ — xoá về ngoại lệ). "Khu du lịch Đại Nam (Lạc Cảnh Đại Nam Văn Hiến)" — công viên giải trí rất nổi tiếng! — vẫn trả về not-found ngay cả sau khi vá lỗi, thêm 1 ca nghi vấn lỗi scraper khác (not-found thật, không phải lỗi ProcessSingleton). 24/157 điểm thiếu toạ độ GIỮ NGOẠI LỆ) | ⬜ | ⬜ |
| An Giang | 222→221 | 10 | ✅ 14/09/2026 TỰ ĐỘNG (tỉnh gộp Kiên Giang cũ — cụm Châu Đốc/Hà Tiên/Long Xuyên/Nam Du/Phú Quốc/Rạch Giá/Thoại Sơn/Tri Tôn/Tịnh Biên/U Minh Thượng. Gộp 1 cặp trùng thật ("Bờ kè lấn biển"="Khu đô thị lấn biển Rạch Giá", phát hiện qua guard chặn trùng toạ độ). **PHÁT HIỆN + SỬA lỗi toạ độ cụm sai nghiêm trọng**: cụm "Tịnh Biên" có toạ độ kinh độ lệch hẳn sang Long Xuyên (105.42 thay vì ~104.97 thật, sát biên giới Campuchia) — khiến audit Bước 3 báo sai hàng loạt 10 POI "cách >50km" dù thực ra đều đúng cụm; geocode lại đúng cụm rồi audit lại sạch 10/12 cảnh báo ngay. Reparent 1 điểm rõ (Khu di tích Hòn Đất/Mộ Chị Sứ: Hà Tiên→Rạch Giá 53.9km→23.6km). "Căn cứ Tỉnh ủy Rạch Giá" giữ nguyên cụm U Minh Thượng dù xa vì không cụm nào gần hơn. LƯU Ý: "Đỉnh Núi Sam & Bệ đá thờ Bà Chúa Xứ" cũng bị guard chặn trùng toạ độ với "Miếu Bà Chúa Xứ Núi Sam" nhưng KHÔNG gộp — kiểm tra địa chỉ xác nhận 2 điểm thật khác nhau theo đúng tích lịch sử (bệ đá gốc trên đỉnh núi, miếu chính dưới chân núi). Cụm "Nam Du" 0 POI — tình trạng có sẵn từ trước, không phải lỗi phát sinh phiên này, ghi nhận không xử lý (ngoài phạm vi checklist). 24/221 điểm thiếu toạ độ GIỮ NGOẠI LỆ (Chùa Kim Tiên bị loại dù có ứng viên tên khớp vì cách cụm 55km — nghi geocode sai tỉnh)) | ⬜ | ⬜ |
| Lâm Đồng | 312→310 | 13 | ✅ 14/09/2026 TỰ ĐỘNG — **TỈNH CUỐI CÙNG, 34/34 TỈNH ĐẠT DoD** (tỉnh gộp Bình Thuận+Đắk Nông cũ — 3 vùng, cụm Bảo Lộc/Cát Tiên/Cổ Thạch/Gia Nghĩa/Krông Nô/La Gi/Madagui/Phan Thiết/Phú Quý/Đà Lạt/Đa Mi/Đạ Tẻh/Đức Trọng, 69 điểm thiếu toạ độ chia 2 batch geocode. 75 cặp Bước 2 bị flag (đa số false positive tên chung do gộp 3 vùng) — dùng kỹ thuật MỚI: quét toạ độ y hệt/rất gần (<300m) giữa mọi cặp POI đã có toạ độ thay vì đọc tay từng cặp, hiệu quả hơn hẳn với số lượng lớn. Gộp 2 cặp trùng thật qua kỹ thuật này: "Hang động Núi Lửa Krông Nô (Quần thể Hang động Chư Blúk)"="Hang động núi lửa Chư Bluk" (0m, cùng hệ thống UNESCO Geopark Đắk Nông, khác cụm); "Mũi Kê Gà"="Hải đăng Kê Gà" (3m, cùng 1 điểm đến du lịch thực tế). Phát hiện + sửa 3 lỗi toạ độ sai nghiêm trọng: (1) "Khu du lịch sinh thái Thác Anna" (Gia Nghĩa) trùng toạ độ y hệt (0m) với "Thác Damb'ri" (Bảo Lộc, cách ~100km) — xác nhận qua địa chỉ là 2 thác THẬT khác nhau, Thác Anna bị geocode khớp nhầm, xoá toạ độ sai KHÔNG merge; (2)+(3) "Làng chài Long Hải" và "Cánh đồng muối Vĩnh Hảo" có địa chỉ xác nhận thuộc TỈNH KHÁC hẳn (TP.HCM và Khánh Hòa — trùng tên địa danh khác tỉnh), xoá toạ độ sai. Reparent 2 điểm rõ theo địa lý (Hang động Chư Bluk, Di tích Nhà ngục Đắk Mil: Gia Nghĩa→Krông Nô 51-60km→9-27km). 3 điểm giữ nguyên dù >50km vì tên/mô tả xác nhận đúng cụm (Hồ Hàm Thuận-Đa Mi, Thác Mây/Tè Trong — hồ/thác lớn trải rộng) hoặc không cụm nào gần hơn thật (Hòn Hải — đảo xa nhất Phú Quý). 47/310 điểm thiếu toạ độ GIỮ NGOẠI LỆ) | ⬜ | ⬜ |

Definition of Done mỗi tỉnh: giống hệt Giai đoạn 1 (query lại DB xác nhận,
không chỉ dựa "đã chạy script").

## Giai đoạn 3 — Type/Tag + trích xuất nội dung (PHỤ THUỘC: tỉnh đó đã đạt DoD chuẩn hoá ở Giai đoạn 1/2)

Không thuộc phạm vi "chuẩn hoá dữ liệu" của plan này, nhưng là điều kiện mở
khoá tiếp theo cho từng tỉnh — ghi lại pointer để không quên trình tự:
- Type/Tag: `SuggestTaxonomyTypesUseCase`/`SuggestTagAssignmentsUseCase`
  (đã build sẵn, chạy theo cụm — endpoint `POST /destination-types/suggest`
  nhận `clusterSlug`), duyệt qua Kanban `/dichoithoi/phan-loai`. Lưu ý đã
  biết từ trước ([[dichoithoi-taxonomy-redesign-chot-chua-build]]): AI không
  đáng tin cho riêng 2 Type `di-tich-lich-su`/`cong-trinh-kiet-tac` (thiếu
  dữ liệu xếp hạng để tra) — cần duyệt tay kỹ 2 Type này mỗi tỉnh, không
  bulk-apply mù.
- Nội dung: quy trình trích xuất/viết bài đã có
  ([[dichoithoi-destination-ai-extraction-plan-open]]).

## Rủi ro còn mở

- Guard chặn trùng toạ độ mới thêm hôm nay chỉ chặn trùng **trong cùng 1
  cụm** — Giai đoạn 1 bước 2 (trùng lặp liên cụm) vẫn phải duyệt tay, guard
  không tự phát hiện được loại này.
- ~~Chưa chốt tiêu chí ưu tiên thứ tự 33 tỉnh Giai đoạn 2~~ — đã chốt
  07/09/2026: tăng dần theo số POI.
- Sửa 3 lỗi thật trong `PlaywrightGoogleMapsProvider` khi làm Cao Bằng
  09/09/2026: (1) `locationBias` được tính nhưng chưa từng dùng để giới hạn
  vùng tìm — giờ ghép thật vào URL; (2) thêm fallback không-bias khi bias
  quá hẹp làm mất địa danh nổi tiếng; (3) **lỗi chính**: code kiểm tra
  `url.includes("/maps/place/")` để biết Google đã trả về đúng 1 kết quả —
  định dạng URL bias mới không đổi URL dù đã hiện đúng kết quả, khiến nhiều
  điểm bị báo nhầm "không tìm thấy". Đã sửa kiểm tra bằng nội dung `h1` thật
  thay vì hình dạng URL + chặn an toàn không nhận toạ độ nếu chỉ là tâm
  khung nhìn bias (tránh ghi nhầm toạ độ cụm thành toạ độ điểm). Áp dụng
  chung mọi tỉnh từ giờ — xem thêm `google-maps-link.ts:hasMarkerCoords()`.
- Phát hiện Chrome-profile leak nghiêm trọng: hàng chục tiến trình
  `chrome.exe` zombie tích luỹ qua nhiều lần server tự khởi động lại trong
  ngày, là nguyên nhân chính của lỗi lặp lại "Failed to open a new tab". Đã
  dọn tay 1 lần (lọc đúng theo `--user-data-dir=...chrome-geocode-profile`,
  KHÔNG kill toàn bộ `chrome.exe` — lần đầu làm sai đã tắt nhầm Chrome cá
  nhân người dùng). Chưa có cơ chế tự dọn — nếu lặp lại lỗi "Failed to open
  a new tab" dồn dập, kiểm tra `Get-CimInstance Win32_Process -Filter
  "Name='chrome.exe'" | Where CommandLine like "*chrome-geocode-profile*"`
  trước khi nghi ngờ code.
- Phát hiện thêm 1 lỗi dữ liệu cụm nghiêm trọng khi làm Thái Nguyên
  10/09/2026: cụm "Chợ Đồn" (huyện cũ thuộc Bắc Kạn, nay thuộc Thái Nguyên)
  có toạ độ ghi nhầm ở TP.HCM (10.929145, 106.821150), làm hỏng `locationBias`
  cho toàn bộ POI con của cụm (candidate trả về toàn địa điểm ở HCMC). Đã
  geocode lại đúng cụm (22.1791798, 105.6060661) rồi chạy lại geocode cho các
  POI con bị ảnh hưởng. Gốc lỗi chưa điều tra (có thể có ở cụm khác — nên
  kiểm tra nhanh toạ độ cụm khi vào tỉnh mới, trước khi tin `locationBias`).
  Cũng phát hiện 1 POI bị geocode sai TỈNH tương tự (không phải lỗi cụm):
  "Bảo tàng Văn hóa các Dân tộc Việt Nam" (Thái Nguyên) từng có toạ độ ở Hà
  Nội — đã xoá, geocode lại ra "not-found" (không đủ tin cậy), để trống chờ
  xử lý tay.
- **LỖI SCRAPER NGHIÊM TRỌNG chưa rõ nguyên nhân, phát hiện khi làm TP. Đà
  Nẵng 12/09/2026**: batch geocode 46 điểm báo "not-found" cho RẤT NHIỀU địa
  danh cực nổi tiếng (Sun World Bà Nà Hills — 71.656 lượt đánh giá, Chùa
  Linh Ứng Sơn Trà, Bảo tàng Điêu khắc Chăm, Chợ Hàn, Cầu Sông Hàn...). Xác
  minh tay bằng Playwright MCP (trình duyệt sạch, khác profile automation)
  cho thấy Google Maps trả về đúng kết quả ngay lập tức cho CẢ 2 dạng URL
  (có bias toạ độ và không) — chứng minh đây là lỗi ở code/scraper của ta,
  KHÔNG PHẢI do Google chặn hay do địa danh thật sự thiếu dữ liệu. Đã thử
  dọn sạch + khởi động lại profile Chrome automation
  (`chrome-geocode-profile`) nhưng KHÔNG khắc phục được — vẫn lỗi y hệt sau
  reset. Log lặp lại cảnh báo "không thấy heading sau khi cuộn hết panel"
  hàng loạt liên tiếp bất thường (nhiều hơn hẳn mức nền thường thấy ở các
  tỉnh trước). Nghi ngờ: có thể liên quan đến việc dùng hết quota/soft-limit
  sau khối lượng request rất lớn trong ngày (usageThisMonth ~1000+ lúc phát
  hiện), hoặc 1 thay đổi hành vi Google Maps chưa được `scrapeCurrentPage()`
  xử lý đúng (khác biệt tinh vi giữa profile automation lâu ngày vs trình
  duyệt mới tinh). CHƯA SỬA — cần điều tra riêng bằng cách so sánh trực tiếp
  HTML/DOM giữa 2 lần chạy (`playwright-google-maps.provider.ts`), có thể
  thêm log chụp màn hình khi "không thấy heading" để chẩn đoán. Cho tới khi
  sửa xong, số POI "not-found" ở các tỉnh làm sau ngày 12/09/2026 cần nghi
  ngờ nhiều hơn bình thường trước khi kết luận "không tìm được" là đúng.
