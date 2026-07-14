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

/**
 * Mo hinh 2 tang (thay affiliate_link_rules cu — 1 provider = 1 template):
 * affiliate_networks = MANG affiliate thuc te (vd Accesstrade) so huu 1 template
 * dung chung cho MOI doi tac trong mang do; affiliate_partners = doi tac cu the
 * (klook/vexere/booking...), moi doi tac gan vao 1 mang (hoac null = chua gan/
 * affiliate truc tiep). Convert: provider -> tim partner -> tim network cua no ->
 * ap template cua NETWORK (khong phai cua partner) — xem giai thich §3 doc phan tich.
 */
export const affiliateNetworkSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  template: z.string().min(1).max(1024),
  placeholder: affiliatePlaceholderSchema,
  isActive: z.boolean(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AffiliateNetwork = z.infer<typeof affiliateNetworkSchema>;

export const createAffiliateNetworkRequestSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  template: z.string().min(1).max(1024),
  placeholder: affiliatePlaceholderSchema.default("{url_enc}"),
  isActive: z.boolean().default(true),
  notes: z.string().nullable().optional(),
});
export type CreateAffiliateNetworkRequest = z.infer<typeof createAffiliateNetworkRequestSchema>;

export const updateAffiliateNetworkRequestSchema = createAffiliateNetworkRequestSchema.partial();
export type UpdateAffiliateNetworkRequest = z.infer<typeof updateAffiliateNetworkRequestSchema>;

/** 1 doi tac affiliate cu the (klook/vexere/booking...) — provider trong ticketLinks[]/Hotel/Tour phai khop `code` */
export const affiliatePartnerSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  homepageUrl: z.string().max(512).nullable(),
  description: z.string().nullable(),
  /** null = chua gan mang (affiliate truc tiep hoac chua cau hinh) */
  networkId: z.string().uuid().nullable(),
  /** Chi dung goi y UX khi nhap sourceUrl — KHONG dung de convert (spec §3) */
  matchDomain: z.string().max(256).nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AffiliatePartner = z.infer<typeof affiliatePartnerSchema>;

export const createAffiliatePartnerRequestSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  homepageUrl: z.string().max(512).nullable().optional(),
  description: z.string().nullable().optional(),
  networkId: z.string().uuid().nullable().optional(),
  matchDomain: z.string().max(256).nullable().optional(),
  isActive: z.boolean().default(true),
});
export type CreateAffiliatePartnerRequest = z.infer<typeof createAffiliatePartnerRequestSchema>;

export const updateAffiliatePartnerRequestSchema = createAffiliatePartnerRequestSchema.partial();
export type UpdateAffiliatePartnerRequest = z.infer<typeof updateAffiliatePartnerRequestSchema>;

/**
 * 1 dong tu Google Sheet cong khai (import hang loat doi tac — doc §4). Cot
 * "loai affiliate" trong Sheet CHINH LA `affiliate_networks.code` — khop
 * CHINH XAC (khong fuzzy theo ten), khong khop duoc thi GIU nguyen networkId
 * dang co (khong tu xoa gan tay). Luu thang, khong preview — upsert theo `code`.
 */
export const affiliatePartnerImportRowSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  homepageUrl: z.string().max(512).nullable().optional(),
  description: z.string().nullable().optional(),
  /** Khop chinh xac affiliate_networks.code — null/khong khop = giu nguyen gan cu */
  networkCode: z.string().max(64).nullable().optional(),
  isActive: z.boolean().default(true),
});
export type AffiliatePartnerImportRow = z.infer<typeof affiliatePartnerImportRowSchema>;

export const importAffiliatePartnersRequestSchema = z.object({
  items: z.array(affiliatePartnerImportRowSchema).min(1).max(1000),
});
export type ImportAffiliatePartnersRequest = z.infer<typeof importAffiliatePartnersRequestSchema>;

export const importAffiliatePartnersResultSchema = z.object({
  inserted: z.number().int(),
  updated: z.number().int(),
  skipped: z.array(z.object({ code: z.string(), reason: z.string() })),
});
export type ImportAffiliatePartnersResult = z.infer<typeof importAffiliatePartnersResultSchema>;

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
