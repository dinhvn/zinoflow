Nếu không có một **tiêu chí định lượng mang tính pháp lý/khách quan** (như Bằng xếp hạng Di tích), cả người nhập liệu lẫn AI chắc chắn sẽ rơi vào bẫy cảm tính: *"Chùa này cổ và đẹp quá ➔ gán cả Di tích lẫn Kiến trúc"*, dẫn đến việc Type `cong-trinh-kiet-tac` lại tiếp tục biến thành "thùng rác" gom dữ liệu.

Dưới đây là **Luật phân định cứng (Hard Rule Logic)** để bổ sung trực tiếp vào tài liệu thiết kế hệ thống (`destination-spec.md`) và Prompt chỉ thị cho AI:

---

## 📐 BỘ LUẬT PHÂN ĐỊNH CỨNG: `di-tich-lich-su` vs `cong-trinh-kiet-tac`

### 1. Luật cốt lõi (Boolean Logic)

$$\text{PrimaryType} = \begin{cases} \text{di-tich-lich-su} & \text{nếu } \text{is\_classified\_heritage} = \text{TRUE} \\ \text{cong-trinh-kiet-tac} & \text{nếu } \text{is\_classified\_heritage} = \text{FALSE} \text{ AND } \text{nature} = \text{Architecture/Engineering/Landmark} \end{cases}$$

Trong đó:

* **`is_classified_heritage = TRUE`**: Điểm đến **đã có văn bản/quyết định xếp hạng chính thức** từ cơ quan nhà nước (Di sản Thế giới UNESCO, Di tích Quốc gia Đặc biệt, Di tích Quốc gia, hoặc Di tích cấp Tỉnh/Thành phố).
* **`is_classified_heritage = FALSE`**: Điểm đến **chưa/không có xếp hạng di tích**, giá trị cốt lõi đến từ thẩm mỹ thiết kế, kỷ thuật xây dựng, độ cao/độ hoành tráng hoặc tính biểu tượng đô thị đương đại.

---

### 2. Thuật toán rẽ nhánh 3 bước (Decision Tree cho AI / Biên tập viên)

```text
[BƯỚC 1: Kiểm tra Bằng xếp hạng Di tích Chính thức]
  │
  ├── 🟢 CÓ (UNESCO / Quốc gia Đặc biệt / Quốc gia / Cấp Tỉnh)
  │     │
  │     ├── Nếu bản chất là Chùa/Đền/Nhà thờ ➔ Primary: [chua-den-mieu] / [nha-tho-cong-giao]
  │     │                                     Secondary: [di-tich-lich-su]
  │     │
  │     └── Tất cả các trường hợp còn lại   ➔ Primary: [di-tich-lich-su]
  │                                           Secondary (nếu đẹp/độc đáo): [cong-trinh-kiet-tac]
  │
  └── 🔴 KHÔNG CÓ BẰNG XẾP HẠNG
        │
        └── Kiểm tra công trình có giá trị biểu tượng/kiến trúc/kỹ thuật?
              │
              ├── CÓ (Landmark, Cầu, Tòa nhà, Biệt thự lạ...) ➔ Primary: [cong-trinh-kiet-tac]
              └── KHÔNG ➔ Xem xét gán sang Type khác (vd: [cho-pho-dem-am-thuc], [khu-vui-choi-cong-vien])

```

---

### 3. Ma trận kiểm thử thực tế (Test Cases Validation)

Áp dụng bộ luật cứng này vào các trường hợp "nhạy cảm" dễ gây tranh cãi nhất tại Việt Nam:

| POI thực tế | Tình trạng pháp lý di tích (`is_classified_heritage`) | PrimaryTypeId (Loại chính) | SecondaryTypeId (Loại phụ) | Lý do xử lý theo Luật |
| --- | --- | --- | --- | --- |
| **Dinh Độc Lập** | **CÓ** *(Di tích Quốc gia Đặc biệt)* | `di-tich-lich-su` | `cong-trinh-kiet-tac` | Có bằng xếp hạng di tích ➔ Bắt buộc lấy Di tích làm Primary. |
| **Bưu điện Trung tâm TP.HCM** | **CÓ** *(Di tích Kiến trúc Nghệ thuật cấp Quốc gia)* | `di-tich-lich-su` | `cong-trinh-kiet-tac` | Dù là biểu tượng check-in, nhưng có bằng Di tích ➔ Di tích ưu tiên số 1. |
| **Cầu Long Biên (Hà Nội)** | **CÓ** *(Di tích Lịch sử cấp Thành phố)* | `di-tich-lich-su` | `cong-trinh-kiet-tac` | Đã thuộc danh mục di tích bảo tồn của Hà Nội. |
| **Landmark 81 / Bitexco** | **KHÔNG** | `cong-trinh-kiet-tac` | *(Không)* | Công trình hiện đại, giá trị kỹ thuật/độ cao, không phải di tích. |
| **Biệt thự Hằng Nga (Crazy House Đà Lạt)** | **KHÔNG** | `cong-trinh-kiet-tac` | *(Không)* | Độc đáo về kiến trúc nhưng không phải di tích xếp hạng. |
| **Cầu Vàng (Bà Nà Hills)** | **KHÔNG** | `khu-vui-choi-cong-vien` | `cong-trinh-kiet-tac` | Nằm trong quần thể vui chơi đóng vé thương mại. |
| **Chùa Bái Đính cổ** | **CÓ** *(Di tích Quốc gia)* | `chua-den-mieu` | `di-tich-lich-su` | Ưu tiên bản chất tâm linh trước ➔ Di tích xếp thứ 2. |

---

## 📝 Đoạn Rule chuẩn hóa (Copy trực tiếp vào System Prompt / CMS Guideline)

Bạn có thể đưa trực tiếp đoạn quy định này vào tài liệu hướng dẫn hoặc System Prompt cho AI gán dữ liệu:

> **RULE PHÂN ĐỊNH `di-tich-lich-su` VÀ `cong-trinh-kiet-tac`:**
> 1. **`di-tich-lich-su`**: BẮT BUỘC điểm đến phải thuộc danh mục Di tích được Nhà nước xếp hạng chính thức (Di sản UNESCO, Di tích Quốc gia Đặc biệt, Di tích Quốc gia, Di tích Cấp Tỉnh/Thành phố). Không tự ý gán Type này dựa trên cảm tính "thấy nó cổ/có vẻ lịch sử".
> 2. **`cong-trinh-kiet-tac`**: Dành cho các công trình nhân tạo (cầu, tháp, biệt thự, quảng trường, tòa nhà) có giá trị cao về mặt thiết kế, thẩm mỹ, kỹ thuật xây dựng hoặc biểu tượng đô thị nhưng KHÔNG CÓ BẰNG XẾP HẠNG DI TÍCH (hoặc là di tích nhưng lấy giá trị kiến trúc làm Secondary).
> 3. Nếu một POI vừa là di tích xếp hạng vừa có kiến trúc xuất sắc (vd: Dinh Độc Lập, Bưu điện TP.HCM): Gán `PrimaryTypeId = di-tich-lich-su` và `SecondaryTypeId = cong-trinh-kiet-tac`.
> 
>