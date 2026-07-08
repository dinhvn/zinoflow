import type { AffiliateLinkStatus } from "@zinoflow/contracts";

export const PRODUCT_REPOSITORY = Symbol("PRODUCT_REPOSITORY");

export interface ProductRecord {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly tags: string[];
  readonly thumbnailUrl: string | null;
  readonly price: number | null;
  readonly provider: string | null;
  readonly sourceUrl: string;
  readonly affiliateUrl: string | null;
  readonly linkStatus: AffiliateLinkStatus;
  readonly source: number;
  readonly status: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface UpsertProductInput {
  readonly name: string;
  readonly category: string;
  readonly tags: string[];
  readonly thumbnailUrl: string | null;
  readonly price: number | null;
  readonly provider: string | null;
  readonly sourceUrl: string;
  readonly affiliateUrl: string;
  readonly linkStatus: AffiliateLinkStatus;
}

/** Repository bang products (Postgres — nguon su that, dichoithoi-product-spec §3) */
export interface ProductRepository {
  findAll(): Promise<ProductRecord[]>;
  findById(id: string): Promise<ProductRecord | null>;
  create(input: UpsertProductInput): Promise<ProductRecord>;
  update(id: string, input: UpsertProductInput): Promise<ProductRecord>;
  /** Danh sach category da dung, sap ABC — goi y autocomplete cho form quan ly (khong bang rieng) */
  listDistinctCategories(): Promise<string[]>;
}
