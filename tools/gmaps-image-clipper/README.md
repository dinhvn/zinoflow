# Google Maps Image Clipper (dichoithoi)

Extension Chrome/Edge nội bộ, có 2 cách nạp ảnh vào cùng 1 cửa sổ Crop để
chỉnh sáng-tương phản-rực màu-làm nét → copy → dán thẳng vào CMS zinoflow
(`?tab=images`, cả Ảnh đại diện lẫn Thư viện ảnh đều đã hỗ trợ Ctrl+V):

1. **Từ Google Maps** — rê chuột qua ảnh sẽ hiện nút nổi **"✂ Cắt ảnh
   này"**, bấm nút đó thì ảnh tự nạp vào cửa sổ Crop.
2. **Từ bất kỳ đâu khác** — copy 1 ảnh (chụp màn hình, ảnh từ website khác,
   ảnh từ ứng dụng khác...) rồi bấm vào cửa sổ Crop, **Ctrl+V** để dán thẳng
   vào, không cần đi qua Google Maps.

Không dùng chuột phải (context menu) vì Google Maps tự chặn sự kiện
`contextmenu` trên ảnh — menu chuột phải của extension không hiện được.
Không bắt trực tiếp sự kiện click trên ảnh vì nhiều ảnh trong Maps là
`<div>` có `background-image` (lazy-load) chứ không phải thẻ `<img>` — nút
nổi dò cả 2 kiểu nên chắc ăn hơn.

Nút nổi hoạt động y hệt ở cả 2 chỗ: ảnh nhỏ trong danh sách/dải ảnh, lẫn ảnh
lớn khi đã bấm vào xem chi tiết (lightbox).

**Chỉ theo dõi chuột khi cửa sổ Crop đang mở.** Lúc duyệt Maps bình thường
(chưa mở cửa sổ Crop), extension không đăng ký bất kỳ listener theo dõi
chuột nào cả — mở cửa sổ Crop thì mọi tab Maps đang mở mới bắt đầu theo dõi
(và tự tắt lại ngay khi đóng cửa sổ Crop), nên không tốn tài nguyên lúc
không dùng tới.

## Cài đặt (load unpacked — chưa lên Chrome Web Store)

1. Mở `chrome://extensions` (hoặc `edge://extensions`).
2. Bật **Chế độ dành cho nhà phát triển / Developer mode** (góc trên phải).
3. Bấm **Tải tiện ích đã giải nén / Load unpacked**, chọn đúng thư mục này
   (`tools/gmaps-image-clipper`).

## Cách dùng

1. Bấm icon extension trên toolbar Chrome để mở **cửa sổ Crop** (cửa sổ nhỏ
   riêng, có thể để mở suốt trong lúc làm việc).
2. Nạp ảnh vào bằng 1 trong 2 cách:
   - **Từ Google Maps**: mở Maps ở 1 tab, rê chuột qua ảnh (thumbnail trong
     dải ảnh, hoặc ảnh đang xem phóng to đều được) — 1 nút xanh **"✂ Cắt ảnh
     này"** hiện ở góc ảnh, bấm vào nút đó. Ảnh tự động nạp vào cửa sổ Crop
     đang mở, nút đổi thành "Đã gửi ✓" để xác nhận.
   - **Từ nguồn khác**: copy 1 ảnh ở bất kỳ đâu (screenshot, ảnh trên
     website khác...), bấm vào cửa sổ Crop rồi **Ctrl+V**.
3. Trong cửa sổ Crop:
   - Chọn **Khung ảnh** (Ảnh đại diện 16:9 / Ảnh thư viện 4:3 / Vuông 1:1)
     khớp với chỗ định dán trong CMS.
   - Kéo chuột trong khung để di chuyển, lăn chuột (hoặc slider Zoom) để
     phóng to/thu nhỏ vùng crop.
   - Bấm 1 trong 3 nút **mode tự động** (Tự động / Rực rỡ / Rõ nét) để hệ
     thống tự tính sáng/tương phản/rực màu/làm nét dựa trên ảnh hiện tại —
     sau đó vẫn chỉnh tay thêm qua slider nếu cần.
   - Bấm **Copy ảnh**.
4. Chuyển qua tab CMS đang mở `?tab=images`, bấm vào khung tải ảnh rồi
   **Ctrl+V**.

## Lấy ảnh chất lượng cao nhất

Mỗi lần chọn ảnh, extension tự thử tải lần lượt theo thứ tự: `=s0` (thường
là bản gốc/lớn nhất Google cho phép) → `=s2400` → `=s1600` → link gốc không
đổi tham số — dùng ngay bản đầu tiên tải thành công. Dòng trạng thái trong
cửa sổ Crop cho biết đã lấy được bản nào ("Đã tải ảnh chất lượng cao nhất"
hoặc "đã dùng phương án dự phòng"). Không phải ảnh nào Google cũng cho phép
`=s0`/`=s2400` (nhất là ảnh người dùng tự đóng góp) nên các mức thấp hơn là
để đảm bảo luôn tải được ảnh, không phải lỗi.

## Nếu ảnh tải lỗi hoặc mờ

Nếu cả 4 mức trên đều lỗi, mở phần **"Ảnh tải lỗi / mờ? Thử cách khác"**
trong panel:

- **Dùng link ảnh gốc (không upsize)** — tải lại đúng kích thước Google trả
  ban đầu (thường là ảnh nhỏ trong lightbox/thumbnail).
- **Dán URL ảnh khác** — chuột phải ảnh trên Maps → "Sao chép địa chỉ hình
  ảnh" (nếu trình duyệt vẫn cho phép mục này dù menu bị Maps can thiệp), dán
  vào ô rồi bấm Tải.

## Giới hạn hiện tại (biết trước, chưa cần sửa nếu chưa vướng)

- Nút nổi chỉ hiện khi rê chuột trúng phần tử (hoặc cha/con gần nó) có ảnh
  từ `googleusercontent.com`/`ggpht.com` rộng/cao ≥ 64px — lọc bớt avatar
  người đánh giá (thường nhỏ hơn), nhưng vẫn có thể thỉnh thoảng bắt nhầm 1
  avatar lớn; vô hại, chỉ cần rê sang đúng ảnh muốn rồi bấm lại.
- Cuộn trang trong lúc nút đang hiện sẽ ẩn nút (vị trí tính theo toạ độ màn
  hình, cuộn xong bị lệch) — rê chuột lại là nút hiện đúng vị trí mới.
- Chưa test thực tế trên trình duyệt mức độ Google cho phép `=s0`/`=s2400`
  với mọi loại ảnh — cơ chế tự thử-lần-lượt ở trên là để giảm rủi ro này,
  nhưng vẫn nên để ý dòng trạng thái xem có đang dùng bản dự phòng không.
- Chỉ chạy trên `https://www.google.com/maps*`. Nếu dùng Maps qua domain
  khác (vd `maps.google.com` redirect) cần mở lại đúng URL `google.com/maps`
  để content script hoạt động.
- Chưa đăng ký icon riêng (dùng icon mặc định của Chrome cho extension chưa
  có icon) — không ảnh hưởng chức năng, chỉ là thẩm mỹ.
