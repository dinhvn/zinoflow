import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import {
  createDestinationJobRequestSchema,
  listDestinationsQuerySchema,
  relinkAllRequestSchema,
  type CreateDestinationJobRequest,
  type CreateDestinationJobResponse,
  type DestinationTaxonomy,
  type ListDestinationsQuery,
  type ListDestinationsResponse,
  type PublishDestinationResult,
  type RecomputeRelatedReport,
  type RelinkAllRequest,
  type RelinkAllReport,
  type SyncDestinationsResult,
} from "@zinoflow/contracts";
import { ZodValidationPipe } from "../../shared/validation/zod-validation.pipe";
import { ListDestinationsUseCase } from "../application/use-cases/list-destinations.usecase";
import { SyncDestinationsUseCase } from "../application/use-cases/sync-destinations.usecase";
import { GetDestinationTaxonomyUseCase } from "../application/use-cases/get-destination-taxonomy.usecase";
import { CreateDestinationJobUseCase } from "../application/use-cases/create-destination-job.usecase";
import { PublishDestinationUseCase } from "../application/use-cases/publish-destination.usecase";
import { RelinkAllUseCase } from "../application/use-cases/relink-all.usecase";
import { RecomputeRelatedService } from "../application/services/recompute-related.service";

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
    private readonly recomputeRelated: RecomputeRelatedService,
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

  @Get("taxonomy")
  taxonomy(): Promise<DestinationTaxonomy> {
    return this.getTaxonomy.execute();
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

  /** Publish bai DA DUYET cua 1 diem den xuong SQL Server (gate thu cong thu 2) */
  @Post(":slug/publish")
  publish(@Param("slug") slug: string): Promise<PublishDestinationResult> {
    return this.publishDestination.execute(slug);
  }
}
