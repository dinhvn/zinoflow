# BÁO CÁO PHÂN TÍCH, AUDIT CẢI TIẾN PROMPT VÀ CHIẾN LƯỢC SEO CONTENT FOR DICHOITHOI.COM

---

## A0. Đánh giá ví dụ job thật "Thác Triệu Hải"

### 1. Tóm tắt nhanh ví dụ

- **Mã Job**: `abaa605a-c2e7-4244-b9a6-bb263f06edb7`
- **Model**: `gemini/gemini-3.1-flash-lite`
- **Đối tượng**: POI điểm đến **Thác Triệu Hải** (tên gọi khác: Thác Đakala, thuộc Đạ Tẻh, Lâm Đồng).
- **Kết quả QA nội bộ**: Đạt các tiêu chuẩn về Dữ liệu sản phẩm, Chính sách và Cấu trúc. **FAIL SEO** do từ khóa chính _"Thác Triệu Hải"_ không xuất hiện ngay ở phần mở bài (`intro`).
- **Dạng Output**: 1 lần gọi sinh toàn bộ (`content`) ra JSON gồm Title, Intro, QuickFacts, 7 Sections, FAQ, UpdateNotice và Metadata.

---

### 2. Điểm mạnh của output hiện tại

- **Độ trung thực dữ liệu (Factual Accuracy) rất cao**: Model tôn trọng tuyệt đối `sourceContext`. Không hề bịa ra nhà hàng sang trọng hay resort quanh thác.
- **Phản ánh đúng thực tế phũ phàng**: Nêu rõ thông tin thực tế như không có dịch vụ lưu trú, không có quán ăn, và chi phí phát sinh 20.000 VNĐ gửi xe/qua vườn dân.
- **Tuân thủ Schema JSON**: Output trả về đúng cấu trúc field, không bị vỡ định dạng code, giữ nguyên 7 `blockKey` theo yêu cầu hệ thống.

---

### 3. Điểm yếu của output hiện tại

- **Văn phong "AI công nghiệp" ở phần mở đầu**: Lối viết còn mang tính khuôn mẫu, dùng các cụm từ mở đầu dập khuôn làm giảm trải nghiệm đọc tự nhiên.
- **Lặp thông tin giữa các phần**: Thông tin di chuyển, ăn uống và vé vào cửa bị lặp lại gần như nguyên văn từ `quickFacts` sang `faq` và sang bài viết chính.
- **Ép khung `items[]` ở nơi không có dịch vụ**: Với section `an-gi` và `qua-mang-ve`, do prompt bắt buộc có `items[]` (>= 3 mục), model phải loay hoay biến "đồ ăn tự mang" thành các item danh mục, gây khiên cưỡng.

---

### 4. Vấn đề SEO nổi bật

- **Thất bại việc đặt Từ khóa chính (Exact Keyword Placement)**: Lỗi nghiêm trọng nhất khiến QA đánh FAIL: Đoạn `intro` viết dài dòng nhưng câu đầu tiên lại dùng từ đồng nghĩa "thác Đakala" và bỏ quên từ khóa SEO chính "Thác Triệu Hải".
- **Heading thiếu Search Intent thực tế**: Heading 1 trong outline (`Thác Triệu Hải: Nét đẹp hùng vĩ giữa đại ngàn Đạ Tẻh`) mang tính văn nghệ tả cảnh, không giải quyết truy vấn tìm kiếm thực tế của người dùng (như _ở đâu, đi thế nào, kinh nghiệm phượt_).
- **Rủi ro Keyword Cannibalization trong FAQ**: Các câu hỏi FAQ trùng lặp trực tiếp với nội dung của H2 `di-chuyen` và `an-gi`, dễ làm loãng mật độ từ khóa chính.

---

### 5. Vấn đề văn phong "giống AI"

- **Lỗi "Nếu bạn đang tìm kiếm..."**: Mở đầu bài viết bằng mẫu câu quen thuộc của AI, tạo cảm giác thiếu trải nghiệm thực tế.
- **Lỗi tính từ hoa mỹ rỗng**: Sử dụng các cụm từ như "dòng nước mát lành", "không gian rừng núi yên tĩnh", "nét đẹp hùng vĩ".
- **Lỗi bị động và trung tính quá mức**: Giọng văn thiếu cá tính của người đi phượt thực tế, thiên về tóm tắt báo cáo thông tin.

---

### 6. 5 câu/đoạn cần sửa ngay (Trích nguyên văn từ ví dụ)

> **1. Đoạn `intro`:**
> _"Nếu bạn đang tìm kiếm một địa điểm để tạm rời xa sự ồn ào của thành phố, nơi có dòng nước mát lành và không gian rừng núi yên tĩnh, thì khu vực thác Đakala tại Lâm Đồng là một lựa chọn đáng cân nhắc..."_
>
> - **Lý do sửa**: Đây là "văn mẫu AI" điển hình. Đưa từ khóa đồng nghĩa (thác Đakala) lên trước, đẩy từ khóa SEO chính (Thác Triệu Hải) xuống quá sâu, vi phạm trực tiếp quy tắc SEO Exact Match ở 100 ký tự đầu.

> **2. Trường `updateNotice`:**
> _"Thông tin trong bài cập nhật tháng 07/2026, giá vé và giờ mở cửa có thể thay đổi."_
>
> - **Lý do sửa**: Text thông báo cập nhật bị AI "bake" cứng vào nội dung. Đúng kiến trúc hệ thống, phần này phải do hệ thống website tự render động dựa trên timestamp publish thực tế.

> **3. Heading H2 đầu tiên (`sections[0]`):**
> _"Thác Triệu Hải: Nét đẹp hùng vĩ giữa đại ngàn Đạ Tẻh"_
>
> - **Lý do sửa**: Heading sáo rỗng, mang tính từ tả cảnh. Cần đổi thành heading giải quyết intent tìm kiếm thực tế: _"Thác Triệu Hải ở đâu và có gì hấp dẫn?"_.

> **4. Câu trả lời trong `faq[0]`:**
> _"Thác không thu phí tham quan trực tiếp... tuy nhiên người dân địa phương có thể thu khoảng 20.000 VNĐ/phương tiện phí đi qua vườn..."_
>
> - **Lý do sửa**: Lặp lại y nguyên câu chữ đã xuất hiện ở `quickFacts.ticketPrice`. Cần viết ngắn gọn, đi thẳng vào câu trả lời: _"Miễn phí vé vào thác, nhưng bạn cần chuẩn bị 20.000 VNĐ/xe phí qua đường rẫy của dân địa phương."_

> **5. Đoạn `quickFacts.food`:**
> _"Khu vực này không có dịch vụ ăn uống, bạn nên chủ động mang theo đồ ăn và bếp nướng cá nhân."_
>
> - **Lý do sửa**: Nội dung này sau đó bị lặp lại nguyên văn ở đoạn văn xuôi của section `an-gi`. Cần quy định rõ: QuickFacts chỉ ghi thông tin dạng bảng rút gọn (`Chưa có dịch vụ - Tự mang đồ ăn`), dành phần diễn giải chi tiết cho thân bài.

---

## A. Chẩn đoán Prompt hiện tại

```

```

                 ┌────────────────────────────────────────┐
                 │         PROMPT HIỆN TẠI (V1)           │
                 └───────────────────┬────────────────────┘
                                     │
    ┌────────────────────────────────┼────────────────────────────────┐
    ▼                                ▼                                ▼

```

┌──────────────┐                 ┌──────────────┐                 ┌──────────────┐
│  ĐIỂM MẠNH   │                 │  ĐIỂM YẾU    │                 │   RỦI RO     │
├──────────────┤                 ├──────────────┤                 ├──────────────┤
│• 1-step call │                 │• Ép 7 H2 cứng│                 │• AI Cliché   │
│• Valid JSON  │                 │• Thiếu SEO   │                 │• Lặp ý       │
│• Fact-bound  │                 │  Exact Match │                 │• Thin Content│
└──────────────┘                 └──────────────┘                 └──────────────┘

```

### 1. Điểm mạnh

- **Luồng xử lý 1 bước (`content`)**: Sinh toàn bộ bài trong một lần gọi giúp giảm chi phí token và tránh lệch pha giữa Outline và Content.
- **Kiểm soát dữ liệu đầu vào tốt**: Ràng buộc "không bịa số liệu" hoạt động hiệu quả, giữ bài viết ở mức an toàn factual.

### 2. Điểm yếu

- **Ép khung 7 section cố định cho mọi POI**: Điểm đến thiên nhiên hoang sơ (như thác, hang động) bị ép phải viết mục "Quà mang về" hay "Ăn gì" dẫn đến việc sinh ra các nội dung gượng ép.
- **Thiếu quy tắc SEO Exact Match cứng**: Prompt chưa có ràng buộc kỹ thuật buộc model phải đưa từ khóa chính vào vị trí ưu tiên (H1, 100 ký tự đầu của Intro, Meta Title).
- **Chưa có bộ lọc Anti-AI Cliché**: Thiếu danh sách cấm các từ ngữ sáo rỗng làm văn phong bị "máy móc".

### 3. Rủi ro lặp ý (Redundancy Risk)

- **Vòng lặp 3 Lớp**: Thông tin bị lặp qua 3 lớp: `intro` -> `quickFacts` -> `sections` (thân bài). Prompt dặn "tránh lặp" nhưng không phân chia vai trò rõ ràng cho từng field.

### 4. Rủi ro Thin Content

- Khi điểm đến không có dữ liệu về mua sắm hay ăn uống, việc bắt buộc tạo danh sách `items[]` khiến AI cố tạo ra các thông tin chung chung (như "mang theo nước lọc", "mua trái cây dọc đường"), làm giảm chất lượng bài viết.

### 5. Rủi ro không khớp User Intent

- Model đối xử một POI phượt hoang sơ (Thác Triệu Hải) giống hệt một Khu du lịch thương mại (Bà Nà Hills), dẫn đến cách phân bổ nội dung thiếu tập trung vào các điểm người đi thật quan tâm (sóng điện thoại, địa hình đường đi, điểm gửi xe).

---

## B. Tách rõ 2 Prompt Strategy

```

```

              ┌──────────────────────────────────────────────┐
              │          PHÂN LẠI DÒNG SẢN PHẨM               │
              └──────────────────────┬───────────────────────┘
                                     │
             ┌───────────────────────┴───────────────────────┐
             ▼                                               ▼

```

┌─────────────────────────────────┐             ┌─────────────────────────────────┐
│     STANDARD POI STRATEGY       │             │   FLAGSHIP / CLUSTER STRATEGY   │
├─────────────────────────────────┤             ├─────────────────────────────────┤
│ • Trang ra quyết định ghé thăm  │             │ • Trang điều hướng tổng quan    │
│ • Góc nhìn: Chi tiết, micro     │             │ • Góc nhìn: Cấp vùng, macro     │
│ • Trả lời: Giá, giờ, cách đi    │             │ • Trả lời: Đi đâu, chia ngày    │
│ • Mẹo thực tế tại chỗ           │             │ • Gom nhóm các POI con          │
└─────────────────────────────────┘             └─────────────────────────────────┘

```

### 1. Strategy cho trang Điểm đến (POI)

- **Bản chất**: Trang hỗ trợ ra quyết định thực tế.
- **Mục tiêu**: Trả lời nhanh các câu hỏi: _Có đáng đi không? Đi mất bao lâu? Đường đi ra sao? Chi phí thực tế thế nào?_
- **Tập trung vào**: Thông tin thực địa chi tiết (địa hình, trang phục, lưu ý an toàn, mẹo trải nghiệm tại chỗ).

### 2. Strategy cho trang Cụm / Flagship

- **Bản chất**: Trang định hướng và gom nhóm địa lý.
- **Mục tiêu**: Trả lời câu hỏi: _Khu vực này có những điểm nào? Phân bổ lịch trình 2N1Đ/3N2Đ ra sao? Nên ở khu vực nào để tiện đi lại?_
- **Tập trung vào**: Liên kết vùng, phân nhóm điểm đến theo trải nghiệm, bức tranh tổng thể về di chuyển và ẩm thực địa phương.

### 3. Bảng so sánh khác biệt giữa 2 loại Prompt

| Tiêu chí                     | Trang Điểm đến lẻ (Standard POI)                                   | Trang Cụm / Flagship                                                    |
| :--------------------------- | :----------------------------------------------------------------- | :---------------------------------------------------------------------- |
| **Thực thể trung tâm**       | Một địa danh đơn lẻ, cụ thể.                                       | Một vùng địa lý, một cụm du lịch lớn.                                   |
| **Search Intent**            | Truy vấn cụ thể về điểm đến (giá vé, giờ mở cửa, review thực tế).  | Truy vấn khám phá rộng (du lịch [Tên vùng], chơi đâu ở [Tên cụm]).      |
| **Góc nhìn (Perspective)**   | Cận cảnh (Micro): Trải nghiệm thực tế tại chỗ.                     | Bao quát (Macro): Định hướng lịch trình và phân bổ thời gian.           |
| **Xử lý QuickFacts**         | Con số cụ thể (Giá vé chính xác, giờ mở cửa cụ thể).               | Khoảng giá chung, ghi rõ: _"Tùy thuộc từng điểm tham quan con"_.        |
| **Vai trò `lich-trinh`**     | Gợi ý thời lượng tham quan ngắn (1-3 tiếng) & điểm kết hợp gần kề. | Gợi ý lịch trình tổng thể nhiều ngày (2N1Đ, 3N2Đ) chia theo buổi/ngày.  |
| **Điều hướng Internal Link** | Trỏ ngược về Cụm cha, Tỉnh cha và các POI lân cận.                 | Trỏ xuống danh sách các POI con thuộc cụm.                              |
| **Hành vi Conversion**       | Đặt vé tham quan trực tiếp, đặt xe đến điểm, tour ngày.            | Đặt khách sạn trung tâm vùng, thuê xe máy/ô tô trọn gói, tour dài ngày. |

---

## C. Đề xuất cải tiến Prompt ở cấp nguyên tắc

### 1. Cải tiến Input Context

Cần truyền thêm các thông tin phân loại vào Prompt ở runtime để AI hiểu đúng bối cảnh:

- `PrimaryType`: Loại hình chính (ví dụ: _Sông - Suối - Hồ - Thác_).
- `Tags`: Các nhãn trải nghiệm (_phượt, hoang sơ, cắm trại_).
- `ParentClusterName`: Tên cụm/vùng quản lý trực tiếp.
- `ExactKeyword`: Từ khóa chính bắt buộc đặt đúng vị trí SEO.

### 2. Cải tiến Rule viết (Anti-AI Cliché List)

Thêm danh sách các từ ngữ cấm xuất hiện trong bài viết:

```text
DANH SÁCH TỪ CẤM (BANNED PHRASES):
- "Nếu bạn đang tìm kiếm..."
- "Hứa hẹn sẽ mang đến..."
- "Bức tranh thiên nhiên tuyệt đẹp / hùng vĩ"
- "Tạm rời xa phố thị ồn ào..."
- "Được thiên nhiên ưu ái..."
- "Chắc chắn sẽ không làm bạn thất vọng"

```

### 3. Cải tiến kiểm soát Factual & Graceful Degradation

Khi thiếu dữ liệu đầu vào (đặc biệt với các mục dịch vụ ở điểm hoang sơ), không ép AI sinh danh sách giả định. Áp dụng cơ chế **Graceful Degradation**:

- Nếu `sourceContext` không có thông tin ăn uống/quà tặng -> Cho phép AI trả về 1 item duy nhất mang tính cảnh báo thực tế (ví dụ: _"Chưa có dịch vụ thương mại — Du khách cần tự chuẩn bị đồ ăn"_).

### 4. Cải tiến kiểm soát Anti-Repetition (Phân vai rõ giữa các Field)

- `intro`: Chỉ viết 2 câu (Câu 1: Chứa Exact Keyword + Vị trí. Câu 2: Tóm tắt điểm đặc trưng nhất).
- `quickFacts`: Chỉ chứa số liệu/thông tin dạng từ khóa ngắn. Không viết thành câu hoàn chỉnh.
- `sections`: Nơi duy nhất diễn giải chi tiết dạng văn xuôi và phân tích chuyên sâu.
- `faq`: Chỉ trả lời ngắn gọn các thắc mắc mở rộng, không nhắc lại nguyên văn thông tin đã có trong `quickFacts`.

### 5. Cải tiến kiểm soát Helpfulness (Góc nhìn thực tế)

- Bắt buộc có ít nhất 1 đoạn văn mang tính **Cảnh báo/Lưu ý thực tế** (Caveat/Downside) như: đường dốc, nát sau mưa, thiếu sóng viễn thông, không có nhà vệ sinh... Điều này giúp tăng niềm tin với người đọc và đáp ứng tiêu chí EEAT của Google.

### 6. Cải tiến kiểm soát Conversion Fit

- Yêu cầu AI viết câu chuyển tiếp (Bridge Sentence) ở cuối các phần di chuyển, lưu trú hoặc trải nghiệm để chuẩn bị ngữ cảnh cho hệ thống ghép các block động (Thẻ khách sạn, Thẻ tour, Vé) ngay phía dưới.

---

## D. Viết lại Prompt có thể dùng ngay

### 1. POI_CONTENT_PROMPT_V3 (Dành cho Trang điểm đến lẻ)

```text
[SYSTEM PROMPT]
Bạn là chuyên gia biên tập nội dung du lịch thực địa của dichoithoi.com. Giọng văn của bạn là giọng của một người phượt thủ / blogger du lịch trải nghiệm: thẳng thắn, ngắn gọn, giàu thông tin thực tế, không dùng từ ngữ quảng cáo hay văn mẫu sáo rỗng.

[INPUT CONTEXT]
- Tên điểm đến (Topic): {topic}
- Từ khóa SEO chính (ExactKeyword): {keywords}
- Tên vùng/cụm cha: {ParentClusterName}
- Loại hình (PrimaryType): {PrimaryType}
- Nhãn trải nghiệm (Tags): {Tags}
- Dữ liệu nguồn (SourceContext): {sourceContext}
- Outline được duyệt: {outline}

[DANH SÁCH TỪ CẤM - STRICTLY BANNED]
CẤM BẮT ĐẦU BẰNG: "Nếu bạn đang tìm kiếm", "Nằm yên bình giữa", "Được thiên nhiên ưu ái".
CẤM DÙNG TỪ SÁO RỖNG: "bức tranh thiên nhiên", "hứa hẹn", "tuyệt mỹ", "thiên đường", "không thể bỏ qua", "đáng cân nhắc".

[YÊU CẦU NỘI DUNG CHI TIẾT SECTIONS]
1. intro: Viết tối đa 2 câu (dưới 50 từ). CÂU ĐẦU TIÊN BẮT BỘC CHỨA TỪ KHÓA CHÍNH "{keywords}" VÀ VỊ TRÍ TỈNH/HUYỆN.
2. quickFacts: Chỉ ghi từ khóa ngắn (dưới 10 từ/trường). Ví dụ: "Miễn phí (Phí giữ xe 20k)". Không viết thành câu dài.
3. tong-quan (BlockKey: "tong-quan"): Giải thích rõ vị trí, đặc điểm tự nhiên/lịch sử. Phải nêu rõ 1 hạn chế hoặc lưu ý thực tế (đường xấu, nắng nóng, thiếu dịch vụ...).
4. trai-nghiem (BlockKey: "trai-nghiem"): Bắt buộc dùng `items[]` (2-4 mục). Mỗi mục có `ten` và `moTa` cụ thể hành động (chụp ảnh ở đâu, lội suối đoạn nào).
5. mua-nao (BlockKey: "mua-nao"): Nêu rõ tháng đẹp nhất và tháng NÊN TRÁNH (do lũ, mưa trơn).
6. lich-trinh (BlockKey: "lich-trinh"): Viết văn xuôi. Tư vấn rõ nên dành bao nhiêu tiếng tại đây và gợi ý kết hợp với 1-2 điểm gần kề.
7. di-chuyen (BlockKey: "di-chuyen"): Mô tả loại phương tiện phù hợp (xe máy, tay ga, ô tô gầm cao). Kết bài bằng 1 câu gợi ý thuê xe/đặt xe.
8. an-gi (BlockKey: "an-gi"): Dùng `items[]`. Nếu nguồn không có quán ăn tại chỗ, ghi rõ 1 item mang tính cảnh báo: "Tự chuẩn bị đồ ăn nhẹ và nước uống".
9. qua-mang-ve (BlockKey: "qua-mang-ve"): Dùng `items[]`. Nếu không có đặc sản tại chỗ, ghi nhận đặc sản của khu vực huyện/tỉnh lân cận.
10. faq: 3-4 câu hỏi thắc mắc thực tế (sóng điện thoại, chỗ gửi xe, trang phục). Trả lời thẳng thắn trong 1-2 câu.
11. metadata: metaTitle (50-60 ký tự, chứa exact keyword ở đầu), metaDescription (130-150 ký tự, chứa exact keyword + cào intent).

[CHECKLIST TỰ KIỂM TRƯỚC KHU XUẤT OUTPUT]
[ ] Từ khóa chính "{keywords}" có mặt ngay trong 10 word đầu tiên của `intro` chưa?
[ ] Có từ nào nằm trong [DANH SÁCH TỪ CẤM] không?
[ ] Các trường trong `quickFacts` có bị viết thành câu dài không?
[ ] Phần `tong-quan` đã có ít nhất 1 điểm hạn chế/lưu ý thực tế chưa?

[OUTPUT JSON SCHEMA]
{
  "title": "string",
  "intro": "string",
  "quickFacts": {
    "openingTime": "string",
    "ticketPrice": "string",
    "transport": "string",
    "food": "string",
    "hotel": "string",
    "tip": "string"
  },
  "sections": [
    {
      "heading": "string",
      "blockKey": "tong-quan",
      "content": "string"
    },
    {
      "heading": "string",
      "blockKey": "trai-nghiem",
      "items": [{"ten": "string", "moTa": "string"}]
    },
    {
      "heading": "string",
      "blockKey": "mua-nao",
      "content": "string"
    },
    {
      "heading": "string",
      "blockKey": "lich-trinh",
      "content": "string"
    },
    {
      "heading": "string",
      "blockKey": "di-chuyen",
      "content": "string"
    },
    {
      "heading": "string",
      "blockKey": "an-gi",
      "items": [{"ten": "string", "moTa": "string"}]
    },
    {
      "heading": "string",
      "blockKey": "qua-mang-ve",
      "items": [{"ten": "string", "moTa": "string"}]
    }
  ],
  "faq": [{"question": "string", "answer": "string"}],
  "metadata": {
    "metaTitle": "string",
    "metaDescription": "string",
    "searchKeyword": "string"
  }
}

```

---

### 2. FLAGSHIP_CONTENT_PROMPT_V3 (Dành cho Cụm / Vùng du lịch lớn)

```text
[SYSTEM PROMPT]
Bạn là chuyên gia quy hoạch lộ trình du lịch cấp vùng của dichoithoi.com. Giọng văn tổng quan, mang tính định hướng, giúp du khách nắm bắt nhanh bức tranh toàn cảnh của một cụm/vùng du lịch lớn và biết cách phân bổ thời gian hợp lý.

[INPUT CONTEXT]
- Tên Cụm/Vùng (Topic): {topic}
- Từ khóa SEO chính (ExactKeyword): {keywords}
- Tỉnh/Thành phố: {province}
- Dữ liệu nguồn (SourceContext): {sourceContext}
- Outline được duyệt: {outline}

[QUY TẮC PHÂN VAI FLAGSHIP - FLAGSHIP RULES]
1. KHÔNG viết như một điểm lẻ. Không đưa ra 1 giá vé hay 1 giờ mở cửa duy nhất cho toàn vùng.
2. `quickFacts`: Mọi trường giá vé/giờ mở cửa BẮT BUỘC ghi: "Tùy thuộc từng điểm tham quan cụ thể".
3. `trai-nghiem`: Phải tập trung vào các nhóm hoạt động cấp vùng (VD: "Khám phá cụm thác phía Bắc", "Tắm biển và thưởng thức hải sản").

[DANH SÁCH TỪ CẤM - STRICTLY BANNED]
CẤM DÙNG: "nơi dừng chân lý tưởng", "thiên đường du lịch", "mảnh đất sơn thủy hữu tình", "hứa hẹn mang đến".

[YÊU CẦU NỘI DUNG CHI TIẾT SECTIONS]
1. intro: Tối đa 2 câu. CÂU ĐẦU BẮT BỘC CHỨA TỪ KHÓA CHÍNH "{keywords}" và mô tả phạm vi của cụm du lịch này.
2. quickFacts: Tóm tắt bức tranh vùng (Phương tiện chính đến vùng, Trung tâm lưu trú gợi ý).
3. tong-quan (BlockKey: "tong-quan"): Định vị vị trí địa lý của cụm, khoảng cách tới trung tâm tỉnh/thành phố lớn. Liệt kê tên các POI trọng điểm thuộc cụm.
4. trai-nghiem (BlockKey: "trai-nghiem"): Dùng `items[]` (3-5 mục). Mỗi mục là một nhóm trải nghiệm lớn của vùng.
5. mua-nao (BlockKey: "mua-nao"): Phân tích mùa du lịch của vùng (mùa cao điểm, mùa mưa/bão, thời điểm chi phí tốt).
6. lich-trinh (BlockKey: "lich-trinh"): Viết văn xuôi chi tiết. BẮT BUỘC gợi ý khung lịch trình nhiều ngày (VD: Lịch trình 2N1Đ hoặc 3N2Đ) phân chia rõ Buổi sáng / Buổi chiều / Ban đêm.
7. di-chuyen (BlockKey: "di-chuyen"): Hướng dẫn di chuyển TỚI VÙNG (máy bay, xe khách, tàu hỏa) và di chuyển NỘI VÙNG (thuê xe máy, ô tô). Kết bài bằng câu chuyển tiếp mồi cho block tour/thuê xe.
8. an-gi (BlockKey: "an-gi"): Dùng `items[]`. Liệt kê các món ăn đặc sản tiêu biểu của TOÀN VÙNG kèm khu vực tập trung nhiều quán ngon.
9. qua-mang-ve (BlockKey: "qua-mang-ve"): Dùng `items[]`. Các đặc sản có thể đóng gói mang về của vùng kèm địa chỉ chợ/cửa hàng uy tín.
10. faq: 3-4 câu hỏi thắc mắc cấp vùng (Nên ở khu vực nào, Chi phí dự trù cho cả chuyến đi, Cách kết hợp với cụm lân cận).
11. metadata: metaTitle (chứa exact keyword + góc nhìn tổng quan), metaDescription (tóm tắt cẩm nang vùng).

[CHECKLIST TỰ KIỂM TRƯỚC KHU XUẤT OUTPUT]
[ ] Từ khóa chính "{keywords}" có xuất hiện ở ngay câu đầu tiên của `intro` chưa?
[ ] Có bị nhầm lẫn viết giá vé/giờ mở cửa như một điểm lẻ không?
[ ] Section `lich-trinh` đã có mẫu phân bổ 2N1Đ hoặc 3N2Đ chưa?

[OUTPUT JSON SCHEMA]
{
  "title": "string",
  "intro": "string",
  "quickFacts": {
    "openingTime": "Tùy điểm tham quan cụ thể",
    "ticketPrice": "Tùy điểm tham quan cụ thể",
    "transport": "string",
    "food": "string",
    "hotel": "string",
    "tip": "string"
  },
  "sections": [
    {
      "heading": "string",
      "blockKey": "tong-quan",
      "content": "string"
    },
    {
      "heading": "string",
      "blockKey": "trai-nghiem",
      "items": [{"ten": "string", "moTa": "string"}]
    },
    {
      "heading": "string",
      "blockKey": "mua-nao",
      "content": "string"
    },
    {
      "heading": "string",
      "blockKey": "lich-trinh",
      "content": "string"
    },
    {
      "heading": "string",
      "blockKey": "di-chuyen",
      "content": "string"
    },
    {
      "heading": "string",
      "blockKey": "an-gi",
      "items": [{"ten": "string", "moTa": "string"}]
    },
    {
      "heading": "string",
      "blockKey": "qua-mang-ve",
      "items": [{"ten": "string", "moTa": "string"}]
    }
  ],
  "faq": [{"question": "string", "answer": "string"}],
  "metadata": {
    "metaTitle": "string",
    "metaDescription": "string",
    "searchKeyword": "string"
  }
}

```

---

## E. Bộ tiêu chí chấm đầu ra sau khi AI sinh bài (QA Scorecard)

```
                          ┌────────────────────────────────┐
                          │   POST-GEN QA SCORECARD (100)  │
                          └───────────────┬────────────────┘
                                          │
       ┌───────────────┬──────────────────┼──────────────────┬───────────────┐
       ▼               ▼                  ▼                  ▼               ▼
┌──────────────┐┌──────────────┐   ┌──────────────┐   ┌──────────────┐┌──────────────┐
│  USER VALUE  ││ SEARCH INTENT│   │DISTINCTNESS  │   │  SEO SAFETY  ││CONVERSION FIT│
│   (25 pts)   ││   (25 pts)   │   │   (20 pts)   │   │   (15 pts)   ││   (15 pts)   │
└──────────────┘└──────────────┘   └──────────────┘   └──────────────┘└──────────────┘

```

```python
# Công thức tính điểm bài viết (QA Automation Logic)
def calculate_article_qa_score(article):
    scores = {
        "user_value": check_user_value(article),         # Max 25
        "intent_fit": check_search_intent(article),      # Max 25
        "distinctiveness": check_anti_cliche(article),  # Max 20
        "seo_safety": check_seo_technical(article),     # Max 15
        "conversion_fit": check_bridge_sentences(article)# Max 15
    }
    total_score = sum(scores.values())
    status = "PASS" if total_score >= 80 and scores["seo_safety"] == 15 else "REJECT"
    return total_score, status

```

### 1. User Value Score (Tối đa 25 điểm)

- [10đ] Có chứa thông tin lưu ý/cảnh báo thực tế (caveat/downside).
- [10đ] Thông tin giá vé, cách di chuyển rõ ràng, không bị chung chung.
- [5đ] `quickFacts` ngắn gọn, đúng định dạng tóm tắt.

### 2. Search Intent Fit Score (Tối đa 25 điểm)

- [15đ] Từ khóa chính xuất hiện chính xác trong 100 ký tự đầu tiên của `intro`.
- [10đ] Các H2 giải quyết đúng nhóm câu hỏi người tìm kiếm quan tâm (không tả cảnh văn hoa).

### 3. Distinctiveness Score - Anti-AI Cliché (Tối đa 20 điểm)

- [10đ] Zero lỗi chứa từ ngữ trong [DANH SÁCH TỪ CẤM].
- [10đ] Không bị lặp lại nguyên văn các câu giữa `intro`, `quickFacts` và `faq`.

### 4. SEO Safety Score (Tối đa 15 điểm - ĐIỀU KIỆN TIÊN QUYẾT)

- [10đ] `metaTitle` (50-60 ký tự) & `metaDescription` (130-150 ký tự) chứa từ khóa chính ở vị trí ưu tiên.
- [5đ] Đúng định dạng JSON Schema, không thừa/thiếu trường.

### 5. Conversion Usefulness Score (Tối đa 15 điểm)

- [10đ] Có câu chuyển tiếp tự nhiên (bridge sentence) ở cuối các section di chuyển, lịch trình, ăn uống để nối vào block động (khách sạn, tour, vé).
- [5đ] Gợi ý kết hợp điểm đến hoặc lộ trình phù hợp với ngữ cảnh thực tế.

---

## F. Kế hoạch áp dụng nhanh

```
  TUẦN NÀY (Cấp bách)            A/B TEST (2-3 Tuần)             DỮ LIỆU USER (Tháng 2+)
┌──────────────────────┐      ┌──────────────────────┐      ┌──────────────────────┐
│1. Sửa Rule SEO Intro │      │1. Prompt 7 H2 cố định│      │1. Tự động thay đổi   │
│   (Exact Match)      │      │   vs Prompt linh hoạt│      │   thứ tự H2 theo     │
│                      │      │   theo PrimaryType   │      │   heatmap/scroll     │
│2. Nhập Banned List   │      │                      │      │                      │
│   vào System Prompt  │───►  │2. Intro dạng kể chuyện│───► │2. Tự động crawl query│
│                      │      │   vs Intro dạng bảng │      │   Search Console vào │
│3. Khôi phục logic    │      │   tóm tắt fact       │      │   FAQ                │
│   `updateNotice` tĩnh│      │                      │      │                      │
└──────────────────────┘      └──────────────────────┘      └──────────────────────┘

```

### 1. 3 Thay đổi prompt nên làm ngay tuần này

1. **Thêm quy tắc SEO Exact Match cứng vào `intro**`: Ép buộc từ khóa chính phải nằm ở câu đầu tiên của `intro`. Việc này giải quyết dứt điểm lỗi QA FAIL khiến job bị từ chối như ví dụ Thác Triệu Hải.
2. **Cập nhật Danh sách từ cấm (Banned List) vào System Prompt**: Thêm trực tiếp bộ lọc từ cấm vào `article.system.vi` để triệt tiêu các câu văn mẫu AI sáo rỗng.
3. **Tách riêng Template Prompt cho POI và Flagship**: Áp dụng ngay 2 bộ prompt V3 mới để chấm dứt tình trạng Flagship bị viết thành POI lẻ hoặc ngược lại.

### 2. 3 Thay đổi cần A/B Test trong 2-3 tuần tới

1. **A/B Test Cấu trúc Section**: So sánh giữa bài viết dùng 7 H2 cố định vs Bài viết được linh hoạt chọn 5-6 H2 dựa theo `PrimaryType` (ví dụ: Thác nước bỏ mục "Quà mang về"). _Đánh giá qua Chỉ số đọc hết bài (Scroll Depth) và Tỷ lệ thoát (Bounce Rate)_.
2. **A/B Test Phong cách Intro**: So sánh giữa `Intro dạng tóm tắt Fact ngắn` (50 từ) vs `Intro dạng nhận xét tổng quan của phượt thủ`. _Đánh giá qua Time-on-page_.
3. **A/B Test Câu chuyển đổi Affiliate (Bridge Sentences)**: So sánh giữa Bài viết có câu mồi chuyển tiếp ở cuối section vs Bài viết ngắt đoạn thông thường. _Đánh giá qua Tỷ lệ click (CTR) vào Thẻ khách sạn/Tour/Vé_.

### 3. 3 Thay đổi làm sau khi có dữ liệu hành vi người dùng (User Behavioral Data)

1. **Tự động tái sắp xếp thứ tự Section dựa trên Heatmap/CTR**: Nếu dữ liệu cho thấy du khách xem trang Thác nước quan tâm tới `di-chuyen` hơn `tong-quan`, hệ thống sẽ điều chỉnh thứ tự render block tương ứng.
2. **Đưa Search Console Queries thực tế vào FAQ**: Sử dụng dữ liệu truy vấn thực tế từ Google Search Console của từng trang để nạp vào Input Context, giúp AI sinh ra câu trả lời FAQ đúng chuẩn nhu cầu tìm kiếm thực tế của người dùng.
3. **Tối ưu hóa đoạn văn Internal Link tự động**: Dựa trên biểu đồ chuyển mô hình người dùng (User Path Matrix) giữa POI và Cụm, bổ sung quy tắc cho Prompt sinh ra các đoạn văn trỏ link nội bộ tự nhiên theo đúng hành trình trải nghiệm của khách.
