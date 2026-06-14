import type { CmsPostRow } from "../../domain/cms-post";

/** Port doc/ghi DB CMS khuyenmai (SQL Server). Chi infrastructure biet mssql. */
export const KHUYENMAI_CMS_DB = Symbol("KHUYENMAI_CMS_DB");

export interface CmsContentWrite {
  title: string;
  fixedContent: string;
  excerpt: string | null;
}

export interface KhuyenMaiCmsDb {
  isConfigured(): boolean;
  /** Doc danh sach bai theo site (1=laruki, 2=dochoi3s) — chi metadata, khong content */
  fetchPosts(siteId: number): Promise<CmsPostRow[]>;
  /** Doc FixedContent 1 bai (cho detail: bóc tag + đua vao prompt update-mode) */
  fetchPostContent(cmsId: number): Promise<string | null>;
  /** Cap nhat noi dung bai da co (UPDATE WordpressPost) */
  updateContent(cmsId: number, content: CmsContentWrite): Promise<void>;
  /** Tao bai moi (PostId=0 — CMS se tao WP post luc publish dau). Tra ve cmsId moi. */
  insertNewPost(
    siteId: number,
    content: CmsContentWrite,
    postType: number | null,
  ): Promise<{ cmsId: number }>;
}
