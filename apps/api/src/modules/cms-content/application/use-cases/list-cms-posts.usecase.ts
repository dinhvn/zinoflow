import { Inject, Injectable } from "@nestjs/common";
import {
  KHUYENMAI_SITE_ID,
  type KhuyenmaiSite,
  type ListCmsPostsQuery,
  type ListCmsPostsResponse,
} from "@zinoflow/contracts";
import {
  CMS_POST_MIRROR_REPOSITORY,
  type CmsPostMirrorRepository,
} from "../ports/cms-post-mirror.repository";
import { toCmsPostDto } from "./cms-post.mapper";

/** Danh sach bai viet CMS cho man /laruki, /dochoi3s (mirror Postgres). */
@Injectable()
export class ListCmsPostsUseCase {
  constructor(
    @Inject(CMS_POST_MIRROR_REPOSITORY) private readonly mirror: CmsPostMirrorRepository,
  ) {}

  async execute(site: KhuyenmaiSite, query: ListCmsPostsQuery): Promise<ListCmsPostsResponse> {
    const { items, total } = await this.mirror.list(KHUYENMAI_SITE_ID[site], query);
    return {
      items: items.map(toCmsPostDto),
      total,
      page: query.page,
      limit: query.limit,
    };
  }
}
