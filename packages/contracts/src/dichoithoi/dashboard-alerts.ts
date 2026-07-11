import { z } from "zod/v4";

/**
 * Khoi "Viec can lam" tren hub CMS dichoithoi (destination-spec §7.2, Phase 23
 * 07/2026) — tong hop canh bao tu du lieu da co san, khong bang/job moi.
 */
export const dichoithoiDashboardAlertSchema = z.object({
  key: z.string(),
  label: z.string(),
  count: z.number().int().min(0),
  href: z.string(),
});
export type DichoithoiDashboardAlert = z.infer<typeof dichoithoiDashboardAlertSchema>;

export const dichoithoiDashboardAlertsResponseSchema = z.object({
  alerts: z.array(dichoithoiDashboardAlertSchema),
  coverageHealthPercent: z.number().int().min(0).max(100),
});
export type DichoithoiDashboardAlertsResponse = z.infer<
  typeof dichoithoiDashboardAlertsResponseSchema
>;
