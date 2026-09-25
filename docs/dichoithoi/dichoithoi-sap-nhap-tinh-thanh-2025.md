# Sáp nhập tỉnh/thành 2025 — bảng đối chiếu tỉnh cũ → tỉnh mới

Việt Nam sáp nhập đơn vị hành chính cấp tỉnh từ **63 xuống còn 34 tỉnh/thành
phố**, có hiệu lực từ **01/07/2025**. Tài liệu này là bảng đối chiếu chính
thức (không phải giả định) — trích trực tiếp từ dữ liệu đã seed trong
`admin_ward_mappings` (Postgres, seed bởi `apps/api/scripts/seed-dvhcvn.ts`
từ nguồn dữ liệu hành chính chính thức), ghi ngày 15/08/2026.

**Tại sao quan trọng cho dichoithoi**: hệ thống Nhóm/Cụm/Điểm đến của
dichoithoi tổ chức theo tỉnh (`kind=province`, 34 dòng khớp đúng bảng dưới
đây). Khi phân tích/gợi ý bất kỳ việc gì liên quan tới "tỉnh" — chuẩn hoá dữ
liệu theo tỉnh, gom cụm, kiểm tra POI có nằm đúng tỉnh không — PHẢI dùng
bảng 34 tỉnh MỚI này làm đơn vị, không dùng 63 tỉnh cũ. Nội dung bài viết
(mô tả, tiêu đề) nhắc tới địa danh theo tên tỉnh cũ (vd "Bắc Giang", "Bình
Thuận") vẫn đúng về mặt lịch sử/thói quen gọi tên, không cần sửa hết, nhưng
cấu trúc dữ liệu (Destination.ProvinceCode, cụm, breadcrumb) phải theo tỉnh
mới.

## Bảng đối chiếu đầy đủ (34 tỉnh/thành mới)

| Tỉnh/thành mới | Gồm các tỉnh/thành cũ |
|---|---|
| An Giang | An Giang, Kiên Giang |
| Bắc Ninh | Bắc Giang, Bắc Ninh |
| Cà Mau | Bạc Liêu, Cà Mau |
| Cao Bằng | Cao Bằng *(giữ nguyên)* |
| Đắk Lắk | Đắk Lắk, Phú Yên |
| Điện Biên | Điện Biên *(giữ nguyên)* |
| Đồng Nai | Bình Phước, Đồng Nai |
| Đồng Tháp | Đồng Tháp, Tiền Giang |
| Gia Lai | Bình Định, Gia Lai |
| Hà Tĩnh | Hà Tĩnh *(giữ nguyên)* |
| Hưng Yên | Hưng Yên, Thái Bình |
| Khánh Hòa | Khánh Hòa, Ninh Thuận |
| Lai Châu | Lai Châu *(giữ nguyên)* |
| Lâm Đồng | Bình Thuận, Đắk Nông, Lâm Đồng |
| Lạng Sơn | Lạng Sơn *(giữ nguyên)* |
| Lào Cai | Lào Cai, Yên Bái |
| Nghệ An | Nghệ An *(giữ nguyên)* |
| Ninh Bình | Hà Nam, Nam Định, Ninh Bình |
| Phú Thọ | Hoà Bình, Phú Thọ, Vĩnh Phúc |
| Quảng Ngãi | Kon Tum, Quảng Ngãi |
| Quảng Ninh | Quảng Ninh *(giữ nguyên)* |
| Quảng Trị | Quảng Bình, Quảng Trị |
| Sơn La | Sơn La *(giữ nguyên)* |
| Tây Ninh | Long An, Tây Ninh |
| Thái Nguyên | Bắc Kạn, Thái Nguyên |
| Thanh Hóa | Thanh Hóa *(giữ nguyên)* |
| TP. Cần Thơ | Cần Thơ, Hậu Giang, Sóc Trăng |
| TP. Đà Nẵng | Đà Nẵng, Quảng Nam |
| TP. Hà Nội | Hà Nội *(giữ nguyên)* |
| TP. Hải Phòng | Hải Phòng, Hải Dương |
| TP. Hồ Chí Minh | TP. Hồ Chí Minh, Bà Rịa - Vũng Tàu, Bình Dương |
| TP. Huế | Huế *(giữ nguyên)* |
| Tuyên Quang | Hà Giang, Tuyên Quang |
| Vĩnh Long | Bến Tre, Trà Vinh, Vĩnh Long |

*(11 tỉnh/thành giữ nguyên không sáp nhập, 23 tỉnh/thành hình thành từ việc
gộp 2-3 tỉnh cũ.)*

## Cách tra cứu chi tiết hơn (cấp xã/phường)

Bảng trên là tổng hợp ở cấp tỉnh. Việc sáp nhập còn diễn ra ở cấp xã/phường
(nhiều xã cũ gộp thành 1 xã/phường mới) — chi tiết đầy đủ nằm trong bảng
`admin_ward_mappings` (cột `old_ward_name`/`old_district_name`/
`old_province_name` → `new_ward_name`/`new_province_name`), dùng qua UI
`/dichoithoi/tra-cuu-dia-chi` hoặc API
`DestinationMirrorRepository.listAddressMappings()`.

## Liên quan

- [[dichoithoi-taxonomy-redesign-chot-chua-build]] — hệ Nhóm/Type/Tag thiết
  kế cho quy mô toàn quốc, không phụ thuộc ranh giới tỉnh cũ/mới.
- Kế hoạch chuẩn hoá POI/cụm theo từng tỉnh (đang bàn 15/08/2026) phải dùng
  đúng 34 tỉnh trong bảng này làm đơn vị chia việc.
