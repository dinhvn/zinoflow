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
  readonly source: string | null;
  readonly sourceUrl: string | null;
  readonly photographer: string | null;
  readonly relatedJobId: string | null;
  readonly searchKeyword: string | null;
}

export interface CreateContentImageInput {
  readonly path: string;
  readonly altText: string;
  readonly width: number;
  readonly height: number;
  readonly status?: ContentImageStatus;
  readonly source?: string | null;
  readonly sourceUrl?: string | null;
  readonly photographer?: string | null;
  readonly relatedJobId?: string | null;
  readonly searchKeyword?: string | null;
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
  /** Doi status pending -> active (duyet anh tu dong tim — plan §2.3) */
  approve(id: string): Promise<ContentImageRecord>;
  /** Tu khoa da bi tu choi cho 1 job — khong goi y lai o lan quet sau (plan §2.3) */
  addRejectedKeyword(jobId: string, keyword: string): Promise<void>;
  isKeywordRejected(jobId: string, keyword: string): Promise<boolean>;
  /** Tieu de bai cam nang (content_drafts.title, ban moi nhat) — hien "bai viet
   * lien quan" o man duyet anh pending (plan §2.3), tranh N+1 khi list. */
  findArticleTitlesByJobIds(jobIds: string[]): Promise<Map<string, string>>;
}
