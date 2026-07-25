# Mô tả Nhóm / Type / Tỉnh / Tag cho trang danh mục dichoithoi.com

> Bản đã rà soát 24/07/2026: slug + tên khớp 100% bản chốt
> `dichoithoi-taxonomy-chuan-hoa.md` (4 Nhóm / 18 Type / 17 Tag); mọi địa danh
> nêu làm ví dụ đều ĐÃ XÁC MINH có thật trong `dichoithoi_dev` và được gán
> đúng type/tag/tỉnh tương ứng — không nêu nơi chưa có trong hệ thống.
>
> **Trạng thái nhập liệu (24/07/2026)**: mô tả 4 Nhóm + 18 Type (PHẦN 1-2) và
> 19 Tỉnh có dữ liệu (PHẦN 4) ĐÃ GHI vào `dichoithoi_dev` qua
> `sqlcmd -f 65001` (script `update-taxonomy-descriptions.sql`). Meta
> description của trang web tự cắt ~160 ký tự đầu từ chính các đoạn này
> (SeoTextUtil) — câu đầu mỗi đoạn đã cố tình gói trọn ý chính + từ khoá.
>
> Lưu ý khi dùng:
> - Mô tả Nhóm/Type/Tỉnh: là đoạn giới thiệu trang `/loai/...`, `/tinh/...`
>   (sửa tiếp qua CMS `/dichoithoi/danh-muc`).
> - Mô tả Tag (PHẦN 3): bản 300-450 từ, viết văn xuôi thuần (không bullet/
>   bold) vì trang `/chu-de/{slug}` hiện chỉ render 1 thẻ `<p>` phẳng
>   (`Topic/Detail.cshtml`), markdown/bullet sẽ không hiển thị đúng; mọi địa
>   danh nêu tên đã đối chiếu với danh sách gán tag thật trong
>   `dichoithoi_dev` (không còn ví dụ bịa/không tồn tại). **ĐÃ GHI
>   `Description` vào DB 24/07/2026** (script `update-tag-descriptions.sql`,
>   verify dấu tiếng Việt nguyên vẹn qua CMS `/dichoithoi/chu-de`) — nhưng
>   **CHƯA đổi `Status`** (vẫn draft/chưa mở public như trước khi sửa): bấm
>   "mở trên site" cho từng tag là quyết định publish riêng, làm khi bạn
>   duyệt xong nội dung. Trang chỉ thật sự index khi vừa mở site vừa đủ ≥5
>   điểm gán (content-seo-ux-plan §10.3, database-redesign §3.2.1) — tag
>   `nhom-ban-teambuilding` hiện chỉ có 1 điểm gán nên dù mở site vẫn
>   `noindex`, cần gán thêm điểm trước.
> - 15 tỉnh chưa có điểm đến: giữ NULL — trang `/tinh` của chúng đang
>   `noindex` (0 điểm) nên chưa cần mô tả; soạn khi tỉnh có dữ liệu.

# PHẦN 1: MÔ TẢ 4 NHÓM LỚN (GROUPS)

### 1. Thiên nhiên & Sinh thái (`thien-nhien`)
Các địa điểm du lịch thiên nhiên và sinh thái đẹp nhất Việt Nam: từ biển đảo, núi đèo, thác hồ đến rừng nguyên sinh và miệt vườn sông nước. Nổi bật trong danh mục là thác Bản Giốc, đèo Mã Pí Lèng, đảo Cô Tô hay rừng tràm Trà Sư — mỗi nơi đều có bài giới thiệu riêng kèm địa chỉ, cách di chuyển và thời điểm đẹp trong năm. Phù hợp cho ai muốn rời phố thị để cắm trại, trekking hoặc đơn giản là ngắm cảnh, hít thở không khí trong lành.

### 2. Tâm linh & Tôn giáo (`tam-linh-ton-giao`)
Điểm đến tâm linh và tôn giáo nổi tiếng trên cả nước, từ chùa, đền, miếu cổ kính đến những nhà thờ Công giáo có kiến trúc đặc sắc. Danh mục quy tụ các trung tâm hành hương lớn như quần thể Yên Tử, chùa Bái Đính, Miếu Bà Chúa Xứ Núi Sam hay Nhà thờ Lớn Hà Nội. Dù bạn đi chiêm bái cầu an dịp đầu năm hay muốn tìm hiểu kiến trúc tôn giáo, bài viết từng điểm đều có địa chỉ, giờ mở cửa và lưu ý trang phục đi kèm.

### 3. Văn hóa - Lịch sử (`van-hoa-lich-su`)
Hành trình khám phá di sản văn hóa và lịch sử Việt Nam qua các di tích, thành cổ, bảo tàng, làng nghề và công trình kiến trúc biểu tượng. Những địa danh ghi dấu thời gian như Đại Nội Huế, Hoàng thành Thăng Long, Nhà tù Hỏa Lò hay Dinh Độc Lập đều có mặt tại đây. Danh mục dành cho du khách muốn hiểu sâu về cội nguồn, kiến trúc và văn hóa truyền thống của từng vùng miền.

### 4. Vui chơi & Giải trí (`vui-choi-giai-tri`)
Muốn xả hơi cuối tuần hay lên lịch cho cả nhà đi chơi? Danh mục này gom các khu vui chơi, công viên chủ đề, nông trại, chợ đêm, phố đi bộ và suối khoáng nóng nổi bật trên toàn quốc — từ Bà Nà Hills, Vinpearl Land đến chợ đêm Đà Lạt hay phố đi bộ Nguyễn Huệ. Giờ hoạt động, giá vé tham khảo và kinh nghiệm đi chơi thực tế có trong bài viết chi tiết của từng điểm.

# PHẦN 2: MÔ TẢ 18 LOẠI HÌNH (TYPES)

## 🌿 Nhóm 1: Thiên nhiên & Sinh thái

#### 1. Biển - Bãi tắm - Đảo (`bien-dao`)
Tổng hợp các bãi biển và hòn đảo du lịch đẹp nhất Việt Nam từ Bắc vào Nam: Bãi Sao, Bãi Khem ở Phú Quốc, đảo Cô Tô, đảo Nam Du, Cù Lao Chàm hay biển Mỹ Khê Đà Nẵng. Mỗi bài viết mô tả đặc trưng bãi tắm, cách ra đảo và mùa biển đẹp để bạn chọn đúng nơi cho chuyến nghỉ hè, lặn ngắm san hô hoặc thưởng thức hải sản tươi.

#### 2. Núi - Cao nguyên - Đèo (`nui-cao-nguyen`)
Việt Nam sở hữu những cung đèo hùng vĩ bậc nhất — Mã Pí Lèng, Ô Quy Hồ, Hải Vân — cùng các đỉnh săn mây như Fansipan, Langbiang hay cao nguyên đá Đồng Văn. Danh mục tổng hợp điểm ngắm cảnh đẹp, đặc điểm thời tiết theo mùa và kinh nghiệm di chuyển an toàn cho cả người đi ô tô lẫn dân phượt xe máy.

#### 3. Sông - Suối - Hồ - Thác (`thac-ho-suoi`)
Danh sách sông, hồ, suối và thác nước đẹp tại Việt Nam: thác Bản Giốc hùng vĩ nơi biên giới, hồ Tuyền Lâm và hồ Xuân Hương thơ mộng ở Đà Lạt, sông Hương xứ Huế hay suối nước Moọc trong xanh ở Quảng Bình. Bài viết từng điểm gợi ý mùa nước đẹp, hoạt động chèo thuyền, kayak và lưu ý an toàn khi tắm suối.

#### 4. Hang động (`hang-dong`)
Địa hình đá vôi trải dài khắp Việt Nam tạo nên những hang động kỳ vĩ: Hang Sơn Đoòng — hang động lớn nhất thế giới, động Thiên Đường, động Ngườm Ngao hay hang Phượng Hoàng - suối Mỏ Gà. Mỗi bài viết nêu rõ mức độ dễ hay khó tham quan, có cần đi theo tour dẫn đường không và trang bị nên mang theo.

#### 5. Rừng - Vườn quốc gia (`rung-vuon-quoc-gia`)
Các vườn quốc gia và khu bảo tồn thiên nhiên dành cho người yêu rừng: Cúc Phương, Bạch Mã, rừng tràm Trà Sư, rừng U Minh Hạ hay vườn chim Thung Nham. Đây là nhóm điểm đến lý tưởng để trekking, ngắm chim và động vật hoang dã — kèm quy định tham quan và lưu ý bảo vệ môi trường ở từng nơi.

#### 6. Sinh thái - Đồng quê - Vườn trái cây (`sinh-thai-dong-que`)
Về với đồng quê, miệt vườn và làng quê sông nước: chèo xuồng xuyên rừng tràm Trà Sư, đi chợ nổi Cái Răng buổi sớm, hái trái cây tại miệt vườn Cần Thơ hay dạo bản Tả Van giữa ruộng bậc thang. Danh mục hợp với chuyến dã ngoại cuối tuần nhẹ nhàng, gần gũi thiên nhiên và nhịp sống nông thôn thanh bình.

## 🛕 Nhóm 2: Tâm linh & Tôn giáo

#### 7. Quần thể & Danh thắng tâm linh (`quan-the-tam-linh`)
Những quần thể danh thắng tâm linh quy mô lớn gắn liền núi non, hồ nước: Yên Tử — cái nôi của Thiền phái Trúc Lâm, chùa Bái Đính, khu du lịch Núi Sam hay Ngũ Hành Sơn. Bài viết từng nơi tổng hợp tuyến hành hương, phương tiện lên núi (cáp treo, xe điện nếu có) và lưu ý trang phục khi chiêm bái.

#### 8. Chùa - Đền - Miếu - Tòa thánh (`chua-den-mieu`)
Danh sách chùa, đền, miếu linh thiêng trên cả nước — nơi lưu giữ giá trị tín ngưỡng và kiến trúc cổ như chùa Thiên Mụ bên sông Hương, chùa Linh Phước khảm sành sứ ở Đà Lạt, Thiền viện Trúc Lâm hay chùa Ông của cộng đồng người Hoa. Địa chỉ, giờ mở cửa và dịp lễ chính trong năm có trong bài viết từng điểm.

#### 9. Nhà thờ - Công trình Công giáo (`nha-tho-cong-giao`)
Các nhà thờ và công trình Công giáo có kiến trúc đẹp nhất Việt Nam: Nhà thờ Đức Bà Sài Gòn, Nhà thờ Lớn Hà Nội, nhà thờ Con Gà và Domaine de Marie ở Đà Lạt hay nhà thờ đá Sapa. Điểm đến phù hợp cho cả du khách hành hương lẫn người yêu kiến trúc châu Âu cổ điển giữa lòng phố Việt.

## 🏛️ Nhóm 3: Văn hóa - Lịch sử

#### 10. Di tích lịch sử - Thành cổ (`di-tich-lich-su`)
Ngược dòng lịch sử qua các di tích, thành cổ và di chỉ khảo cổ đã được xếp hạng: Đại Nội Huế, Hoàng thành Thăng Long, Địa đạo Củ Chi, Nhà tù Hỏa Lò hay cố đô Hoa Lư. Bài viết từng di tích kể lại ý nghĩa lịch sử, kèm giá vé, giờ mở cửa và gợi ý thuê thuyết minh để chuyến tham quan trọn vẹn hơn.

#### 11. Bảo tàng - Triển lãm (`bao-tang-trien-lam`)
Không gian trưng bày cho người muốn hiểu Việt Nam sâu hơn một chuyến đi chơi: Bảo tàng Chứng tích Chiến tranh, Bảo tàng Dân tộc Việt Nam, Viện Hải dương học Nha Trang hay Bảo tàng Mỹ thuật Cung đình Huế. Mỗi bài viết tóm tắt chủ đề trưng bày chính, lịch mở cửa và đối tượng phù hợp — đưa trẻ nhỏ đi cùng hay tìm hiểu chuyên sâu đều chọn được nơi hợp ý.

#### 12. Làng nghề truyền thống (`lang-nghe-truyen-thong`)
Ghé thăm các làng nghề, làng chài còn giữ nếp sống truyền thống: làng chài Mũi Né và Hàm Ninh, nhà thùng nước mắm Phú Quốc, làng hoa Thái Phiên Đà Lạt hay bản Tả Phìn của người Dao đỏ với nghề thổ cẩm và lá thuốc tắm. Đến tận nơi xem cách làm nghề, trò chuyện với người địa phương và mua đặc sản làm quà ngay tại nguồn.

#### 13. Công trình kiến trúc - Biểu tượng (`cong-trinh-kiet-tac`)
Những công trình kiến trúc và biểu tượng đô thị đáng ghé nhất Việt Nam — Cầu Rồng phun lửa ở Đà Nẵng, Bưu điện Trung tâm và Nhà thờ Đức Bà Sài Gòn, cầu Long Biên trăm tuổi hay Biệt thự Hằng Nga độc lạ ở Đà Lạt. Bài viết từng công trình gợi ý góc chụp đẹp, thời điểm lên đèn buổi tối và câu chuyện kiến trúc phía sau.

## 🎢 Nhóm 4: Vui chơi & Giải trí

#### 14. Khu vui chơi - Công viên chủ đề (`khu-vui-choi-cong-vien`)
Danh sách khu vui chơi, công viên chủ đề và safari quy mô lớn cho một ngày đi chơi trọn vẹn: Bà Nà Hills với Cầu Vàng nổi tiếng, Vinpearl Land Nha Trang và Phú Quốc, Vinpearl Safari hay Thung lũng Tình Yêu Đà Lạt. Giá vé, giờ hoạt động và kinh nghiệm đi để tránh giờ đông đúc có trong bài viết từng khu.

#### 15. Nông trại - Vườn hoa - Cắm trại (`nong-trai-vuon-hoa-camping`)
Nông trại, vườn hoa và đồi chè đang là điểm hẹn cuối tuần được yêu thích: Fresh Garden và làng hoa Vạn Thành ở Đà Lạt, đồi chè Cầu Đất, cao nguyên Mộc Châu mùa hoa hay nông trại cún Puppy Farm cho gia đình có trẻ nhỏ. Nhiều nơi kết hợp khu cắm trại, điểm chụp ảnh và trải nghiệm thu hoạch — chi tiết xem trong bài viết riêng từng điểm.

#### 16. Suối khoáng nóng - Onsen - Spa (`khoang-nong-onsen-spa`)
Tắm khoáng nóng là cách phục hồi năng lượng được ưa chuộng sau những chặng đường dài. Danh mục tập hợp các suối khoáng nóng tự nhiên và khu tắm khoáng tại Việt Nam — như suối khoáng nóng Bản Mòng ở Sơn La — kèm mô tả trải nghiệm và cách kết hợp vào lịch trình. Danh sách đang tiếp tục được bổ sung các điểm Onsen, spa mới.

#### 17. Chợ - Phố đêm - Khu ẩm thực (`cho-pho-dem-am-thuc`)
Ăn gì, mua gì khi đến một thành phố lạ? Ghé chợ và phố đêm — nơi nhịp sống địa phương hiện rõ nhất: chợ Bến Thành, chợ Đồng Xuân, chợ đêm Đà Lạt, chợ nổi Cái Răng trên sông hay phố Tây Bùi Viện về khuya. Bài viết từng nơi gợi ý món nên thử, khung giờ đông vui và mẹo mua đặc sản.

#### 18. Phố cổ - Phố đi bộ (`pho-co-pho-di-bo`)
Các khu phố cổ và tuyến phố đi bộ nổi tiếng — nơi vừa dạo chơi vừa cảm nhận hồn đô thị: phố cổ Hà Nội và Hồ Gươm, phố đi bộ Nguyễn Huệ, phố đi bộ Huế bên sông Hương hay phố cổ Đồng Văn giữa cao nguyên đá. Khung giờ đi bộ, hoạt động cuối tuần và quán xá đáng ghé có trong bài viết từng tuyến phố.

# 🔴 PHẦN 3: MÔ TẢ 17 CHỦ ĐỀ / TAGS (/chu-de/{slug})

> Đã format lại 25/07/2026 — bổ sung gạch đầu dòng/in đậm cho nội dung liệt kê
> (giữ nguyên toàn bộ tên điểm đến/facts đã verify, chỉ thêm cấu trúc trình bày).
> Bản đã duyệt + ≥5 điểm gán thì trang /chu-de/{slug} mới được index.

### 1. Phù hợp gia đình & trẻ nhỏ (`phu-hop-gia-dinh`)
Chủ đề này gom những điểm đến ưu tiên sự an toàn và tiện nghi hơn là thử thách — nơi trẻ nhỏ có chỗ chạy nhảy, người lớn tuổi không phải leo trèo vất vả và cả nhà đều tìm được hoạt động hợp với mình.

Ba tiêu chí chọn lọc chính:
- Địa hình di chuyển bằng phẳng hoặc có phương tiện hỗ trợ
- Không gian có chỗ nghỉ chân và vệ sinh sạch sẽ
- Đủ hoạt động đa dạng để cả người lớn lẫn trẻ em cùng có điều để làm

Một số điểm tiêu biểu:
- **Vinpearl Land Nha Trang** và **Vinpearl Land Phú Quốc** — tách riêng khu trò chơi nhẹ nhàng cho trẻ nhỏ khỏi khu vực mạo hiểm
- **Vinpearl Safari Phú Quốc** — cho trẻ tiếp xúc gần với động vật hoang dã trong môi trường được kiểm soát an toàn
- **Nông Trại Cún Puppy Farm** (Đà Lạt) — điểm dừng nhẹ nhàng để bé chơi cùng thú cưng
- **Fresh Garden** và **Đồi Mộng Mơ** (Đà Lạt) — không gian rộng cho trẻ chạy nhảy tự do
- **Viện Hải dương học Nha Trang** — vừa xem sinh vật biển vừa học kiến thức trực quan, không cần lặn hay chèo thuyền
- **Tràng An** và **đầm Vân Long** (Ninh Bình) — trải nghiệm ngồi thuyền len lỏi qua hang động đá vôi, không cần đi bộ nhiều
- Các miệt vườn trái cây ở **Cần Thơ** — cả nhà cùng hái quả, ăn tại vườn

Kinh nghiệm thực tế: nên đi vào **buổi sáng sớm hoặc sau giờ nắng gắt buổi chiều** để trẻ không mệt, mang theo mũ nón và đủ nước uống, và với các khu vui chơi ngoài trời nên ưu tiên ngày thời tiết mát.

Danh sách dưới đây tổng hợp đầy đủ các điểm đến phù hợp gia đình đã được chọn lọc, giúp bạn lên lịch trình mà không phải lo lắng về sức khỏe hay sự an toàn của các thành viên nhỏ tuổi.

### 2. Lãng mạn — Phù hợp cặp đôi (`lang-man-cap-doi`)
Chủ đề này tổng hợp những tọa độ hẹn hò có không gian riêng tư, cảnh quan trữ tình và nhịp sống chậm rãi dành cho hai người. Một địa danh lãng mạn không đơn thuần là nơi có phong cảnh đẹp, mà phải là không gian đủ tĩnh lặng để hai người trò chuyện, sẻ chia và lưu giữ kỷ niệm.

Một số tọa độ tiêu biểu theo vùng miền:
- **Đà Lạt** (điểm đến lãng mạn bậc nhất Việt Nam): Hồ Xuân Hương buổi sương sớm, Thung lũng Tình Yêu, Đồi Thông Hai Mộ gắn với câu chuyện tình buồn nổi tiếng, Cầu Ánh Sao lung linh về đêm
- **Huế**: dạo thuyền trên sông Hương lúc hoàng hôn buông xuống
- **Miền Trung**: vịnh Lăng Cô và vịnh Ninh Vân yên tĩnh, ít đông đúc; Hòn Chồng - Hòn Vợ ở Nha Trang gắn với truyền thuyết tình yêu đôi lứa
- Không gian ấm cúng: Thiền viện Trúc Lâm, đồi chè Cầu Đất buổi sớm mờ sương

Thời điểm lý tưởng để ghé các tọa độ này thường là **lúc bình minh vừa hé rạng hoặc "giờ vàng" cuối chiều**, khi ánh sáng dịu và ít người qua lại nhất.

Danh sách bên dưới gợi ý chi tiết các tọa độ lãng mạn trải dài từ Bắc vào Nam để bạn dễ dàng lên kế hoạch cho chuyến đi hai người.

### 3. Tụ tập nhóm bạn — Team building (`nhom-ban-teambuilding`)
Chủ đề này dành cho những chuyến đi tập thể đông người — nhóm bạn, lớp học hay công ty muốn tìm không gian đủ rộng để tổ chức trò chơi vận động, ăn uống chung và gắn kết. Khác với các chủ đề khác trong danh mục, tiêu chí quan trọng nhất ở đây không phải cảnh đẹp mà là **tính linh hoạt của mặt bằng**: có bãi đất trống hoặc bãi biển đủ rộng để dàn trò chơi, không bị ràng buộc nghiêm ngặt về tiếng ồn, và dễ tiếp cận bằng xe lớn chở cả đoàn.

**Phố Tây Bùi Viện** ở TP.HCM là ví dụ tiêu biểu cho không gian tụ tập đông người về đêm — quán xá san sát, dễ đặt chỗ theo nhóm, phù hợp cho các buổi liên hoan sau một ngày hoạt động chung. Hiện danh sách điểm đến của chủ đề này trên hệ thống còn khá ít, đội ngũ biên tập đang tiếp tục bổ sung thêm các bãi biển, khu dã ngoại rộng và khu nghỉ dưỡng có dịch vụ tổ chức sự kiện tập thể.

Khi tổ chức chuyến đi nhóm, nên liên hệ trước với đơn vị quản lý điểm đến về:
- Quy định mang đồ ăn ngoài
- Khung giờ giới hạn âm thanh
- Chỗ đỗ xe cho đoàn lớn, đặc biệt nếu đi vào cuối tuần cao điểm

Danh sách dưới đây sẽ tiếp tục cập nhật thêm các điểm đến phù hợp cho hoạt động nhóm khi dữ liệu đầy đủ hơn.

### 4. Nghỉ dưỡng — Chữa lành — Thư giãn (`nghi-duong-chua-lanh`)
Chủ đề này quy tụ những tọa độ có không gian xanh mát, tách biệt khỏi ồn ào đô thị, phù hợp cho ai muốn chậm lại, hít thở và phục hồi năng lượng sau những ngày bận rộn.

Tiêu chí chọn lọc ưu tiên các điểm sở hữu yếu tố tự nhiên có giá trị thư giãn thật sự:
- Hồ nước tĩnh lặng: Hồ Tuyền Lâm, Hồ Than Thở (Đà Lạt)
- Vịnh biển ít người: vịnh Lăng Cô, vịnh Ninh Vân, vịnh Vân Phong, vịnh Xuân Đài
- Không gian thiền: Thiền viện Trúc Lâm, chùa Trấn Quốc
- Ngâm mình trong nước mát giữa rừng: suối nước Moọc (Quảng Bình), suối Đỗ (Nha Trang)
- Rừng nguyên sinh sát biển: bán đảo Sơn Trà (Đà Nẵng) — không khí trong lành hiếm có ở một thành phố lớn

Để đạt hiệu quả phục hồi tốt nhất, nên lên kế hoạch nghỉ **ít nhất 2 ngày 1 đêm** và hạn chế dùng thiết bị điện tử trong lúc ở đây. Thời điểm lý tưởng để ghé các tọa độ này thường là **ngày giữa tuần**, khi lượng khách vắng hơn giúp giữ được sự tĩnh lặng vốn có của không gian.

Danh sách tuyển chọn dưới đây sẽ giúp bạn tìm một nơi "sạc lại năng lượng" phù hợp nhất với mình.

### 5. Check-in sống ảo — Góc chụp đẹp (`check-in-song-ao`)
Đây là chủ đề có nhiều điểm đến nhất trên toàn hệ thống — tập hợp những nơi có bối cảnh thị giác nổi bật, kiến trúc độc đáo hoặc tiểu cảnh được cộng đồng yêu thích chia sẻ nhiều trên mạng xã hội.

Một số tọa độ tiêu biểu theo vùng miền:
- **Đà Lạt**: Cầu Ánh Sao, Vườn Ánh Sáng Lumiere về đêm, Đồi cỏ hồng, Biệt thự Hằng Nga, Dalat Fairytale Land
- **Vùng Tây Bắc**: cổng trời ở Sa Pa, đèo Mã Pí Lèng, đèo Ô Quy Hồ, các bản làng Tả Van, Tả Phìn với khung cảnh ruộng bậc thang
- **Hà Nội**: Con đường gốm sứ — điểm check-in mang tính biểu tượng đô thị
- Kiến trúc nhà thờ: nhà thờ đá Sa Pa, nhà thờ Con Gà Đà Lạt

Để có ảnh đẹp mà không phải chen chúc, nên có mặt vào khoảng **7h00-8h30 sáng** khi ánh sáng dịu và lượng khách còn thưa; buổi chiều muộn gần hoàng hôn cũng là khung giờ đẹp cho các tọa độ hướng biển hoặc thung lũng.

Danh sách tuyển chọn dưới đây sẽ gợi ý những góc máy đáng chụp nhất tại từng điểm đến.

### 6. Săn mây — Ngắm hoàng hôn & bình minh (`san-may-hoang-hon`)
Chủ đề này tổng hợp những địa danh có vị trí địa lý phù hợp để bắt trọn các khoảnh khắc quang học đẹp nhất của bầu trời — từ biển mây bồng bềnh buổi sớm đến ráng chiều rực rỡ lúc hoàng hôn.

- **Săn mây** (độ cao là yếu tố quyết định): đỉnh Fansipan, đèo Mã Pí Lèng, đèo Ô Quy Hồ, đỉnh Langbiang, Tà Xùa — dễ đón mây luồn qua sườn núi vào sáng sớm
- **Ngắm hoàng hôn hướng biển**: bán đảo Sơn Trà, Bãi Môn - Mũi Điện (nơi có ngọn hải đăng cổ nhất Việt Nam) — tầm nhìn thoáng ra biển Đông
- **Đồi Cát Mũi Né**: cồn cát đổi màu liên tục theo ánh sáng, đẹp cả lúc bình minh lẫn hoàng hôn

Thời điểm vàng để săn mây thường là **5h00-6h30 sáng**, sau những đêm trời quang, ít gió; còn để ngắm hoàng hôn nên có mặt **trước giờ mặt trời lặn khoảng 45 phút** để không bỏ lỡ khoảnh khắc trời chuyển màu.

Hãy tra cứu danh sách chi tiết bên dưới để chọn đúng tọa độ và thời điểm cho chuyến đi ngắm bầu trời của bạn.

### 7. Hoang sơ — Vắng người — Yêu thiên nhiên (`hoang-so-kham-pha`)
Chủ đề này tuyển chọn những danh thắng còn giữ nét nguyên bản, chưa bị hạ tầng du lịch thương mại hóa can thiệp nhiều — dành cho người sẵn sàng đánh đổi tiện nghi để đổi lấy sự tĩnh lặng và cảnh quan chưa bị xáo trộn bởi đám đông.

- **Biển đảo**: đảo Nam Du, đảo Hải Tặc, Cù Lao Câu (còn thưa vắng dịch vụ du lịch quy mô lớn); vịnh Vân Phong, vịnh Ninh Vân (giữ nét hoang sơ hiếm có so với các vịnh biển đã phát triển mạnh)
- **Rừng núi**: rừng tràm Trà Sư mùa nước nổi, Hang Sơn Đoòng, núi Cấm (An Giang)
- **Bản làng vùng cao**: Tả Phìn, Tả Van (Sa Pa) — còn giữ nhịp sống chậm, ít bị du lịch hóa

Đi du lịch ở các điểm hoang sơ đồng nghĩa với việc phải chủ động hơn về hậu cần: mang theo đủ nước uống, đồ ăn nhẹ và thiết bị liên lạc, vì dịch vụ tại chỗ thường rất hạn chế. **Nguyên tắc quan trọng nhất** khi ghé những nơi này là không để lại rác thải, giữ nguyên vẹn cảnh quan cho người đến sau.

Hãy tham khảo danh sách dưới đây và cùng góp phần bảo tồn vẻ đẹp nguyên bản của thiên nhiên Việt Nam.

### 8. Mạo hiểm — Trekking — Phượt (`mao-hiem-trekking`)
Chủ đề này quy tụ những hành trình đòi hỏi sức bền và kỹ năng di chuyển trên địa hình phức tạp — phần thưởng là cảm giác vỡ òa khi đứng trước khung cảnh mà chỉ những ai dám bước qua thử thách mới được chiêm ngưỡng.

- **Trekking núi cao**: Fansipan (nóc nhà Đông Dương), Tà Xùa — đòi hỏi thể lực tốt, nên đi cùng người dẫn đường địa phương
- **Phượt xe máy**: đèo Mã Pí Lèng, đèo Ô Quy Hồ — khúc cua tay áo sát vực sâu
- **Thám hiểm hang động**: Hang Sơn Đoòng (Quảng Bình) — tầm cỡ thế giới
- **Trekking xuyên rừng ngắn ngày**: Vườn quốc gia Cúc Phương, Vườn quốc gia Bạch Mã

An toàn luôn là ưu tiên số một: không tự ý trekking đơn độc ở vùng rừng sâu hay hang động mà không có hướng dẫn viên địa phương, cần kiểm tra kỹ dự báo thời tiết trước khi đi (**đặc biệt tránh mùa mưa lũ tháng 8-10** ở miền Trung và miền Bắc), và chuẩn bị giày bám tốt cùng trang phục thấm hút mồ hôi.

Danh sách dưới đây cung cấp thông tin về từng hành trình để bạn sẵn sàng chinh phục.

### 9. Cắm trại — Glamping — Dã ngoại (`cam-trai-dieu-da`)
Chủ đề này tổng hợp những không gian tự nhiên thoáng đãng — bờ hồ, bãi biển hay rừng thông — phù hợp cho hoạt động hạ lều qua đêm, từ cắm trại tự túc đến glamping đầy đủ tiện nghi.

- **Cắm trại ven hồ**: Hồ Tuyền Lâm (Đà Lạt), hồ Thang Hen (Cao Bằng) — ngắm mặt nước phẳng lặng buổi sáng sớm
- **Cắm trại đảo**: đảo Cô Tô, đảo Nam Du — bãi cát còn hoang sơ, phù hợp dựng lều ngắm sao đêm xa ánh đèn thành phố
- **Cắm trại rừng núi**: suối nước Moọc (Quảng Bình), rừng nguyên sinh Rú Chá (Huế)

Nếu chọn cắm trại tự túc, cần chủ động theo dõi thời tiết — đặc biệt hướng gió và khả năng mưa đêm — chuẩn bị bạt lót chống thấm, túi ngủ đủ ấm và đèn chiếu sáng cá nhân; **luôn dập tắt hoàn toàn tàn lửa trại trước khi rời đi** để phòng cháy rừng.

Hãy tham khảo danh sách dưới đây để tìm vị trí hạ lều phù hợp cho chuyến dã ngoại sắp tới của bạn.

### 10. Vui chơi ban đêm — Nightlife (`di-choi-ban-dem`)
Chủ đề này tập hợp những không gian sầm uất, nhộn nhịp sau khi mặt trời lặn tại các thành phố du lịch lớn — nơi du khách khám phá một khía cạnh khác của điểm đến qua ẩm thực đường phố, mua sắm và không khí về đêm.

- **Chợ Đêm Đà Lạt**: đồ nướng, sữa đậu nành nóng, không khí se lạnh cao nguyên
- **Chợ đêm Tây Đô** (Cần Thơ): đậm nhịp sống miền Tây sông nước
- **Phố Tây Bùi Viện** (TP.HCM): sôi động đến tận khuya với quán bar, nhạc sống, đông đảo du khách quốc tế
- **Phố đi bộ Nguyễn Huệ**: nơi người dân Sài Gòn dạo mát, ngắm phun nước nhạc nước mỗi tối cuối tuần
- **Hồ Tây** (Hà Nội): điểm hẹn quen thuộc với các quán cà phê ven hồ về đêm

Khi tham gia các hoạt động về đêm, nên **bảo quản cẩn thận tài sản cá nhân** ở nơi đông người, hỏi rõ giá trước khi gọi món tại khu chợ đêm, và ưu tiên xe công nghệ hoặc taxi chính hãng nếu có dùng đồ uống có cồn.

Danh sách dưới đây gợi ý những điểm đến không thể bỏ qua để lấp đầy lịch trình buổi tối của bạn.

### 11. Đi về trong ngày — Du lịch cuối tuần (`du-lich-cuoi-tuan`)
Chủ đề này dành cho những ai không có nhiều thời gian nhưng vẫn muốn đổi gió — tập hợp các điểm đến nằm gần trung tâm đô thị lớn, đi về được trong ngày hoặc gọn trong một kỳ cuối tuần.

- **Gần Hà Nội**: Hồ Tây (dạo chơi buổi sáng), xa hơn là khu du lịch núi Sam (An Giang) cho ai muốn kết hợp hành hương
- **Gần các thành phố biển**: Đồi Cát (Mũi Né), Bãi Cháy (Hạ Long)
- **Trọn vẹn 1 ngày, không cần lên kế hoạch phức tạp**: Vinpearl Land Nha Trang, Vinpearl Land Phú Quốc

Để chuyến đi trong ngày không mệt mỏi vì kẹt xe, nên **xuất phát sớm vào buổi sáng** và bắt đầu hành trình về trước giờ cao điểm chiều tối; chuẩn bị sẵn đồ ăn nhẹ và nước uống trên xe cũng giúp chủ động hơn.

Hãy tra cứu danh sách dưới đây để chọn ngay một điểm đến gần bạn cho kỳ nghỉ cuối tuần này.

### 12. Mùa hoa — Cảnh sắc theo mùa (`canh-sac-theo-mua`)
Chủ đề này tổng hợp những danh thắng có vẻ đẹp thay đổi rõ rệt theo mùa — cùng một tọa độ nhưng mỗi thời điểm trong năm lại mang một diện mạo hoàn toàn khác.

- **Mùa lúa chín (khoảng tháng 9-10)**: ruộng bậc thang Xã La Pán Tẩn, Xã Tú Lệ (Yên Bái cũ, nay thuộc Lào Cai) chuyển sang màu vàng óng; vùng cao Hoàng Su Phì cũng là điểm quen thuộc của giới nhiếp ảnh mùa này
- **Mùa hoa đầu năm**: cao nguyên Mộc Châu nổi tiếng với hoa mận, hoa cải trắng
- **Cảnh sắc theo giai đoạn trong năm**: đồi chè Cầu Đất (Đà Lạt), đồi cỏ hồng

Vì thời điểm hoa nở hay lúa chín có thể **lệch 1-2 tuần so với dự kiến** tùy thời tiết, nên theo dõi sát các cập nhật thực tế từ cộng đồng du lịch địa phương trước khi khởi hành, và đặt phòng sớm vì các điểm này thường cháy dịch vụ vào đúng mùa đẹp.

Danh sách bên dưới sẽ cung cấp thông tin mùa vụ cho từng điểm đến.

### 13. Ẩm thực & Đặc sản địa phương (`am-thuc-dac-san`)
Chủ đề này quy tụ những khu chợ, làng nghề và không gian ẩm thực lưu giữ hương vị đặc trưng của từng vùng miền Việt Nam.

- **Chợ truyền thống lâu đời**: chợ Bến Thành (TP.HCM), chợ Đồng Xuân (Hà Nội) — đủ loại đặc sản vùng miền quy tụ về một chỗ
- **Chợ nổi Cái Răng** (Cần Thơ): mua trái cây, ăn sáng ngay trên thuyền giữa dòng sông tấp nập từ tờ mờ sáng
- **Làng chài Mũi Né**: hải sản tươi vừa đánh bắt
- **Cơ sở sản xuất rượu Sim** (Phú Quốc): tìm hiểu đặc sản nổi tiếng của đảo ngọc
- **Miệt vườn trái cây** (Cần Thơ): vừa hái vừa thưởng thức trái cây ngay tại vườn

Để thưởng thức ẩm thực trọn vẹn và an toàn, nên **ưu tiên quán ăn có đông khách địa phương** thay vì chỉ những nơi chuyên phục vụ tour đoàn, hỏi giá trước khi gọi món tại các khu chợ, và chuẩn bị sẵn tiền mặt lẻ để thuận tiện thanh toán.

Danh sách dưới đây sẽ dẫn bạn đến những điểm ẩm thực đáng thử nhất trên khắp cả nước.

### 14. Văn hóa bản địa — Bản làng & Phong tục (`van-hoa-ban-dia`)
Chủ đề này đưa du khách đến không gian sống thực tế của các cộng đồng dân tộc trên khắp Việt Nam — nơi vẫn giữ được nếp nhà, trang phục và phong tục truyền thống.

- **Vùng cao phía Bắc**: bản Tả Phìn, bản Tả Van (Sa Pa) — nơi sinh sống của người Dao đỏ và người H'Mông; phiên chợ lùi Hà Giang chỉ họp theo chu kỳ 6 ngày một lần; cao nguyên đá Đồng Văn — vùng đất của người H'Mông với những phiên chợ vùng cao đậm bản sắc
- **Miền Tây Nam Bộ**: làng nổi Châu Đốc, Làng Văn hóa người Chăm — tìm hiểu đời sống sông nước và văn hóa Chăm còn được gìn giữ
- **Bảo tàng Dân tộc Việt Nam** (Thái Nguyên): điểm dừng phù hợp để có cái nhìn tổng quan trước khi đi sâu vào từng bản làng cụ thể

Khi ghé thăm bản làng, cần tôn trọng quy định ứng xử văn hóa bản địa: **hỏi ý kiến trước khi chụp ảnh người dân**, ăn mặc lịch sự, không tự ý đụng vào vật thờ cúng.

Hãy tham khảo danh sách tuyển chọn dưới đây để bắt đầu hành trình khám phá văn hóa đa dạng của Việt Nam.

### 15. Di sản — Kỷ lục thế giới (`di-san-ky-luc`)
Chủ đề này tập hợp những địa danh mang giá trị nổi bật đã được UNESCO công nhận hoặc giữ những kỷ lục đáng tự hào của Việt Nam.

- **Vịnh Hạ Long**: di sản thiên nhiên thế giới nổi tiếng nhất cả nước
- **Quần thể danh thắng Tràng An** (Ninh Bình): di sản hỗn hợp văn hóa và thiên nhiên đầu tiên của Việt Nam, bao gồm cả cố đô Hoa Lư trong vùng lõi di sản
- **Quần thể di tích Cố đô Huế** (Đại Nội): di sản văn hóa thế giới
- **Hoàng thành Thăng Long** (Hà Nội): giá trị lịch sử hơn nghìn năm
- **Hang Sơn Đoòng** (Quảng Bình): hang động tự nhiên lớn nhất thế giới, nằm trong vùng di sản Phong Nha - Kẻ Bàng
- **Chùa Bái Đính** (Ninh Bình): nhiều kỷ lục Việt Nam về quy mô kiến trúc chùa

Vì đây là các vùng di sản nhạy cảm, du khách cần tuân thủ nghiêm quy định bảo tồn: **không khắc chữ lên di tích, không xả rác**, đi đúng tuyến tham quan quy định. Thuê hướng dẫn viên tại điểm sẽ giúp hiểu sâu hơn về giá trị lịch sử và địa chất của từng di sản.

Danh sách dưới đây cung cấp thông tin về từng địa danh.

### 16. Lịch sử chiến tranh — Hoài niệm (`lich-su-chien-tranh`)
Chủ đề này đưa du khách trở về những chứng nhân lịch sử ghi dấu các cuộc chiến tranh bảo vệ tổ quốc, mang ý nghĩa giáo dục và tri ân sâu sắc.

- **Địa đạo Củ Chi** (TP.HCM): hệ thống đường hầm nổi tiếng thế giới, có thể chui xuống trải nghiệm không gian sinh hoạt và chiến đấu của quân dân thời chiến
- **Nhà tù Hỏa Lò** (Hà Nội), **Nhà lao Cây Dừa** (Phú Quốc): lưu giữ nguyên vẹn không gian giam giữ cùng nhiều hiện vật lịch sử
- **Dinh Độc Lập** (TP.HCM): nơi diễn ra thời khắc lịch sử kết thúc chiến tranh; **Bảo tàng Chứng tích Chiến tranh** gần đó trưng bày tư liệu hình ảnh chân thực về hậu quả chiến tranh
- **Khu di tích Pác Bó** (Cao Bằng): gắn liền với những năm tháng hoạt động cách mạng của Bác Hồ

Khi ghé thăm các di tích này, du khách nên trang phục lịch sự, giữ trật tự, **không cười đùa to tiếng tại nơi tưởng niệm**, và nên nghe thuyết minh tại điểm để hiểu trọn câu chuyện phía sau từng hiện vật.

Danh sách dưới đây sẽ dẫn bạn đến những địa danh lịch sử thiêng liêng ấy.

### 17. Biểu tượng địa phương — Phải ghé (`bieu-tuong`)
Chủ đề này tập hợp những danh thắng và công trình mang tính nhận diện cao nhất, đóng vai trò như "tấm danh thiếp du lịch" đại diện cho hình ảnh của từng tỉnh, thành phố. Đây là những điểm mà nếu chưa ghé qua, chuyến đi đến địa phương đó dường như chưa trọn vẹn.

- **Hà Nội**: Hồ Gươm
- **TP.HCM**: chợ Bến Thành, Nhà thờ Đức Bà
- **Đà Nẵng**: Cầu Rồng phun lửa mỗi cuối tuần
- **Cần Thơ**: Bến Ninh Kiều
- **Huế**: chùa Thiên Mụ bên dòng sông Hương
- **Hà Giang**: Cột cờ Lũng Cú — điểm địa đầu Tổ quốc
- **Quảng Ninh**: Vịnh Hạ Long — hình ảnh đại diện trên bản đồ du lịch thế giới

Vì là những điểm "phải ghé" thu hút đông du khách, các tọa độ này thường **đông đúc vào khung giờ cao điểm và dịp lễ Tết**. Nên ưu tiên ghé thăm vào sáng sớm để tận hưởng không khí tĩnh lặng và chụp ảnh không bị đám đông, hoặc buổi tối khi nhiều công trình lên đèn rực rỡ.

Hãy tra cứu danh sách tuyển chọn dưới đây để không bỏ lỡ những điểm đến biểu tượng khi ghé thăm từng tỉnh thành Việt Nam.

# PHẦN 4: MÔ TẢ 19 TỈNH/THÀNH CÓ ĐIỂM ĐẾN (/tinh/{slug})

> Chỉ soạn cho 19 tỉnh đã có POI trong hệ thống (theo địa giới 34 tỉnh sau
> sáp nhập 2025 — tỉnh gộp ghi rõ "bao gồm X cũ" vì từ khoá tên tỉnh cũ vẫn
> là truy vấn tìm kiếm chính). 15 tỉnh còn lại chưa có dữ liệu → trang đang
> `noindex`, chưa cần mô tả. ĐÃ GHI vào DB 24/07/2026.

### 1. Hà Nội (`ha-noi`)
Hà Nội — thủ đô nghìn năm văn hiến với mật độ di tích dày đặc bậc nhất cả nước: Hồ Gươm, phố cổ 36 phố phường, Hoàng thành Thăng Long, Văn Miếu Quốc Tử Giám hay Quảng trường Ba Đình - Lăng Bác. Thành phố hợp với kiểu du lịch chậm: sáng dạo hồ, trưa cà phê phố cổ, chiều thăm di tích, tối thưởng thức ẩm thực vỉa hè. Mỗi điểm đến đều có bài viết riêng kèm địa chỉ, giờ mở cửa và kinh nghiệm tham quan.

### 2. Cao Bằng (`cao-bang`)
Cao Bằng là miền non nước biên giới với thác Bản Giốc nổi tiếng nằm ngay đường biên Việt - Trung, động Ngườm Ngao kỳ ảo và hồ Thang Hen giữa núi đá. Đây cũng là vùng đất cách mạng với khu di tích Pác Bó, nơi gắn liền những năm tháng hoạt động của Bác Hồ. Phù hợp cho chuyến phượt 2-3 ngày kết hợp cảnh quan hùng vĩ và lịch sử.

### 3. Tuyên Quang (`tuyen-quang`) — bao gồm Hà Giang cũ
Tuyên Quang (bao gồm Hà Giang cũ) sở hữu cao nguyên đá Đồng Văn — công viên địa chất toàn cầu UNESCO, đèo Mã Pí Lèng huyền thoại, cột cờ Lũng Cú nơi địa đầu Tổ quốc và dinh thự vua Mèo trăm năm tuổi. Cung đường Hà Giang được dân phượt xem là chuyến đi đáng giá nhất miền Bắc, đẹp nhất mùa hoa tam giác mạch cuối năm và những phiên chợ vùng cao đậm bản sắc.

### 4. Sơn La (`son-la`)
Sơn La nổi bật với cao nguyên Mộc Châu — đồi chè xanh mướt và mùa hoa mận, hoa cải trắng trời — cùng Tà Xùa, thiên đường săn mây của dân trekking. Ngoài ra còn đỉnh Pha Luông hùng vĩ trong thơ Quang Dũng, thác Dải Yếm và suối khoáng nóng Bản Mòng để thư giãn sau chặng đường dài.

### 5. Lào Cai (`lao-cai`) — bao gồm Yên Bái cũ
Lào Cai (bao gồm Yên Bái cũ) là trung tâm du lịch vùng cao Tây Bắc: Sapa với đỉnh Fansipan — nóc nhà Đông Dương, thung lũng Mường Hoa, bản Tả Van, Tả Phìn; và vùng ruộng bậc thang Mù Cang Chải với La Pán Tẩn, Tú Lệ đẹp nhất mùa lúa chín tháng 9-10. Điểm đến bốn mùa: xuân ngắm hoa, hè tránh nóng, thu săn lúa vàng, đông săn mây.

### 6. Thái Nguyên (`thai-nguyen`)
Thái Nguyên — thủ phủ chè Việt Nam với đồi chè Tân Cương xanh mướt, hồ Núi Cốc gắn huyền thoại nàng Công chàng Cốc, suối Cửa Tử hoang sơ và hang Phượng Hoàng - suối Mỏ Gà. Bảo tàng Văn hóa các dân tộc Việt Nam giữa trung tâm thành phố là điểm dừng đáng giá cho người yêu văn hóa. Gần Hà Nội, rất hợp chuyến đi cuối tuần.

### 7. Lạng Sơn (`lang-son`)
Lạng Sơn — cửa ngõ biên giới phía Bắc với đỉnh Mẫu Sơn mờ sương, thung lũng Bắc Sơn xanh ngắt giữa núi đá vôi, chùa Tam Thanh cùng nàng Tô Thị trong ca dao và chợ Đông Kinh sầm uất. Điểm đến còn ít đông đúc, hợp chuyến khám phá ngắn ngày từ Hà Nội.

### 8. Quảng Ninh (`quang-ninh`)
Quảng Ninh sở hữu Vịnh Hạ Long — di sản thiên nhiên thế giới, cùng những hòn đảo được yêu thích: Cô Tô, Quan Lạn, Vân Đồn, Tuần Châu. Đất Phật Yên Tử — cái nôi của Thiền phái Trúc Lâm, làng chài Cửa Vạn trên vịnh và bãi biển Bãi Cháy sôi động đủ cho lịch trình 2-4 ngày trọn vẹn cả biển đảo lẫn tâm linh.

### 9. Ninh Bình (`ninh-binh`)
Ninh Bình được ví là "vịnh Hạ Long trên cạn" với quần thể danh thắng Tràng An — di sản kép thế giới, Tam Cốc - Bích Động và hang Múa nhìn toàn cảnh sông núi. Cùng chùa Bái Đính quy mô hàng đầu Đông Nam Á, cố đô Hoa Lư nghìn năm và đầm Vân Long, đây là điểm đi về trong ngày lý tưởng từ Hà Nội.

### 10. Quảng Trị (`quang-tri`) — bao gồm Quảng Bình cũ
Quảng Trị (bao gồm Quảng Bình cũ) là thủ phủ hang động của Việt Nam: Hang Sơn Đoòng lớn nhất thế giới, động Thiên Đường lộng lẫy và suối nước Moọc xanh ngọc giữa vùng Phong Nha - Kẻ Bàng. Cạnh đó là biển Nhật Lệ, bãi Đá Nhảy độc đáo và Vũng Chùa - Đảo Yến — nơi yên nghỉ của Đại tướng Võ Nguyên Giáp.

### 11. Huế (`hue`)
Huế — kinh đô cuối cùng của Việt Nam với quần thể di tích cố đô được thế giới công nhận: Đại Nội, lăng Minh Mạng, lăng Khải Định, chùa Thiên Mụ bên dòng sông Hương. Nhịp sống chậm, ẩm thực đậm chất cung đình và những nơi ít người biết như rừng ngập mặn Rú Chá khiến Huế hợp với chuyến đi 2-3 ngày trầm lắng, sâu sắc.

### 12. Đà Nẵng (`da-nang`) — bao gồm Quảng Nam cũ
Đà Nẵng (bao gồm Quảng Nam cũ) gói trọn biển - núi - phố cổ trong một chuyến đi: biển Mỹ Khê, bán đảo Sơn Trà, đèo Hải Vân, Bà Nà Hills, và phố cổ Hội An với Chùa Cầu, các hội quán người Hoa cùng Cù Lao Chàm ngoài khơi. Điểm đến chiều được mọi kiểu du lịch, từ nghỉ dưỡng gia đình đến khám phá văn hóa.

### 13. Khánh Hòa (`khanh-hoa`)
Khánh Hòa — thủ phủ du lịch biển miền Trung với Nha Trang: lặn ngắm san hô ở đảo Hòn Mun, thăm Tháp Bà Ponagar của người Chăm, nhà thờ Đá, chùa Long Sơn và Viện Hải dương học. Xa hơn có bãi biển Đại Lãnh, vịnh Vân Phong và vịnh Ninh Vân hoang sơ cho người muốn tránh đám đông.

### 14. Đắk Lắk (`dak-lak`) — bao gồm Phú Yên cũ
Đắk Lắk (bao gồm Phú Yên cũ) tập trung các điểm ven biển từng nổi tiếng qua phim "Tôi thấy hoa vàng trên cỏ xanh": Gành Đá Dĩa với những cột đá bazan xếp tầng độc nhất, Bãi Môn - Mũi Điện đón bình minh, Tháp Nhạn, đầm Ô Loan và vịnh Xuân Đài. Vùng biển còn giữ nét hoang sơ, hải sản tươi và giá cả dễ chịu.

### 15. Lâm Đồng (`lam-dong`) — bao gồm Bình Thuận, Đắk Nông cũ
Lâm Đồng (bao gồm Bình Thuận, Đắk Nông cũ) dẫn đầu cả nước về số điểm đến trên Dichoithoi với hai cực khí hậu: Đà Lạt — thành phố ngàn hoa với hồ Xuân Hương, thác Pongour, Thung lũng Tình Yêu, nhà ga cổ và hàng chục vườn hoa, nông trại; và biển Mũi Né với đồi cát, bãi đá Ông Địa, hải đăng Kê Gà. Một tỉnh, hai trải nghiệm — cao nguyên mát lạnh và biển nắng gió.

### 16. TP. Hồ Chí Minh (`ho-chi-minh`)
TP. Hồ Chí Minh — đô thị sôi động nhất cả nước, nơi lịch sử và hiện đại đan xen: Dinh Độc Lập, Bưu điện Trung tâm, Nhà thờ Đức Bà, chợ Bến Thành, Bảo tàng Chứng tích Chiến tranh và Địa đạo Củ Chi ở ngoại thành. Về đêm có phố đi bộ Nguyễn Huệ, phố Tây Bùi Viện — thành phố không ngủ đúng nghĩa.

### 17. An Giang (`an-giang`) — bao gồm Kiên Giang cũ
An Giang (bao gồm Kiên Giang cũ) trải từ miền Tây sông nước đến đảo ngọc: rừng tràm Trà Sư, Miếu Bà Chúa Xứ Núi Sam linh thiêng, hồ Tà Pạ; và Phú Quốc với Bãi Sao, Bãi Khem cát trắng, cùng quần đảo Nam Du, đảo Hải Tặc, Hà Tiên. Vừa hành hương, vừa nghỉ biển — một trong những tỉnh đa dạng trải nghiệm nhất Nam Bộ.

### 18. Cần Thơ (`can-tho`)
Cần Thơ — trái tim miền Tây với chợ nổi Cái Răng họp từ tờ mờ sáng, bến Ninh Kiều lộng gió, chợ đêm Tây Đô và những miệt vườn trái cây trĩu quả quanh năm. Vườn cò Bằng Lăng, khu du lịch Mỹ Khánh cùng nhịp sống sông nước khiến hai ngày ở đây trôi rất nhanh.

### 19. Cà Mau (`ca-mau`)
Cà Mau — nơi chạm tay vào điểm cực Nam Tổ quốc tại Mũi Cà Mau, xuyên rừng đước Năm Căn, rừng U Minh Hạ và ra Hòn Đá Bạc, đảo Hòn Khoai ngoài khơi. Chợ nổi Cà Mau, đầm Thị Tường — "biển hồ giữa đồng bằng" — và sân chim giữa rừng ngập mặn cho trải nghiệm miền Tây nơi tận cùng bản đồ.
