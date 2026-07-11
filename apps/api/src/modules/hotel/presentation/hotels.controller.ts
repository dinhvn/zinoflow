import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import {
  assignHotelRequestSchema,
  fetchSheetRequestSchema,
  importHotelsRequestSchema,
  upsertHotelRequestSchema,
  type AssignHotelRequest,
  type FetchSheetRequest,
  type FetchSheetResponse,
  type Hotel,
  type ImportHotelsRequest,
  type ImportHotelsResult,
  type UpsertHotelRequest,
} from "@zinoflow/contracts";
import { ZodValidationPipe } from "../../shared/validation/zod-validation.pipe";
import { JOB_QUEUE, QUEUE_NAMES, type JobQueue } from "../../shared/jobs/job-queue.port";
import {
  SHEET_CSV_FETCHER,
  type SheetCsvFetcher,
} from "../../shared/sheet-import/ports/sheet-csv-fetcher.port";
import { ListHotelsUseCase } from "../application/use-cases/list-hotels.usecase";
import { UpsertHotelUseCase } from "../application/use-cases/upsert-hotel.usecase";
import { ImportHotelsUseCase } from "../application/use-cases/import-hotels.usecase";
import { AssignHotelToDestinationUseCase } from "../application/use-cases/assign-hotel-to-destination.usecase";
import { ListHotelsForDestinationUseCase } from "../application/use-cases/list-hotels-for-destination.usecase";

/** REST man "Khách sạn" (hotel-spec §6) */
@Controller("hotels")
export class HotelsController {
  constructor(
    private readonly listHotels: ListHotelsUseCase,
    private readonly upsertHotel: UpsertHotelUseCase,
    private readonly importHotels: ImportHotelsUseCase,
    private readonly assignHotel: AssignHotelToDestinationUseCase,
    private readonly listForDestination: ListHotelsForDestinationUseCase,
    @Inject(SHEET_CSV_FETCHER) private readonly sheetFetcher: SheetCsvFetcher,
    @Inject(JOB_QUEUE) private readonly jobQueue: JobQueue,
  ) {}

  @Get()
  list(): Promise<Hotel[]> {
    return this.listHotels.execute();
  }

  /** Tai Google Sheet (cong khai) ve CSV — client parse + xem truoc roi import */
  @Post("fetch-sheet")
  async fetchSheet(
    @Body(new ZodValidationPipe(fetchSheetRequestSchema)) request: FetchSheetRequest,
  ): Promise<FetchSheetResponse> {
    return { csv: await this.sheetFetcher.fetchCsv(request.url) };
  }

  /** Import hang loat (dry-run mac dinh — client goi lai dryRun=false sau khi xem preview) */
  @Post("import")
  importBulk(
    @Body(new ZodValidationPipe(importHotelsRequestSchema)) request: ImportHotelsRequest,
  ): Promise<ImportHotelsResult> {
    return this.importHotels.execute(request);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(upsertHotelRequestSchema)) request: UpsertHotelRequest,
  ): Promise<Hotel> {
    return this.upsertHotel.create(request);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(upsertHotelRequestSchema)) request: UpsertHotelRequest,
  ): Promise<Hotel> {
    return this.upsertHotel.update(id, request);
  }

  /** Panel "Khách sạn gợi ý" tren trang chi tiet diem den */
  @Get("by-destination/:slug")
  listByDestination(@Param("slug") slug: string): Promise<Hotel[]> {
    return this.listForDestination.execute(slug);
  }

  @Post(":id/assign")
  async assign(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(assignHotelRequestSchema)) request: AssignHotelRequest,
  ): Promise<{ ok: true }> {
    await this.assignHotel.assign(id, request.destinationSlug);
    return { ok: true };
  }

  @Delete(":id/assign/:destinationSlug")
  async unassign(
    @Param("id") id: string,
    @Param("destinationSlug") destinationSlug: string,
  ): Promise<{ ok: true }> {
    await this.assignHotel.unassign(id, destinationSlug);
    return { ok: true };
  }

  /** Tinh lai gan tu dong theo khoang cach cho TOAN BO khach san (hotel-spec §5 job 3) */
  @Post("auto-assign")
  async autoAssign(): Promise<{ jobId: string | null }> {
    const jobId = await this.jobQueue.send(QUEUE_NAMES.hotelAutoAssign, {});
    return { jobId };
  }
}
