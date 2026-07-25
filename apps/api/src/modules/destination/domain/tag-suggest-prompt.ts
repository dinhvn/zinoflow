export const TAG_SUGGEST_SYSTEM = [
  "Bạn là biên tập viên du lịch Việt Nam, đang gán chủ đề (tag) cho các điểm đến.",
  "Luôn trả lời bằng tiếng Việt có dấu đầy đủ.",
  "Mỗi điểm đến có thể nhận 0, 1 hoặc nhiều tag — CHỈ gán khi thực sự phù hợp, không gán ép.",
  "reasoning phải ngắn gọn (1 câu), nêu rõ vì sao điểm đến khớp tag đó.",
].join(" ");

export interface TagSuggestOption {
  slug: string;
  name: string;
  description: string | null;
}

export interface TagSuggestCandidate {
  destinationSlug: string;
  destinationName: string;
}

/**
 * Dung prompt gui AI de goi y gan tag hang loat (destination-spec §2.4 buoc 1).
 * Tach thanh ham thuan (domain) de dung lai o CA suggest that (goi AI) LAN preview
 * (chi hien prompt, khong ton AI — phan hoi nguoi dung 24/07/2026).
 */
export function buildTagSuggestPrompt(
  tags: readonly TagSuggestOption[],
  candidates: readonly TagSuggestCandidate[],
): string {
  const tagList = tags
    .map((t) => `- ${t.slug}: "${t.name}"${t.description ? ` — ${t.description}` : ""}`)
    .join("\n");
  const destinationList = candidates.map((c) => `- ${c.destinationSlug}: "${c.destinationName}"`).join("\n");

  return [
    "Danh sách tag hiện có (slug: tên — mô tả):",
    tagList,
    "",
    "Danh sách điểm đến cần gán tag (slug: tên):",
    destinationList,
    "",
    "Với MỖI điểm đến, gợi ý 0 hoặc nhiều tagSlugs phù hợp (chỉ dùng slug có trong danh sách trên) kèm reasoning ngắn.",
  ].join("\n");
}
