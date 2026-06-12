import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import {
  createDestinationJobRequestSchema,
  listDestinationsQuerySchema,
  type CreateDestinationJobRequest,
  type CreateDestinationJobResponse,
  type DestinationTaxonomy,
  type ListDestinationsQuery,
  type ListDestinationsResponse,
  type SyncDestinationsResult,
} from "@zinoflow/contracts";
import { ZodValidationPipe } from "../../shared/validation/zod-validation.pipe";
import { ListDestinationsUseCase } from "../application/use-cases/list-destinations.usecase";
import { SyncDestinationsUseCase } from "../application/use-cases/sync-destinations.usecase";
import { GetDestinationTaxonomyUseCase } from "../application/use-cases/get-destination-taxonomy.usecase";
import { CreateDestinationJobUseCase } from "../application/use-cases/create-destination-job.usecase";

/**
 * REST khu Dichoithoi (spec dichoithoi-destination-spec §5.1) — M4 Phase A:
 * list mirror + dong bo + taxonomy. Phase B/C them jobs + publish + relink.
 */
@Controller("destinations")
export class DestinationsController {
  constructor(
    private readonly listDestinations: ListDestinationsUseCase,
    private readonly syncDestinations: SyncDestinationsUseCase,
    private readonly getTaxonomy: GetDestinationTaxonomyUseCase,
    private readonly createJob: CreateDestinationJobUseCase,
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
}
