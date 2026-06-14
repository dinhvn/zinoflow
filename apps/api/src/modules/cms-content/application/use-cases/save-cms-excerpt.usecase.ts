import { Inject, Injectable, Logger } from "@nestjs/common";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  CMS_POST_MIRROR_REPOSITORY,
  type CmsPostMirrorRepository,
} from "../ports/cms-post-mirror.repository";
import { KHUYENMAI_CMS_DB, type KhuyenMaiCmsDb } from "../ports/khuyenmai-cms-db.port";

/** Luu mo ta SEO (Excerpt) thang xuong CMS — doc lap voi luong ghi content AI. */
@Injectable()
export class SaveCmsExcerptUseCase {
  private readonly logger = new Logger(SaveCmsExcerptUseCase.name);

  constructor(
    @Inject(CMS_POST_MIRROR_REPOSITORY) private readonly mirror: CmsPostMirrorRepository,
    @Inject(KHUYENMAI_CMS_DB) private readonly cmsDb: KhuyenMaiCmsDb,
  ) {}

  async execute(cmsId: number, excerpt: string): Promise<void> {
    const post = await this.mirror.findByCmsId(cmsId);
    if (!post) throw new DomainRuleError(`Không tìm thấy bài CMS #${cmsId}`);
    if (post.postId === 0 && !post.aiContentWrittenAt) {
      throw new DomainRuleError("Bài mới chưa ghi nội dung — ghi nội dung vào CMS trước khi lưu mô tả SEO");
    }
    await this.cmsDb.updateExcerpt(cmsId, excerpt.trim());
    this.logger.log(`Luu mo ta SEO cho bai CMS #${cmsId}`);
  }
}
