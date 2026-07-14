import type { AffiliatePartnerRule } from "../../domain/affiliate-link-rule";

export const AFFILIATE_PARTNER_REPOSITORY = Symbol("AFFILIATE_PARTNER_REPOSITORY");

export interface AffiliatePartnerRecord extends AffiliatePartnerRule {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly homepageUrl: string | null;
  readonly description: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateAffiliatePartnerInput {
  readonly code: string;
  readonly name: string;
  readonly homepageUrl: string | null;
  readonly description: string | null;
  readonly networkId: string | null;
  readonly matchDomain: string | null;
  readonly isActive: boolean;
}

export type UpdateAffiliatePartnerInput = Partial<CreateAffiliatePartnerInput>;

/** Repository bang affiliate_partners (Postgres) */
export interface AffiliatePartnerRepository {
  listAll(): Promise<AffiliatePartnerRecord[]>;
  listActive(): Promise<AffiliatePartnerRecord[]>;
  findById(id: string): Promise<AffiliatePartnerRecord | null>;
  findByCode(code: string): Promise<AffiliatePartnerRecord | null>;
  create(input: CreateAffiliatePartnerInput): Promise<AffiliatePartnerRecord>;
  update(id: string, input: UpdateAffiliatePartnerInput): Promise<AffiliatePartnerRecord>;
  delete(id: string): Promise<void>;
  /** Upsert theo `code` — dung cho import Google Sheet (khong doi networkId neu doi tac da co) */
  upsertByCode(code: string, input: Omit<CreateAffiliatePartnerInput, "code">): Promise<{ created: boolean }>;
}
