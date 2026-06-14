import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import {
  createCmsJobRequestSchema,
  createCmsPostRequestSchema,
  khuyenmaiSiteSchema,
  listCmsPostsQuerySchema,
  saveCmsAiInputsRequestSchema,
  type CreateCmsJobRequest,
  type CreateCmsJobResponse,
  type CreateCmsPostRequest,
  type CreateCmsPostResponse,
  type KhuyenmaiSite,
  type CmsPostDetail,
  type ListCmsPostsQuery,
  type ListCmsPostsResponse,
  type SaveCmsAiInputsRequest,
  type SyncCmsPostsResult,
  type WriteCmsResult,
} from "@zinoflow/contracts";
import { ZodValidationPipe } from "../../shared/validation/zod-validation.pipe";
import { SyncCmsPostsUseCase } from "../application/use-cases/sync-cms-posts.usecase";
import { ListCmsPostsUseCase } from "../application/use-cases/list-cms-posts.usecase";
import { GetCmsPostDetailUseCase } from "../application/use-cases/get-cms-post-detail.usecase";
import { CreateCmsContentJobUseCase } from "../application/use-cases/create-cms-content-job.usecase";
import { WriteContentToCmsUseCase } from "../application/use-cases/write-content-to-cms.usecase";
import { CreateCmsPostUseCase } from "../application/use-cases/create-cms-post.usecase";

/**
 * REST khu CMS khuyenmai (laruki/dochoi3s) — spec laruki-dochoi3s-content-spec §3.
 * Phase 1: list + sync + detail. Phase 2: jobs + ai-inputs. Phase 3+: ghi CMS + tao moi.
 */
@Controller("cms")
export class CmsContentController {
  constructor(
    private readonly syncPosts: SyncCmsPostsUseCase,
    private readonly listPosts: ListCmsPostsUseCase,
    private readonly getDetail: GetCmsPostDetailUseCase,
    private readonly createJob: CreateCmsContentJobUseCase,
    private readonly writeToCms: WriteContentToCmsUseCase,
    private readonly createPost: CreateCmsPostUseCase,
  ) {}

  /** Tao bai MOI (INSERT shell PostId=0 ben CMS) — tra ve cmsId de mo trang chi tiet */
  @Post(":site/posts")
  create(
    @Param("site", new ZodValidationPipe(khuyenmaiSiteSchema)) site: KhuyenmaiSite,
    @Body(new ZodValidationPipe(createCmsPostRequestSchema)) request: CreateCmsPostRequest,
  ): Promise<CreateCmsPostResponse> {
    return this.createPost.execute(site, request);
  }

  /** Danh sach bai theo site (mirror) */
  @Get(":site/posts")
  list(
    @Param("site", new ZodValidationPipe(khuyenmaiSiteSchema)) site: KhuyenmaiSite,
    @Query(new ZodValidationPipe(listCmsPostsQuerySchema)) query: ListCmsPostsQuery,
  ): Promise<ListCmsPostsResponse> {
    return this.listPosts.execute(site, query);
  }

  /** Dong bo mirror tu CMS (1 chieu doc) */
  @Post(":site/sync")
  sync(
    @Param("site", new ZodValidationPipe(khuyenmaiSiteSchema)) site: KhuyenmaiSite,
  ): Promise<SyncCmsPostsResult> {
    return this.syncPosts.execute(site);
  }

  /** Chi tiet 1 bai */
  @Get("posts/:cmsId")
  detail(@Param("cmsId") cmsId: string): Promise<CmsPostDetail> {
    return this.getDetail.execute(Number(cmsId));
  }

  /** Tao job AI cho 1 bai (mode create | update) */
  @Post("posts/:cmsId/jobs")
  createContentJob(
    @Param("cmsId") cmsId: string,
    @Body(new ZodValidationPipe(createCmsJobRequestSchema)) request: CreateCmsJobRequest,
  ): Promise<CreateCmsJobResponse> {
    return this.createJob.execute(Number(cmsId), request);
  }

  /** Luu thong tin cung cap cho AI ma KHONG tao bai */
  @Post("posts/:cmsId/ai-inputs")
  async saveAiInputs(
    @Param("cmsId") cmsId: string,
    @Body(new ZodValidationPipe(saveCmsAiInputsRequestSchema)) request: SaveCmsAiInputsRequest,
  ): Promise<{ ok: true }> {
    await this.createJob.saveInputs(
      Number(cmsId),
      request.userNotes?.trim() || null,
      request.tagHints?.trim() || null,
      request.referenceUrls ?? [],
    );
    return { ok: true };
  }

  /** Ghi content da duyet (Approved) xuong CMS — UPDATE WordpressPost.FixedContent */
  @Post("posts/:cmsId/write")
  write(@Param("cmsId") cmsId: string): Promise<WriteCmsResult> {
    return this.writeToCms.execute(Number(cmsId));
  }
}
