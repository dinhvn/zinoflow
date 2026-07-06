# Note chỉnh sửa DiChoiThoi.Web — ảnh điểm đến theo solution mới (07/2026)

Ghi chú cho người sửa repo `D:\Gits\mmo\dichoithoi` (zinoflow KHÔNG sửa repo đó).
Mục tiêu: website đọc đường dẫn ảnh từ **cột DB Thumbnail** thay vì suy từ Id,
để khớp convention mới `diem-den/{slug}/hero|medium|thumb.webp` mà zinoflow upload
qua FTP (spec §14 — `dichoithoi-destination-spec.md`).

## Hiện trạng (soi code 07/2026)

| Vị trí | Hiện tại |
|---|---|
| `Program.cs:80-83` | Serve tĩnh thư mục `contents/` tại root URL → `/diem-den/...` = `contents/diem-den/...` |
| `contents/diem-den/` | 278 ảnh full `{slug}.webp` + 277 thumb `thumbnail/{slug}.webp` — nằm TRONG source, deploy = upload cả folder |
| `DiChoiThoi.Common/DbEntities/Destination.cs` | KHÔNG có cột `Thumbnail` |
| `DiChoiThoi.Service/Repositories/Destination/DestinationRepository.cs:45` | `Image = x.des.Id + ".webp"` — hardcode từ Id |
| Views list (4 chỗ) | hardcode `"../diem-den/thumbnail/" + item.Id + ".webp"` |
| `Views/Destination/Detail.cshtml:14` | `src="../diem-den/@detail.Image"` (ảnh full) |
| `Utilities/SchemaUtil.cs:69,104` | JSON-LD image = `{host}/diem-den/{Id}.webp` |
| `<img>` mọi nơi | không `width/height`, không `loading="lazy"`, không `srcset` |

Convention MỚI (zinoflow FTP lên): `contents/diem-den/{slug}/hero.webp` (1600w),
`{slug}/medium.webp` (800w), `{slug}/thumb.webp` (400w). Cột `Thumbnail` trong DB
lưu path TƯƠNG ĐỐI dạng `{slug}/thumb.webp`.

## Việc cần sửa (theo thứ tự)

### 1. DB — thêm cột Thumbnail (nếu chưa chạy schema v2)
Nếu đã chạy migration schema v2 (redesign doc §7) thì cột có sẵn, bỏ qua.
Nếu còn schema cũ, chạy tạm để chuyển tiếp:
```sql
ALTER TABLE Destination ADD Thumbnail nvarchar(256) NULL;
```
`NULL` = chưa migrate, website fallback đường dẫn cũ (xem mục 3).

### 2. Entity + Model
- `DiChoiThoi.Common/DbEntities/Destination.cs`: thêm
  `[StringLength(256)] public string Thumbnail { get; set; }`
- `DiChoiThoi.Service/Models/DestinationModel.cs` (+ `DestinationDetailModel`
  nếu tách): đảm bảo có `Thumbnail` (DestinationModel đã có sẵn property này).

### 3. Repository — nguồn sự thật đường dẫn ảnh (QUAN TRỌNG NHẤT)
`DestinationRepository.cs` (mọi query trả Image/Thumbnail):
```csharp
// CŨ  (dòng 45):
Image = x.des.Id + ".webp",

// MỚI — ưu tiên cột DB, fallback layout cũ khi chưa migrate ảnh:
Thumbnail = x.des.Thumbnail,                       // "{slug}/thumb.webp" hoặc NULL
// Ở tầng model/helper (không làm trong SQL):
//   ThumbUrl = Thumbnail != null ? $"/diem-den/{Thumbnail}"
//                                : $"/diem-den/thumbnail/{Id}.webp";
//   HeroUrl  = Thumbnail != null ? $"/diem-den/{Thumbnail.Replace("thumb.webp","hero.webp")}"
//                                : $"/diem-den/{Id}.webp";
```
Khuyến nghị viết 1 helper duy nhất (vd `ImageUrlUtils.Thumb(model)` /
`ImageUrlUtils.Hero(model)`) rồi MỌI view/schema dùng helper đó — hết hardcode rải rác.

### 4. Views — thay 6 chỗ hardcode
Dùng helper ở mục 3, đồng thời đổi URL tương đối `../diem-den/...` thành
tuyệt đối `/diem-den/...` (tránh vỡ khi route sâu):
- `Views/Destination/_DestinationList.cshtml:11`
- `Views/Destination/_ChildDestination.cshtml:11`
- `Views/Shared/_DestinationGroup.cshtml:8`
- `Views/Shared/_DestinationListDetail.cshtml:21`
- `Views/Destination/Detail.cshtml:14` → dùng HERO (không phải thumb)
- `Views/Phuot/Detail.cshtml:191` (khối điểm đến trong bài phượt)

### 5. SEO/JSON-LD
- `Utilities/SchemaUtil.cs:69` và `:104`: image = HERO URL từ helper.
- `Controllers/DestinationController.cs:230` (og:image): HERO URL.

### 6. Tốc độ (spec §14.2 — làm cùng lúc sửa view)
- Mọi `<img>` thẻ card/list: thêm `width`/`height` (chống CLS) + `loading="lazy"`.
- Ảnh hero ở Detail: `fetchpriority="high"`, KHÔNG lazy.
- Card list nên `srcset="{thumb} 400w, {medium} 800w"` khi ảnh mới đã có medium.

### 7. Deploy — ĐỪNG để redeploy xóa ảnh FTP (bẫy lớn nhất)
Ảnh mới do zinoflow FTP lên nằm trong `contents/diem-den/{slug}/` — thư mục này
KHÔNG có trong source. Nếu pipeline deploy kiểu wipe-folder (azure-pipelines.yml)
thì mỗi lần deploy sẽ XÓA toàn bộ ảnh đã upload.
- Cấu hình deploy GIỮ NGUYÊN (không xóa) `contents/diem-den/` — vd tắt
  "Remove additional files at destination", hoặc exclude thư mục này.
- Dài hạn (đúng spec §14.1.1): bỏ hẳn ảnh khỏi source repo, `contents/diem-den`
  chỉ sống trên hosting + bản gốc backup ở máy local.

### 8. Trình tự go-live an toàn
1. Sửa code theo mục 1-6, deploy — fallback giữ nguyên ảnh cũ, CHƯA có gì đổi trên web.
2. zinoflow chạy job migrate ảnh (tải full cũ → 3 cỡ WebP → FTP `{slug}/` → điền
   cột Thumbnail). Điểm nào migrate xong tự chuyển sang path mới nhờ fallback.
3. Kiểm tra ngẫu nhiên list + detail + og:image + JSON-LD.
4. Khi 100% có Thumbnail: xóa nhánh fallback + (tùy chọn) xóa ảnh layout cũ.

## Lưu ý thêm
- Ảnh full cũ có thể < 1600px → hero mới không nét hơn bản gốc (sharp không phóng to).
  Chấp nhận được; điểm quan trọng thay ảnh đẹp sau qua tab upload của zinoflow.
- `thumbnail/` cũ có 277 file / 278 full — có 1 điểm lệch, job migrate nên report
  điểm thiếu ảnh thay vì fail.
