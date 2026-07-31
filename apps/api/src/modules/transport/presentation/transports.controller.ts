import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import {
  fetchSheetRequestSchema,
  importTransportsRequestSchema,
  transportModeSchema,
  upsertTransportRequestSchema,
  type FetchSheetRequest,
  type FetchSheetResponse,
  type ImportTransportsRequest,
  type ImportTransportsResult,
  type Transport,
  type TransportMode,
  type UpsertTransportRequest,
} from "@zinoflow/contracts";
import { ZodValidationPipe } from "../../shared/validation/zod-validation.pipe";
import {
  SHEET_CSV_FETCHER,
  type SheetCsvFetcher,
} from "../../shared/sheet-import/ports/sheet-csv-fetcher.port";
import { ListTransportsUseCase } from "../application/use-cases/list-transports.usecase";
import { UpsertTransportUseCase } from "../application/use-cases/upsert-transport.usecase";
import { ImportTransportsUseCase } from "../application/use-cases/import-transports.usecase";

/** REST man "Vận chuyển" (transport-plan §3 Giai đoạn 1) */
@Controller("transports")
export class TransportsController {
  constructor(
    private readonly listTransports: ListTransportsUseCase,
    private readonly upsertTransport: UpsertTransportUseCase,
    private readonly importTransports: ImportTransportsUseCase,
    @Inject(SHEET_CSV_FETCHER) private readonly sheetFetcher: SheetCsvFetcher,
  ) {}

  @Get()
  list(@Query("mode") mode?: string): Promise<Transport[]> {
    const parsed = mode ? transportModeSchema.parse(mode) : undefined;
    return this.listTransports.execute(parsed as TransportMode | undefined);
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
    @Body(new ZodValidationPipe(importTransportsRequestSchema)) request: ImportTransportsRequest,
  ): Promise<ImportTransportsResult> {
    return this.importTransports.execute(request);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(upsertTransportRequestSchema)) request: UpsertTransportRequest,
  ): Promise<Transport> {
    return this.upsertTransport.create(request);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(upsertTransportRequestSchema)) request: UpsertTransportRequest,
  ): Promise<Transport> {
    return this.upsertTransport.update(id, request);
  }
}
