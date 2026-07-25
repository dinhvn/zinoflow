import { stripHtml } from "../../shared/text/strip-html";

// Du de AI hieu ngu canh, khong can toan bo bai (tranh vuot ngan sach token khi 1 cum co ~40 diem)
const MAX_CONTENT_CHARS = 500;

export const TAXONOMY_TYPE_SUGGEST_SYSTEM = [
  "Bạn là biên tập viên du lịch Việt Nam, đang rà soát lại loại hình (Type) của điểm đến.",
  "Luôn trả lời bằng tiếng Việt có dấu đầy đủ.",
  "CHỈ dựa vào tên và nội dung mô tả đã cho — KHÔNG bịa thông tin không có trong đó.",
  "Một điểm đến có thể thuộc nhiều loại hình cùng lúc — chỉ chọn loại thực sự đúng bản chất nơi chốn.",
  "reason phải ngắn gọn (1 câu), nêu rõ vì sao chọn (hoặc đổi) loại đó.",
  // Luat cung phan dinh di-tich-lich-su/cong-trinh-kiet-tac (dichoithoi-taxonomy-chuan-hoa.md
  // §2.1, 24/07/2026) — chan cannibalization phat hien that: 18/49 diem cong-trinh-kien-truc
  // (ten cu) tung trung ca di-tich-lich-su vi AI/nguoi nhap gan theo cam tinh "trong co ve co".
  "QUY TẮC BẮT BUỘC khi chọn giữa 'di-tich-lich-su' và 'cong-trinh-kiet-tac':",
  "chỉ chọn 'di-tich-lich-su' khi nội dung có nhắc rõ điểm đến ĐÃ ĐƯỢC XẾP HẠNG di tích chính thức",
  "(Di sản UNESCO, Di tích Quốc gia đặc biệt, Di tích Quốc gia, hoặc Di tích cấp Tỉnh/Thành) —",
  "không suy diễn từ việc 'trông cổ/có vẻ lịch sử'; nếu không có xếp hạng nhưng có giá trị",
  "kiến trúc/kỹ thuật/biểu tượng rõ thì chọn 'cong-trinh-kiet-tac'; nếu vừa có xếp hạng vừa có",
  "kiến trúc đẹp thì chọn CẢ HAI (di-tich-lich-su là chính).",
].join(" ");

export interface TaxonomyTypeSuggestCandidate {
  slug: string;
  name: string;
}

export interface TaxonomyTypeOption {
  slug: string;
  name: string;
}

/**
 * Dung prompt gui AI de goi y lai Type cho 1 danh sach diem den (Buoc 2, relations-plan
 * §6.3). Tach thanh ham thuan (domain, khong goi AI/DB that) de dung lai o CA suggest
 * that (goi AI) LAN preview (chi hien prompt, khong ton AI — phan hoi nguoi dung
 * 24/07/2026: "cho nao cung co the chon provider, xem truoc prompt").
 */
export function buildTaxonomyTypeSuggestPrompt(
  types: readonly TaxonomyTypeOption[],
  candidates: readonly TaxonomyTypeSuggestCandidate[],
  contentBySlug: ReadonlyMap<string, string>,
): string {
  const typeList = types.map((t) => `- ${t.slug}: "${t.name}"`).join("\n");
  const destinationList = candidates
    .map((c) => {
      const raw = contentBySlug.get(c.slug);
      const content = raw ? stripHtml(raw).slice(0, MAX_CONTENT_CHARS) : "";
      return `- ${c.slug}: "${c.name}"${content ? ` — ${content}` : " — (chưa có nội dung)"}`;
    })
    .join("\n");

  return [
    "Danh sách loại hình chuẩn (slug: tên):",
    typeList,
    "",
    "Danh sách điểm đến cần đánh giá lại (slug: tên — nội dung):",
    destinationList,
    "",
    "Với MỖI điểm đến, đề xuất 1 hoặc nhiều suggestedTypeSlugs phù hợp nhất",
    "(chỉ dùng slug có trong danh sách loại hình trên) kèm reason ngắn.",
  ].join("\n");
}
