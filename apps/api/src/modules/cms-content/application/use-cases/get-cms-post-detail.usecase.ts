import { Inject, Injectable } from "@nestjs/common";
import type { CmsPostDetail } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  CMS_POST_MIRROR_REPOSITORY,
  type CmsPostMirrorRepository,
} from "../ports/cms-post-mirror.repository";
import { KHUYENMAI_CMS_DB, type KhuyenMaiCmsDb } from "../ports/khuyenmai-cms-db.port";
import {
  CONTENT_JOB_REPOSITORY,
  type ContentJobRepository,
} from "../../../ai-content/application/ports/content-job.repository";
import { extractCmsTags } from "../../domain/cms-post";
import { stripHtml } from "../../../shared/text/strip-html";
import { sanitizeCmsHtmlForDisplay } from "../services/cms-html.renderer";
import { toCmsPostDto } from "./cms-post.mapper";

/** Chi tiet 1 bai cho man /[site]/[cmsId] — gom mirror + tag hien co + trang thai job + ghi chu AI. */
@Injectable()
export class GetCmsPostDetailUseCase {
  constructor(
    @Inject(CMS_POST_MIRROR_REPOSITORY) private readonly mirror: CmsPostMirrorRepository,
    @Inject(KHUYENMAI_CMS_DB) private readonly cmsDb: KhuyenMaiCmsDb,
    @Inject(CONTENT_JOB_REPOSITORY) private readonly jobRepo: ContentJobRepository,
  ) {}

  async execute(cmsId: number): Promise<CmsPostDetail> {
    const entity = await this.mirror.findByCmsId(cmsId);
    if (!entity) {
      throw new DomainRuleError(`Không tìm thấy bài viết CMS #${cmsId}`, [
        "Bấm Đồng bộ từ CMS rồi thử lại",
      ]);
    }
    // Doc noi dung hien tai ben CMS (FixedContent + Excerpt): hien thi tham khao + boc tag.
    // Bai moi (postId=0, chua ghi) co the chua co content -> bo qua.
    let existingTags: string[] = [];
    let currentContent: string | null = null;
    let currentExcerpt: string | null = null;
    if (entity.postId !== 0 || entity.aiContentWrittenAt) {
      const body = await this.cmsDb.fetchPostContent(cmsId).catch(() => null);
      existingTags = extractCmsTags(body?.fixedContent ?? null);
      currentContent = body?.fixedContent ? sanitizeCmsHtmlForDisplay(body.fixedContent) : null;
      // Excerpt la meta description -> hien thi plain text (bo the HTML cu neu co)
      currentExcerpt = body?.excerpt ? stripHtml(body.excerpt).trim() || null : null;
    }

    // Trang thai job dang soan (UI mo nut "Ghi vao CMS" khi Approved)
    let activeJobStatus: string | null = null;
    if (entity.activeContentJobId) {
      const job = await this.jobRepo.findById(entity.activeContentJobId);
      activeJobStatus = job?.toSnapshot().status ?? null;
    }

    return {
      ...toCmsPostDto(entity),
      existingTags,
      currentContent,
      currentExcerpt,
      activeJobStatus,
      aiNotes: entity.aiNotes,
      aiTagHints: entity.aiTagHints,
      aiReferenceUrls: entity.aiReferenceUrls,
    };
  }
}
