import { z } from "zod/v4";
import { contentJobStatusSchema } from "../ai-content/content-job";

/**
 * Tong hop cho Dashboard trang chu — gom job pipeline, viec can lam, tien do
 * theo kenh (dichoithoi/laruki/dochoi3s), chi phi AI, trang thai he thong.
 * 1 endpoint GET /dashboard/summary de trang chu chi goi 1 lan.
 */

export const dashboardJobStatusCountSchema = z.object({
  status: contentJobStatusSchema,
  count: z.number().int(),
});

export const dashboardRecentJobSchema = z.object({
  id: z.string(),
  topic: z.string(),
  articleType: z.string(),
  status: contentJobStatusSchema,
  createdAt: z.string(),
});

/** 1 bucket trang thai trong 1 kenh (label tieng Viet + so luong). */
export const dashboardChannelStateSchema = z.object({
  key: z.string(),
  label: z.string(),
  count: z.number().int(),
});

export const dashboardChannelSchema = z.object({
  key: z.enum(["dichoithoi", "laruki", "dochoi3s"]),
  label: z.string(),
  total: z.number().int(),
  href: z.string(),
  states: z.array(dashboardChannelStateSchema),
});

export const dashboardSummaryResponseSchema = z.object({
  generatedAt: z.string(),
  jobs: z.object({
    total: z.number().int(),
    byStatus: z.array(dashboardJobStatusCountSchema),
    recent: z.array(dashboardRecentJobSchema),
  }),
  /** Viec can lam (actionable) — so luong cho hang doi cong viec */
  actions: z.object({
    pendingReview: z.number().int(), // job InReview
    failed: z.number().int(), // job Failed
    approved: z.number().int(), // job Approved (san sang dang/ghi)
  }),
  channels: z.array(dashboardChannelSchema),
  cost: z.object({
    costUsd: z.number(),
    calls: z.number().int(),
    from: z.string(),
    to: z.string(),
    daily: z.array(z.object({ date: z.string(), costUsd: z.number() })),
  }),
  system: z.object({ database: z.string() }),
});
export type DashboardSummaryResponse = z.infer<typeof dashboardSummaryResponseSchema>;
