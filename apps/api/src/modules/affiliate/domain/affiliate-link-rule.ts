import type { AffiliateLinkStatus, AffiliatePlaceholder } from "@zinoflow/contracts";

/** 1 doi tac affiliate (vd klook/vexere/booking) — mirror affiliatePartnerSchema */
export interface AffiliatePartnerRule {
  readonly code: string;
  readonly matchDomain: string | null;
  readonly networkId: string | null;
  readonly isActive: boolean;
}

/** 1 mang affiliate (vd Accesstrade) — template DUNG CHUNG cho moi doi tac cua no */
export interface AffiliateNetworkRule {
  readonly id: string;
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

function findPartner(
  sourceUrl: string,
  partners: readonly AffiliatePartnerRule[],
  explicitProvider: string | null,
): AffiliatePartnerRule | null {
  const active = partners.filter((p) => p.isActive);
  if (explicitProvider) {
    return active.find((p) => p.code === explicitProvider) ?? null;
  }
  const domain = extractDomain(sourceUrl);
  if (!domain) return null;
  return active.find((p) => p.matchDomain && domain.endsWith(p.matchDomain.toLowerCase())) ?? null;
}

function applyTemplate(network: AffiliateNetworkRule, sourceUrl: string): string {
  const value = network.placeholder === "{url_enc}" ? encodeURIComponent(sourceUrl) : sourceUrl;
  return network.template.split(network.placeholder).join(value);
}

/**
 * Thuat toan convert v2 (doc phan tich affiliate-provider-management §3): tim doi
 * tac (provider) -> tim MANG cua doi tac do -> ap template cua MANG (khong phai
 * cua tung doi tac — cac mang thuc te nhu Accesstrade dung 1 template deep-link
 * chung cho moi merchant). Khong khop duoc doi tac/mang/mang tat -> giu nguyen
 * sourceUrl, danh dau 'no-rule' — khong bao gio bia du lieu, khong am tham thieu
 * hoa hong.
 */
export function resolveAffiliateLink(
  sourceUrl: string,
  partners: readonly AffiliatePartnerRule[],
  networks: readonly AffiliateNetworkRule[],
  explicitProvider: string | null = null,
): ResolvedAffiliateLink {
  const partner = findPartner(sourceUrl, partners, explicitProvider);
  if (!partner) {
    return { provider: explicitProvider ?? "other", affiliateUrl: sourceUrl, linkStatus: "no-rule" };
  }
  const network = partner.networkId
    ? networks.find((n) => n.id === partner.networkId && n.isActive) ?? null
    : null;
  if (!network) {
    return { provider: partner.code, affiliateUrl: sourceUrl, linkStatus: "no-rule" };
  }
  return {
    provider: partner.code,
    affiliateUrl: applyTemplate(network, sourceUrl),
    linkStatus: "converted",
  };
}
