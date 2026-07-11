import type { ArticleTopic } from "@zinoflow/contracts";

/**
 * Doan topic tu tieu de bai (article-spec §8.1) — CHI la goi y ban dau, nguoi
 * dung tick xac nhan/sua truoc khi luu (khong bao gio tu gan im lang).
 * Thu tu kiem tra co y nghia: tu khoa cang cu the xet truoc de tranh nham
 * (vd "lich trinh an choi" nen la itinerary, khong phai food).
 */
const KEYWORD_RULES: Array<{ topic: ArticleTopic; keywords: string[] }> = [
  { topic: "itinerary", keywords: ["lịch trình", "hành trình", "ngày", "đêm 3 ngày"] },
  { topic: "souvenir", keywords: ["quà", "đặc sản mua", "lưu niệm", "mua sắm"] },
  { topic: "nightlife", keywords: ["về đêm", "buổi tối", "chơi đêm"] },
  { topic: "food", keywords: ["ẩm thực", "ăn gì", "quán ăn", "món ngon", "đặc sản"] },
  { topic: "poi-guide", keywords: ["top", "điểm check-in", "địa điểm", "điểm tham quan"] },
];

export function guessArticleTopic(title: string): ArticleTopic {
  const normalized = title.toLowerCase();
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((k) => normalized.includes(k))) return rule.topic;
  }
  return "general";
}
