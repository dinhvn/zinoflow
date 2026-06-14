import { Inject, Injectable } from "@nestjs/common";
import type { CmsPostDetail } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  CMS_POST_MIRROR_REPOSITORY,
  type CmsPostMirrorRepository,
} from "../ports/cms-post-mirror.repository";
import { KHUYENMAI_CMS_DB, type KhuyenMaiCmsDb } from "../ports/khuyenmai-cms-db.port";
import { extractCmsTags } from "../../domain/cms-post";
import { toCmsPostDto } from "./cms-post.mapper";

/** Chi tiet 1 bai cho man /[site]/[cmsId] — gom mirror + tag hien co + ghi chu AI. */
@Injectable()
export class GetCmsPostDetailUseCase {
  constructor(
    @Inject(CMS_POST_MIRROR_REPOSITORY) private readonly mirror: CmsPostMirrorRepository,
    @Inject(KHUYENMAI_CMS_DB) private readonly cmsDb: KhuyenMaiCmsDb,
  ) {}

  async execute(cmsId: number): Promise<CmsPostDetail> {
    const entity = await this.mirror.findByCmsId(cmsId);
    if (!entity) {
      throw new DomainRuleError(`Không tìm thấy bài viết CMS #${cmsId}`, [
        "Bấm Đồng bộ từ CMS rồi thử lại",
      ]);
    }
    // Bóc tag tu FixedContent ben CMS (chi de hien thi tham khao). Bai moi (postId=0,
    // chua ghi) co the chua co content -> tag rong.
    let existingTags: string[] = [];
    if (entity.postId !== 0 || entity.aiContentWrittenAt) {
      const content = await this.cmsDb.fetchPostContent(cmsId).catch(() => null);
      existingTags = extractCmsTags(content);
    }

    return {
      ...toCmsPostDto(entity),
      existingTags,
      aiNotes: entity.aiNotes,
      aiTagHints: entity.aiTagHints,
      aiReferenceUrls: entity.aiReferenceUrls,
    };
  }
}
