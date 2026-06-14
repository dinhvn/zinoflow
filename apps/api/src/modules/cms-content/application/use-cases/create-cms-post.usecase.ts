import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  KHUYENMAI_SITE_ID,
  type CreateCmsPostRequest,
  type CreateCmsPostResponse,
  type KhuyenmaiSite,
} from "@zinoflow/contracts";
import {
  CMS_POST_MIRROR_REPOSITORY,
  type CmsPostMirrorRepository,
} from "../ports/cms-post-mirror.repository";
import { KHUYENMAI_CMS_DB, type KhuyenMaiCmsDb } from "../ports/khuyenmai-cms-db.port";

/**
 * Tao bai MOI hoan toan (phuong an R): INSERT shell vao WordpressPost (PostId=0, content rong)
 * de lay cmsId, tao dong mirror -> sau do dung chung luong tao job + ghi content nhu bai co san.
 * CMS se tao WP post that luc publish dau (PostId=0 -> Posts.CreateAsync — viec ben repo khuyenmai).
 */
@Injectable()
export class CreateCmsPostUseCase {
  private readonly logger = new Logger(CreateCmsPostUseCase.name);

  constructor(
    @Inject(CMS_POST_MIRROR_REPOSITORY) private readonly mirror: CmsPostMirrorRepository,
    @Inject(KHUYENMAI_CMS_DB) private readonly cmsDb: KhuyenMaiCmsDb,
  ) {}

  async execute(site: KhuyenmaiSite, request: CreateCmsPostRequest): Promise<CreateCmsPostResponse> {
    const siteId = KHUYENMAI_SITE_ID[site];
    const postType = request.postType ?? null;
    const { cmsId } = await this.cmsDb.insertNewPost(
      siteId,
      { title: request.title.trim(), fixedContent: "", excerpt: null },
      postType,
    );
    await this.mirror.createLocal({
      cmsId,
      siteId,
      postId: 0,
      postType,
      title: request.title.trim(),
      link: null,
      isReadyAuto: false,
      datePublished: null,
      dateUpdated: new Date(),
    });
    this.logger.log(`Tao bai moi CMS #${cmsId} (${site})`);
    return { cmsId };
  }
}
