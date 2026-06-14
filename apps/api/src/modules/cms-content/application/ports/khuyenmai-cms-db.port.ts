import type { CmsPostRow } from "../../domain/cms-post";

/** Port doc/ghi DB CMS khuyenmai (SQL Server). Chi infrastructure biet mssql. */
export const KHUYENMAI_CMS_DB = Symbol("KHUYENMAI_CMS_DB");

export interface CmsContentWrite {
  title: string;
  fixedContent: string;
  excerpt: string | null;
}

/** Noi dung hien tai 1 bai (FixedContent + Excerpt) */
export interface CmsPostBody {
  fixedContent: string | null;
  excerpt: string | null;
}

export interface KhuyenMaiCmsDb {
  isConfigured(): boolean;
  /** Doc danh sach bai theo site (1=laruki, 2=dochoi3s) — chi metadata, khong content */
  fetchPosts(siteId: number): Promise<CmsPostRow[]>;
  /** Doc FixedContent + Excerpt 1 bai (cho detail: hien thi + bóc tag + prompt update-mode) */
  fetchPostContent(cmsId: number): Promise<CmsPostBody>;
  /** Cap nhat noi dung bai da co (UPDATE WordpressPost) */
  updateContent(cmsId: number, content: CmsContentWrite): Promise<void>;
  /** Cap nhat rieng mo ta SEO (UPDATE WordpressPost.Excerpt) */
  updateExcerpt(cmsId: number, excerpt: string): Promise<void>;
  /** Tao bai moi (PostId=0 — CMS se tao WP post luc publish dau). Tra ve cmsId moi. */
  insertNewPost(
    siteId: number,
    content: CmsContentWrite,
    postType: number | null,
  ): Promise<{ cmsId: number }>;
}
