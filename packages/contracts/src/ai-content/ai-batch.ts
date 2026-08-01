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
});
export type SubmitAiBatchRequest = z.infer<typeof submitAiBatchRequestSchema>;

export const aiBatchItemSchema = z.object({
  id: z.string().uuid(),
  batchId: z.string().uuid(),
  entityId: z.string(),
  params: z.record(z.string(), z.unknown()).nullable(),
  status: aiBatchItemStatusSchema,
  errorMessage: z.string().nullable(),
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
