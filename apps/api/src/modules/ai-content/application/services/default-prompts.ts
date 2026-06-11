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
};
