import { z } from "zod/v4";

/**
 * Contracts cho tinh nang tim diem con (POI) trong 1 cum da co san bang Gemini +
 * Google Search Grounding — nguoi dung duyet qua bang truoc khi ghi DB
 * (dichoithoi-cluster-poi-discovery-plan.md).
 */

/** Khop thang cot Priority co san tren v2.Destination (1=cao nhat, 5=thap nhat) */
export const clusterPoiCandidatePriorityLevelSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
export type ClusterPoiCandidatePriorityLevel = z.infer<
  typeof clusterPoiCandidatePriorityLevelSchema
>;

/**
 * Tinh boi FuzzyMatchDestinationName so voi DB (nguong LONG, luon de nguoi dung tu
 * xem lai) — KHONG phai AI tra ve:
 * - "new": khong khop diem nao, tao moi khi Chap nhan.
 * - "existing-in-cluster": khop 1 diem DA co san TRONG cum nay — chi hien thi, khong
 *   thao tac duoc.
 * - "orphan-match": khop 1 diem dang chua gan cum (parentSlug=null) cung tinh — Chap
 *   nhan se gan lai parentSlug thay vi tao moi.
 * - "backup-match": khop 1 dong trong bang backup (dichoithoi_destinations_backup,
 *   dot lam moi du lieu theo Atlas — GD6 plan-lam-moi-du-lieu-atlas.md) chua duoc
 *   khoi phuc — Chap nhan se KHOI PHUC nguyen dong backup (bai viet/anh/toa do/
 *   Type/Tag...) vao cum nay thay vi tao diem trong rong.
 */
export const clusterPoiCandidateMatchTypeSchema = z.enum([
  "new",
  "existing-in-cluster",
  "orphan-match",
  "backup-match",
]);
export type ClusterPoiCandidateMatchType = z.infer<typeof clusterPoiCandidateMatchTypeSchema>;

export const clusterPoiCandidateStatusSchema = z.enum(["pending", "accepted", "rejected"]);
export type ClusterPoiCandidateStatus = z.infer<typeof clusterPoiCandidateStatusSchema>;

export const clusterPoiCandidateItemSchema = z.object({
  name: z.string().min(1).max(128),
  priorityLevel: clusterPoiCandidatePriorityLevelSchema,
  shortDescription: z.string().max(1000).nullable(),
  address: z.string().max(256).nullable(),
  matchType: clusterPoiCandidateMatchTypeSchema,
  /** Chi co gia tri khi matchType != "new" */
  matchedSlug: z.string().nullable(),
  matchedName: z.string().nullable(),
  /** matchType="backup-match" — goi y nhanh cho nguoi duyet biet backup co gi truoc khi tick */
  backupHasArticle: z.boolean().nullable(),
  backupHasImages: z.boolean().nullable(),
  status: clusterPoiCandidateStatusSchema,
});
export type ClusterPoiCandidateItem = z.infer<typeof clusterPoiCandidateItemSchema>;

/** 1 dong staging — PK clusterSlug, upsert khi chay lai (khong giu lich su nhieu phien) */
export const clusterPoiCandidateSchema = z.object({
  clusterSlug: z.string().min(1).max(64),
  extractedAt: z.string(),
  candidates: z.array(clusterPoiCandidateItemSchema),
});
export type ClusterPoiCandidate = z.infer<typeof clusterPoiCandidateSchema>;

/** GET :slug/cluster-poi-candidates — null = chua tung chay tim cho cum nay */
export const getClusterPoiCandidatesResponseSchema = z.object({
  candidate: clusterPoiCandidateSchema.nullable(),
});
export type GetClusterPoiCandidatesResponse = z.infer<
  typeof getClusterPoiCandidatesResponseSchema
>;

/** POST :slug/cluster-poi-candidates — extraNotes la mo ta bo sung nguoi dung nhap them cho AI */
export const findClusterPoiCandidatesRequestSchema = z.object({
  extraNotes: z.string().max(2000).nullable(),
});
export type FindClusterPoiCandidatesRequest = z.infer<
  typeof findClusterPoiCandidatesRequestSchema
>;

/**
 * POST :slug/cluster-poi-candidates/accept — preferAiMetadataIndexes la tap con
 * cua acceptedIndexes, CHI co y nghia voi matchType="backup-match": danh dau dong
 * nao nguoi dung chon dung ten/mo ta/priority AI tim duoc THAY VI giu nguyen ban
 * backup (mac dinh khong co trong danh sach nay = GIU BAN BACKUP, vi da duyet tay).
 */
export const acceptClusterPoiCandidatesRequestSchema = z.object({
  acceptedIndexes: z.array(z.number().int().min(0)).min(1),
  preferAiMetadataIndexes: z.array(z.number().int().min(0)).optional(),
});
export type AcceptClusterPoiCandidatesRequest = z.infer<
  typeof acceptClusterPoiCandidatesRequestSchema
>;

/**
 * POST :slug/cluster-poi-candidates/preview — KHAC previewDestinationJobPromptResponseSchema:
 * co them block config vi Google Search Grounding bat/tat quyet dinh dung/sai ket qua,
 * khong the chi suy doan qua noi dung prompt text.
 */
export const previewClusterPoiPromptResponseSchema = z.object({
  systemPrompt: z.string(),
  userPrompt: z.string(),
  config: z.object({
    model: z.string(),
    useGoogleSearch: z.boolean(),
    temperature: z.number(),
  }),
});
export type PreviewClusterPoiPromptResponse = z.infer<
  typeof previewClusterPoiPromptResponseSchema
>;
