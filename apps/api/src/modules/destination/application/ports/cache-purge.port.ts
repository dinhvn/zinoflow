export const CACHE_PURGE = Symbol("CACHE_PURGE");

/**
 * Purge cache 2 tang cua website sau khi noi dung 1 diem den thay doi
 * (Phase 17 — content-seo-ux-plan §10.5.1 muc 2): tang 1 la endpoint
 * invalidate-cache co san cua website (OutputCache tag theo slug), tang 2 la
 * Cloudflare Purge Cache API (chi goi neu da cau hinh token/zone). Loi o day
 * KHONG duoc chan luong publish — cache van tu het han theo TTL.
 */
export interface CachePurgePort {
  purgeDestination(slug: string): Promise<void>;
}
