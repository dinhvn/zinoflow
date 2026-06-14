import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  aiProviderKeySchema,
  khuyenmaiArticleType,
  khuyenmaiPostTypeLabel,
  khuyenmaiSiteFromId,
  type CreateCmsJobRequest,
  type CreateCmsJobResponse,
} from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import { stripHtml } from "../../../shared/text/strip-html";
import { CreateContentJobUseCase } from "../../../ai-content/application/use-cases/create-content-job.usecase";
import {
  CONTENT_JOB_REPOSITORY,
  type ContentJobRepository,
} from "../../../ai-content/application/ports/content-job.repository";
import {
  CMS_POST_MIRROR_REPOSITORY,
  type CmsPostMirrorRepository,
} from "../ports/cms-post-mirror.repository";
import { KHUYENMAI_CMS_DB, type KhuyenMaiCmsDb } from "../ports/khuyenmai-cms-db.port";
import { CMS_REFERENCE_FETCHER, type CmsReferenceFetcher } from "../ports/cms-reference-fetcher.port";

const MAX_OLD_CONTENT_CHARS = 16_000;

/**
 * Tao content job AI cho 1 bai CMS khuyenmai (laruki/dochoi3s).
 * - mode create: bai chua co content AI.
 * - mode update: dua content hien tai (giu tag) + ghi chu vao ngu canh de AI viet lai.
 * Generate chay tren pipeline ai-content (articleType km-<postType>, siteCode = laruki|dochoi3s).
 */
@Injectable()
export class CreateCmsContentJobUseCase {
  private readonly logger = new Logger(CreateCmsContentJobUseCase.name);

  constructor(
    @Inject(CMS_POST_MIRROR_REPOSITORY) private readonly mirror: CmsPostMirrorRepository,
    @Inject(KHUYENMAI_CMS_DB) private readonly cmsDb: KhuyenMaiCmsDb,
    @Inject(CONTENT_JOB_REPOSITORY) private readonly jobRepo: ContentJobRepository,
    @Inject(CMS_REFERENCE_FETCHER) private readonly referenceFetcher: CmsReferenceFetcher,
    private readonly createContentJob: CreateContentJobUseCase,
  ) {}

  /** Luu thong tin cung cap cho AI ma KHONG tao bai. */
  async saveInputs(
    cmsId: number,
    notes: string | null,
    tagHints: string | null,
    referenceUrls: Array<{ label: string; url: string }>,
  ): Promise<void> {
    const post = await this.requirePost(cmsId);
    await this.mirror.saveAiInputs(post.cmsId, notes, referenceUrls);
    await this.mirror.saveTagHints(post.cmsId, tagHints);
    this.logger.log(`Luu thong tin AI cho bai CMS #${cmsId}`);
  }

  async execute(cmsId: number, request: CreateCmsJobRequest): Promise<CreateCmsJobResponse> {
    const post = await this.requirePost(cmsId);

    if (post.activeContentJobId) {
      const activeJob = await this.jobRepo.findById(post.activeContentJobId);
      const status = activeJob?.toSnapshot().status;
      if (activeJob && status !== "Failed" && status !== "Rejected") {
        throw new DomainRuleError(`Bài "${post.title}" đang có bài soạn/duyệt dở`, [
          "Hoàn tất hoặc hủy job hiện tại trước khi tạo job mới",
        ]);
      }
    }

    await this.mirror.saveAiInputs(post.cmsId, request.userNotes?.trim() || null, request.referenceUrls ?? []);
    await this.mirror.saveTagHints(post.cmsId, request.tagHints?.trim() || null);

    const site = khuyenmaiSiteFromId(post.siteId) ?? "laruki";
    const sourceContext = await this.buildSourceContext(post.cmsId, post.postType, request);

    const result = await this.createContentJob.execute({
      siteCode: site,
      sourceType: "Topic",
      sourceRef: `cms:${post.cmsId}`,
      topic: post.title,
      articleType: khuyenmaiArticleType(post.postType),
      keywordSeed: [],
      sourceContext,
      aiProvider: request.aiProvider ? aiProviderKeySchema.parse(request.aiProvider) : undefined,
      aiModel: request.aiModel,
    });

    await this.mirror.setActiveJob(post.cmsId, result.jobId);
    this.logger.log(`Tao job ${result.jobId} cho bai CMS #${cmsId} (${site}, mode ${request.mode})`);
    return { jobId: result.jobId, status: result.status };
  }

  private async requirePost(cmsId: number) {
    const post = await this.mirror.findByCmsId(cmsId);
    if (!post) {
      throw new DomainRuleError(`Không tìm thấy bài CMS #${cmsId}`, ["Bấm Đồng bộ từ CMS rồi thử lại"]);
    }
    return post;
  }

  /** Ghep ngu canh: loai bai + ghi chu + goi y tag + content cu (update) + nguon tham khao. */
  private async buildSourceContext(
    cmsId: number,
    postType: number | null,
    request: CreateCmsJobRequest,
  ): Promise<string> {
    const parts: string[] = [];
    parts.push(`## Loại bài (PostType): ${khuyenmaiPostTypeLabel(postType)}`);

    if (request.userNotes?.trim()) {
      parts.push("", "## Ghi chú từ người quản trị (ưu tiên cao)", request.userNotes.trim());
    }

    if (request.tagHints?.trim()) {
      parts.push(
        "",
        "## Gợi ý tag để chèn (đặt tag CMS đúng cú pháp [Type_Param:value] tại vị trí hợp lý)",
        request.tagHints.trim(),
        "(Các loại tag: ProductList, SellerList, Product, SaleList, Link, QA, DateTime)",
      );
    }

    if (request.mode === "update") {
      const current = await this.cmsDb.fetchPostContent(cmsId).catch(() => null);
      if (current?.trim()) {
        parts.push(
          "",
          "## Nội dung hiện tại (VIẾT LẠI tốt hơn — GIỮ NGUYÊN mọi tag [..], không xóa/sửa tag)",
          stripHtml(current).slice(0, MAX_OLD_CONTENT_CHARS),
        );
      }
    }

    for (const ref of request.referenceUrls ?? []) {
      try {
        const text = await this.referenceFetcher.fetchText(ref.url);
        parts.push("", `## Nguồn tham khảo "${ref.label}" (${ref.url})`, text || "(trang không có nội dung)");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Bo qua nguon ${ref.url}: ${message}`);
        parts.push("", `## Nguồn tham khảo "${ref.label}" (${ref.url})`, "(không tải được trang — cần kiểm tra tay)");
      }
    }

    return parts.join("\n");
  }
}
