import { z } from "zod/v4";

/**
 * Chu de (tag) diem den — destination-spec §2.4. Nguon su that: v2.DestinationTag/
 * DestinationTagMap tren SQL Server (7 tag dau seed qua phase-b-01-seed-tags.sql,
 * tu 07/2026 tao/sua/xoa duoc ngay trong CMS /dichoithoi/chu-de).
 * Khong co mirror Postgres rieng (giong taxonomy group/type/province) — doc/ghi thang site DB.
 */
export const destinationTagSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  /** Rieng cho <meta name="description"> — tach khoi description hien thi (giong
   * Destination.metaDescription, database-redesign §4.3). Null = web tu fallback ve
   * description qua SeoTextUtil (KHONG doc DescriptionHtml — tranh markup lot vao meta). */
  metaDescription: z.string().nullable(),
  status: z.number().int(),
});
export type DestinationTag = z.infer<typeof destinationTagSchema>;

/** 1 diem den + danh sach tag dang gan — cho man duyet bulk-assign */
export const destinationTagAssignmentSchema = z.object({
  destinationSlug: z.string(),
  destinationName: z.string(),
  tagSlugs: z.array(z.string()),
});
export type DestinationTagAssignment = z.infer<typeof destinationTagAssignmentSchema>;

export const listDestinationTagAssignmentsResponseSchema = z.object({
  tags: z.array(destinationTagSchema),
  assignments: z.array(destinationTagAssignmentSchema),
});
export type ListDestinationTagAssignmentsResponse = z.infer<
  typeof listDestinationTagAssignmentsResponseSchema
>;

/** Buoc 1 — AI goi y gan tag hang loat (destination-spec §2.4), kem ly do ngan */
export const tagSuggestionSchema = z.object({
  destinationSlug: z.string(),
  tagSlugs: z.array(z.string()),
  reasoning: z.string(),
});
export type TagSuggestion = z.infer<typeof tagSuggestionSchema>;

/** Schema dua cho AI structured-output — CHI phan AI tu suy luan (khong kem ten diem den that) */
export const aiTagSuggestionBatchSchema = z.object({
  suggestions: z.array(tagSuggestionSchema),
});
export type AiTagSuggestionBatch = z.infer<typeof aiTagSuggestionBatchSchema>;

export const suggestTagAssignmentsRequestSchema = z.object({
  /** Rong = chay tren TOAN BO diem den chua co tag nao (spec §2.4 buoc 1) */
  destinationSlugs: z.array(z.string()).optional(),
  aiProvider: z.string().optional(),
  aiModel: z.string().optional(),
});
export type SuggestTagAssignmentsRequest = z.infer<typeof suggestTagAssignmentsRequestSchema>;

export const suggestTagAssignmentsResponseSchema = z.object({
  suggestions: z.array(tagSuggestionSchema),
});
export type SuggestTagAssignmentsResponse = z.infer<typeof suggestTagAssignmentsResponseSchema>;

/** Nguoi dung duyet (tick approve/reject tung dong) roi goi apply — ghi de toan bo tag cua diem do */
export const applyTagAssignmentsRequestSchema = z.object({
  assignments: z.array(
    z.object({ destinationSlug: z.string(), tagSlugs: z.array(z.string()) }),
  ),
});
export type ApplyTagAssignmentsRequest = z.infer<typeof applyTagAssignmentsRequestSchema>;

export const applyTagAssignmentsResponseSchema = z.object({ appliedCount: z.number().int() });
export type ApplyTagAssignmentsResponse = z.infer<typeof applyTagAssignmentsResponseSchema>;

/** Buoc 2 — AI ra soat nguoc: diem gan sai / tag duoi nguong (destination-spec §2.4) */
export const tagReverseCheckFindingSchema = z.object({
  /** null = phat hien o cap TAG (vd duoi nguong so luong), khong phai 1 diem cu the */
  destinationSlug: z.string().nullable(),
  tagSlug: z.string(),
  issue: z.enum(["likely-wrong", "under-threshold"]),
  reasoning: z.string(),
});
export type TagReverseCheckFinding = z.infer<typeof tagReverseCheckFindingSchema>;

export const aiTagReverseCheckBatchSchema = z.object({
  findings: z.array(
    z.object({
      destinationSlug: z.string(),
      tagSlug: z.string(),
      reasoning: z.string(),
    }),
  ),
});
export type AiTagReverseCheckBatch = z.infer<typeof aiTagReverseCheckBatchSchema>;

export const reverseCheckTagAssignmentsResponseSchema = z.object({
  findings: z.array(tagReverseCheckFindingSchema),
});
export type ReverseCheckTagAssignmentsResponse = z.infer<
  typeof reverseCheckTagAssignmentsResponseSchema
>;

/** Buoc 3 — AI soan mo ta cho 1 tag (dung lai pipeline ai-content, khong flow moi) */
export const generateTagDescriptionRequestSchema = z.object({
  tagSlug: z.string(),
  aiProvider: z.string().optional(),
  aiModel: z.string().optional(),
});
export type GenerateTagDescriptionRequest = z.infer<typeof generateTagDescriptionRequestSchema>;

export const generateTagDescriptionResponseSchema = z.object({ description: z.string() });
export type GenerateTagDescriptionResponse = z.infer<typeof generateTagDescriptionResponseSchema>;

export const updateTagDescriptionRequestSchema = z.object({
  description: z.string().nullable(),
  /** Luon gui kem description (khong optional) — CMS co 2 o nhap rieng, luu 1 lan.
   * Server tu sinh lai DescriptionHtml (auto-link toi diem den cung tag) tu description
   * moi nay — xem update-destination-tag-description.usecase (hoac usecase tuong duong). */
  metaDescription: z.string().max(160).nullable(),
});
export type UpdateTagDescriptionRequest = z.infer<typeof updateTagDescriptionRequestSchema>;

/** Xem truoc HTML auto-link cua mo ta TRUOC khi luu (nguoi dung yeu cau 25/07/2026) —
 * dung noi dung dang go trong textarea, khong doi hoi da luu. */
export const previewTagDescriptionRequestSchema = z.object({
  description: z.string().nullable(),
});
export type PreviewTagDescriptionRequest = z.infer<typeof previewTagDescriptionRequestSchema>;

export const previewTagDescriptionResponseSchema = z.object({ html: z.string().nullable() });
export type PreviewTagDescriptionResponse = z.infer<typeof previewTagDescriptionResponseSchema>;

/** Tao tag moi (truoc day chi seed duoc qua SQL tay) — destination-spec §2.4 */
export const createDestinationTagRequestSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug chỉ gồm chữ thường/số, nối bằng dấu gạch ngang"),
  name: z.string().min(1).max(128),
  description: z.string().max(2000).nullable().optional(),
});
export type CreateDestinationTagRequest = z.infer<typeof createDestinationTagRequestSchema>;

/** Sua ten/trang thai 1 tag — KHONG sua Slug (khoa on dinh dung trong URL/token) */
export const updateDestinationTagRequestSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  /** 1 = da mo trang public /chu-de/{slug}; 0 = chua mo (site tra 404). AI goi y/ra soat dung MOI tag bat ke status */
  status: z.number().int().min(0).max(1).optional(),
});
export type UpdateDestinationTagRequest = z.infer<typeof updateDestinationTagRequestSchema>;

/**
 * Ban Kanban gan tay Tag theo cum/tinh (phan hoi nguoi dung 24/07/2026 — muon gan tay
 * "giong nhu cum", tuc cung trai nghiem voi /dichoithoi/phan-loai cua Type). Khac Type:
 * KHONG co bang nhap Postgres rieng cho goi y AI (suggestedTagSlugs chi ephemeral tren
 * client sau khi bam "Goi y AI cho cum nay", khong luu lai qua reload).
 */
export const tagKanbanBoardDestinationSchema = z.object({
  slug: z.string(),
  name: z.string(),
  parentSlug: z.string().nullable(),
  imageUrl: z.string().nullable(),
  tagSlugs: z.array(z.string()),
});
export type TagKanbanBoardDestination = z.infer<typeof tagKanbanBoardDestinationSchema>;

export const tagKanbanClusterOptionSchema = z.object({
  slug: z.string(),
  name: z.string(),
  kind: z.enum(["province", "cluster"]),
});
export type TagKanbanClusterOption = z.infer<typeof tagKanbanClusterOptionSchema>;

export const getTagKanbanBoardResponseSchema = z.object({
  tags: z.array(destinationTagSchema),
  clusters: z.array(tagKanbanClusterOptionSchema),
  destinations: z.array(tagKanbanBoardDestinationSchema),
});
export type GetTagKanbanBoardResponse = z.infer<typeof getTagKanbanBoardResponseSchema>;
