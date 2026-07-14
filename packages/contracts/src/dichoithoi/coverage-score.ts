import { z } from "zod/v4";

/**
 * Content Coverage Score — destination-spec §2.2.2 (CHỐT 07/2026). Nhóm D
 * (tự tính từ dữ liệu sẵn có, không AI, không nhập tay), CHỈ hiện nội bộ CMS.
 *
 * Phase 28.6 (07/2026): tier dùng `ContentTier` THẬT (Phase 25) thay vì suy
 * từ `kind` — poi = tier "poi"; province/cluster với `ContentTier="flagship"`
 * = tier "flagship"; province/cluster với "standard"/null = tier "standard"
 * (checklist rút gọn giống POI, không có mục riêng Flagship). 3 mục
 * Flagship-only trước đây ghi "chưa tính được" nay đã có đủ hạ tầng: độ phủ
 * bài cẩm nang theo topic (`ArticleDestinationMap`, Phase 26), đánh giá biên
 * tập + external review link (Phase 28.0). "Lịch trình gợi ý" (07/2026) không
 * còn là mục coverage riêng — đã chuyển thành blockKey "lich-trinh" trong
 * sections[], tính chung vào "main-content".
 */
export const coverageChecklistItemSchema = z.object({
  key: z.string(),
  label: z.string(),
  done: z.boolean(),
});
export type CoverageChecklistItem = z.infer<typeof coverageChecklistItemSchema>;

export const destinationCoverageScoreSchema = z.object({
  destinationSlug: z.string(),
  destinationName: z.string(),
  kind: z.enum(["province", "cluster", "poi"]),
  tier: z.enum(["poi", "standard", "flagship"]),
  scorePercent: z.number().int().min(0).max(100),
  items: z.array(coverageChecklistItemSchema),
});
export type DestinationCoverageScore = z.infer<typeof destinationCoverageScoreSchema>;

export const listCoverageScoresResponseSchema = z.object({
  items: z.array(destinationCoverageScoreSchema),
});
export type ListCoverageScoresResponse = z.infer<typeof listCoverageScoresResponseSchema>;
