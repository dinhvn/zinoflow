import { z } from "zod/v4";
import { aiProviderKeySchema } from "./ai-provider";

/**
 * Batch AI (Gemini Batch API) — chay nhieu tac vu AI cung luc, re hon ~50%
 * nhung khong co ket qua ngay, phai bam nut "Kiem tra" thu cong (khong tu
 * dong poll). taskType la khoa mo rong: 1 loai tac vu moi = 1 handler moi
 * (BatchTaskHandler, apps/api), KHONG sua schema nay khi them tac vu.
 */
export const aiBatchTaskTypeSchema = z.enum([
  "content-outline",
  "content-article",
  "destination-gsg-extraction",
  "cluster-poi-discovery",
]);
export type AiBatchTaskType = z.infer<typeof aiBatchTaskTypeSchema>;

export const aiBatchStatusSchema = z.enum(["submitted", "succeeded", "failed"]);
export type AiBatchStatus = z.infer<typeof aiBatchStatusSchema>;

export const aiBatchItemStatusSchema = z.enum(["pending", "succeeded", "failed"]);
export type AiBatchItemStatus = z.infer<typeof aiBatchItemStatusSchema>;

/** 1 item gui vao batch — entityId tuy taskType (contentJobId | destination slug | cluster slug). */
export const aiBatchItemInputSchema = z.object({
  entityId: z.string().min(1),
  /** Tham so phu tuy tac vu — vd cluster-poi-discovery doc params.extraNotes. */
  params: z.record(z.string(), z.unknown()).optional(),
});
export type AiBatchItemInput = z.infer<typeof aiBatchItemInputSchema>;

export const submitAiBatchRequestSchema = z.object({
  taskType: aiBatchTaskTypeSchema,
  items: z.array(aiBatchItemInputSchema).min(1).max(500),
  /**
   * Ghi de provider/model cho CA batch nay (tuy chon — khong truyen thi dung
   * mac dinh cua tung item: aiProvider/aiModel cua job voi content-outline/
   * content-article, model co dinh voi destination-gsg-extraction/cluster-poi-discovery).
   * Phai truyen CA HAI cung luc hoac khong truyen gi — 1 batch chi goi duoc
   * 1 provider (client.batches.create gui 1 lan cho 1 model).
   */
  provider: aiProviderKeySchema.optional(),
  model: z.string().optional(),
  /** Ghi chu tuy chon nguoi dung tu nhap de phan biet cac batch cung taskType
   * (vd "GSG cho cụm Đà Lạt đợt 2") — cho phep rong. */
  note: z.string().max(500).optional(),
});
export type SubmitAiBatchRequest = z.infer<typeof submitAiBatchRequestSchema>;

export const aiBatchItemSchema = z.object({
  id: z.string().uuid(),
  batchId: z.string().uuid(),
  entityId: z.string(),
  params: z.record(z.string(), z.unknown()).nullable(),
  status: aiBatchItemStatusSchema,
  errorMessage: z.string().nullable(),
  /** Chi co gia tri khi status "succeeded". */
  inputTokens: z.number().int().nonnegative().nullable(),
  outputTokens: z.number().int().nonnegative().nullable(),
  costUsd: z.number().nonnegative().nullable(),
  createdAt: z.string().datetime(),
});
export type AiBatchItem = z.infer<typeof aiBatchItemSchema>;

export const aiBatchSchema = z.object({
  id: z.string().uuid(),
  taskType: aiBatchTaskTypeSchema,
  provider: aiProviderKeySchema,
  model: z.string(),
  providerBatchName: z.string(),
  status: aiBatchStatusSchema,
  itemCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  checkedAt: z.string().datetime().nullable(),
  /** Ghi chu tuy chon nguoi dung nhap luc gui batch — null neu de trong. */
  note: z.string().nullable(),
  /** So item "failed" trong batch — status batch phan anh trang thai JOB cua
   * Google (vd "succeeded" = Google xu ly xong), KHONG dam bao moi item ben
   * trong deu thanh cong (vd loi validate/AI rieng tung item). UI dung field
   * nay de hien "Xong (lỗi N)" thay vi "succeeded" gay hieu lam khi co item loi. */
  failedItemCount: z.number().int().nonnegative(),
  /** Cong don tu cac item "succeeded" trong batch — 0 neu chua co item nao xong. */
  totalInputTokens: z.number().int().nonnegative(),
  totalOutputTokens: z.number().int().nonnegative(),
  totalCostUsd: z.number().nonnegative(),
});
export type AiBatch = z.infer<typeof aiBatchSchema>;

export const submitAiBatchResponseSchema = z.object({
  batchId: z.string().uuid(),
});
export type SubmitAiBatchResponse = z.infer<typeof submitAiBatchResponseSchema>;

export const checkAiBatchResponseSchema = z.object({
  batch: aiBatchSchema,
  items: z.array(aiBatchItemSchema),
});
export type CheckAiBatchResponse = z.infer<typeof checkAiBatchResponseSchema>;

export const listAiBatchesQuerySchema = z.object({
  taskType: aiBatchTaskTypeSchema.optional(),
});
export type ListAiBatchesQuery = z.infer<typeof listAiBatchesQuerySchema>;

/**
 * Xem trước prompt SẼ gửi cho 1 item — build y het luc submit that (dung
 * chung BatchTaskHandler.buildRequest) nhung KHONG goi AI/luu gi, cho nguoi
 * dung kiem tra truoc khi bam "Chạy Batch AI" (yeu cau nguoi dung 08/2026).
 */
export const previewAiBatchPromptRequestSchema = z.object({
  taskType: aiBatchTaskTypeSchema,
  entityId: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional(),
  provider: aiProviderKeySchema.optional(),
  model: z.string().optional(),
});
export type PreviewAiBatchPromptRequest = z.infer<typeof previewAiBatchPromptRequestSchema>;

export const previewAiBatchPromptResponseSchema = z.object({
  model: z.string(),
  promptText: z.string(),
});
export type PreviewAiBatchPromptResponse = z.infer<typeof previewAiBatchPromptResponseSchema>;
