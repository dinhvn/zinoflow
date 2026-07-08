import type { AffiliateLinkStatus, AffiliatePlaceholder } from "@zinoflow/contracts";

/** 1 quy tac chuyen doi (khop domain -> template) — mirror affiliateLinkRuleSchema */
export interface AffiliateLinkRule {
  readonly id: string;
  readonly provider: string;
  readonly matchDomain: string | null;
  readonly template: string;
  readonly placeholder: AffiliatePlaceholder;
  readonly isActive: boolean;
}

export interface ResolvedAffiliateLink {
  readonly provider: string;
  readonly affiliateUrl: string;
  readonly linkStatus: AffiliateLinkStatus;
}

/** Lay hostname sach (bo "www.") de khop voi matchDomain — tra null neu sourceUrl khong parse duoc */
function extractDomain(sourceUrl: string): string | null {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function findRule(
  sourceUrl: string,
  rules: readonly AffiliateLinkRule[],
  explicitProvider: string | null,
): AffiliateLinkRule | null {
  const active = rules.filter((r) => r.isActive);
  if (explicitProvider) {
    return active.find((r) => r.provider === explicitProvider) ?? null;
  }
  const domain = extractDomain(sourceUrl);
  if (!domain) return null;
  return (
    active.find((r) => r.matchDomain && domain.endsWith(r.matchDomain.toLowerCase())) ?? null
  );
}

function applyTemplate(rule: AffiliateLinkRule, sourceUrl: string): string {
  const value = rule.placeholder === "{url_enc}" ? encodeURIComponent(sourceUrl) : sourceUrl;
  return rule.template.split(rule.placeholder).join(value);
}

/**
 * Thuat toan convert sourceUrl -> affiliateUrl (spec §3). Khong bao gio bia du lieu:
 * khong khop rule nao -> giu nguyen sourceUrl, danh dau 'no-rule' de nguoi dung biet
 * can them rule, KHONG am tham thieu hoa hong.
 */
export function resolveAffiliateLink(
  sourceUrl: string,
  rules: readonly AffiliateLinkRule[],
  explicitProvider: string | null = null,
): ResolvedAffiliateLink {
  const rule = findRule(sourceUrl, rules, explicitProvider);
  if (!rule) {
    return { provider: explicitProvider ?? "other", affiliateUrl: sourceUrl, linkStatus: "no-rule" };
  }
  return {
    provider: rule.provider,
    affiliateUrl: applyTemplate(rule, sourceUrl),
    linkStatus: "converted",
  };
}
