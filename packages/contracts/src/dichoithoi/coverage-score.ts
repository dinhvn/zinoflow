import { z } from "zod/v4";

/**
 * Content Coverage Score — destination-spec §2.2.2 (CHỐT 07/2026). Nhóm D
 * (tự tính từ dữ liệu sẵn có, không AI, không nhập tay), CHỈ hiện nội bộ CMS.
 *
 * Phạm vi đợt build này (07/2026, tự động): dùng ĐÚNG dữ liệu đã có trong
 * code hiện tại. 2 mục Flagship-only trong spec CHƯA tính được vì thiếu hạ
 * tầng: "lịch trình (B)" (không có field riêng biệt đánh dấu khối B đã có
 * hay chưa) và "độ phủ bài cẩm nang theo topic" (`ArticleDestinationMap` —
 * article-spec §8.1 — bảng quan hệ này chưa được xây). Tier Flagship/POI
 * cũng chưa có cột `ContentTier` thật (spec ghi "gán tay, không AI" nhưng
 * chưa build form) — tạm dùng `kind` làm proxy: poi = tier "poi",
 * province/cluster = tier "flagship" (khớp ví dụ spec "Flagship vd Đà Lạt"
 * là node cluster/province có con).
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
  tier: z.enum(["poi", "flagship"]),
  scorePercent: z.number().int().min(0).max(100),
  items: z.array(coverageChecklistItemSchema),
});
export type DestinationCoverageScore = z.infer<typeof destinationCoverageScoreSchema>;

export const listCoverageScoresResponseSchema = z.object({
  items: z.array(destinationCoverageScoreSchema),
});
export type ListCoverageScoresResponse = z.infer<typeof listCoverageScoresResponseSchema>;
