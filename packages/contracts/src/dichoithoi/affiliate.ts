import { z } from "zod/v4";

/**
 * Contracts cho co che chuyen doi link goc -> link affiliate — dung CHUNG cho
 * ve diem den (ticketLinks[]), khach san, tour.
 * Spec: docs/dichoithoi/dichoithoi-affiliate-link-conversion-spec.md.
 */

/** '{url}' giu nguyen | '{url_enc}' URL-encode truoc khi thay vao template */
export const affiliatePlaceholderSchema = z.enum(["{url}", "{url_enc}"]);
export type AffiliatePlaceholder = z.infer<typeof affiliatePlaceholderSchema>;

/**
 * converted: da ap rule; no-rule: chua co rule khop (affiliateUrl=sourceUrl);
 * manual-override: nguoi dung tu sua tay, job "Ap dung lai" bo qua (spec §3.4)
 */
export const affiliateLinkStatusSchema = z.enum(["converted", "no-rule", "manual-override"]);
export type AffiliateLinkStatus = z.infer<typeof affiliateLinkStatusSchema>;

export const affiliateLinkRuleSchema = z.object({
  id: z.string().uuid(),
  provider: z.string().min(1).max(64),
  matchDomain: z.string().max(256).nullable(),
  template: z.string().min(1).max(1024),
  placeholder: affiliatePlaceholderSchema,
  isActive: z.boolean(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AffiliateLinkRule = z.infer<typeof affiliateLinkRuleSchema>;

export const createAffiliateLinkRuleRequestSchema = z.object({
  provider: z.string().min(1).max(64),
  matchDomain: z.string().max(256).nullable().optional(),
  template: z.string().min(1).max(1024),
  placeholder: affiliatePlaceholderSchema.default("{url_enc}"),
  isActive: z.boolean().default(true),
  notes: z.string().nullable().optional(),
});
export type CreateAffiliateLinkRuleRequest = z.infer<typeof createAffiliateLinkRuleRequestSchema>;

export const updateAffiliateLinkRuleRequestSchema = createAffiliateLinkRuleRequestSchema.partial();
export type UpdateAffiliateLinkRuleRequest = z.infer<typeof updateAffiliateLinkRuleRequestSchema>;

/**
 * Hinh dang CHUNG cho 1 link kiem tien o bat ky noi nao dung co che nay
 * (ticketLinks[] cua diem den, khach san, tour) — spec §2.
 */
export const affiliateLinkItemSchema = z.object({
  provider: z.string().min(1).max(64),
  label: z.string().max(128).nullable(),
  sourceUrl: z.url().max(1024),
  affiliateUrl: z.string().max(1024),
  linkStatus: affiliateLinkStatusSchema,
  /** Gia tham khao rieng cua nha cung cap nay — tuy chon, nhieu noi khong hien
   *  gia truoc khi bam link ngoai (content-seo-ux-plan §5.5b). KHONG suy dien. */
  price: z.number().nonnegative().nullable(),
});
export type AffiliateLinkItem = z.infer<typeof affiliateLinkItemSchema>;

/** Preview convert ngay trong form (chua luu) — dan sourceUrl, tuy chon chi dinh provider */
export const resolveAffiliateLinkRequestSchema = z.object({
  sourceUrl: z.url().max(1024),
  provider: z.string().max(64).nullable().optional(),
});
export type ResolveAffiliateLinkRequest = z.infer<typeof resolveAffiliateLinkRequestSchema>;

export const resolveAffiliateLinkResponseSchema = z.object({
  provider: z.string(),
  affiliateUrl: z.string(),
  linkStatus: affiliateLinkStatusSchema,
});
export type ResolveAffiliateLinkResponse = z.infer<typeof resolveAffiliateLinkResponseSchema>;

/** Nut "Ap dung lai" — 1 rule cu the hoac toan bo (ruleId=null) — spec §4 */
export const reapplyAffiliateRuleRequestSchema = z.object({
  ruleId: z.string().uuid().nullable(),
});
export type ReapplyAffiliateRuleRequest = z.infer<typeof reapplyAffiliateRuleRequestSchema>;

export const reapplyAffiliateRuleReportSchema = z.object({
  ruleId: z.string().uuid().nullable(),
  targets: z.array(z.object({ label: z.string(), updatedCount: z.number().int() })),
  totalUpdated: z.number().int(),
  durationMs: z.number().int(),
});
export type ReapplyAffiliateRuleReport = z.infer<typeof reapplyAffiliateRuleReportSchema>;
