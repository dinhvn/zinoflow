import { z } from "zod/v4";

/**
 * Tong hop chi phi AI tu ai_usage_logs (spec §13) — cho man /usage.
 * Gop theo provider×model, theo operation (buoc pipeline), va theo ngay.
 */

/** Khoang ngay loc (YYYY-MM-DD). Bo trong -> mac dinh 30 ngay gan nhat (xu ly o use case). */
export const aiUsageSummaryQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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
export type AiUsageSummaryResponse = z.infer<typeof aiUsageSummaryResponseSchema>;
