/**
 * Prompt templates mac dinh — nguon su that duy nhat cho:
 * (1) seed migration vao bang prompt_templates, (2) fallback khi DB chua co row
 * (vd: chay unit test voi in-memory repo, hoac migration chua chay).
 *
 * Noi dung prompt la user-facing text -> BAT BUOC tieng Viet co dau day du.
 * Doi prompt o production: tao version moi trong DB, KHONG sua file nay
 * (file nay chi la baseline v-dau-tien).
 */

export const SYSTEM_PROMPT_KEY = "article.system.vi";

export const PROMPT_KEYS = {
  system: SYSTEM_PROMPT_KEY,
  outline: (articleType: string) => `${articleType}.outline.vi`,
  section: (articleType: string) => `${articleType}.section.vi`,
  frame: (articleType: string) => `${articleType}.frame.vi`,
} as const;

/** Quy tac ngon ngu nhung vao moi prompt — rule bat buoc cua du an. */
const VIETNAMESE_RULE = [
  `- BẮT BUỘC viết tiếng Việt có dấu đầy đủ trong toàn bộ nội dung.`,
  `- Nếu chủ đề hoặc dữ liệu đầu vào không dấu, hãy chuẩn hóa lại thành tiếng Việt có dấu.`,
].join("\n");

const NO_FABRICATION_RULE = [
  `- CHỈ dùng thông tin sản phẩm có trong dữ liệu được cung cấp, KHÔNG tự chế thông số, giá, khuyến mãi.`,
  `- KHÔNG claim quá đà ("tốt nhất thị trường", "cam kết 100%", claim y khoa...).`,
].join("\n");

export const DEFAULT_PROMPTS: Readonly<Record<string, string>> = {
  [SYSTEM_PROMPT_KEY]: [
    `Bạn là chuyên gia viết content affiliate tiếng Việt cho website thương mại.`,
    `Bạn LUÔN viết tiếng Việt có dấu đầy đủ, viết trung thực, chỉ dùng dữ liệu được cung cấp,`,
    `tuân thủ schema output nghiêm ngặt.`,
  ].join(" "),

  // ===== TOP-LIST (spec §17.2-B) =====
  "toplist.outline.vi": [
    `Tạo OUTLINE cho bài viết TOP-LIST (danh sách sản phẩm tốt nhất) tiếng Việt.`,
    `Chủ đề: {{topic}}`,
    `Từ khóa chính: {{keywords}}`,
    `Website: {{siteCode}}`,
    `Giọng văn: {{toneProfile}}`,
    `Dữ liệu sản phẩm (JSON): {{products}}`,
    ``,
    `Yêu cầu:`,
    VIETNAMESE_RULE,
    `- title: 50-70 ký tự, chứa từ khóa chính một cách tự nhiên.`,
    `- sectionHeadings: 3-5 mục H2, BẮT BUỘC có "Tiêu chí xếp hạng" và "Cách chọn mua theo ngân sách".`,
    `- plannedProducts: chọn các sản phẩm phù hợp nhất từ dữ liệu; nếu danh sách rỗng thì để mảng rỗng.`,
    `- plannedFaqQuestions: 3-6 câu hỏi theo search intent thực tế của người mua.`,
    NO_FABRICATION_RULE,
  ].join("\n"),

  "toplist.section.vi": [
    `Viết nội dung cho MỘT section của bài top-list tiếng Việt.`,
    `Bài viết: {{title}}`,
    `Section cần viết (heading phải giữ nguyên): {{sectionHeading}}`,
    `Toàn bộ outline (để giữ mạch bài, KHÔNG lặp nội dung section khác): {{outline}}`,
    `Dữ liệu sản phẩm (JSON): {{products}}`,
    `Giọng văn: {{toneProfile}}`,
    ``,
    `Yêu cầu:`,
    VIETNAMESE_RULE,
    `- content: 120-250 từ, giọng tự nhiên như người viết thật, không khoa trương.`,
    `- Đi thẳng vào nội dung của section này, không viết lại mở bài.`,
    NO_FABRICATION_RULE,
  ].join("\n"),

  "toplist.frame.vi": [
    `Hoàn thiện KHUNG bài viết top-list tiếng Việt (mọi block TRỪ các section chính đã viết xong).`,
    `Chủ đề: {{topic}}`,
    `Từ khóa chính: {{keywords}}`,
    `Website: {{siteCode}}`,
    `Outline: {{outline}}`,
    `Tóm tắt các section đã viết: {{sectionsSummary}}`,
    `Dữ liệu sản phẩm (JSON): {{products}}`,
    `Giọng văn: {{toneProfile}}`,
    ``,
    `Yêu cầu:`,
    VIETNAMESE_RULE,
    `- hero.title: giữ đúng title trong outline. hero.affiliateDisclosure: câu khai báo tiếp thị liên kết rõ ràng.`,
    `- intent: bài dành cho ai, giải quyết vấn đề gì. quickAnswer: 3-5 bullet kết luận nhanh.`,
    `- productRecommendations: theo mẫu top-list — vì sao trong danh sách, ưu/nhược, mức giá tham khảo,`,
    `  đối tượng phù hợp. CHỈ dùng sản phẩm trong dữ liệu; nếu dữ liệu rỗng, dùng productUrl`,
    `  "https://example.com/placeholder" và ghi rõ trong whyInList rằng cần bổ sung dữ liệu thật.`,
    `- faq: trả lời các câu hỏi trong outline, mỗi câu 2-4 câu văn.`,
    `- finalCta: gợi ý item ưu tiên, không claim quá đà.`,
    `- metadata.metaTitle <= 70 ký tự, metaDescription <= 170 ký tự,`,
    `  internalLinkSuggestions: 2 đường dẫn nội bộ dạng "/ten-bai-viet" (slug không dấu).`,
    NO_FABRICATION_RULE,
  ].join("\n"),

  // ===== REVIEW DON (spec §17.2-A) =====
  "review.outline.vi": [
    `Tạo OUTLINE cho bài REVIEW MỘT SẢN PHẨM tiếng Việt.`,
    `Chủ đề: {{topic}}`,
    `Từ khóa chính: {{keywords}}`,
    `Website: {{siteCode}}`,
    `Giọng văn: {{toneProfile}}`,
    `Dữ liệu sản phẩm (JSON): {{products}}`,
    ``,
    `Yêu cầu:`,
    VIETNAMESE_RULE,
    `- title: 50-70 ký tự, chứa tên sản phẩm + từ khóa chính tự nhiên.`,
    `- sectionHeadings: 4-5 mục H2 theo khung review: giới thiệu nhanh sản phẩm và đối tượng dùng;`,
    `  ưu điểm và hạn chế; trải nghiệm theo tiêu chí (chất liệu/độ bền, tính năng, giá trị trên giá tiền);`,
    `  so sánh nhẹ với 1-2 lựa chọn cùng phân khúc; kết luận có nên mua không.`,
    `- plannedProducts: sản phẩm chính được review + 1-2 sản phẩm so sánh (nếu có trong dữ liệu).`,
    `- plannedFaqQuestions: 3-6 câu hỏi người mua hay hỏi trước khi xuống tiền.`,
    NO_FABRICATION_RULE,
  ].join("\n"),

  "review.section.vi": [
    `Viết nội dung cho MỘT section của bài review sản phẩm tiếng Việt.`,
    `Bài viết: {{title}}`,
    `Section cần viết (heading phải giữ nguyên): {{sectionHeading}}`,
    `Toàn bộ outline (để giữ mạch bài, KHÔNG lặp nội dung section khác): {{outline}}`,
    `Dữ liệu sản phẩm (JSON): {{products}}`,
    `Giọng văn: {{toneProfile}}`,
    ``,
    `Yêu cầu:`,
    VIETNAMESE_RULE,
    `- content: 120-250 từ, trung thực, nêu cả điểm chưa tốt nếu dữ liệu cho thấy.`,
    `- Đi thẳng vào nội dung của section này, không viết lại mở bài.`,
    NO_FABRICATION_RULE,
  ].join("\n"),

  "review.frame.vi": [
    `Hoàn thiện KHUNG bài review sản phẩm tiếng Việt (mọi block TRỪ các section chính đã viết xong).`,
    `Chủ đề: {{topic}}`,
    `Từ khóa chính: {{keywords}}`,
    `Website: {{siteCode}}`,
    `Outline: {{outline}}`,
    `Tóm tắt các section đã viết: {{sectionsSummary}}`,
    `Dữ liệu sản phẩm (JSON): {{products}}`,
    `Giọng văn: {{toneProfile}}`,
    ``,
    `Yêu cầu:`,
    VIETNAMESE_RULE,
    `- hero.title: giữ đúng title trong outline. hero.affiliateDisclosure: câu khai báo tiếp thị liên kết rõ ràng.`,
    `- intent: ai nên đọc review này. quickAnswer: 3-5 bullet kết luận nhanh (có nên mua, ai nên mua).`,
    `- productRecommendations: sản phẩm chính + tối đa 2 lựa chọn thay thế cùng phân khúc,`,
    `  mỗi item ghi rõ ưu/nhược và đối tượng phù hợp. CHỈ dùng sản phẩm trong dữ liệu;`,
    `  nếu dữ liệu rỗng, dùng productUrl "https://example.com/placeholder" và ghi rõ cần bổ sung dữ liệu thật.`,
    `- faq: trả lời các câu hỏi trong outline, mỗi câu 2-4 câu văn.`,
    `- finalCta: kết luận có nên mua không, không claim quá đà.`,
    `- metadata.metaTitle <= 70 ký tự, metaDescription <= 170 ký tự,`,
    `  internalLinkSuggestions: 2 đường dẫn nội bộ dạng "/ten-bai-viet" (slug không dấu).`,
    NO_FABRICATION_RULE,
  ].join("\n"),

  // ===== GUIDE ĐIỂM ĐẾN dichoithoi.com (dichoithoi-destination-spec §2.2, §4) =====
  "guide-diem-den.outline.vi": [
    `Tạo OUTLINE cho bài viết GIỚI THIỆU ĐIỂM ĐẾN DU LỊCH Việt Nam, chuẩn SEO,`,
    `giọng văn như người đã đi thực tế viết lại — không liệt kê khô khan.`,
    `Điểm đến: {{topic}}`,
    `Từ khóa chính: {{keywords}}`,
    `Giọng văn: {{toneProfile}}`,
    `DỮ LIỆU ĐIỂM ĐẾN (nguồn sự thật — ưu tiên tuyệt đối khi viết):`,
    `{{sourceContext}}`,
    ``,
    `Yêu cầu:`,
    VIETNAMESE_RULE,
    `- title: 50-70 ký tự, chứa tên điểm đến, gợi đúng search intent du lịch`,
    `  (ví dụ "Vịnh Hạ Long: kinh nghiệm tham quan, giá vé, ăn gì 2026").`,
    `- sectionHeadings: 4-7 mục H2 phủ đủ thông tin người đi du lịch cần:`,
    `  giới thiệu tổng quan & vì sao đáng đi; chơi gì / trải nghiệm nổi bật;`,
    `  thời điểm đẹp nhất để đi; món ăn / đặc sản gần đó; và mục riêng phù hợp đặc thù điểm này.`,
    `  KHÔNG đặt heading cho giờ mở cửa/giá vé/di chuyển/lưu trú — các mục đó nằm ở khối thông tin nhanh riêng.`,
    `- plannedFaqQuestions: 3-6 câu đúng search intent thực tế (có nên đi, đi mùa nào, mất bao lâu, lưu ý gì...).`,
    `- KHÔNG tự chế số liệu (giá vé, giờ, khoảng cách) ngoài dữ liệu được cung cấp.`,
  ].join("\n"),

  "guide-diem-den.section.vi": [
    `Viết nội dung cho MỘT section của bài giới thiệu điểm đến du lịch tiếng Việt.`,
    `Bài viết: {{title}}`,
    `Section cần viết (heading phải giữ nguyên): {{sectionHeading}}`,
    `Toàn bộ outline (giữ mạch bài, KHÔNG lặp nội dung section khác): {{outline}}`,
    `DỮ LIỆU ĐIỂM ĐẾN (nguồn sự thật): {{sourceContext}}`,
    `Giọng văn: {{toneProfile}}`,
    ``,
    `Yêu cầu:`,
    VIETNAMESE_RULE,
    `- content: 120-250 từ, như người đi thực tế kể lại — có chi tiết cụ thể, cảm nhận thật,`,
    `  tránh văn mẫu sáo rỗng kiểu "điểm đến hấp dẫn không thể bỏ qua".`,
    `- Nếu bài nhắc tới điểm đến khác trong danh sách điểm liên quan (trong dữ liệu),`,
    `  dùng đúng TÊN CHUẨN của điểm đó để hệ thống tự gắn link.`,
    `- Số liệu (giá, giờ, khoảng cách) CHỈ lấy từ dữ liệu cung cấp; thiếu thì viết định tính,`,
    `  không bịa con số.`,
  ].join("\n"),

  "guide-diem-den.frame.vi": [
    `Hoàn thiện KHUNG bài giới thiệu điểm đến (mọi phần TRỪ các section chính đã viết xong).`,
    `Điểm đến: {{topic}}`,
    `Từ khóa chính: {{keywords}}`,
    `Outline: {{outline}}`,
    `Tóm tắt các section đã viết: {{sectionsSummary}}`,
    `DỮ LIỆU ĐIỂM ĐẾN (nguồn sự thật): {{sourceContext}}`,
    `Giọng văn: {{toneProfile}}`,
    ``,
    `Yêu cầu:`,
    VIETNAMESE_RULE,
    `- title: giữ đúng title trong outline.`,
    `- intro: 80-150 từ mở bài tự nhiên, chứa tên điểm đến, nêu cả địa chỉ MỚI và địa chỉ CŨ`,
    `  (trước sáp nhập) nếu dữ liệu có đủ cả hai.`,
    `- quickFacts (dữ liệu hiển thị dạng thẻ — NGẮN GỌN, đúng sự thật):`,
    `  openingTime, ticketPrice: lấy từ dữ liệu; thiếu thì ghi "Cần kiểm tra lại" — KHÔNG bịa.`,
    `  Giá vé luôn kèm "có thể thay đổi". Điểm miễn phí ghi "Miễn phí".`,
    `  transport: cách di chuyển tới nơi (từ trung tâm, phương tiện). food: ăn gì tại chỗ/gần đó.`,
    `  hotel: nên ở khu nào. tip: 2-4 mẹo thực tế.`,
    `- faq: trả lời các câu hỏi trong outline, mỗi câu 2-4 câu văn.`,
    `- updateNotice: ghi ĐÚNG NGUYÊN VĂN "Thông tin trong bài cập nhật tháng {{currentDate}},`,
    `  giá vé và giờ mở cửa có thể thay đổi." — dùng đúng tháng/năm {{currentDate}} được cung cấp,`,
    `  KHÔNG tự suy ra từ kiến thức nền.`,
    `- metadata: name = tên chuẩn có dấu; slugSuggestion = slug không dấu;`,
    `  metaTitle <= 140 ký tự; metaDescription 100-290 ký tự chứa từ khóa;`,
    `  description = mô tả 1-2 câu (50-900 ký tự); searchKeyword = các từ người dùng hay gõ, cách nhau dấu phẩy.`,
    `- KHÔNG claim tuyệt đối ("đẹp nhất Việt Nam", "duy nhất", "rẻ nhất") khi không có nguồn.`,
  ].join("\n"),

  // ===== KHUYENMAI laruki/dochoi3s (km-*) — 1 content, tag inline (laruki-dochoi3s-content-spec §4) =====
  // Default CHUNG; per-site/per-postType soan qua /prompts (key <site>.km-<postType>.<step>.vi).
  "km-bai-viet.outline.vi": [
    `Tạo OUTLINE bài viết affiliate/giới thiệu sản phẩm cho website {{siteCode}}, chuẩn SEO,`,
    `giọng tự nhiên như người viết thật.`,
    `Chủ đề: {{topic}}`,
    `Từ khóa chính: {{keywords}}`,
    `Giọng văn: {{toneProfile}}`,
    `NGỮ CẢNH (ghi chú người dùng, nguồn tham khảo có thể tiếng Anh, gợi ý tag, nội dung cũ nếu viết lại):`,
    `{{sourceContext}}`,
    ``,
    `Yêu cầu:`,
    VIETNAMESE_RULE,
    `- title: 50-70 ký tự, chứa từ khóa chính tự nhiên.`,
    `- sectionHeadings: 3-7 mục H2 hợp chủ đề và đúng niche của site`,
    `  (laruki: thời trang/làm đẹp — bối cảnh dùng, mẹo phối; dochoi3s: đồ chơi trẻ em —`,
    `  nhấn ĐỘ TUỔI phù hợp, AN TOÀN/vật liệu, kỹ năng phát triển).`,
    `- KHÔNG bịa số liệu sản phẩm/giá: danh sách sản phẩm sẽ do TAG [..] sinh ra khi publish.`,
  ].join("\n"),

  "km-bai-viet.section.vi": [
    `Viết nội dung MỘT section của bài viết cho website {{siteCode}}.`,
    `Bài viết: {{title}}`,
    `Section cần viết (giữ nguyên heading): {{sectionHeading}}`,
    `Toàn bộ outline (giữ mạch, KHÔNG lặp section khác): {{outline}}`,
    `NGỮ CẢNH (gợi ý tag + nội dung cũ nếu viết lại): {{sourceContext}}`,
    `Giọng văn: {{toneProfile}}`,
    ``,
    `Yêu cầu:`,
    VIETNAMESE_RULE,
    `- content: 120-300 từ, văn xuôi tự nhiên, hợp niche; KHÔNG khoa trương.`,
    `- TAG: nếu chỗ này cần danh sách sản phẩm/giá/link, ĐẶT đúng cú pháp tag CMS`,
    `  (ví dụ [ProductList_SupplierCode:juno], [ProductList_ProductTag:innisfree-jeju], [Year])`,
    `  dựa theo gợi ý tag trong ngữ cảnh. Tag để TRÊN DÒNG RIÊNG, KHÔNG bọc trong câu.`,
    `- GIỮ NGUYÊN mọi tag [..] đã có trong "nội dung hiện tại" (ngữ cảnh) khi viết lại — KHÔNG xóa/sửa tag.`,
    `- KHÔNG bịa thông số/giá sản phẩm: số liệu do tag thay thế khi publish.`,
  ].join("\n"),

  "km-bai-viet.frame.vi": [
    `Hoàn thiện KHUNG bài viết cho website {{siteCode}} (mọi phần TRỪ các section đã viết).`,
    `Chủ đề: {{topic}}`,
    `Từ khóa chính: {{keywords}}`,
    `Outline: {{outline}}`,
    `Tóm tắt các section đã viết: {{sectionsSummary}}`,
    ``,
    `Yêu cầu:`,
    VIETNAMESE_RULE,
    `- title: giữ đúng title trong outline.`,
    `- excerpt: 1-2 câu (50-300 ký tự) tóm tắt bài, chứa từ khóa chính — dùng cho mô tả ngắn.`,
  ].join("\n"),
};
