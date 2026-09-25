/**
 * Gop 59 cap POI trung lap thuc (audit 15/08/2026, "Sổ Soát Trùng Lặp" —
 * 62 cap duoc Claude phan loai bang kien thuc dia ly, 1 cap bi loai vi nghi
 * la 2 diem thuc khac nhau [cau-da-co-lang-nom/lang-nom-4, chuyen sang can
 * xac minh rieng], 2 nhom 3 chieu [Chua Chuong, Chua Nom] gop con 59 cap
 * xoa duy nhat sau khi khu trung).
 *
 * Voi moi cap (keep, drop): dien bu cac truong keep dang thieu ma drop co
 * (KHONG ghi de truong keep da co san), roi xoa drop qua cung logic
 * deleteCascade() (typeorm-destination-mirror.repository.ts) — sao chep lai
 * truc tiep vi khong the wire DI day du (ContentJobRepository) trong script
 * doc lap.
 *
 * Mac dinh chi IN BAO CAO (dry-run). Them --apply de ghi that vao DB.
 * Chay: pnpm ts-node scripts/merge-duplicate-poi.ts [--apply]
 */
import "dotenv/config";
import "reflect-metadata";
import { DataSource } from "typeorm";
import { DestinationMirrorEntity } from "../src/modules/destination/infrastructure/entities/destination-mirror.entity";

const MERGES: Array<{ keep: string; drop: string[] }> = [
  // Giai đoạn 2, tỉnh Lâm Đồng — Bước 2 (audit trùng lặp theo tỉnh, tỉnh
  // CUỐI CÙNG trong 34 tỉnh) — 14/09/2026. Tỉnh gộp Bình Thuận+Đắk Nông cũ
  // (3 vùng), 75 cặp bị flag nhưng đa số false positive tên chung. Tìm
  // trùng thật bằng cách quét toạ độ y hệt/rất gần (<300m) giữa mọi cặp
  // POI đã có toạ độ thay vì đọc tay 75 cặp — hiệu quả hơn hẳn. 2 cặp
  // trùng thật xác nhận: (1) "Hang động Núi Lửa Krông Nô (Quần thể Hang
  // động Chư Blúk)"="Hang động núi lửa Chư Bluk" — cùng hệ thống hang
  // UNESCO Geopark Đắk Nông, toạ độ y hệt (0m), chỉ khác cụm (krong-no/
  // gia-nghia). (2) "Mũi Kê Gà"="Hải đăng Kê Gà" — cách nhau 3m, trong du
  // lịch thực tế được xem là cùng 1 điểm đến (hải đăng nằm ngay trên mũi).
  // RIÊNG "Khu du lịch sinh thái Thác Anna" (cụm gia-nghia)="Thác Damb'ri"
  // (cụm bao-loc) cũng trùng toạ độ y hệt (0m) nhưng KHÔNG gộp — mô tả xác
  // nhận đây là 2 thác THẬT khác nhau cách nhau ~100km (Gia Nghĩa vs Bảo
  // Lộc), Damb'ri có địa chỉ xác thực nên đúng, Thác Anna bị lỗi geocode
  // khớp nhầm — đã xoá toạ độ sai của Thác Anna (không merge, không giữ
  // toạ độ sai).
  { keep: "hang-dong-nui-lua-chu-bluk", drop: ["hang-dong-nui-lua-krong-no-quan-the-hang-dong-chu-bluk"] },
  { keep: "mui-ke-ga", drop: ["hai-dang-ke-ga"] },
  // Giai đoạn 2, tỉnh An Giang — Bước 2 (audit trùng lặp theo tỉnh)
  // 14/09/2026. Tỉnh gộp Kiên Giang cũ. 1 cặp trùng thật trong 25 cặp bị
  // flag: "Bờ kè lấn biển Rạch Giá" = "Khu đô thị lấn biển Rạch Giá" —
  // phát hiện qua guard chặn trùng toạ độ lúc geocode (Google trả cùng 1
  // vị trí cho cả 2 tên gọi khác nhau của cùng khu phát triển đô thị lấn
  // biển). LƯU Ý: "Đỉnh Núi Sam & Bệ đá thờ Bà Chúa Xứ" cũng bị guard chặn
  // nhưng KHÔNG gộp với "Miếu Bà Chúa Xứ Núi Sam" — kiểm tra địa chỉ xác
  // nhận đây là 2 điểm thật khác nhau theo đúng tích lịch sử (bệ đá gốc
  // trên đỉnh núi nơi phát hiện tượng, miếu chính dưới chân núi nơi thờ
  // hiện tại) — Google chỉ trả nhầm cùng toạ độ khi tìm "Đỉnh Núi Sam".
  { keep: "khu-do-thi-lan-bien-rach-gia", drop: ["bo-ke-lan-bien-rach-gia"] },
  // Giai đoạn 2, tỉnh Bắc Ninh — Bước 2 (audit trùng lặp theo tỉnh)
  // 14/09/2026. 2 cặp trùng thật trong 19 cặp bị flag: (1) "Chùa Sẻ" xuất
  // hiện ở 2 cụm khác nhau (luc-ngan đã có toạ độ, tay-yen-tu chưa) — cùng
  // 1 ngôi chùa (Chùa Xẻ, Lục Ngạn) bị nhân bản khi sáp nhập cụm. (2) "Đền
  // Từ Hả" (tay-yen-tu, không tìm được toạ độ) = "Đền Hả" (luc-ngan, đã
  // geocode 0.89) — cùng 1 di tích thờ Phò mã Vũ Thành, tên đầy đủ "Từ Hả
  // linh từ" bị tách thành 2 bản ghi khác cụm.
  { keep: "chua-se", drop: ["chua-se-2"] },
  { keep: "den-ha", drop: ["den-tu-ha"] },
  // Giai đoạn 2, tỉnh Khánh Hòa — Bước 2 (audit trùng lặp theo tỉnh)
  // 14/09/2026 — tỉnh gộp Ninh Thuận cũ. 2 cặp trùng thật: (1) "Suối Đá
  // Bàn" x2 bản (khanh-son/khanh-vinh) — TOẠ ĐỘ Y HỆT (12.206729/
  // 108.918786), mô tả gần giống hệt. (2) "Khu du lịch sinh thái Thác Yang
  // Bay" (khanh-vinh, ĐÚNG cụm, mới geocode) = "Khu du lịch Yang Bay" (nha-
  // trang, sai cụm, cách ~700m) — cùng khu du lịch sinh thái thác nước
  // Yang Bay.
  { keep: "suoi-da-ban-3", drop: ["suoi-da-ban-4"] },
  { keep: "khu-du-lich-sinh-thai-thac-yang-bay", drop: ["khu-du-lich-yang-bay"] },
  // Giai đoạn 2, tỉnh Lào Cai — Bước 2 (audit trùng lặp theo tỉnh)
  // 14/09/2026 — tỉnh gộp Yên Bái cũ. 2 cặp trùng thật: (1) "Đền Ông" (mô
  // tả chung chung "điểm tâm linh nhỏ trong huyện Bảo Yên", guard chặn khi
  // geocode trùng đúng toạ độ) = "Đền Bảo Hà (Đền thờ Ông Hoàng Bảy)" (đền
  // nổi tiếng nhất vùng, cùng huyện) — "Ông" là tên rút gọn của "Ông Hoàng
  // Bảy". (2) "Suối khoáng nóng Trạm Tấu" (cụm nghia-lo ĐÚNG, có toạ độ) =
  // "Khu du lịch sinh thái Suối khoáng nóng Trạm Tấu" (cụm yen-bai, sai
  // cụm) — mô tả gần giống hệt "suối khoáng nóng tự nhiên giữa núi rừng".
  { keep: "den-bao-ha-den-tho-ong-hoang-bay", drop: ["den-ong"] },
  { keep: "suoi-khoang-nong-tram-tau", drop: ["khu-du-lich-sinh-thai-suoi-khoang-nong-tram-tau"] },
  // Phát hiện thêm qua audit tên: "Đồi Mâm Xôi (La Pán Tẩn)" (mu-cang-chai,
  // ĐÚNG cụm, chưa toạ độ) = "Đồi Mâm Xôi" (yen-bai, sai cụm, đã có toạ độ)
  // — mô tả gần giống hệt "biểu tượng du lịch Mù Cang Chải, ruộng bậc thang
  // hình mâm xôi". "Đồi Mâm Xôi bé" (đã có toạ độ riêng, mô tả rõ "phiên
  // bản nhỏ hơn") là 1 đồi thật khác, KHÔNG gộp.
  { keep: "doi-mam-xoi-la-pan-tan", drop: ["doi-mam-xoi"] },
  // Phát hiện sau khi reparent: "Đền Bảo Hà (Lào Cai)" và "Đền Ông Hoàng
  // Bảy (Bảo Hà - khu vực lân cận)" hoá ra CÙNG 1 ngôi đền với "Đền Bảo Hà
  // (Đền thờ Ông Hoàng Bảy)" đã gộp trước đó — toạ độ gần như y hệt (cách
  // vài mét), mô tả đều "thần vệ quốc Hoàng Bảy... linh thiêng bậc nhất
  // Tây Bắc". Gộp cả 3 bản về 1 (tên đầy đủ nhất).
  { keep: "den-bao-ha-den-tho-ong-hoang-bay", drop: ["den-bao-ha-lao-cai", "den-ong-hoang-bay-bao-ha-khu-vuc-lan-can"] },
  // Giai đoạn 2, tỉnh Đắk Lắk — Bước 2 (audit trùng lặp theo tỉnh)
  // 13/09/2026 — 3 cặp trùng thật, đều xác nhận qua TOẠ ĐỘ Y HỆT hoặc rất
  // gần: (1) "Biệt điện Bảo Đại" (buon-ma-thuot) = "Biệt điện Bảo Đại (đồi
  // Hồ Lắk)" (lak) — cùng 1 toạ độ hệt (12.674576/108.042109) dù tên phụ đề
  // gợi ý khác vị trí, xác nhận là 1 biệt điện. (2) "Thác Dray Sáp" (buon-
  // ma-thuot) = "Thác Dray Sáp (nhánh gần Lắk)" (lak) — cùng toạ độ hệt
  // (12.537924/107.890234). (3) "Khu du lịch sinh thái Cầu treo Buôn Đôn"
  // (buon-don, ĐÚNG cụm) = "Trung tâm Du lịch Cầu Treo Buôn Đôn" (buon-ma-
  // thuot, sai cụm) — cách ~150m, mô tả cùng ý "cầu treo bắc qua sông
  // Sêrêpốk".
  { keep: "biet-dien-bao-dai", drop: ["biet-dien-bao-dai-doi-ho-lak"] },
  { keep: "thac-dray-sap", drop: ["thac-dray-sap-nhanh-gan-lak"] },
  { keep: "khu-du-lich-sinh-thai-cau-treo-buon-don", drop: ["trung-tam-du-lich-cau-treo-buon-don"] },
  // Giai đoạn 2, tỉnh Thanh Hóa — Bước 2 (audit trùng lặp theo tỉnh)
  // 13/09/2026 — 2 cặp trùng thật phát hiện qua geocode: (1) "Thác Cổng
  // Trời" x2 bản (ben-en có toạ độ "khu vực Như Xuân", cam-thuy chưa toạ
  // độ) — cùng tên, cùng mô tả "hoang sơ ít người biết", giữ bản đúng cụm
  // địa lý (Như Xuân gần Bến En). (2) "Bãi biển Sầm Sơn" (cụm sam-son ĐÚNG,
  // chưa toạ độ) = "Biển Sầm Sơn" (cụm thanh-hoa, đã có toạ độ) — mô tả
  // giống hệt "nổi tiếng nhất Thanh Hóa", giữ bản đúng cụm, bù toạ độ từ
  // bản kia.
  { keep: "thac-cong-troi", drop: ["thac-cong-troi-2"] },
  { keep: "bai-bien-sam-son", drop: ["bien-sam-son"] },
  // Phát hiện thêm qua audit lần 2: "Đền Tô Hiến Thành" (sam-son, có toạ
  // độ) = "Đền thờ Tô Hiến Thành" (hai-tien, chưa toạ độ) — cùng danh tướng
  // thời Lý, mô tả gần giống hệt. "Di tích Đền thờ Mai An Tiêm" (nga-son,
  // ĐÚNG cụm — truyền thuyết quả dưa hấu gắn với Nga Sơn) = "Đền thờ Mai An
  // Tiêm" (thanh-hoa, sai cụm, chưa toạ độ) — cùng nhân vật truyền thuyết.
  // LƯU Ý: "Đền Bà Triệu" (thanh-hoa, di tích quốc gia đặc biệt — bản
  // chính) KHÔNG gộp với "Đền thờ Bà Triệu (Sầm Sơn)" — tên gọi tự phân
  // biệt rõ là 2 đền khác nhau (chính điện vs chi nhánh địa phương). "Thác
  // Bản Báng" KHÔNG gộp "Bản Báng" — thác nước và bản làng là 2 đặc điểm
  // khác nhau dù cùng tên khu vực.
  { keep: "den-to-hien-thanh", drop: ["den-tho-to-hien-thanh"] },
  { keep: "di-tich-den-tho-mai-an-tiem", drop: ["den-tho-mai-an-tiem"] },
  // Phát hiện qua audit sai cụm (Bước 3): "Bãi Đông" (thanh-hoa, sai cụm)
  // và "Bãi biển Bãi Đông" (nghi-son, đúng cụm) ra TOẠ ĐỘ Y HỆT
  // (19.326528,105.824059) — cùng 1 bãi biển trên bán đảo Nghi Sơn.
  { keep: "bai-bien-bai-dong", drop: ["bai-dong"] },
  // Giai đoạn 2, tỉnh Quảng Ngãi — Bước 2 (audit trùng lặp theo tỉnh)
  // 13/09/2026 — tỉnh gộp Kon Tum cũ (cụm Kon Tum/Măng Đen/Ngọc Hồi/Ngọc
  // Linh). 4 cặp trùng thật, mô tả gần giống hệt: Núi Cà Đam/Cà Đăm (cùng
  // cụm tra-bong); Đỉnh Thới Lới x2 bản (ly-son/quang-ngai, cùng "cột cờ
  // chủ quyền + miệng núi lửa"); Làng cổ Gò Cỏ/Làng Gò Cỏ (cùng cụm sa-
  // huynh, cùng làng cổ Sa Huỳnh); Làng muối/Cánh đồng muối Sa Huỳnh (guard
  // chặn khi geocode xác nhận trùng toạ độ).
  { keep: "nui-ca-dam", drop: ["nui-ca-dam-3"] },
  { keep: "dinh-thoi-loi", drop: ["dinh-thoi-loi-ly-son"] },
  { keep: "lang-co-go-co", drop: ["lang-go-co"] },
  { keep: "lang-muoi-sa-huynh", drop: ["canh-dong-muoi-sa-huynh"] },
  // Phát hiện thêm qua audit lần 2 (sau geocode): "Núi Thiên Ấn & Chùa
  // Thiên Ấn" (mới geocode 15.148349/108.818195) = "Núi Thiên Ấn" (đã có
  // toạ độ 15.150883/108.818579, cách ~300m) — cùng "đệ nhất danh thắng
  // Quảng Ngãi", giữ bản tên đầy đủ hơn. "Ngã ba Đông Dương (Cột mốc biên
  // giới...)" (mới geocode, cụm ngoc-hoi ĐÚNG) = "Ngã ba Đông Dương" (cụm
  // kon-tum, toạ độ gần như y hệt ~15m) — giữ bản tên đầy đủ + đúng cụm.
  // "Suối nước nóng Trà Bồng" (mới geocode) VÔ TÌNH ra TOẠ ĐỘ Y HỆT "Suối
  // nước nóng Thạch Bích" (cụm ba-to, khác cụm nên guard không chặn) — xác
  // nhận qua audit là cùng 1 suối nước nóng, giữ bản đúng tên cụm.
  { keep: "nui-thien-an-chua-thien-an", drop: ["nui-thien-an"] },
  { keep: "nga-ba-dong-duong-cot-moc-bien-gioi-viet-nam-lao-campuchia", drop: ["nga-ba-dong-duong"] },
  { keep: "suoi-nuoc-nong-tra-bong", drop: ["suoi-nuoc-nong-thach-bich"] },
  // Giai đoạn 2, tỉnh Quảng Ninh — Bước 2 (audit trùng lặp theo tỉnh)
  // 13/09/2026 — 2 cặp trùng thật: (1) "Đền Cửa Ông" x2 bản (den-cua-ong-2
  // cụm van-don, den-cua-ong cụm ha-long) — cùng mô tả thờ "Hưng Nhượng
  // Vương Trần Quốc Tảng", cách nhau ~2.5km, giữ bản có mô tả đầy đủ hơn
  // ("di tích lịch sử quốc gia đặc biệt"). (2) "Bảo tàng & Thư viện Quảng
  // Ninh" (đã geocode ra đúng "Bảo tàng Quảng Ninh") = "Bảo tàng Quảng
  // Ninh" (bản riêng, chưa toạ độ) — cùng toà nhà bảo tàng+thư viện nổi
  // tiếng (khối đen), giữ bản có toạ độ.
  { keep: "den-cua-ong-2", drop: ["den-cua-ong"] },
  { keep: "bao-tang-thu-vien-quang-ninh", drop: ["bao-tang-quang-ninh"] },
  // Giai đoạn 2, tỉnh Gia Lai — Bước 2 (audit trùng lặp theo tỉnh)
  // 13/09/2026 — tỉnh gộp Bình Định cũ (cụm An Khê/Ayun Pa/Hoài Nhơn/Kbang/
  // Pleiku/Quy Nhơn/Tây Sơn). Phát hiện MẪU LỖI HỆ THỐNG: 6 địa danh phía
  // Gia Lai cũ bị nhân bản thêm 1 bản có hậu tố "(Gia Lai)" — mô tả diễn
  // đạt khác chữ nhưng cùng ý (Biển Hồ Chè, Biển Hồ T'Nưng, Chùa Minh
  // Thành, Núi lửa Chư Đăng Ya, Thác Phú Cường, Vườn quốc gia Kon Ka Kinh)
  // — nghi do nhập liệu 2 lần khi gộp tỉnh, giữ bản KHÔNG hậu tố (tên gốc,
  // đa số đã đúng cụm pleiku/kbang).
  { keep: "bien-ho-che", drop: ["bien-ho-che-gia-lai"] },
  { keep: "bien-ho-ho-t-nung", drop: ["bien-ho-t-nung-gia-lai"] },
  { keep: "chua-minh-thanh", drop: ["chua-minh-thanh-gia-lai"] },
  { keep: "nui-lua-chu-dang-ya", drop: ["nui-lua-chu-dang-ya-gia-lai"] },
  { keep: "thac-phu-cuong", drop: ["thac-phu-cuong-gia-lai"] },
  { keep: "vuon-quoc-gia-kon-ka-kinh", drop: ["vuon-quoc-gia-kon-ka-kinh-gia-lai"] },
  // "Thủy điện Ia Ly (Gia Lai)" trùng đúng "Nhà máy Thủy điện Ialy" (guard
  // chặn khi geocode xác nhận trùng toạ độ) — cùng 1 nhà máy thuỷ điện.
  { keep: "nha-may-thuy-dien-ialy", drop: ["thuy-dien-ia-ly-gia-lai"] },
  // Giai đoạn 2, tỉnh Quảng Trị — Bước 2 (audit trùng lặp theo tỉnh)
  // 13/09/2026 — "Lũy Thầy" (mới geocode, cụm dong-hoi, 17.467832/
  // 106.624341, mô tả "phòng tuyến quân sự do Đào Duy Từ xây dựng") = "Thành
  // cổ Đồng Hới" (cụm dong-hoi, đã có toạ độ, cách chỉ ~150m, mô tả "di tích
  // quân sự thời Trịnh-Nguyễn") — cùng 1 công trình lịch sử (luỹ Thầy =
  // tên dân gian của thành Đồng Hới, cùng hệ thống phòng tuyến Trịnh-
  // Nguyễn), guard không tự chặn vì cách >15m nhưng rõ ràng trùng qua tên
  // gọi + mô tả lịch sử. Giữ bản tên chính thức hơn.
  { keep: "thanh-co-dong-hoi", drop: ["luy-thay"] },
  // Giai đoạn 2, tỉnh Ninh Bình — Bước 2 (audit trùng lặp theo tỉnh)
  // 13/09/2026 — tỉnh gộp Nam Định+Hà Nam cũ (cụm Nam Định/Phủ Dầy/Phủ
  // Lý/Xuân Thủy). 3 cặp trùng thật do tách qua ranh giới cụm cũ, mô tả
  // gần giống hệt: (1) "Cồn Nổi Kim Sơn" (kim-son, chưa toạ độ) = "Cồn Nổi
  // (Kim Sơn)" (xuan-thuy, đã có toạ độ) — cùng bãi bồi/cồn nổi ven biển
  // hệ sinh thái ngập mặn. (2) "Làng nghề chiếu cói Kim Sơn" (kim-son,
  // ĐÚNG cụm địa lý) = "Làng nghề cói Kim Sơn" (xuan-thuy, sai cụm) — cùng
  // làng nghề cói, giữ bản đúng cụm. (3) "Nhà thờ Giáo xứ Hưng Nghĩa"
  // (xuan-thuy, sai cụm, mới geocode) = "Nhà thờ Hưng Nghĩa" (nam-dinh,
  // ĐÚNG cụm — nhà thờ Gothic nổi tiếng ở Trực Ninh, Nam Định) — mô tả
  // "kiến trúc Gothic như lâu đài châu Âu" trùng khớp, giữ bản đúng cụm.
  { keep: "con-noi-kim-son-2", drop: ["con-noi-kim-son"] },
  { keep: "lang-nghe-chieu-coi-kim-son", drop: ["lang-nghe-coi-kim-son"] },
  { keep: "nha-tho-hung-nghia", drop: ["nha-tho-giao-xu-hung-nghia"] },
  // Giai đoạn 2, TP. Hải Phòng — Bước 2 (audit trùng lặp theo tỉnh)
  // 13/09/2026 — tỉnh gộp Hải Dương cũ (cụm Hải Dương/Kinh Môn/Côn Sơn). 3
  // cặp trùng thật: (1) "Chùa Nhẫm Dương (Chùa Thánh Quang)" (kinh-mon) =
  // "Chùa Nhẫm Dương" (hai-duong) — TOẠ ĐỘ Y HỆT (21.038805,106.537968) khi
  // geocode, giữ bản đúng cụm địa lý (Kinh Môn) + tên đầy đủ hơn. (2)
  // "Tuyệt Tình Cốc (Hồ An Sơn)" (bach-dang) = "Tuyệt Tình Cốc" (hai-phong)
  // — TOẠ ĐỘ Y HỆT (20.999688,106.571188), giữ bản tên đầy đủ hơn. (3)
  // "Làng Việt Hải" (cụm hai-phong SAI, mới geocode 20.7983,107.0434) =
  // "Làng cổ Việt Hải" (cụm cat-ba ĐÚNG, 20.7872,107.0567, cách ~1.5km,
  // mô tả gần giống hệt "làng biệt lập giữa/trong vùng lõi rừng/vườn quốc
  // gia Cát Bà") — Việt Hải là 1 xã trên đảo Cát Bà, giữ bản đúng cụm.
  { keep: "chua-nham-duong-chua-thanh-quang", drop: ["chua-nham-duong"] },
  { keep: "tuyet-tinh-coc-ho-an-son", drop: ["tuyet-tinh-coc"] },
  { keep: "lang-co-viet-hai", drop: ["lang-viet-hai"] },
  // Giai đoạn 2, tỉnh Nghệ An — Bước 2 (audit trùng lặp theo tỉnh)
  // 13/09/2026 — "Hang Bua" (cụm hoang-mai, mới geocode) và "Danh thắng
  // Hang Bua" (cụm quy-chau, đã có toạ độ từ trước) trả về TOẠ ĐỘ Y HỆT
  // (19.616457,105.018529) khi Google tự xác định vị trí thật — xác nhận
  // đây là cùng 1 hang động (danh thắng quốc gia ở Quỳ Châu), bị gán nhầm
  // cụm "hoang-mai" ở bản trùng lặp. Giữ bản đúng cụm + tên đầy đủ hơn.
  { keep: "danh-thang-hang-bua", drop: ["hang-bua"] },
  // Giai đoạn 2, TP. Hà Nội — Bước 2 (audit trùng lặp theo tỉnh)
  // 13/09/2026 — tỉnh gộp Hà Tây+Hòa Bình cũ (5 cụm: Ba Vì/Hà Nội/Hương
  // Sơn/Sóc Sơn/Sơn Tây). 3 cặp trùng thật do tách đôi qua ranh giới cụm
  // cũ: (1) "Làng văn hóa các dân tộc Việt Nam" (ba-vi, chưa toạ độ) =
  // "Làng Văn hóa - Du lịch các Dân tộc Việt Nam" (son-tay, đã có toạ độ,
  // mô tả gần giống hệt "tái hiện văn hóa kiến trúc 54 dân tộc"). (2) "Chùa
  // Hương (Hương Sơn)" (cụm ha-noi SAI, chưa toạ độ) = "Quần thể danh thắng
  // Chùa Hương" (cụm huong-son ĐÚNG, mô tả đầy đủ "hệ thống chùa chiền,
  // hang động, suối Yến") — cùng 1 quần thể, tên rút gọn bị gán nhầm cụm.
  // (3) "Đền Gióng - Sóc Sơn" (cụm ha-noi SAI, chưa toạ độ) = "Quần thể di
  // tích Đền Sóc (Đền Gióng)" (cụm soc-son ĐÚNG, đã có toạ độ, "di tích
  // quốc gia đặc biệt thờ Thánh Gióng") — Đền Gióng và Đền Sóc là 1 nơi.
  // LƯU Ý: "Chùa Đậu" (chua-dau-2, Hương Sơn, thờ nhục thân thiền sư)
  // KHÔNG trùng "Chùa Dâu" (chua-dau, Bắc Ninh, tổ đình Phật giáo Luy Lâu)
  // dù slug gần giống — 2 chùa hoàn toàn khác nhau, khác cả tên có dấu
  // (Dâu/Đậu) lẫn tỉnh. "Núi Hương Tích (Hòa Bình)" (mô tả "núi non
  // trekking giáp Hà Nội-Hòa Bình") KHÔNG gộp với "Động Hương Tích" (mô tả
  // "Nam thiên đệ nhất động", hang động tâm linh) dù cùng tên gọi — có thể
  // là núi và hang khác điểm cụ thể trong cùng khu vực, giữ nguyên tách
  // biệt theo "thà bỏ trống còn hơn ghi sai" (guard chặn trùng toạ độ khi
  // geocode cũng xác nhận nghi ngờ này).
  { keep: "lang-van-hoa-du-lich-cac-dan-toc-viet-nam", drop: ["lang-van-hoa-cac-dan-toc-viet-nam"] },
  { keep: "quan-the-danh-thang-chua-huong", drop: ["chua-huong-huong-son"] },
  { keep: "quan-the-di-tich-den-soc-den-giong", drop: ["den-giong-soc-son"] },
  // Giai đoạn 2, tỉnh Cà Mau — Bước 2 (audit trùng lặp theo tỉnh)
  // 13/09/2026 — tỉnh gộp Bạc Liêu cũ (4 cụm: Bạc Liêu/Cà Mau/Đất Mũi/Giá
  // Rai). 2 cặp trùng thật: (1) "Khu di tích lịch sử Giồng Bốm" (cụm bạc-
  // liêu, chưa toạ độ) = "Khu di tích lịch sử Trận Giồng Bốm" (cụm gia-rai,
  // đã ghi rõ "di tích lịch sử quốc gia") — cùng 1 trận đánh 1946 của lực
  // lượng Cao Đài Minh Chơn Đạo chống Pháp tại Giồng Bốm, bị tách đôi khi
  // chia cụm theo tỉnh cũ; giữ bản "Trận Giồng Bốm" (tên đầy đủ, đúng cụm
  // địa lý Giá Rai). (2) "Biểu tượng con tàu Mũi Cà Mau" (cụm đất-mũi, mới
  // gán toạ độ 8.6103,104.7171) = "Tượng đài Biểu tượng Con Tàu Mũi Cà Mau"
  // (cụm cà-mau, toạ độ 8.6074,104.7229, cách nhau ~700m cùng khu vực Mũi Cà
  // Mau) — mô tả 2 bản gần như giống hệt nhau (biểu tượng con tàu/thuyền
  // rẽ sóng ra biển tại điểm cực Nam), giữ bản đúng cụm địa lý (đất-mũi).
  { keep: "khu-di-tich-lich-su-tran-giong-bom", drop: ["khu-di-tich-lich-su-giong-bom"] },
  { keep: "bieu-tuong-con-tau-mui-ca-mau", drop: ["tuong-dai-bieu-tuong-con-tau-mui-ca-mau"] },
  // Giai đoạn 2, tỉnh Tuyên Quang — Bước 2 (audit trùng lặp theo tỉnh)
  // 13/09/2026 — tỉnh gộp Hà Giang cũ. "Làng du lịch cộng đồng Nà Tông"
  // (na-hang) và "Làng văn hóa du lịch cộng đồng thôn Nà Tông" (tuyen-quang)
  // cùng 1 bản, cả 2 đều chưa có toạ độ. Giữ cụm đúng địa lý hơn (Na Hang).
  { keep: "lang-du-lich-cong-dong-na-tong", drop: ["lang-van-hoa-du-lich-cong-dong-thon-na-tong"] },
  // Giai đoạn 2, tỉnh Đồng Tháp — Bước 2 (audit trùng lặp theo tỉnh)
  // 13/09/2026 — tỉnh gộp Tiền Giang cũ. 5 cặp trùng thật (tên đầy đủ/tên
  // rút gọn cùng 1 nơi): Làng hoa kiểng Sa Đéc (vùng phụ cận)=Làng hoa Sa
  // Đéc (toạ độ cách nhau 1.4km, cùng khu vực); Khu di tích lịch sử Xẻo
  // Quýt=Khu du lịch Xẻo Quýt; Vườn quýt hồng Lai Vung (vùng đệm Tháp
  // Mười)=Vườn quýt hồng Lai Vung; Khu di tích Quốc gia đặc biệt Gò
  // Tháp=Khu di tích Gò Tháp; Làng nghề đóng ghe xuồng/đóng xuồng ghe Long
  // Hậu (chỉ đảo từ). LƯU Ý: "Chùa Bửu Lâm" (2 bản, my-tho vs cao-lanh)
  // KHÔNG gộp dù trùng tên hệt — toạ độ cách nhau 65km, là 2 chùa thật khác
  // nhau (tên chùa phổ biến, trùng ở nhiều tỉnh).
  { keep: "lang-hoa-sa-dec", drop: ["lang-hoa-kieng-sa-dec-vung-phu-can"] },
  { keep: "khu-du-lich-xeo-quyt", drop: ["khu-di-tich-lich-su-xeo-quyt"] },
  { keep: "vuon-quyt-hong-lai-vung", drop: ["vuon-quyt-hong-lai-vung-vung-dem-thap-muoi"] },
  { keep: "khu-di-tich-go-thap", drop: ["khu-di-tich-quoc-gia-dac-biet-go-thap"] },
  { keep: "lang-nghe-dong-ghe-xuong-long-hau", drop: ["lang-nghe-dong-xuong-ghe-long-hau"] },
  // Giai đoạn 2, tỉnh Đồng Nai — Bước 2 (audit trùng lặp theo tỉnh)
  // 13/09/2026: "Khu du lịch sinh thái Suối Mơ" (hậu tố "-2" trong slug gợi
  // ý bị nhân bản khi né trùng tên) trùng với "Khu du lịch Suối Mơ" đã có
  // toạ độ đúng cụm Định Quán (khu resort Suối Mơ thật ở Tân Phú).
  { keep: "khu-du-lich-suoi-mo", drop: ["khu-du-lich-sinh-thai-suoi-mo-2"] },
  // Giai đoạn 2, tỉnh Vĩnh Long — Bước 2 (audit trùng lặp theo tỉnh)
  // 13/09/2026 — tỉnh gộp Bến Tre+Trà Vinh+Vĩnh Long cũ, nhiều địa danh bị
  // nhân bản qua nhiều cụm: "Nhà cổ Cai Cường" (tên trùng hệt), "Làng nghề
  // gạch gốm Mang Thít"="Vương quốc Gạch Gốm Mang Thít" (tên thương hiệu du
  // lịch của cùng làng nghề), "Cầu Mỹ Thuận" bị nhân bản 3 lần (chỉ có 1
  // cầu thật tên này, cầu mới tên riêng "Mỹ Thuận 2" không trùng). Giữ bản
  // đã có toạ độ.
  { keep: "nha-co-cai-cuong", drop: ["nha-co-cai-cuong-2"] },
  { keep: "vuong-quoc-gach-gom-mang-thit", drop: ["lang-nghe-gach-gom-mang-thit"] },
  { keep: "cau-my-thuan-4", drop: ["cau-my-thuan-2", "cau-my-thuan-3"] },
  // Giai đoạn 2, tỉnh Vĩnh Long — Bước 1 (geocode) 13/09/2026: "Ao Bà Om
  // (Ao Kuu)" và "Ao Bà Om" cùng 1 hồ nổi tiếng ở Trà Vinh — bản sau bị gán
  // nhầm cụm "Duyên Hải" (cách 38km) trong khi bản trước đúng cụm
  // "Trà Vinh" (cách 4.5km, đã có toạ độ). Giữ bản đúng cụm.
  { keep: "ao-ba-om-ao-kuu", drop: ["ao-ba-om"] },
  // Giai đoạn 2, tỉnh Hà Tĩnh — Bước 1 (geocode) 12/09/2026: "Khu di tích
  // Ngã ba Đồng Lộc" và "Khu di tích Lịch sử Quốc gia Đặc biệt Ngã ba Đồng
  // Lộc" cùng 1 di tích — bản đầu bị gán NHẦM cụm "Thiên Cầm" (cách di tích
  // thật 32km) trong khi bản sau đúng cụm "Đồng Lộc" (cách 1.5km, đã có
  // toạ độ). Giữ bản tên đầy đủ + đúng cụm.
  { keep: "khu-di-tich-lich-su-quoc-gia-dac-biet-nga-ba-dong-loc", drop: ["khu-di-tich-nga-ba-dong-loc"] },
  // Giai đoạn 2, tỉnh Hà Tĩnh — Bước 2 (audit trùng lặp theo tỉnh)
  // 12/09/2026: "Ngã ba Đồng Lộc" (địa danh chung) trùng toạ độ ~40m với
  // "Khu di tích Lịch sử Quốc gia Đặc biệt Ngã ba Đồng Lộc" đã gộp ở trên.
  // "Biển Xuân Thành"/"Bãi biển Xuân Thành" cùng tên bãi biển, chỉ khác
  // cách gọi. "Đền thờ/Đền Chế thắng Phu nhân Nguyễn Thị Bích Châu" cùng 1
  // nhân vật lịch sử, cùng khu vực ven biển Kỳ Anh (bản đầu từng bị gán
  // nhầm cụm thien-cam).
  { keep: "khu-di-tich-lich-su-quoc-gia-dac-biet-nga-ba-dong-loc", drop: ["nga-ba-dong-loc"] },
  { keep: "bai-bien-xuan-thanh", drop: ["bien-xuan-thanh"] },
  { keep: "den-che-thang-phu-nhan-nguyen-thi-bich-chau", drop: ["den-tho-che-thang-phu-nhan-nguyen-thi-bich-chau"] },
  // Giai đoạn 2, tỉnh Hà Tĩnh — Bước 1 (geocode) 12/09/2026: "Khu vực lòng
  // hồ Ngàn Trươi (Đảo Tràm)" trùng toạ độ với "Hồ Ngàn Trươi" đã có sẵn
  // (cùng hồ, cùng cụm vu-quang) — phát hiện qua guard chặn trùng toạ độ.
  { keep: "ho-ngan-truoi", drop: ["khu-vuc-long-ho-ngan-truoi-dao-tram"] },
  // Giai đoạn 2, tỉnh Hưng Yên — Bước 2 (audit trùng lặp theo tỉnh)
  // 12/09/2026: 3 bản ghi cùng chỉ 1 di tích "Đền Đa Hòa" (toạ độ cách nhau
  // ≤300m, cùng 1 khu vực Chử Đồng Tử) — bị nhân bản qua nhiều tên/cụm khác
  // nhau. Giữ tên ngắn gọn + đúng cụm chu-dong-tu.
  { keep: "den-da-hoa", drop: ["den-chu-dong-tu-tien-dung-den-da-hoa", "den-da-hoa-den-chu-dong-tu"] },
  // "Đền Mẫu"/"Đền Mẫu (Hoa Dương Linh Từ)" — Đền Mẫu Hưng Yên (Phố Hiến) có
  // tên chính thức đầy đủ là "Hoa Dương Linh Từ", cùng 1 di tích. Giữ bản đã
  // có toạ độ + tên đầy đủ.
  { keep: "den-mau-hoa-duong-linh-tu", drop: ["den-mau"] },
  // "Bãi biển Cồn Vành (Khu vực hoang sơ)"/"Biển Cồn Vành" — cùng 1 bãi biển
  // (Cồn Vành, Tiền Hải), khác mỗi hậu tố mô tả khu vực hoang sơ. Giữ bản đã
  // có toạ độ + đúng cụm thai-binh.
  { keep: "bien-con-vanh", drop: ["bai-bien-con-vanh-khu-vuc-hoang-so"] },
  // Giai đoạn 2, tỉnh Hưng Yên — Bước 1 (geocode) 12/09/2026: "Ecopark" và
  // "Khu đô thị sinh thái Ecopark" cùng 1 khu đô thị, phát hiện khi thấy
  // "ecopark" (chưa có toạ độ, gán nhầm cụm chu-dong-tu) trùng tên với bản
  // đã geocode xong (20.946798,105.941861, đúng cụm van-giang). Giữ bản đã
  // có toạ độ + đúng cụm.
  { keep: "khu-do-thi-sinh-thai-ecopark", drop: ["ecopark"] },
  // Giai đoạn 2, tỉnh Tây Ninh — Bước 2 (audit trùng lặp theo tỉnh)
  // 12/09/2026: "Di tích Quốc gia đặc biệt Căn cứ Trung ương Cục Miền Nam"
  // và "Căn cứ Trung ương Cục miền Nam" — cùng 1 di tích (đã cùng toạ độ
  // 11.733852,106.076689 sẵn trong DB), khác mỗi mức tên đầy đủ. Giữ bản
  // tên chính thức. 13 cặp còn lại trong lượt audit này là ĐỊA DANH KHÁC
  // NHAU THẬT (false positive do trùng cụm từ chung "Quần thể danh thắng",
  // "Khu du lịch sinh thái", "Chùa Thiền/Thiên..." — đã kiểm tra kiến thức
  // địa lý thật, không gộp).
  { keep: "di-tich-quoc-gia-dac-biet-can-cu-trung-uong-cuc-mien-nam", drop: ["can-cu-trung-uong-cuc-mien-nam"] },
  // Giai đoạn 2, tỉnh Tây Ninh — Bước 1 (geocode) 12/09/2026: "Khu du lịch
  // sinh thái Cửa khẩu Xa Mát" chỉ là tên quảng bá du lịch của chính "Cửa
  // khẩu Quốc tế Xa Mát" (đã có toạ độ thật, cùng cụm tan-bien) — phát hiện
  // qua guard chặn trùng toạ độ khi geocode (Google trả về đúng vị trí cửa
  // khẩu cho cả 2 tên). Giữ bản tên chính thức đã có toạ độ.
  { keep: "cua-khau-quoc-te-xa-mat", drop: ["khu-du-lich-sinh-thai-cua-khau-xa-mat"] },
  // Giai đoạn 2, tỉnh Thái Nguyên — Bước 1 (geocode) 10/09/2026: "Khu di tích
  // ATK Định Hóa" và "Khu di tích Quốc gia Đặc biệt ATK Định Hóa" cùng 1 di
  // tích, khác mỗi mức tên đầy đủ, cả 2 đều chưa có toạ độ. Giữ bản tên đầy đủ.
  { keep: "khu-di-tich-quoc-gia-dac-biet-atk-dinh-hoa", drop: ["khu-di-tich-atk-dinh-hoa"] },
  // Giai đoạn 2, tỉnh Thái Nguyên — Bước 2 (audit trùng lặp theo tỉnh)
  // 10/09/2026: "Động Tham Phầy"/"Hang Thẳm Phầy" — CÙNG 1 hang (xác nhận qua
  // web search: cùng nằm ở bản Nà Slải, xã Hoàng Trĩ, huyện Ba Bể; đã cùng
  // toạ độ 22.319599,105.642559 sẵn trong DB). Giữ tên phổ biến trên mọi
  // nguồn "Hang Thẳm Phầy".
  { keep: "hang-tham-phay", drop: ["dong-tham-phay"] },
  // Giai đoạn 2, tỉnh Lai Châu — Bước 2 (audit trùng lặp theo tỉnh) 10/09/2026:
  // "Thác Tác Tình" bị nhân bản 3 lần (thêm hậu tố mô tả vị trí khác nhau),
  // giữ bản gốc đã có toạ độ thật (cụm lai-chau).
  { keep: "thac-tac-tinh", drop: ["thac-tac-tinh-khu-vuc-lan-can", "thac-tac-tinh-gan-khu-vuc-muong-te-nam-nhun"] },
  // "Làng/Bản du lịch cộng đồng Sin Suối Hồ" — cùng 1 bản, khác chữ
  // "Làng"/"Bản" + gán khác cụm (phong-tho đúng hơn lai-chau). Giữ bản đã
  // có toạ độ homestay thật.
  { keep: "lang-du-lich-cong-dong-sin-suoi-ho", drop: ["ban-du-lich-cong-dong-sin-suoi-ho"] },
  // "Núi Đá Ô"/"Đỉnh núi Đá Ô" — cùng núi, khác cụm (sin-ho vs lai-chau),
  // cả 2 đều chưa có toạ độ.
  { keep: "nui-da-o", drop: ["dinh-nui-da-o"] },
  // Giai đoạn 2, tỉnh Cao Bằng — Bước 2 (audit trùng lặp theo tỉnh) 09/09/2026:
  // "Khu di tích Pác Bó" và "Khu di tích Quốc gia Đặc biệt Pác Bó" cùng 1 khu
  // di tích (toạ độ cách nhau ~600m, cùng khu vực), khác nhau ở tên đầy đủ +
  // cụm gán (pac-bo đúng hơn cao-bang). Giữ bản tên đầy đủ + đúng cụm.
  { keep: "khu-di-tich-quoc-gia-dac-biet-pac-bo", drop: ["khu-di-tich-pac-bo"] },
  // Giai đoạn 2, tỉnh Cao Bằng — Bước 1 (geocode) 09/09/2026: "Đèo Mẻ Pia"
  // và "Đèo Khau Cốc Chà (Đèo 14 tầng)" là CÙNG 1 con đèo thật (xã Xuân
  // Trường, Bảo Lạc, 14-15 tầng dốc) — 2 tên gọi khác nhau, audit theo tên
  // không bắt được vì 0 từ trùng nhau. Xác nhận qua web search + candidate
  // Google Maps của cả 2 slug đều cùng trỏ về "Khau Coc Cha Mountain Pass".
  // Giữ "Đèo Mẻ Pia" (tên phổ biến hơn trong báo chí).
  { keep: "deo-me-pia", drop: ["deo-khau-coc-cha-deo-14-tang"] },
  // Giai đoạn 2 pilot Lạng Sơn — Bước 2 (audit trùng lặp theo tỉnh, script
  // audit-duplicate-poi-by-province.ts) phát hiện 08/09/2026: cùng xã Hữu
  // Liên, huyện Hữu Lũng — chỉ khác chữ "sinh thái" và bị gán nhầm cụm
  // lang-son thay vì huu-lung. Giữ bản đã có toạ độ + đúng cụm.
  { keep: "lang-du-lich-cong-dong-huu-lien", drop: ["lang-du-lich-sinh-thai-cong-dong-huu-lien"] },
  // Giai đoạn 2 pilot Lạng Sơn — Bước 1 (geocode) phát hiện 08/09/2026:
  // "Thác Đăng Mò" (cụm lang-son, chưa toạ độ) và "Thác Đăng Mò 2" (cụm
  // bac-son, đã geocode) ra cùng 1 toạ độ Google Maps — cùng 1 thác thật,
  // gán nhầm 2 cụm khác nhau. Giữ bản đã có toạ độ + đúng cụm hơn.
  { keep: "thac-dang-mo-2", drop: ["thac-dang-mo"] },
  // Giai đoạn 1 pilot Điện Biên — Bước 2 (audit trùng lặp riêng tỉnh),
  // phát hiện 07/09/2026: "Đền Hoàng Công Chất" trùng "Đền thờ Hoàng Công
  // Chất" (cùng cụm dien-bien-phu), bản có tọa độ + tên đầy đủ hơn giữ lại.
  { keep: "den-tho-hoang-cong-chat", drop: ["den-hoang-cong-chat"] },
  { keep: "thac-pongour-thac-bay-tang", drop: ["thac-pongour"] },
  { keep: "chua-linh-an", drop: ["chua-linh-an-da-lat"] },
  { keep: "thac-dac-mai", drop: ["thac-dak-mai"] },
  { keep: "bien-con-bung-bien-thanh-phu", drop: ["bien-con-bung"] },
  { keep: "chua-vam-ray", drop: ["chua-vam-ray-2"] },
  { keep: "chua-ang-chua-angkorajaborey", drop: ["chua-ang"] },
  { keep: "cau-ngoi-chua-luong", drop: ["cau-ngoi-cho-luong-chua-luong"] },
  { keep: "den-truc-ngu-dong-thi-son", drop: ["ngu-dong-thi-son-den-truc"] },
  { keep: "dia-tang-phi-lai-tu", drop: ["chua-dia-tang-phi-lai"] },
  { keep: "thac-dray-nur", drop: ["thac-dray-nur-2"] },
  { keep: "thac-vuc-hom", drop: ["vuc-hom"] },
  { keep: "nui-da-voi-me", drop: ["da-voi-me"] },
  { keep: "mui-dien-mui-dai-lanh-hai-dang-dai-lanh", drop: ["hai-dang-mui-dien-mui-dai-lanh"] },
  { keep: "di-tich-lich-su-rach-gam-xoai-mut", drop: ["khu-di-tich-chien-thang-rach-gam-xoai-mut"] },
  { keep: "khu-di-tich-cu-pho-bang-nguyen-sinh-sac", drop: ["khu-di-tich-nguyen-sinh-sac"] },
  { keep: "thac-khuoi-nhi", drop: ["suoi-khuoi-nhi"] },
  { keep: "dinh-nui-pac-ta", drop: ["nui-pac-ta"] },
  { keep: "den-pac-tap", drop: ["den-pac-ta"] },
  { keep: "thac-mo-thac-pac-ban", drop: ["thac-mo-thac-pac-ban-2"] },
  { keep: "cua-khau-quoc-te-ma-lu-thang", drop: ["cua-khau-ma-lu-thang"] },
  { keep: "san-bay-ta-con", drop: ["di-tich-san-bay-ta-con"] },
  { keep: "he-thong-hang-cha-loi", drop: ["hang-cha-loi"] },
  { keep: "bai-bien-dien-thanh", drop: ["bien-dien-thanh"] },
  { keep: "khu-di-tich-quoc-gia-dac-biet-lam-kinh", drop: ["khu-di-tich-lam-kinh"] },
  { keep: "bai-bien-hai-tien", drop: ["bien-hai-tien"] },
  { keep: "ho-latina-ho-da-tinh-bien", drop: ["ho-latina-ho-da-latina"] },
  { keep: "khu-du-lich-sinh-thai-ham-ho", drop: ["khu-du-lich-ham-ho"] },
  { keep: "dam-mon-thuong", drop: ["dam-mon"] },
  // "mui-dam-mon" KHONG co dong rieng — "dam-mon" chi xoa 1 lan (o tren), "mui-dam-mon"
  // giu nguyen doc lap, khong gop noi dung vao no (xem note trong so soat trung lap).
  { keep: "thac-ta-gu", drop: ["thac-ta-gu-khanh-son-giap-ranh-khanh-vinh"] },
  { keep: "dao-hoa-lan-hon-heo", drop: ["dao-hoa-lan"] },
  { keep: "lang-det-tho-cam-my-nghiep", drop: ["lang-nghe-det-tho-cam-my-nghiep"] },
  { keep: "deo-ngoan-muc-deo-song-pha", drop: ["deo-ngoan-muc"] },
  { keep: "deo-khanh-le-deo-omega", drop: ["deo-khanh-le"] },
  { keep: "danh-thang-mat-than-nui-nui-thung", drop: ["nui-mat-than-nui-thung"] },
  { keep: "lang-da-co-khuoi-ky", drop: ["lang-da-khuoi-ky"] },
  { keep: "dinh-phja-oac", drop: ["dinh-phia-oac"] },
  { keep: "vuon-nhan-xuong-vinh-chau", drop: ["vuon-nhan-co-vinh-chau"] },
  { keep: "deo-nuoc-ngot", drop: ["deo-nuoc-ngot-giap-ranh"] },
  { keep: "chua-chuong-kim-chung-tu", drop: ["chua-chuong", "chua-chuong-van-giang"] },
  { keep: "chua-nom-linh-thong-tu", drop: ["chua-nom", "chua-nom-linh-thong-co-tu"] },
  { keep: "den-da-trach", drop: ["den-hoa-da-trach"] },
  { keep: "bai-bien-dong-chau", drop: ["bien-dong-chau"] },
  { keep: "chua-ghositaram-chua-cu-lao", drop: ["chua-ghositaram"] },
  {
    keep: "den-tho-lac-long-quan-va-tuong-me-au-co-tai-dat-mui",
    drop: ["den-tho-lac-long-quan-va-tuong-me-au-co-dat-mui"],
  },
  { keep: "cum-dao-hon-khoai", drop: ["dao-hon-khoai-ca-mau"] },
  { keep: "khu-du-lich-khai-long-bai-bien-khai-long", drop: ["khu-du-lich-bien-khai-long"] },
  { keep: "bai-bien-sa-huynh", drop: ["bien-sa-huynh"] },
  { keep: "cong-to-vo", drop: ["cong-to-vo-ly-son"] },
  { keep: "dinh-nui-ngoc-linh", drop: ["nui-ngoc-linh"] },
  { keep: "chua-hang", drop: ["chua-hang-ly-son"] },
  { keep: "thac-mua-roi-thac-nam-me", drop: ["thac-mua-roi"] },
  { keep: "chua-huong-tich-ha-tinh", drop: ["chua-huong-tich"] },
  { keep: "bai-bien-thien-cam", drop: ["bien-thien-cam"] },
  { keep: "hoanh-son-quan", drop: ["deo-ngang-hoanh-son-quan"] },
  { keep: "dinh-nui-na-lay", drop: ["nui-na-lay"] },
  { keep: "khu-linh-dia-co-mau-son", drop: ["linh-dia-co-mau-son"] },
  { keep: "dam-chuon", drop: ["dam-chuon-pha-tam-giang"] },
];

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  const dataSource = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    entities: [DestinationMirrorEntity],
    synchronize: false,
  });
  await dataSource.initialize();

  try {
    const repo = dataSource.getRepository(DestinationMirrorEntity);
    const allDropSlugs = MERGES.flatMap((m) => m.drop);

    let missingCount = 0;
    let publishedCount = 0;
    const updates: Array<{ slug: string; patch: Partial<DestinationMirrorEntity> }> = [];
    const safeToDelete: string[] = [];

    for (const { keep, drop } of MERGES) {
      const keepEntity = await repo.findOne({ where: { slug: keep } });
      if (!keepEntity) {
        console.log(`⚠️  Bỏ qua "${keep}" — không tìm thấy (có thể đã bị gộp/xoá trước đó).`);
        missingCount++;
        continue;
      }

      const patch: Partial<DestinationMirrorEntity> = {};
      for (const dropSlug of drop) {
        const dropEntity = await repo.findOne({ where: { slug: dropSlug } });
        if (!dropEntity) {
          console.log(`⚠️  Bỏ qua "${dropSlug}" (drop của "${keep}") — không tìm thấy.`);
          missingCount++;
          continue;
        }
        if (dropEntity.siteId !== null) {
          console.log(
            `⚠️⚠️ "${dropSlug}" ĐÃ PUBLISH (siteId=${dropEntity.siteId}) — KHÔNG tự xoá, cần xử lý tay riêng.`,
          );
          publishedCount++;
          continue;
        }
        safeToDelete.push(dropSlug);

        const merged = keepEntity.thumbnail ? keepEntity.thumbnail : dropEntity.thumbnail;
        if (merged && merged !== keepEntity.thumbnail) patch.thumbnail = merged;
        if (keepEntity.lat === null && dropEntity.lat !== null) {
          patch.lat = dropEntity.lat;
          patch.lng = dropEntity.lng;
          patch.googleMapsUrl = dropEntity.googleMapsUrl;
        }
        if (!keepEntity.addressNew && dropEntity.addressNew) patch.addressNew = dropEntity.addressNew;
        if (!keepEntity.contactPhone && dropEntity.contactPhone) patch.contactPhone = dropEntity.contactPhone;
        if (!keepEntity.contactWebsite && dropEntity.contactWebsite)
          patch.contactWebsite = dropEntity.contactWebsite;
        if ((keepEntity.gallery?.length ?? 0) === 0 && (dropEntity.gallery?.length ?? 0) > 0) {
          patch.gallery = dropEntity.gallery;
        }
        const mergedTypes = new Set([...(keepEntity.types ?? []), ...(dropEntity.types ?? [])]);
        if (mergedTypes.size !== (keepEntity.types?.length ?? 0)) patch.types = Array.from(mergedTypes);
        const mergedTags = new Set([...(keepEntity.tags ?? []), ...(dropEntity.tags ?? [])]);
        if (mergedTags.size !== (keepEntity.tags?.length ?? 0)) patch.tags = Array.from(mergedTags);
        const existingUrls = new Set((keepEntity.aiReferenceUrls ?? []).map((r) => r.url));
        const newUrls = (dropEntity.aiReferenceUrls ?? []).filter((r) => !existingUrls.has(r.url));
        if (newUrls.length > 0) {
          patch.aiReferenceUrls = [...(keepEntity.aiReferenceUrls ?? []), ...newUrls];
        }

        console.log(
          `[Gộp] "${dropEntity.name}" (${dropSlug}) -> "${keepEntity.name}" (${keep})` +
            (Object.keys(patch).length > 0 ? ` — bù trường: ${Object.keys(patch).join(", ")}` : " — không có gì để bù"),
        );
      }
      if (Object.keys(patch).length > 0) updates.push({ slug: keep, patch });
    }

    console.log(
      `\n=== Tổng: ${MERGES.length} nhóm gộp, ${safeToDelete.length}/${allDropSlugs.length} slug sẽ bị xoá ` +
        `(${missingCount} không tìm thấy, ${publishedCount} đã publish bị loại khỏi lượt này) ===`,
    );

    if (!apply) {
      console.log('\n[Dry-run] Chưa ghi gì. Chạy lại với --apply để ghi thật.');
      return;
    }

    await dataSource.manager.transaction(async (manager) => {
      for (const { slug, patch } of updates) {
        await manager.getRepository(DestinationMirrorEntity).update({ slug }, patch);
      }
      const toDelete = safeToDelete;
      if (toDelete.length === 0) return;
      await manager.query(
        `DELETE FROM dichoithoi_destination_relations WHERE source_slug = ANY($1) OR target_slug = ANY($1)`,
        [toDelete],
      );
      await manager.query(
        `DELETE FROM dichoithoi_poi_distances WHERE poi_a_slug = ANY($1) OR poi_b_slug = ANY($1)`,
        [toDelete],
      );
      await manager.query(
        `DELETE FROM dichoithoi_cluster_distances WHERE cluster_a_slug = ANY($1) OR cluster_b_slug = ANY($1)`,
        [toDelete],
      );
      await manager.query(`DELETE FROM hotel_destination_map WHERE destination_slug = ANY($1)`, [toDelete]);
      await manager.query(`DELETE FROM tour_destination_map WHERE destination_slug = ANY($1)`, [toDelete]);
      await manager.query(`DELETE FROM destination_tickets WHERE destination_slug = ANY($1)`, [toDelete]);
      await manager.query(
        `DELETE FROM dichoithoi_destination_ai_extractions WHERE destination_slug = ANY($1)`,
        [toDelete],
      );
      await manager.query(
        `UPDATE products SET tags = COALESCE(
           (SELECT array_agg(t) FROM unnest(tags) t WHERE t <> ALL($1)), '{}'
         ) WHERE tags && $1`,
        [toDelete],
      );
      await manager.query(`DELETE FROM dichoithoi_destinations WHERE slug = ANY($1)`, [toDelete]);
    });

    console.log(
      `\nĐã ghi: bù dữ liệu ${updates.length} điểm giữ lại, xoá ${safeToDelete.length} điểm trùng ` +
        `(cascade quan hệ/khoảng cách/hotel-tour-map/vé/ai-extraction/tags sản phẩm).`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error("LỖI:", err);
  process.exit(1);
});
