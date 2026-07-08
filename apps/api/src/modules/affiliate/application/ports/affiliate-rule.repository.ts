import type { AffiliateLinkRule as AffiliateLinkRuleDomain } from "../../domain/affiliate-link-rule";

export const AFFILIATE_RULE_REPOSITORY = Symbol("AFFILIATE_RULE_REPOSITORY");

/** 1 dong ban ghi day du (kem field hien thi UI: notes/createdAt/updatedAt) */
export interface AffiliateLinkRuleRecord extends AffiliateLinkRuleDomain {
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateAffiliateLinkRuleInput {
  readonly provider: string;
  readonly matchDomain: string | null;
  readonly template: string;
  readonly placeholder: AffiliateLinkRuleDomain["placeholder"];
  readonly isActive: boolean;
  readonly notes: string | null;
}

export type UpdateAffiliateLinkRuleInput = Partial<CreateAffiliateLinkRuleInput>;

/** Repository bang affiliate_link_rules (Postgres — nguon su that duy nhat, spec §2) */
export interface AffiliateRuleRepository {
  listAll(): Promise<AffiliateLinkRuleRecord[]>;
  listActive(): Promise<AffiliateLinkRuleRecord[]>;
  findById(id: string): Promise<AffiliateLinkRuleRecord | null>;
  create(input: CreateAffiliateLinkRuleInput): Promise<AffiliateLinkRuleRecord>;
  update(id: string, input: UpdateAffiliateLinkRuleInput): Promise<AffiliateLinkRuleRecord>;
}
