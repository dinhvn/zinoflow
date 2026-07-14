import type { AffiliateNetworkRule } from "../../domain/affiliate-link-rule";

export const AFFILIATE_NETWORK_REPOSITORY = Symbol("AFFILIATE_NETWORK_REPOSITORY");

export interface AffiliateNetworkRecord extends AffiliateNetworkRule {
  readonly code: string;
  readonly name: string;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateAffiliateNetworkInput {
  readonly code: string;
  readonly name: string;
  readonly template: string;
  readonly placeholder: AffiliateNetworkRule["placeholder"];
  readonly isActive: boolean;
  readonly notes: string | null;
}

export type UpdateAffiliateNetworkInput = Partial<CreateAffiliateNetworkInput>;

/** Repository bang affiliate_networks (Postgres) */
export interface AffiliateNetworkRepository {
  listAll(): Promise<AffiliateNetworkRecord[]>;
  listActive(): Promise<AffiliateNetworkRecord[]>;
  findById(id: string): Promise<AffiliateNetworkRecord | null>;
  create(input: CreateAffiliateNetworkInput): Promise<AffiliateNetworkRecord>;
  update(id: string, input: UpdateAffiliateNetworkInput): Promise<AffiliateNetworkRecord>;
  delete(id: string): Promise<void>;
}
