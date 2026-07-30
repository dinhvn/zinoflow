# Dichoithoi — LLM Project Brief for Deep Analysis

Tài liệu này dành riêng để nạp vào Gemini Pro hoặc LLM khác ở chế độ reasoning/thinking,
giúp model hiểu đủ bối cảnh trước khi phân tích website dichoithoi.com và đề xuất cải tiến.

Mục tiêu của tài liệu này:

1. Giải thích dichoithoi là website gì, đang giải quyết bài toán gì.
2. Tóm tắt cách tổ chức dữ liệu: tỉnh -> cụm -> điểm đến, cùng Type và Tag.
3. Mô tả cách website public hiển thị tỉnh, cụm, điểm đến.
4. Mô tả prompt AI hiện tại khi tạo bài cho cụm và điểm đến.
5. Chỉ ra các điểm cần lưu ý để LLM không hiểu sai vì đọc nhầm tài liệu lịch sử.

Tài liệu này được viết theo hướng self-contained để có thể copy nguyên file vào Gemini.
Mọi phần quan trọng cho phân tích kiến trúc, UX/SEO, và prompt hiện tại đã được tóm đầy đủ
ngay trong tài liệu này, không bắt buộc phải mở thêm file khác.

## 0. Nguyên tắc ưu tiên bất biến

Đây là nguyên tắc gốc cần giữ xuyên suốt khi phân tích và đề xuất cải tiến cho dichoithoi.

1. Ưu tiên tổ chức thông tin khoa học:
   Mọi trang, mọi route, mọi taxonomy phải có vai trò rõ ràng, không chồng chéo, không trùng mục đích.

2. Ưu tiên nội dung có giá trị thật cho người dùng:
   Nội dung phải giúp người đọc ra quyết định tốt hơn, không viết chỉ để lấp từ khóa hoặc tăng số lượng bài.

3. SEO là ưu tiên hàng đầu trong quyết định sản phẩm nội dung:
   Khi có xung đột giữa thẩm mỹ, cảm tính biên tập, hoặc giải pháp kỹ thuật, cần ưu tiên phương án giữ cấu trúc SEO đúng và bền vững.

4. Thứ tự ưu tiên khi phải đánh đổi:
   SEO đúng định hướng và nội dung hữu ích cho người dùng đứng trước, tối ưu phụ trợ đứng sau.

5. Mọi đề xuất từ LLM phải được chấm theo 3 câu hỏi:
   Giải pháp này có làm cấu trúc rõ hơn không, có tăng giá trị thực cho người đọc không, và có cải thiện SEO đúng chuẩn Google không.

## 1. Dichoithoi là gì

`dichoithoi.com` là website nội dung du lịch Việt Nam, tập trung vào:

1. Tổng hợp điểm đến theo địa lý và loại hình.
2. Giúp người đọc quyết định đi đâu, đi khi nào, đi như thế nào.
3. Kiếm tiền qua affiliate từ vé tham quan, khách sạn, tour, và một số sản phẩm liên quan.

Website không chỉ là blog viết cho có traffic. Mỗi trang điểm đến được định hướng như một
trang ra quyết định, phải trả lời được các câu hỏi thực dụng:

1. Đây là nơi gì, có đáng đi không?
2. Nó nằm ở đâu, đi thế nào?
3. Giá vé, giờ mở cửa, lưu ý thực tế là gì?
4. Nếu đến đây thì nên ăn gì, ở đâu, có tour hay vé nào nên đặt?
5. Nếu đang khám phá một vùng lớn thì trong vùng đó có các điểm tham quan con nào?

Ba mục tiêu sản phẩm chạy song song:

1. SEO: phủ cụm từ khóa du lịch theo tỉnh, cụm, loại hình, chủ đề.
2. UX: giúp người dùng tìm được điểm phù hợp nhanh, không phải đọc lan man.
3. Monetization: đặt CTA booking ở đúng nơi trong hành trình đọc.

## 2. Kiến trúc sản phẩm ở mức cao

Hệ thống dichoithoi hiện có 3 phần:

1. Website public `dichoithoi` bằng .NET: nhiệm vụ chính là đọc dữ liệu và render nhanh.
2. AI Content Tool `zinoflow`: đóng vai trò CMS mới cho dữ liệu điểm đến, bài viết, khách sạn, tour.
3. CMS dichoithoi cũ: giữ các module chưa migrate hết, nhưng phần điểm đến mới không còn là nguồn sự thật lâu dài.

Nguyên tắc quan trọng:

1. Website public là read-model, ưu tiên tốc độ đọc và SEO.
2. ZinoFlow là nơi soạn thảo, duyệt, publish.
3. Nội dung live không được phụ thuộc vào việc gọi AI khi render trang.
4. Các khối hiển thị quan trọng được precompute hoặc publish sẵn xuống database website.

### 2.1 Source of truth và luồng publish

Đây là phần quan trọng để LLM hiểu đúng hệ thống, vì nếu bỏ qua sẽ rất dễ phân tích sai theo kiểu
“website tự render động từ CMS” hoặc “AI viết xong là live ngay”. Thực tế không phải vậy.

Luồng đúng là:

1. ZinoFlow giữ draft, version, review history, prompt, AI usage, và mirror dữ liệu.
2. Người dùng generate hoặc sửa nội dung trong ZinoFlow.
3. Nội dung phải qua review và kiểm tra trước khi publish.
4. Khi publish, ZinoFlow render hoặc bake dữ liệu cần thiết rồi ghi xuống SQL Server của website.
5. Website chỉ đọc dữ liệu đã publish, không tự gọi AI khi người dùng mở trang.

Hiểu ngắn gọn:

1. Postgres của ZinoFlow là xưởng soạn.
2. SQL Server của dichoithoi là read-model production.
3. Website public chỉ nên được phân tích như lớp render, không phải nơi quyết định logic biên tập.

Điểm quan trọng cho phân tích:

1. Approve không đồng nghĩa với publish.
2. Một số khối hiển thị được precompute từ dữ liệu khác, không phải do AI viết trực tiếp.
3. Khi phân tích lỗi hoặc cơ hội cải tiến, phải tách bạch phần nào thuộc workflow CMS và phần nào thuộc website render.

## 3. Mô hình nội dung cốt lõi

### 3.1 Cây địa lý: tỉnh -> cụm -> điểm đến

Hệ thống dùng 3 cấp chính:

1. `province`: tỉnh hoặc thành phố cấp tỉnh.
2. `cluster`: cụm du lịch hoặc vùng du lịch bên trong tỉnh.
3. `poi`: điểm đến cụ thể mà khách thực sự ghé thăm.

Hiểu ngắn gọn:

1. Tỉnh là lớp điều hướng địa lý cấp cao nhất.
2. Cụm là lớp gom các điểm gần nhau hoặc cùng một khu du lịch lớn.
3. Điểm đến là trang chi tiết cuối cùng cho từng nơi cụ thể.

Ví dụ tư duy:

1. `Lâm Đồng` là tỉnh.
2. `Đà Lạt` có thể là cluster hoặc node lớn dùng để gom nhiều điểm.
3. `Biệt thự Hằng Nga`, `Hồ Xuân Hương`, `Thác Datanla` là các POI.

### 3.2 Hai chiều phân loại khác ngoài cây địa lý

Ngoài cây địa lý, mỗi điểm đến còn có 2 trục phân loại riêng:

1. `Type`: trả lời câu hỏi “nơi này là gì”. Đây là bản chất vật lý hoặc loại hình chính.
2. `Tag`: trả lời câu hỏi “nơi này hợp với trải nghiệm gì, bối cảnh gì, đối tượng gì”.

Nói ngắn:

1. Type là trục bản chất.
2. Tag là trục search intent và trải nghiệm cắt ngang.

Ví dụ:

1. Một nơi có thể có Type là `thác - hồ - suối`.
2. Cùng nơi đó có thể có Tag là `check-in sống ảo`, `hoang sơ khám phá`, hoặc `đi về trong ngày`.

### 3.3 Lưu ý quan trọng về tài liệu taxonomy

Trong thư mục docs hiện có tài liệu lịch sử và tài liệu chuẩn hóa mới, nên LLM rất dễ bị nhiễu.

Để phân tích hợp lý, nên hiểu như sau:

1. Bộ taxonomy cũ `16 Type / 3 Nhóm / 9 Tag` là baseline lịch sử.
2. Hướng thiết kế nên dùng để phân tích là bộ chuẩn hóa mới `4 Nhóm / 18 Type / 17 Tag`.
3. Một số doc ghi “đã migrate”, một số doc cũ vẫn ghi “chưa migrate”; đây là dấu hiệu tài liệu nội bộ chưa đồng bộ hoàn toàn.

Nếu LLM phát hiện mâu thuẫn này, đó là tín hiệu đúng, không phải lỗi đọc.

## 4. Cây phân loại nên hiểu khi phân tích

### 4.1 Nhóm và Type

Type hiện được định hướng theo 4 nhóm lớn:

1. `Thiên nhiên & Sinh thái`
2. `Tâm linh & Tôn giáo`
3. `Văn hóa - Lịch sử`
4. `Vui chơi & Giải trí`

Trong 4 nhóm đó, Type là lớp con như:

1. `Biển - Bãi tắm - Đảo`
2. `Núi - Cao nguyên - Đèo`
3. `Sông - Suối - Hồ - Thác`
4. `Hang động`
5. `Rừng - Vườn quốc gia`
6. `Sinh thái - Đồng quê - Vườn trái cây`
7. `Quần thể & Danh thắng tâm linh`
8. `Chùa - Đền - Miếu - Toà thánh`
9. `Nhà thờ - Công trình Công giáo`
10. `Di tích lịch sử - Thành cổ`
11. `Bảo tàng - Triển lãm`
12. `Làng nghề truyền thống`
13. `Công trình kiến trúc - Biểu tượng`
14. `Khu vui chơi - Công viên chủ đề`
15. `Nông trại - Vườn hoa - Cắm trại`
16. `Suối khoáng nóng - Onsen - Spa`
17. `Chợ - Phố đêm - Khu ẩm thực`
18. `Phố cổ - Phố đi bộ`

Nguyên tắc dùng Type:

1. Một điểm đến có thể có nhiều Type.
2. Nhưng luôn có một `PrimaryType` để hiển thị chính.
3. Type dùng để xây landing page SEO theo dạng `/loai/{nhom}/{type}`.

### 4.2 Tag

Tag là lớp cắt ngang search intent, không phải bản chất vật lý. Các nhóm tư duy chính của Tag gồm:

1. Đối tượng: gia đình, cặp đôi, nhóm bạn.
2. Trải nghiệm: check-in, săn mây, trekking, camping.
3. Bối cảnh: ban đêm, cuối tuần, theo mùa.
4. Giá trị nổi bật: ẩm thực, văn hóa bản địa, di sản, lịch sử chiến tranh, biểu tượng địa phương.

Nguyên tắc dùng Tag:

1. Tag là bộ từ vựng đóng, không cho nhập tự do.
2. Tag không được trùng nghĩa với Type.
3. Tag dùng để tạo trang chủ đề `/chu-de/{slug}` và để tăng khả năng gom điểm đến theo search intent.

## 5. Cách website public sắp xếp và hiển thị

### 5.1 Các route public chính

Các route quan trọng cần hiểu khi phân tích UX và SEO:

1. `/diem-den`: trang khám phá hợp nhất, có facet theo tỉnh, cụm, loại, từ khóa.
2. `/diem-den/{slug}`: trang chi tiết điểm đến hoặc cụm.
3. `/tinh/{slug}`: landing page theo tỉnh.
4. `/loai`: danh sách nhóm loại.
5. `/loai/{groupSlug}`: landing page theo nhóm loại.
6. `/loai/{groupSlug}/{typeSlug}`: landing page theo Type.
7. `/chu-de/{slug}`: landing page theo Tag.
8. `/cam-nang/{slug}`: bài cẩm nang tổng hợp, khác hẳn bài điểm đến.

Điểm cần hiểu rõ:

1. `/diem-den` là trang khám phá có facet, thiên về search và browse.
2. `/tinh`, `/loai`, `/chu-de` là các landing page SEO có chủ đích.
3. `/cam-nang/{slug}` là lớp nội dung hỗ trợ topical authority và internal link, không thay thế trang destination.

### 5.2 Trang tỉnh hiển thị như thế nào

Trang tỉnh là landing page địa lý cấp cao, không phải bài chi tiết như một POI.

Vai trò của trang tỉnh:

1. Làm SEO landing cho truy vấn kiểu “du lịch {tỉnh}”.
2. Liệt kê các điểm đến nổi bật trong tỉnh.
3. Là một điểm vào điều hướng cho người chưa biết chính xác sẽ đi đâu.

Tỉnh không đi theo luồng `/diem-den/{slug}` như một bài chi tiết hoàn chỉnh. Trong code public hiện tại,
node `province` được redirect sang route riêng `/tinh/{slug}`.

### 5.3 Trang cụm hiển thị như thế nào

Cụm là lớp trung gian, nhưng thực tế có 2 kiểu hiển thị khác nhau:

1. `Cluster có thông tin thăm quan riêng`
   Ví dụ kiểu khu du lịch hoặc vùng có thể hiện như một điểm đến lớn. Trường hợp này,
   cluster hiển thị gần giống một trang destination giàu nội dung, có body content và các khối phụ.

2. `Cluster không có thông tin thăm quan riêng`
   Trường hợp này nó hoạt động như một landing page gom con, ưu tiên hiển thị danh sách các điểm con.

Ngoài ra còn có biến thể `Flagship`:

1. Đây là node lớn, thường là cụm hoặc vùng trọng điểm.
2. Mục tiêu là làm trang tổng quan sâu cho cả vùng.
3. Trang này phải trả lời câu hỏi “ở cả vùng này có gì” chứ không chỉ mô tả một POI lẻ.

### 5.4 Trang điểm đến hiển thị như thế nào

POI là trang chi tiết đích cuối cùng. Đây là loại trang quan trọng nhất của site.

Một trang POI hiện nay thường gồm:

1. Hero ảnh, H1, badge Type và Tag.
2. Khối quyết định nhanh: giá vé, giờ mở cửa, địa chỉ, nút chỉ đường, điện thoại, CTA mua vé.
3. Thân bài nội dung chính do AI sinh và biên tập lại.
4. Gallery ảnh.
5. Đánh giá biên tập.
6. Link ngoài trung tính như Google Maps, TripAdvisor nếu có.
7. Mẹo và lưu ý thực tế.
8. Khối khách sạn.
9. Khối tour.
10. Khối quà mang về.
11. Khối điểm đến liên quan.
12. FAQ.

Nếu là POI nằm dưới một node cha flagship, trang còn có banner điều hướng kiểu “Về {node cha}”.

### 5.5 Trang flagship hiển thị khác gì

Node `ContentTier = flagship` là một điểm cần phân tích riêng. Đây không chỉ là vấn đề thiết kế bài viết,
mà còn là cách render trang.

Trang flagship khác trang POI ở chỗ:

1. Nó đại diện cho một vùng lớn hoặc cụm lớn.
2. Nó không xoáy vào một giá vé hoặc một giờ mở cửa duy nhất.
3. Khối “Điểm tham quan” được nâng thành một module chính của trang.
4. Website hiển thị các điểm con theo 2 lớp:
   - Lớp nổi bật
   - Lớp theo khu vực hoặc khoảng cách
5. Nó phù hợp để gắn thêm các bài cẩm nang như lịch trình, ẩm thực, buổi tối, quà mang về.

## 6. Cơ chế điều hướng nội dung quan trọng

### 6.1 Related destinations

Hệ thống có khối `RelatedJson` hoặc dữ liệu con để gợi ý điểm liên quan.

Mục tiêu:

1. Tăng internal link.
2. Giữ người dùng khám phá thêm trong cùng vùng hoặc cùng loại trải nghiệm.
3. Hỗ trợ mini itinerary và các hành vi đọc tiếp theo.

### 6.2 Article to Destination mapping

Ngoài bài destination, hệ thống còn có bài cẩm nang tổng hợp. Các bài này có thể được gắn ngược vào destination
theo `topic`, ví dụ:

1. `itinerary`
2. `food`
3. `nightlife`
4. `souvenir`
5. `poi-guide`
6. `general`

Điều này cho phép một node flagship như Đà Lạt hiển thị thêm link kiểu:

1. Xem lịch trình chi tiết
2. Xem thêm về ẩm thực
3. Xem thêm về buổi tối
4. Xem thêm quà mang về

### 6.3 Vai trò của hotel, tour và article trong toàn hệ

Đây là 3 module dễ bị bỏ sót khi chỉ nhìn website destination page, nhưng thực tế chúng là một phần quan trọng của mô hình sản phẩm.

#### Hotel

Hotel không phải một site con SEO độc lập. Vai trò chính là:

1. Là card gợi ý đặt phòng trên trang điểm đến.
2. Hỗ trợ chuyển đổi affiliate.
3. Làm trang destination thực dụng hơn, không chỉ là bài đọc thông tin.

Gemini nên hiểu rằng hotel hiện được xem là mô-đun dữ liệu phục vụ destination, không phải một vertical content đầy đủ như destination.

#### Tour

Tour cũng có vai trò tương tự hotel nhưng ở tình huống người dùng muốn mua hành trình đóng gói:

1. Gợi ý tour phù hợp ngay trong trang điểm đến.
2. Đặc biệt quan trọng ở node flagship và các vùng có lịch trình nhiều ngày.
3. Có liên hệ trực tiếp với khối lịch trình, nhưng không phải cùng một thứ.

#### Article hoặc cẩm nang

Article là lớp nội dung tổng hợp, khác destination ở bản chất:

1. Destination mô tả một nơi cụ thể.
2. Article mô tả một chủ đề hoặc một danh sách nhiều nơi.

Vai trò của article:

1. Kéo traffic informational đầu phễu.
2. Làm internal link hàng loạt tới destination, hotel, tour.
3. Bổ sung các chủ đề mà trang destination không nên ôm hết, ví dụ lịch trình chi tiết, ẩm thực, buổi tối, top điểm check-in.

Điểm rất quan trọng:

1. Article không chỉ là bài viết tự do.
2. Nó có thể chứa dynamic blocks như danh sách destination, hotel, tour.
3. Các block này được compile khi publish, không resolve động lúc người dùng mở trang.

## 7. Prompt AI hiện tại tạo bài như thế nào

### 7.1 Cách chọn prompt

Khi tạo bài destination, hệ thống chọn prompt theo `articleType = guide-diem-den` và `contentTier`:

1. Nếu `contentTier = flagship` thì dùng prompt pack riêng cho flagship.
2. Nếu không phải flagship thì dùng prompt pack điểm đến thường.

Thứ tự lấy prompt:

1. Ưu tiên prompt active trong database.
2. Nếu không có, fallback về prompt mặc định trong code.

### 7.2 Điểm đến thường: prompt đang ép những gì

Bài điểm đến thường đang bị ép theo 7 section cố định, theo đúng thứ tự:

1. `tong-quan`
2. `trai-nghiem`
3. `mua-nao`
4. `lich-trinh`
5. `di-chuyen`
6. `an-gi`
7. `qua-mang-ve`

Ý nghĩa thực tế của 7 khối này:

1. Tổng quan hoặc giới thiệu về điểm đến.
2. Trải nghiệm cụ thể khách sẽ làm ở đó.
3. Nên đi mùa nào hoặc thời điểm nào.
4. Lịch trình gợi ý cho một điểm lẻ, tập trung vào “nên dành bao lâu” và “kết hợp với điểm nào gần đó”.
5. Di chuyển tới nơi.
6. Ăn gì đặc trưng.
7. Quà mang về.

Ngoài 7 section, prompt còn ép AI sinh thêm các field khung:

1. `title`
2. `intro`
3. `quickFacts`
4. `faq`
5. `metadata`

Lưu ý runtime hiện tại:

1. Trước đây prompt có yêu cầu `updateNotice`, nhưng đã được bỏ khỏi prompt destination.
2. Badge cập nhật nay lấy động từ dữ liệu hệ thống khi publish/render, không bake text cứng từ AI.

Các rule quan trọng của prompt điểm đến thường:

1. Các khối `trai-nghiem`, `an-gi`, `qua-mang-ve` phải có `items[]` dạng danh sách cấu trúc.
2. `lich-trinh` phải là văn xuôi, không dùng danh sách items.
3. Không được bịa số liệu như giá, giờ, khoảng cách nếu source context không có.
4. Nếu nhắc tới điểm đến khác thì phải dùng đúng tên chuẩn để hệ thống auto-link nội bộ.

### 7.3 Cụm hoặc flagship: prompt đang ép những gì

Flagship vẫn dùng 7 blockKey như trên, nhưng ý nghĩa đổi sang góc nhìn vùng lớn:

1. Tổng quan cả vùng.
2. Trải nghiệm tiêu biểu của cả vùng.
3. Nên đi vào mùa nào.
4. Lịch trình gợi ý 2N1Đ, 3N2Đ hoặc tương đương.
5. Di chuyển tới vùng đó.
6. Ăn gì đặc trưng của vùng.
7. Quà mang về từ vùng.

Rule quan trọng của prompt flagship:

1. Không được viết như thể đây là một POI lẻ.
2. Không được bịa một giờ mở cửa hay giá vé chung cho cả vùng.
3. Quick facts phải phản ánh thực tế “tùy điểm tham quan cụ thể”.
4. `trai-nghiem` phải là hoạt động cấp vùng, không phải chỉ liệt kê tên các điểm con.
5. `lich-trinh` có thể dài hơn để mô tả theo ngày hoặc buổi.

### 7.4 Prompt generation flow hiện tại

Về mặt pipeline, bài destination hiện ưu tiên sinh toàn bộ bài trong một lần gọi AI cho bước `content`,
thay vì tách rời từng section rồi mới làm frame như thiết kế cũ.

Mục tiêu của cách này:

1. Giảm lặp ý giữa intro và section tổng quan.
2. Giảm lặp ý giữa quick facts với section đầy đủ.
3. Giúp model nhìn toàn bài để tự tránh trùng lặp tốt hơn.

### 7.5 AI viết gì và máy tự ghép gì

Đây là ranh giới mà Gemini cần hiểu rõ khi audit chất lượng nội dung và chất lượng UX.

AI không viết ra toàn bộ những gì người dùng thấy trên trang.

Thông thường:

1. AI viết phần bài chính theo 7 section và các field khung như intro, FAQ, metadata.
2. Hệ thống ghép thêm các phần dữ liệu cứng hoặc precompute như giá vé, giờ mở cửa, price breakdown, practical notes, hotel cards, tour cards, related destinations, article links.
3. Website render các khối này theo logic UI riêng.

Hệ quả khi phân tích:

1. Nếu một trang hiển thị dở, chưa chắc prompt AI dở; có thể khối render hoặc dữ liệu ngoài prompt đang yếu.
2. Nếu nội dung bài hay nhưng tỷ lệ chuyển đổi thấp, có thể vấn đề nằm ở placement của hotel hoặc tour card, không phải ở văn bản.
3. Nếu user thấy trùng lặp, phải xem đó là trùng ở AI section hay trùng giữa AI section với quick facts hoặc block động.

### 7.6 Raw prompt hiện tại (trích từ code)

Phần này là bản tóm tắt sát runtime để bạn có thể đưa thẳng cho Gemini mà không bị lệch với code.

#### 7.6.1 Cách hệ thống resolve prompt thực tế

1. Hệ thống luôn resolve theo thứ tự: prompt active trong DB trước, fallback về `DEFAULT_PROMPTS` trong code nếu DB chưa có.
2. Với destination:
   - `articleType = guide-diem-den`
   - nếu `contentTier = flagship` thì ưu tiên key `guide-diem-den-flagship.*.vi`
   - nếu không phải flagship thì dùng `guide-diem-den.*.vi`
3. Pipeline generate chính hiện dùng operation `content` (một lần gọi AI để ra cả section + frame), thay vì tách `section` rồi `frame` như trước.

#### 7.6.2 Key prompt destination đang dùng

1. System prompt: `article.system.vi`
2. Standard destination:
   - `guide-diem-den.outline.vi`
   - `guide-diem-den.content.vi`
   - (`guide-diem-den.section.vi`, `guide-diem-den.frame.vi` còn giữ để tương thích migration/công cụ phụ)
3. Flagship destination:
   - `guide-diem-den-flagship.outline.vi`
   - `guide-diem-den-flagship.content.vi`
   - (`guide-diem-den-flagship.section.vi`, `guide-diem-den-flagship.frame.vi` còn giữ để tương thích migration/công cụ phụ)

#### 7.6.3 Raw instruction cốt lõi của prompt destination (đang chạy)

`article.system.vi`:

```text
Bạn là chuyên gia viết content affiliate tiếng Việt cho website thương mại.
Bạn LUÔN viết tiếng Việt có dấu đầy đủ, viết trung thực, chỉ dùng dữ liệu được cung cấp,
tuân thủ schema output nghiêm ngặt.
```

`guide-diem-den.content.vi` ép model:

1. Viết TOÀN BỘ bài trong 1 lần: 7 section + intro + quickFacts + faq + metadata.
2. Giữ đúng outline và đúng thứ tự 7 blockKey cố định:
   `tong-quan | trai-nghiem | mua-nao | lich-trinh | di-chuyen | an-gi | qua-mang-ve`.
3. `trai-nghiem`, `an-gi`, `qua-mang-ve` bắt buộc có `items[]` (>= 3 mục `{ten, moTa}`),
   còn `lich-trinh` viết văn xuôi, không dùng `items`.
4. Chống trùng lặp rõ ràng giữa:
   - intro và `tong-quan`
   - quickFacts.transport và section `di-chuyen`
   - quickFacts.food và section `an-gi`
5. Không bịa số liệu; thiếu dữ liệu thì viết định tính hoặc ghi cần kiểm tra lại theo rule từng field.
6. Metadata bị ép theo SEO format (metaTitle 50-60 ký tự, không trùng y nguyên H1/title, metaDescription có từ khóa).

`guide-diem-den-flagship.content.vi` ép model:

1. Vẫn 7 blockKey như trên nhưng góc nhìn vùng lớn/tổng quan, không viết như POI lẻ.
2. `mua-nao` là khối bắt buộc phải rõ mùa đẹp/mùa cần lưu ý.
3. `lich-trinh` có thể dài hơn để mô tả mẫu theo ngày/buổi.
4. Quick facts không được bịa 1 giá vé/giờ mở cửa chung cho cả vùng:
   - `openingTime`, `ticketPrice` phải ghi kiểu “Tuỳ điểm tham quan cụ thể — xem trang từng điểm”.

#### 7.6.4 Biến đầu vào template hiện có

Các biến được render vào prompt ở runtime (PromptBuilder base vars + step vars):

1. `topic`
2. `keywords`
3. `toneProfile`
4. `sourceContext`
5. `articleType`
6. `outline` (khi vào bước content)
7. `title` (khi vào bước content)

Lưu ý cho Gemini khi audit prompt:

1. Nội dung trong file này phản ánh baseline prompt trong code.
2. Runtime thật có thể đang dùng bản DB mới hơn nếu team đã tạo version prompt active trong `prompt_templates`.
3. Vì vậy nên xem đây là “default runtime baseline”; nếu có bản prompt active mới trong DB thì ưu tiên xem đó là runtime thực tế cuối cùng.

## 8. Những điểm Gemini nên đặc biệt chú ý khi phân tích

### 8.1 Phân biệt 3 lớp khác nhau

LLM cần tách bạch 3 việc sau, nếu không sẽ kết luận sai:

1. `Cây địa lý`: tỉnh, cụm, điểm đến.
2. `Taxonomy`: Type và Tag.
3. `Content tier`: flagship hay standard.

Ba lớp này độc lập với nhau.

Ví dụ:

1. Một node có thể là `cluster` nhưng đồng thời là `flagship`.
2. Một POI có thể có nhiều Type và nhiều Tag.
3. Một bài hiển thị giàu nội dung chưa chắc là POI, có thể là cluster có own visit info.

### 8.2 Các câu hỏi phân tích tốt nên trả lời

Nếu dùng tài liệu này làm input cho Gemini, các câu hỏi phù hợp gồm:

1. Cây tỉnh -> cụm -> điểm đến hiện tại đã tối ưu cho search intent chưa?
2. Có điểm nào cụm đang làm trùng vai trò với tỉnh hoặc POI không?
3. Bộ Type và Tag hiện tại đã đủ mạnh để tạo landing page SEO chưa?
4. Các route public đang chồng chéo hay thiếu lớp nào không?
5. Prompt cho flagship đã đủ khác prompt POI chưa?
6. Trang flagship có đang thiếu các khối nội dung đặc thù vùng lớn không?
7. Có điểm nào trong UX đang làm người dùng khó đi từ khám phá sang đặt vé, đặt khách sạn, đặt tour không?
8. Có nơi nào đang có rủi ro cannibalization giữa tỉnh, cụm, type page, tag page và bài cẩm nang không?

### 8.3 Các điểm mù hoặc rủi ro hiện có

Đây là các vấn đề Gemini nên xem như tín hiệu cần audit kỹ:

1. Tài liệu taxonomy giữa các file chưa hoàn toàn đồng bộ.
2. Một số cluster có hai vai trò: vừa landing vừa quasi-destination page.
3. Flagship là khái niệm rất mạnh nhưng nếu dùng không nhất quán sẽ làm prompt và UX lệch nhau.
4. Trang POI đang gánh cả SEO, UX lẫn monetization nên rất dễ quá tải nếu thứ tự khối chưa đúng.
5. Nếu Type và Tag không được dùng chặt, landing page sẽ dễ mỏng hoặc chồng keyword.

### 8.4 Những phần đã là as-built và những phần còn mang tính kế hoạch

Một điểm quan trọng khi dùng tài liệu nội bộ để nhờ LLM tư vấn là không được trộn lẫn “đang chạy thật” với “đã nghĩ ra trong spec nhưng chưa build hết”.

Khi đọc dichoithoi, Gemini nên giả định:

1. Cách hiển thị cơ bản của `/diem-den`, `/tinh`, `/loai`, `/chu-de`, `/diem-den/{slug}` là as-built đáng tin.
2. Prompt destination và prompt flagship hiện tại là as-built đáng tin.
3. Nhiều ý tưởng về taxonomy, article, image workflow, extraction, block động, hotel, tour có thể đang ở các mức khác nhau: đã build một phần, đang chạy thật một phần, hoặc mới là spec.

Vì vậy, khi đánh giá hoặc đề xuất:

1. Nên hỏi ngược “đây là vấn đề của site đang chạy hay của roadmap/spec chưa hoàn tất?”.
2. Nên tách đề xuất thành 2 loại: tối ưu as-built và quyết định sản phẩm cấp roadmap.

### 8.5 Nếu cần phân tích sâu, nên yêu cầu Gemini trả lời theo 5 lớp

Đây là cấu trúc đầu ra phù hợp nhất cho dự án này:

1. Product model: website đang phục vụ hành vi người dùng nào.
2. Information architecture: cây tỉnh, cụm, điểm đến và taxonomy có hợp lý không.
3. Public UX and SEO: route, landing page, detail page, internal link, content hierarchy.
4. Content generation: prompt, block structure, source context, risk of repetition or thin content.
5. Monetization: placement và logic của ticket, hotel, tour, article support.

## 9. Kết luận ngắn cho LLM

Nếu phải tóm tắt dichoithoi trong vài dòng để reasoning:

1. Đây là một website du lịch Việt Nam theo mô hình địa lý + taxonomy, dùng AI để sản xuất và cập nhật nội dung destination.
2. Cây chính là `tỉnh -> cụm -> điểm đến`, nhưng cách hiển thị của `cụm` có 2 biến thể và `flagship` là một lớp ưu tiên nội dung riêng.
3. Type trả lời “nơi này là gì”, Tag trả lời “nơi này phù hợp trải nghiệm gì”.
4. Trang public quan trọng nhất là `/diem-den/{slug}`, nhưng hệ thống SEO còn phụ thuộc mạnh vào `/tinh`, `/loai`, `/chu-de` và bài cẩm nang.
5. Prompt AI hiện tại đã tách rõ `POI thường` và `Flagship`, đều chạy theo khung 7 section cố định, nhưng ý nghĩa và mức tổng quan khác nhau.
6. AI chỉ viết một phần của trải nghiệm trang; nhiều khối quan trọng là dữ liệu cứng hoặc khối được hệ thống ghép thêm lúc publish và render.
7. Bài toán tối ưu tiếp theo không chỉ là viết bài hay hơn, mà là đồng bộ giữa taxonomy, cây điều hướng, route public, prompt, workflow publish, và placement của các khối kiếm tiền.

## 10. Phụ lục tóm tắt tự đủ để gửi Gemini

Để tránh phụ thuộc file tham chiếu ngoài, có thể coi các mục dưới đây là bản tóm tắt thay cho doc gốc:

1. Kiến trúc hệ thống:
   ZinoFlow là nơi soạn/duyệt/publish; website public chỉ đọc dữ liệu đã publish; không gọi AI lúc render.

2. Prompt destination:
   Có hai nhánh standard và flagship; cả hai dùng khung 7 blockKey cố định, nhưng flagship bắt buộc góc nhìn vùng lớn.

3. UX/SEO detail page:
   POI tập trung quyết định nhanh + nội dung thực dụng; flagship tập trung tổng quan vùng + điều hướng điểm con.

4. Taxonomy:
   Type = bản chất điểm đến; Tag = search intent/trải nghiệm cắt ngang; tránh trùng nghĩa Type/Tag.

5. Article cẩm nang:
   Là lớp nội dung hỗ trợ topical authority và internal link; có thể chứa block động khi publish.

6. Nguyên tắc chất lượng:
   Ưu tiên cấu trúc thông tin khoa học, giá trị thật cho người dùng, và SEO bền vững theo chuẩn Google.

## 11. Cách dùng tài liệu này với Gemini để ra tư vấn tốt hơn

### 11.1 Mục tiêu đúng khi đưa vào Gemini

Mục tiêu không phải chỉ để Gemini “đọc hiểu dự án”, mà để nó trả lời tốt 3 câu hỏi khó hơn:

1. Cách tổ chức thông tin hiện tại của dichoithoi đã hợp lý chưa.
2. Nội dung và khối hiển thị trên từng loại trang đã đủ đúng với search intent chưa.
3. Prompt tạo content hiện tại nên đổi như thế nào để bài viết hữu ích hơn, ít lặp hơn, và khớp cấu trúc trang hơn.

Nếu muốn Gemini tư vấn đúng, nên yêu cầu nó phân tích theo góc nhìn product + SEO + content system,
không chỉ như một copywriter hay chỉ như một kỹ sư prompt.

### 11.2 Gemini nên được giao những việc gì

Các nhóm việc phù hợp nhất:

1. Đánh giá cây tỉnh -> cụm -> điểm đến có hợp với hành vi tìm kiếm thực tế không.
2. Đánh giá Type và Tag có đang đủ để tạo landing page mạnh chưa.
3. Đánh giá mỗi loại trang đang thiếu hay thừa khối nội dung nào.
4. Đánh giá prompt hiện tại có đang ép đúng cấu trúc nhưng chưa đủ chiều sâu hay chưa.
5. Đề xuất cách tách vai trò giữa POI, flagship, article cẩm nang để tránh trùng lặp nội dung.
6. Đề xuất prompt mới hoặc bổ sung prompt rule để nội dung gắn chặt hơn với UX và conversion.

### 11.3 Gemini không nên làm gì nếu không có thêm dữ liệu thật

Để tránh tư vấn lệch, không nên để Gemini tự quyết những việc sau mà không có kiểm chứng:

1. Tự kết luận taxonomy nào chắc chắn đúng nếu chưa đối chiếu search intent thật.
2. Tự đề nghị nhét thêm thật nhiều section chỉ vì “đủ nội dung”, bỏ qua mật độ đọc và conversion.
3. Tự suy luận rằng trang tỉnh, cụm, POI đều nên có cùng một công thức nội dung.
4. Tự đánh giá prompt chỉ dựa trên lý thuyết mà không nhìn mối quan hệ giữa prompt và khối render thực tế.

### 11.4 Những hướng cải thiện prompt mà Gemini nên tập trung

Nếu mục tiêu là làm prompt hiệu quả hơn, Gemini nên tập trung phân tích và đề xuất quanh các trục này:

1. Search intent fit:
   Prompt hiện tại đã ép đủ 7 section, nhưng cần xem mỗi section có thực sự trả lời đúng ý định tìm kiếm của từng loại node hay không.

2. Vai trò theo node type:
   Prompt của POI và flagship đã tách, nhưng có thể vẫn chưa đủ mạnh ở chỗ phân vai giữa “điểm lẻ”, “vùng lớn”, và “bài cẩm nang”.

3. Tránh lặp:
   Cần xem các rule hiện tại đã đủ chặn lặp giữa intro, tổng quan, quick facts, section lịch trình, section trải nghiệm, và các block render thêm chưa.

4. Gắn với dữ liệu thật:
   Prompt nên tận dụng tốt hơn source context, Type, Tag, parent node, related destinations, hotel, tour, article links nếu các dữ liệu này giúp tăng chất lượng nội dung.

5. Conversion-aware writing:
   Prompt hiện thiên về cấu trúc thông tin. Gemini nên xem có cần tăng rule để bài viết mở đường tốt hơn cho vé, tour, hotel mà không thành quảng cáo lộ liễu không.

6. Distinctiveness:
   Prompt nên làm rõ hơn đâu là phần một trang destination bắt buộc phải có tiếng nói riêng, tránh ra bài nào cũng cùng một khuôn sáo dù đã đúng heading.

### 11.5 Dạng đầu ra nên yêu cầu Gemini trả về

Để câu trả lời dùng được ngay, nên yêu cầu Gemini xuất theo format này:

1. Các vấn đề lớn nhất trong cấu trúc thông tin và nội dung hiện tại.
2. Các vấn đề riêng của POI.
3. Các vấn đề riêng của flagship hoặc cụm lớn.
4. Các vấn đề riêng của trang tỉnh, Type, Tag, article.
5. Đề xuất cải thiện prompt ở mức nguyên tắc.
6. Đề xuất chỉnh prompt cụ thể, có ví dụ rule hoặc đoạn prompt thay thế.
7. Các rủi ro nếu giữ nguyên prompt hiện tại.
8. Thứ tự ưu tiên nên làm trước.

### 11.6 Prompt mẫu để dán vào Gemini

Bạn có thể dùng tài liệu này làm context rồi dán prompt sau:

```text
Hãy đọc kỹ tài liệu briefing dự án dichoithoi này như bối cảnh hệ thống.

Vai trò của bạn: chuyên gia product SEO content architecture cho website du lịch, đồng thời hiểu thiết kế prompt cho hệ thống AI tạo nội dung.

Mục tiêu của bạn không phải chỉ tóm tắt tài liệu, mà phải phân tích xem:
1. Cách tổ chức tỉnh -> cụm -> điểm đến hiện tại có hợp lý không.
2. Type và Tag đã đủ mạnh cho điều hướng và SEO chưa.
3. Mỗi loại trang gồm tỉnh, cụm, flagship, POI, type page, tag page, article cẩm nang đang nên hiển thị gì và đang có nguy cơ trùng lặp gì.
4. Prompt tạo content hiện tại cho destination thường và flagship có điểm yếu gì.
5. Nên cải thiện prompt như thế nào để nội dung hữu ích hơn, khác biệt hơn, khớp search intent hơn, và hỗ trợ conversion tốt hơn.

Yêu cầu đầu ra:
1. Không chỉ khen hoặc chê chung chung.
2. Chỉ ra vấn đề theo từng lớp: information architecture, content strategy, page structure, prompt design.
3. Ưu tiên tìm các điểm có thể gây thin content, duplicated intent, internal cannibalization, lặp ý giữa các trang hoặc giữa các block trong cùng trang.
4. Đề xuất cải thiện prompt theo kiểu hành động được, ví dụ thêm rule gì, bỏ rule gì, tách prompt theo loại node nào, đưa thêm input nào vào source context.
5. Với mỗi đề xuất quan trọng, giải thích tại sao thay đổi đó sẽ làm nội dung tốt hơn hoặc hiệu quả hơn.

Hãy trả lời theo cấu trúc:
A. Những điểm đang làm tốt.
B. Những vấn đề lớn nhất của hệ thống hiện tại.
C. Những vấn đề riêng của prompt content.
D. Đề xuất cải thiện prompt ở mức chiến lược.
E. Đề xuất chỉnh prompt cụ thể có thể áp dụng ngay.
F. Thứ tự ưu tiên nên làm trước.
```

### 11.7 Nếu muốn Gemini tập trung riêng vào prompt

Nếu bạn chỉ muốn Gemini soi prompt thay vì audit toàn hệ, nên nói rõ thêm:

1. Hãy coi cấu trúc trang hiện tại là ràng buộc cố định.
2. Chỉ tập trung vào cách prompt nên sinh nội dung để khớp từng khối hiển thị.
3. Tách riêng đề xuất cho POI và flagship.
4. Không đề xuất thêm section mới nếu chưa chỉ ra section cũ đang thiếu gì.

Mục đích của ràng buộc này là tránh việc Gemini trả lời theo kiểu “thêm nhiều mục hơn là tốt hơn”, trong khi bài toán thật là làm nội dung đúng vai trò của từng trang.

## 12. Ví dụ thực tế từ 1 job thật (outline + content)

Mục này là ví dụ chạy thật để Gemini hiểu rõ hệ thống đang gửi gì cho AI và AI trả về thế nào.

Thông tin job:

1. Job URL: http://localhost:3005/content/abaa605a-c2e7-4244-b9a6-bb263f06edb7
2. Site: dichoithoi
3. Model: gemini/gemini-3.1-flash-lite
4. Trạng thái: DraftReady
5. Số bước AI: 2 bước (outline + content)

Tổng quan chất lượng tự động của hệ thống tại thời điểm lấy ví dụ:

1. Dữ liệu sản phẩm: pass
2. Trùng lặp nội dung: pass (có cảnh báo)
3. Chính sách nội dung: pass
4. SEO: fail
5. Cấu trúc bài viết: pass

SEO fail cụ thể:

1. Từ khóa chính "Thác Triệu Hải" chưa xuất hiện trong mở bài.

### 12.1 Bước outline

Prompt đã gửi (trích nguyên văn):

```text
Bạn là cây viết du lịch người Việt giàu kinh nghiệm, đã đi thực tế nhiều vùng miền Việt Nam, viết cho website cẩm nang du lịch dichoithoi.com. Người đọc là người đang lên kế hoạch một chuyến đi thật — bài viết phải giúp họ quyết định được: có nên đi không, đi khi nào, chuẩn bị gì, tới nơi thì làm gì.

Nguyên tắc bắt buộc:
- LUÔN viết tiếng Việt có dấu đầy đủ, giọng tự nhiên như người từng đến nơi kể lại cho bạn bè — không phải giọng quảng cáo hay tờ rơi du lịch.
- Mọi con số (giá vé, giờ mở cửa, khoảng cách, thời gian di chuyển) CHỈ được lấy từ dữ liệu cung cấp trong prompt; thiếu thì viết định tính hoặc ghi rõ cần kiểm chứng — TUYỆT ĐỐI không bịa.
- Trung thực cả hai chiều: nêu điểm hay lẫn hạn chế thật (đông đúc, nắng nóng, dịch vụ còn ít...) khi bối cảnh cho thấy; không claim tuyệt đối ("đẹp nhất", "duy nhất", "rẻ nhất") khi không có nguồn.
- Ưu tiên chi tiết hữu ích, cụ thể, làm theo được — hơn là tính từ hoa mỹ.
- Tuân thủ schema output nghiêm ngặt.

Tạo OUTLINE cho bài viết GIỚI THIỆU ĐIỂM ĐẾN DU LỊCH Việt Nam, chuẩn SEO,
giọng văn như người đã đi thực tế viết lại — không liệt kê khô khan.
Điểm đến: Thác Triệu Hải
Từ khóa chính: Thác Triệu Hải
Giọng văn: tự nhiên, gần gũi, trung thực
DỮ LIỆU ĐIỂM ĐẾN (nguồn sự thật — ưu tiên tuyệt đối khi viết):
[đã truyền đầy đủ sourceContext gồm: dữ liệu điểm đến, điểm liên quan, ghi chú quản trị, tóm tắt nguồn tham khảo]

Yêu cầu:
- BẮT BUỘC viết tiếng Việt có dấu đầy đủ trong toàn bộ nội dung.
- Nếu chủ đề hoặc dữ liệu đầu vào không dấu, hãy chuẩn hóa lại thành tiếng Việt có dấu.
- title: 50-70 ký tự, chứa tên điểm đến, gợi đúng search intent du lịch.
- sectionHeadings: ĐÚNG 7 mục H2 theo THỨ TỰ CỐ ĐỊNH về Ý NGHĨA.
- plannedFaqQuestions: 3-6 câu đúng search intent thực tế.
- KHÔNG tự chế số liệu (giá vé, giờ, khoảng cách) ngoài dữ liệu được cung cấp.

[response JSON schema]
```

Response nhận về (nguyên văn):

```json
{
  "title": "Thác Triệu Hải: Kinh nghiệm khám phá thác Đakala hoang sơ",
  "sectionHeadings": [
    "Thác Triệu Hải: Nét đẹp hùng vĩ giữa đại ngàn Đạ Tẻh",
    "Những hoạt động thú vị cho chuyến dã ngoại tại thác",
    "Thời điểm lý tưởng để ghé thăm thác Triệu Hải",
    "Gợi ý lịch trình tham quan thác Triệu Hải trong ngày",
    "Hướng dẫn cách di chuyển đến thác Đakala",
    "Ăn uống gì khi đi dã ngoại tại thác Triệu Hải?",
    "Mua gì làm quà sau chuyến đi Đạ Tẻh?"
  ],
  "plannedFaqQuestions": [
    "Thác Triệu Hải có mất phí tham quan không?",
    "Đường vào thác Triệu Hải có khó đi không, xe ô tô vào được không?",
    "Nên chuẩn bị gì khi đi cắm trại tại thác Triệu Hải?",
    "Thác Triệu Hải có dịch vụ lưu trú không?"
  ]
}
```

### 12.2 Bước content

Prompt đã gửi (trích đúng phần cốt lõi, giữ nguyên logic):

```text
Bạn là cây viết du lịch người Việt giàu kinh nghiệm, đã đi thực tế nhiều vùng miền Việt Nam...

Viết TOÀN BỘ bài giới thiệu điểm đến du lịch tiếng Việt trong 1 lần — cả 7 khối nội dung
chính (sections) VÀ phần khung bài (intro/quickFacts/faq/updateNotice/metadata).
Điểm đến: Thác Triệu Hải
Từ khóa chính: Thác Triệu Hải
Outline: {"title":"Thác Triệu Hải: Kinh nghiệm khám phá thác Đakala hoang sơ", ...}
DỮ LIỆU ĐIỂM ĐẾN (nguồn sự thật): [truyền đầy đủ]
Giọng văn: tự nhiên, gần gũi, trung thực

Yêu cầu chính:
- Viết đủ 7 section với blockKey cố định.
- Không bịa số liệu.
- Khối trai-nghiem/an-gi/qua-mang-ve có items.
- intro không lặp ý với tổng quan.
- quickFacts ngắn gọn, không lặp lại section liên quan.
- faq đi thẳng vào trả lời.
- metadata đúng ràng buộc SEO.

[response JSON schema]
```

Response nhận về (nguyên văn, đã format lại cho dễ đọc):

```json
{
  "title": "Thác Triệu Hải: Kinh nghiệm khám phá thác Đakala hoang sơ",
  "intro": "Nếu bạn đang tìm kiếm một địa điểm để tạm rời xa sự ồn ào của thành phố, nơi có dòng nước mát lành và không gian rừng núi yên tĩnh, thì khu vực thác Đakala tại Lâm Đồng là một lựa chọn đáng cân nhắc...",
  "quickFacts": {
    "openingTime": "Không quy định giờ mở cửa, tuy nhiên nên tham quan vào ban ngày để đảm bảo an toàn.",
    "ticketPrice": "Miễn phí tham quan, tuy nhiên cần trả phí khoảng 20.000 VNĐ cho một phương tiện khi đi qua vườn của người dân.",
    "transport": "Bạn có thể di chuyển bằng xe máy hoặc ô tô gầm cao để tiếp cận gần chân thác.",
    "food": "Khu vực này không có dịch vụ ăn uống, bạn nên chủ động mang theo đồ ăn và bếp nướng cá nhân.",
    "hotel": "Không có dịch vụ lưu trú tại thác, bạn nên tìm nhà nghỉ ở khu vực trung tâm Đạ Tẻh.",
    "tip": "Hãy mang theo thuốc chống côn trùng và kiểm tra kỹ thời tiết trước khi khởi hành."
  },
  "faq": [
    {
      "question": "Thác Triệu Hải có mất phí tham quan không?",
      "answer": "Thác không thu phí tham quan trực tiếp..."
    },
    {
      "question": "Đường vào thác Triệu Hải có khó đi không, xe ô tô vào được không?",
      "answer": "Đường đi khá thuận tiện với xe máy..."
    },
    {
      "question": "Nên chuẩn bị gì khi đi cắm trại tại thác Triệu Hải?",
      "answer": "Vì đây là điểm đến chưa được khai thác dịch vụ..."
    },
    {
      "question": "Thác Triệu Hải có dịch vụ lưu trú không?",
      "answer": "Khu vực thác hiện không có khách sạn hay dịch vụ lưu trú nào..."
    }
  ],
  "updateNotice": "Thông tin trong bài cập nhật tháng 07/2026, giá vé và giờ mở cửa có thể thay đổi.",
  "metadata": {
    "name": "Thác Triệu Hải",
    "slugSuggestion": "thac-trieu-hai",
    "metaTitle": "Khám phá Thác Triệu Hải Lâm Đồng: Cẩm nang đi thác Đakala",
    "metaDescription": "Cùng khám phá Thác Triệu Hải (thác Đakala) tại Lâm Đồng với kinh nghiệm di chuyển, cắm trại và những lưu ý quan trọng...",
    "description": "Thác Triệu Hải, hay còn gọi là thác Đakala, tọa lạc tại xã Đạ Tẻh 2, tỉnh Lâm Đồng...",
    "searchKeyword": "Thác Triệu Hải, thác Đakala, du lịch Đạ Tẻh, cắm trại Lâm Đồng, phượt thác Lâm Đồng"
  },
  "sections": [
    {
      "heading": "Tổng quan / giới thiệu về Thác Triệu Hải",
      "blockKey": "tong-quan"
    },
    {
      "heading": "Trải nghiệm gì ở Thác Triệu Hải",
      "blockKey": "trai-nghiem"
    },
    {
      "heading": "Nên đi Thác Triệu Hải vào mùa nào",
      "blockKey": "mua-nao"
    },
    {
      "heading": "Lịch trình gợi ý khi đi Thác Triệu Hải",
      "blockKey": "lich-trinh"
    },
    {
      "heading": "Di chuyển tới Thác Triệu Hải",
      "blockKey": "di-chuyen"
    },
    {
      "heading": "Ăn gì đặc trưng ở Thác Triệu Hải",
      "blockKey": "an-gi"
    },
    {
      "heading": "Quà mang về từ Thác Triệu Hải",
      "blockKey": "qua-mang-ve"
    }
  ]
}
```

Lưu ý quan trọng khi đọc ví dụ này:

1. Job này được tạo tại thời điểm prompt version còn có trường updateNotice trong schema content.
2. Vì vậy ví dụ phản ánh đúng runtime của job đó, không phải cam kết rằng mọi job mới đều còn updateNotice.

### 12.3 Prompt dán Gemini để audit chất lượng chính ví dụ này

Bạn có thể dán prompt dưới đây vào Gemini, ngay sau khi dán mục ví dụ ở trên:

```text
Hãy đóng vai chuyên gia biên tập SEO du lịch và chuyên gia đánh giá chất lượng AI-writing.

Tôi sẽ cung cấp cho bạn 1 ví dụ job thật gồm:
1) Prompt outline + response outline
2) Prompt content + response content
3) Kết quả quality check nội bộ

Nhiệm vụ của bạn:
1. Chấm điểm tổng thể theo thang 100 và chấm theo từng nhóm:
    - SEO intent fit
    - Mức hữu ích thực tế cho người đọc
    - Độ tự nhiên như người thật (human-likeness)
    - Độ tin cậy dữ liệu / không bịa
    - Khả năng chuyển đổi (booking intent)
2. Với mỗi nhóm, nêu:
    - Điểm mạnh
    - Điểm yếu
    - Dẫn chứng cụ thể từ câu/đoạn trong response
3. Kiểm tra sâu SEO:
    - Keyword chính có xuất hiện tự nhiên ở intro/H1/H2 chưa
    - Rủi ro thin content, lặp ý, keyword stuffing
    - Rủi ro cannibalization giữa heading
    - Khả năng match search intent cho truy vấn đi thực tế
4. Kiểm tra sâu văn phong:
    - Có giống người từng đi thật không
    - Có bị sáo rỗng/công nghiệp hóa không
    - Có đoạn nào nghe như “AI viết” và vì sao
5. Đưa ra đề xuất sửa prompt để cải thiện chất lượng ở lần generate sau:
    - Rule nào cần thêm
    - Rule nào cần bỏ hoặc nới
    - Input context nào cần bổ sung
    - Cách sửa để vừa chuẩn SEO vừa tự nhiên như người thật

Yêu cầu đầu ra:
A. Điểm tổng + bảng điểm chi tiết
B. 10 vấn đề quan trọng nhất cần sửa (ưu tiên theo mức độ ảnh hưởng)
C. Prompt outline phiên bản đề xuất mới
D. Prompt content phiên bản đề xuất mới
E. 5 tiêu chí QA tự động nên thêm vào pipeline

Lưu ý bắt buộc:
- Không nhận xét chung chung.
- Mọi nhận định đều phải có bằng chứng từ ví dụ được cung cấp.
- Nếu thấy dữ liệu chưa đủ để kết luận, ghi rõ phần thiếu và ảnh hưởng của phần thiếu đó.
```

### 12.4 Prompt dán Gemini để trả về bản prompt mới dùng được ngay

Nếu bạn muốn Gemini trả về prompt mới ở dạng có thể copy trực tiếp vào hệ thống, dùng thêm câu chốt này:

```text
Khi đề xuất prompt mới, hãy xuất đúng 2 khối độc lập:
1) OUTLINE_PROMPT_V2
2) CONTENT_PROMPT_V2

Mỗi khối phải là plain text hoàn chỉnh có thể dán vào prompt template,
không giải thích chen giữa các dòng prompt.

Sau 2 khối, mới ghi phần giải thích ngắn vì sao sửa như vậy.
```
