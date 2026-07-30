import { z } from "zod/v4";

/**
 * Tong hop chi phi AI tu ai_usage_logs (spec §13) — cho man /usage.
 * Gop theo provider×model, theo operation (buoc pipeline), va theo ngay.
 */

/** Khoang ngay loc (YYYY-MM-DD). Bo trong -> mac dinh 30 ngay gan nhat (xu ly o use case). */
export const aiUsageSummaryQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
export type AiUsageSummaryQuery = z.infer<typeof aiUsageSummaryQuerySchema>;

export const aiUsageTotalsSchema = z.object({
  calls: z.number().int(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  costUsd: z.number(),
  avgLatencyMs: z.number(),
});
export type AiUsageTotals = z.infer<typeof aiUsageTotalsSchema>;

/** 1 dong gop theo provider + model */
export const aiUsageModelStatSchema = z.object({
  provider: z.string(),
  model: z.string(),
  calls: z.number().int(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  costUsd: z.number(),
});
export type AiUsageModelStat = z.infer<typeof aiUsageModelStatSchema>;

/** 1 dong gop theo operation (outline/section/frame/cms-seo-description/...) */
export const aiUsageOperationStatSchema = z.object({
  operation: z.string(),
  calls: z.number().int(),
  costUsd: z.number(),
});
export type AiUsageOperationStat = z.infer<typeof aiUsageOperationStatSchema>;

/** 1 ngay (date = YYYY-MM-DD) */
export const aiUsageDailyStatSchema = z.object({
  date: z.string(),
  calls: z.number().int(),
  costUsd: z.number(),
});
export type AiUsageDailyStat = z.infer<typeof aiUsageDailyStatSchema>;

export const aiUsageSummaryResponseSchema = z.object({
  range: z.object({ from: z.string(), to: z.string() }),
  totals: aiUsageTotalsSchema,
  byModel: z.array(aiUsageModelStatSchema),
  byOperation: z.array(aiUsageOperationStatSchema),
  daily: z.array(aiUsageDailyStatSchema),
});
export type AiUsageSummaryResponse = z.infer<
  typeof aiUsageSummaryResponseSchema
>;

/**
 * 1 lan goi AI cu the cua 1 job — gom ca prompt/response tho (yeu cau nguoi dung
 * 07/2026 de debug/audit: bam vao 1 content job xem duoc AI da nhan prompt gi,
 * tra ve gi cho tung buoc outline/section/frame).
 */
export const aiUsageLogEntrySchema = z.object({
  id: z.string(),
  operation: z.string(),
  provider: z.string(),
  model: z.string(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  costUsd: z.number(),
  latencyMs: z.number().int(),
  promptText: z.string().nullable(),
  responseText: z.string().nullable(),
  promptKey: z.string().nullable(),
  promptVersion: z.number().int().nullable(),
  promptSource: z.enum(["db", "default"]).nullable(),
  sourceContextHash: z.string().nullable(),
  createdAt: z.string(),
});
export type AiUsageLogEntry = z.infer<typeof aiUsageLogEntrySchema>;

/**
 * Man "Lịch sử gọi AI" (/usage, tab Lịch sử) — liệt kê TỪNG lượt gọi AI toàn hệ
 * thống (không chỉ theo 1 content job như `listByJobId`/aiUsageLogEntrySchema),
 * kem jobId de biet lan nao thuoc job viet bai nao (null = khong gan job, vd
 * goi y Type/Tag taxonomy). Yeu cau nguoi dung 24/07/2026.
 */
export const aiUsageLogRowSchema = aiUsageLogEntrySchema.extend({
  jobId: z.string().nullable(),
});
export type AiUsageLogRow = z.infer<typeof aiUsageLogRowSchema>;

export const listAiUsageLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  provider: z.string().optional(),
  operation: z.string().optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
export type ListAiUsageLogsQuery = z.infer<typeof listAiUsageLogsQuerySchema>;

export const listAiUsageLogsResponseSchema = z.object({
  rows: z.array(aiUsageLogRowSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
  /** Danh sach operation duy nhat tung xuat hien — dung cho dropdown loc, khong can query rieng */
  operations: z.array(z.string()),
});
export type ListAiUsageLogsResponse = z.infer<
  typeof listAiUsageLogsResponseSchema
>;
