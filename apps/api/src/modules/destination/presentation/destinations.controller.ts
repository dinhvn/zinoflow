import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import {
  checkImageRequestSchema,
  createDestinationJobRequestSchema,
  importDestinationsRequestSchema,
  listDestinationsQuerySchema,
  saveAiInputsRequestSchema,
  relinkAllRequestSchema,
  suggestDestinationMetaRequestSchema,
  updateThumbnailRequestSchema,
  upsertDestinationRequestSchema,
  type CheckImageRequest,
  type CheckImageResponse,
  type CreateDestinationJobRequest,
  type CreateDestinationJobResponse,
  type DestinationDetail,
  type DestinationTaxonomy,
  type ImportDestinationsRequest,
  type ImportDestinationsResult,
  type ListDestinationsQuery,
  type ListDestinationsResponse,
  type PublishDestinationResult,
  type RecomputeRelatedReport,
  type RelinkAllRequest,
  type RelinkAllReport,
  type SaveAiInputsRequest,
  type SuggestDestinationMetaRequest,
  type DestinationMetaSuggestion,
  type SyncDestinationsResult,
  type UpdateThumbnailRequest,
  type UpsertDestinationRequest,
} from "@zinoflow/contracts";
import { ZodValidationPipe } from "../../shared/validation/zod-validation.pipe";
import { ListDestinationsUseCase } from "../application/use-cases/list-destinations.usecase";
import { SyncDestinationsUseCase } from "../application/use-cases/sync-destinations.usecase";
import { GetDestinationTaxonomyUseCase } from "../application/use-cases/get-destination-taxonomy.usecase";
import { CreateDestinationJobUseCase } from "../application/use-cases/create-destination-job.usecase";
import { PublishDestinationUseCase } from "../application/use-cases/publish-destination.usecase";
import { RelinkAllUseCase } from "../application/use-cases/relink-all.usecase";
import { UpdateThumbnailUseCase } from "../application/use-cases/update-thumbnail.usecase";
import { GetDestinationDetailUseCase } from "../application/use-cases/get-destination-detail.usecase";
import { UpsertDestinationUseCase } from "../application/use-cases/upsert-destination.usecase";
import { ImportDestinationsUseCase } from "../application/use-cases/import-destinations.usecase";
import { SuggestDestinationMetaUseCase } from "../../ai-content/application/use-cases/suggest-destination-meta.usecase";
import { Patch } from "@nestjs/common";
import { RecomputeRelatedService } from "../application/services/recompute-related.service";
import { IMAGE_CHECKER, type ImageChecker } from "../application/ports/image-checker.port";
import { Inject } from "@nestjs/common";

/**
 * REST khu Dichoithoi (spec dichoithoi-destination-spec §5.1):
 * Phase A list/sync/taxonomy, Phase B jobs, Phase C publish + relink + related.
 */
@Controller("destinations")
export class DestinationsController {
  constructor(
    private readonly listDestinations: ListDestinationsUseCase,
    private readonly syncDestinations: SyncDestinationsUseCase,
    private readonly getTaxonomy: GetDestinationTaxonomyUseCase,
    private readonly createJob: CreateDestinationJobUseCase,
    private readonly publishDestination: PublishDestinationUseCase,
    private readonly relinkAll: RelinkAllUseCase,
    private readonly updateThumbnail: UpdateThumbnailUseCase,
    private readonly getDetail: GetDestinationDetailUseCase,
    private readonly upsertDestination: UpsertDestinationUseCase,
    private readonly importDestinations: ImportDestinationsUseCase,
    private readonly suggestMeta: SuggestDestinationMetaUseCase,
    private readonly recomputeRelated: RecomputeRelatedService,
    @Inject(IMAGE_CHECKER) private readonly imageChecker: ImageChecker,
  ) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(listDestinationsQuerySchema))
    query: ListDestinationsQuery,
  ): Promise<ListDestinationsResponse> {
    return this.listDestinations.execute(query);
  }

  /** Dong bo mirror tu SQL Server (1 chieu doc) — nut "Dong bo" tren UI */
  @Post("sync")
  sync(): Promise<SyncDestinationsResult> {
    return this.syncDestinations.execute();
  }

  /** Tao diem den MOI trong AI tool (siteId=null cho toi khi publish) — spec §7.3 */
  @Post()
  create(
    @Body(new ZodValidationPipe(upsertDestinationRequestSchema)) request: UpsertDestinationRequest,
  ): Promise<{ slug: string }> {
    return this.upsertDestination.create(request);
  }

  /** AI goi y mo ta + phan loai (mem, KHONG dung lat/lng/dia chi) — spec §3.5 */
  @Post("suggest-meta")
  suggestMetadata(
    @Body(new ZodValidationPipe(suggestDestinationMetaRequestSchema))
    request: SuggestDestinationMetaRequest,
  ): Promise<DestinationMetaSuggestion> {
    return this.suggestMeta.execute(request);
  }

  /** Import hang loat (UPSERT theo slug, khong wipe) — spec §7.2 nut +Them */
  @Post("import")
  importBulk(
    @Body(new ZodValidationPipe(importDestinationsRequestSchema)) request: ImportDestinationsRequest,
  ): Promise<ImportDestinationsResult> {
    return this.importDestinations.execute(request.items);
  }

  /** Sua metadata diem den (mirror; neu da co tren web thi ghi luon SQL Server) */
  @Patch(":slug")
  updateMeta(
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(upsertDestinationRequestSchema)) request: UpsertDestinationRequest,
  ): Promise<{ slug: string }> {
    return this.upsertDestination.update(slug, request);
  }

  @Get("taxonomy")
  taxonomy(): Promise<DestinationTaxonomy> {
    return this.getTaxonomy.execute();
  }

  /**
   * Chi tiet 1 diem den cho trang /dichoithoi/[slug] (spec §7.3).
   * DAT SAU cac GET tinh ("taxonomy") de khong nuot chung thanh slug.
   */
  @Get(":slug")
  detail(@Param("slug") slug: string): Promise<DestinationDetail> {
    return this.getDetail.execute(slug);
  }

  /** Tao job AI cho 1 diem den — mode create (bai moi) | update (viet lai bai cu) */
  @Post(":slug/jobs")
  createDestinationJob(
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(createDestinationJobRequestSchema))
    request: CreateDestinationJobRequest,
  ): Promise<CreateDestinationJobResponse> {
    return this.createJob.execute(slug, request);
  }

  /** Luu thong tin cung cap cho AI (ghi chu + URL nguon) ma KHONG tao bai */
  @Post(":slug/ai-inputs")
  async saveAiInputs(
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(saveAiInputsRequestSchema)) request: SaveAiInputsRequest,
  ): Promise<{ ok: true }> {
    await this.createJob.saveInputs(slug, request.userNotes ?? null, request.referenceUrls ?? []);
    return { ok: true };
  }

  /**
   * Re-link toan bo (spec §12.2). DAT TRUOC :slug/publish de Nest khong nuot
   * "relink" thanh slug. Body {dryRun:true} = xem truoc, khong ghi.
   */
  @Post("relink")
  relink(
    @Body(new ZodValidationPipe(relinkAllRequestSchema)) request: RelinkAllRequest,
  ): Promise<RelinkAllReport> {
    return this.relinkAll.execute(request.dryRun);
  }

  /** Tinh lai RelatedJson TOAN BO diem published (spec §12.3) */
  @Post("recompute-related")
  async recompute(): Promise<RecomputeRelatedReport> {
    const startedAt = Date.now();
    const result = await this.recomputeRelated.recomputeAll();
    return { ...result, durationMs: Date.now() - startedAt };
  }

  /** Kiem tra anh ton tai tren hosting (HEAD request — spec §14.3) */
  @Post("check-image")
  checkImage(
    @Body(new ZodValidationPipe(checkImageRequestSchema)) request: CheckImageRequest,
  ): Promise<CheckImageResponse> {
    return this.imageChecker.check(request.path);
  }

  /** Cap nhat duong dan thumbnail cho 1 diem den (spec §14.3) */
  @Post(":slug/thumbnail")
  async setThumbnail(
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(updateThumbnailRequestSchema)) request: UpdateThumbnailRequest,
  ): Promise<{ ok: true }> {
    await this.updateThumbnail.execute(slug, request.thumbnail);
    return { ok: true };
  }

  /** Publish bai DA DUYET cua 1 diem den xuong SQL Server (gate thu cong thu 2) */
  @Post(":slug/publish")
  publish(@Param("slug") slug: string): Promise<PublishDestinationResult> {
    return this.publishDestination.execute(slug);
  }
}
