Background: Tôi là một lập trình viên có kinh nghiệm hơn 10 năm.
Tôi đang làm affiliate, nhưng thu nhập hiện tại không cao.
Đây là cách hiện tại tôi đang làm:

Tôi làm affiliate trên nhiều nền tảng

1. accesstrade -> Đây là nền tảng affiliate lớn, có rất nhiều nhãn hàng

2. Trực tiếp với Shopee



Tôi đã tự xây dựng hệ thống của riêng mình như sau (Tôi build lâu rồi, từ lúc chưa có Copilot):

Hiện tại tôi đang có 2 websites phục vụ affiliate: cả 2 websites này đều làm bằng wordpress (Tôi tự code theme)

1. https://laruki.com -> Chuyên về lĩnh vực thời trang (Quần áo, giày dép, túi), làm đẹp

2. https://dochoi3s.com/ -> Chuyên về đồ chơi cho trẻ em.

Các bài viết trên các websites này là giới thiệu, danh sách sản phẩm kèm theo. Hãy truy cập để hiểu thêm



Ngoài ra, tôi còn có 1 CMS dùng để quản lý data tập trung, nội dung, sản phẩm,... Các chức năng chính như sau:

1. Quản lý chiến dịch tham gia (Call API tới accesstrade để cập nhật trạng thái chiến dịch) để biết status chiến dịch để điều hướng traffic.

2. Quản lý danh sách promotion của từng thương hiệu -> Tôi nhập danh sách trong google sheet sau đó import vào

3. Cào và quản lý product

- Tôi sẽ cào theo danh sách link có sẵn. có lọc theo điều kiện muốn theo setting trong link

- Import các product cố định, product này tôi nhập trong google sheet và import vào.

Việc cào product này sẽ được cào tự động vào 0h mỗi ngày hoặc tôi tự bấm nút

4. Bài Posts -> Tôi sẽ lưu toàn bộ bài viết trên 2 websites laruki và dochoi3s, mỗi bài sẽ có cấu hình riêng, ví dụ bài post thì liên quan tới chiến dịch nào, supllier nào, tag nào, tự động cập nhật khi nào, hàng ngày, đầu tháng,...

5. Post tag content -> Ở đây tôi sẽ có nhiều tag, các tag này sẽ được sự dụng trong bài viết

Ví dụ:  Product_[options] trong đó option có thể là SupplierCode,CategoryCode,ProductTag,NumberProduct. Trong bài viết, tôi sẽ chèn tag như sau: [Product_ProductTag:innisfree-jeju]. => Hệ thống nếu gặp tag này sẽ tự động replace thành 1 product theo cấu hình với template code sẵn.

Tương tự các tag như sau: ProductList_[options] => hiện danh sánh product. Link_[options] -> hiện link

Cách thức hoạt động xem sau

6. Tools

- Tool tự tạo ảnh từ các product để đăng lên facebook fanpage và group

7. Manage

- Quản lý log (log việc cào data, việc post bài,...)

- Catagory

- ...

CMS này tôi code bằng Net core 9, database dùng SQL server, chạy trên Azure

Hệ thống đang tự động như sau

- Cào data hàng ngày (Cào từ các website như Juno, Vascara,...), chạy vào mỗi 0h đêm hoặc theo scheduler mỗi supplier đã setting.

- Tự động cập nhật bài viết trên laruki và dochoi3s tự động theo cài đặt. Khi cập nhật sẽ replace các tag trong bài viết. Các sản phẩm sẽ được cập nhật với dữ liệu mới nhất. CMS sẽ tự động replace và tạo thành 1 bài post dạng html thuần -> Sau đó Call wordpress API để update bài viết tự động.



Tóm gọn: CMS là một nơi xử lý data trung tâm, sau đó push data lên các website để người dùng truy cập, tôi sẽ kiếm tiền từ các website này.



Note: Một số website sẽ chặn việc cào data tự động khắt khe như shopee, lazada. tự động sẽ rất khó vượt qua lớp bảo vệ và dễ bị chặn, hoạt động không ổn định => Nên tôi đã viết 1 chrome extension để cào data những web này một cách thủ công. Data cào từ extension cũng sẽ call API của CMS để update vô database.



Tôi có 1 fanpage 10k follower và 1 facebook group về thanh lý giày túi với 45k thành viên.



Vấn đề hiện tại: Số lượng bài viết trên laruki và dochoi3s đang rất ít, do tôi phải tự viết bài, chèn tag, kiếm sản phẩm, sau đó cài đặt để cms update tự động.



Mục tiêu: Tôi có kĩ thuật, có hệ thống có sẵn, bây giờ là thời đại AI, tôi muốn tận dụng thế mạnh AI để tăng thu nhập thụ động.



- Tôi muốn có 1 hệ thống quản lý phục vụ cho việc kiếm tiền của tôi, tương lai có thể là tất cả những gì liên quan tới tôi (tiền bạc, công việc cá nhân,....). Nó giống như 1 nơi mà tôi có thể quản lý và điều khiển mọi thứ

- Các bài viết trên laruki, dochoi3s tôi muốn bán tự động, tự động, làm tay,...

- Có ai phân tích, tạo content tự động



Hãy giúp tôi phân tích, khai phá, mở rộng, gợi ý, định hướng để làm sao tôi làm affiliate hiệu quả



Nếu xây dựng hệ thống thì xây như thế nào, công nghệ gì, hệ thống phải có thể mở rộng để giải quyết các vấn đề trên. (Tôi sẽ dùng copilot để code)



Một số câu hỏi

- Làm sao để SEO hiệu quả khi nội dung tự động, xuất hiện trên google search

- Có hệ thống AI nào có sẵn, miễn phí hỗ trợ việc trên

- Nếu tự xây thì sao? (dùng copilot), 


Tôi muốn bạn và tôi cùng phân tích thật kỹ trước khi bắt đầu thực hiện 


## Dinh huong chot hien tai (11/06/2026) — THAY THE dinh huong 31/05

- Muc tieu truoc mat: build AI Content Tool truoc, sau do mo rong Image Tool va cac tinh nang nang cao.
- Van dung data san pham tu he thong cu (.NET CMS tren Azure) qua API, khong dung vao CMS cu.
- Co che van hanh: bam chay thu cong (on-demand), human review truoc khi publish WordPress.

Cong nghe (da chot):
- Stack: Node.js monorepo (pnpm workspaces).
- Backend: NestJS (REST API) + TypeORM, clean architecture theo module.
- Frontend: Next.js App Router + Tailwind + shadcn/ui, UI/UX hien dai.
- Database: PostgreSQL cai truc tiep tren may local (KHONG dung Docker - may yeu).
- Queue: pg-boss (chay tren Postgres, khong can Redis).
- AI: multi-provider, chon duoc provider/model khi tao content (Claude, ChatGPT, ...).

Tai lieu chi tiet: docs/tech-recommendation-web-mvp.md va docs/specs/

Luu y: docs/blueprint-local-first.md (huong .NET) da LOI THOI, chi giu de tham khao.

## Dinh huong mo rong (12/06/2026) — dichoithoi.com (diem den du lich)

Boi canh: website thu 3 — https://dichoithoi.com/ — chuyen ve diem du lich Viet Nam
(.NET + SQL Server tren site4now.net, source: `D:\Gits\mmo\dichoithoi`).
Hien tai diem den viet tay trong Google Sheet → CMS import (xoa toan bo + insert lai)
→ website hien thi tai `/diem-den/{slug}`. CMS luc import tu dong replace ten diem den
trong bai thanh link noi bo (bai A nhac diem B → B thanh link).

Quyet dinh:
1. Them tinh nang trong AI Content Tool: tao bai diem den bang AI theo format chuan SEO,
   giong nguoi viet that — menu rieng vi luong data khac bai affiliate.
2. Ngoai tao moi, co nut "Cap nhat bai" cho diem den da co (thu cong truoc,
   tu dong de giai doan sau).
3. AI tool tro thanh noi quan ly TOAN BO bai viet dichoithoi; duyet xong ghi
   TRUC TIEP vao SQL Server cua website — bo qua Google Sheet va CMS import.
   He qua: sau go-live phai ngung dung nut import tren CMS cu (import la wipe-all,
   se xoa mat bai do AI tool tao).
4. Giu va port co che auto-link quan he diem den sang AI tool (chay luc publish
   + job re-link toan bo). Quan he diem den luu tuong minh trong AI tool
   (bang destination_relations), KHONG doi schema website o MVP.

Input cho 1 bai diem den (nguoi dung cung cap, AI viet them tu kien thuc nen):
- Ten; dia chi (ca dia chi cu VA moi sau sap nhap tinh/thanh); vi tri + khoang cach
  toi trung tam; lien he (dien thoai, website); gio mo cua; gia ve;
  thong tin tong quat; diem den lien quan.
- Gia ve / gio mo cua: tu nhap HOAC dua URL website tham khao de tool tu lay
  (moi truong co the co nguon tham khao rieng).

Khung noi dung "ai cung can" (phan tich chi tiet o spec §2.2): tong quan, vi tri &
di chuyen, gio mo cua & gia ve, trai nghiem/choi gi, mon an/dac san, thoi diem dep,
luu tru, meo & luu y, FAQ, diem den gan do.

Kiem tien tren bai diem den:
- Khach san: website da co module hotel theo HotelGroupId (MyTour) — bai AI gan dung
  HotelGroupId, muc "Luu tru" dan nguoi doc xuong khu khach san.
- Ve online/tour: nhap link affiliate (bookingUrl) → bai chen CTA "Mua ve online"
  canh muc gia ve.

Cap nhat 12/06/2026 (chot sau phan tich):
- UU TIEN lam tinh nang nay TRUOC WordPress publish → milestone M4
  trong `docs/specs/ai-content-delivery-plan.md` (WordPress lui ve M5, hardening M6).
- DAI TU website dichoithoi: thiet ke lai database tu dau (uu tien toc do render),
  nguoi dung se viet lai website hien thi theo schema moi —
  chi tiet `docs/dichoithoi/dichoithoi-database-redesign.md`.
  (Phuong an additive trong spec §11 da bi thay the boi quyet dinh dai tu nay.)
- Da xac nhan ket noi duoc SQL Server site4now.net tu may local.

Cap nhat tiep 12/06/2026:
- Website van la .NET cu (chi sua tang doc theo schema moi).
- AI tool dam nhan vai tro CMS cho noi dung diem den; CMS cu chi con cac module
  chua migrate (Hotel/Tour/Sim/Phuot/Post), module Destination tat vinh vien.

Cac quyet dinh chi tiet da chot trong cung ngay (chi tiet o specs):
- UI AI tool: khu "Dichoithoi" rieng tren sidebar (Diem den / Taxonomy / Review /
  Cong cu), man review tai dung pipeline ai-content — destination-spec §7.
- Co che 2 database: Postgres = xuong soan thao (draft/version/review),
  SQL Server = read-model production chi chua ban da duyet; publish co 2 chot
  TAY rieng biet (Approve nội dung ≠ Publish len web) — system-overview §2.1.
- 3 job van hanh (re-link, recompute related, dong bo mirror): idempotent,
  pg-boss, co dry-run + phat hien sua ngoai luong bang content hash —
  destination-spec §12.
- Dia chi cu + moi sau sap nhap: website hien thi CA HAI; seed dataset dvhcvn
  (admin_provinces/admin_wards/admin_ward_mappings) vao Postgres de map
  tu dong — destination-spec §13.
- Anh diem den: tach khoi deploy source (FTP rieng), DB luu path tuong doi,
  folder theo slug 3 co anh (hero/thumb/in-bai), Cloudflare free cache edge;
  giai doan 2: tab "Anh" upload + AI goi y danh sach anh/alt text;
  LAM SAU: remark tren anh (watermark/caption) — destination-spec §14.

Tai lieu vao cua: `docs/dichoithoi/dichoithoi-system-overview.md` (kien truc 3 thanh phan,
lo trinh) → `dichoithoi-database-redesign.md` (schema moi) →
`dichoithoi-destination-spec.md` (tinh nang trong AI tool).