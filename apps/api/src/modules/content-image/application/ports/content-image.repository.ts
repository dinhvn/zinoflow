import type { ContentImageStatus } from "@zinoflow/contracts";

export const CONTENT_IMAGE_REPOSITORY = Symbol("CONTENT_IMAGE_REPOSITORY");

export interface ContentImageRecord {
  readonly id: string;
  readonly path: string;
  readonly altText: string;
  readonly caption: string | null;
  readonly width: number;
  readonly height: number;
  readonly status: ContentImageStatus;
  readonly usageCount: number;
  readonly uploadedAt: Date;
}

export interface CreateContentImageInput {
  readonly path: string;
  readonly altText: string;
  readonly width: number;
  readonly height: number;
}

export interface UpdateContentImageInput {
  readonly altText: string;
  readonly caption: string | null;
}

/** Repository bang content_images (Postgres — nguon su that duy nhat) */
export interface ContentImageRepository {
  findAll(): Promise<ContentImageRecord[]>;
  findById(id: string): Promise<ContentImageRecord | null>;
  create(input: CreateContentImageInput): Promise<ContentImageRecord>;
  update(id: string, input: UpdateContentImageInput): Promise<ContentImageRecord>;
  delete(id: string): Promise<void>;
  /** Dem so ban ghi content_drafts con chua token "[[block:image id=<id>]]"
   * (chua xoa duoc anh dang dung — tranh vo anh trong bai da/dang soan) */
  countReferencesInDrafts(id: string): Promise<number>;
}
