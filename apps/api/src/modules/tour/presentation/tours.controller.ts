import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import {
  assignTourRequestSchema,
  fetchSheetRequestSchema,
  importToursRequestSchema,
  upsertTourRequestSchema,
  type AssignTourRequest,
  type FetchSheetRequest,
  type FetchSheetResponse,
  type ImportToursRequest,
  type ImportToursResult,
  type Tour,
  type UpsertTourRequest,
} from "@zinoflow/contracts";
import { ZodValidationPipe } from "../../shared/validation/zod-validation.pipe";
import {
  SHEET_CSV_FETCHER,
  type SheetCsvFetcher,
} from "../../shared/sheet-import/ports/sheet-csv-fetcher.port";
import { ListToursUseCase } from "../application/use-cases/list-tours.usecase";
import { UpsertTourUseCase } from "../application/use-cases/upsert-tour.usecase";
import { ImportToursUseCase } from "../application/use-cases/import-tours.usecase";
import { AssignTourToDestinationUseCase } from "../application/use-cases/assign-tour-to-destination.usecase";
import { ListToursForDestinationUseCase } from "../application/use-cases/list-tours-for-destination.usecase";

/** REST man "Tour" (tour-spec §6) */
@Controller("tours")
export class ToursController {
  constructor(
    private readonly listTours: ListToursUseCase,
    private readonly upsertTour: UpsertTourUseCase,
    private readonly importTours: ImportToursUseCase,
    private readonly assignTour: AssignTourToDestinationUseCase,
    private readonly listForDestination: ListToursForDestinationUseCase,
    @Inject(SHEET_CSV_FETCHER) private readonly sheetFetcher: SheetCsvFetcher,
  ) {}

  @Get()
  list(): Promise<Tour[]> {
    return this.listTours.execute();
  }

  @Post("fetch-sheet")
  async fetchSheet(
    @Body(new ZodValidationPipe(fetchSheetRequestSchema)) request: FetchSheetRequest,
  ): Promise<FetchSheetResponse> {
    return { csv: await this.sheetFetcher.fetchCsv(request.url) };
  }

  @Post("import")
  importBulk(
    @Body(new ZodValidationPipe(importToursRequestSchema)) request: ImportToursRequest,
  ): Promise<ImportToursResult> {
    return this.importTours.execute(request);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(upsertTourRequestSchema)) request: UpsertTourRequest,
  ): Promise<Tour> {
    return this.upsertTour.create(request);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(upsertTourRequestSchema)) request: UpsertTourRequest,
  ): Promise<Tour> {
    return this.upsertTour.update(id, request);
  }

  /** Panel "Tour gợi ý" tren trang chi tiet diem den */
  @Get("by-destination/:slug")
  listByDestination(@Param("slug") slug: string): Promise<Tour[]> {
    return this.listForDestination.execute(slug);
  }

  @Post(":id/assign")
  async assign(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(assignTourRequestSchema)) request: AssignTourRequest,
  ): Promise<{ ok: true }> {
    await this.assignTour.assign(id, request.destinationSlug, request.isPrimary ?? false);
    return { ok: true };
  }

  @Delete(":id/assign/:destinationSlug")
  async unassign(
    @Param("id") id: string,
    @Param("destinationSlug") destinationSlug: string,
  ): Promise<{ ok: true }> {
    await this.assignTour.unassign(id, destinationSlug);
    return { ok: true };
  }
}
