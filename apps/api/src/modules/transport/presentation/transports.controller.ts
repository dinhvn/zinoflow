import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import {
  transportModeSchema,
  upsertTransportRequestSchema,
  type Transport,
  type TransportMode,
  type UpsertTransportRequest,
} from "@zinoflow/contracts";
import { ZodValidationPipe } from "../../shared/validation/zod-validation.pipe";
import { ListTransportsUseCase } from "../application/use-cases/list-transports.usecase";
import { UpsertTransportUseCase } from "../application/use-cases/upsert-transport.usecase";

/** REST man "Vé xe" (transport-plan §3 Giai đoạn 1) */
@Controller("transports")
export class TransportsController {
  constructor(
    private readonly listTransports: ListTransportsUseCase,
    private readonly upsertTransport: UpsertTransportUseCase,
  ) {}

  @Get()
  list(@Query("mode") mode?: string): Promise<Transport[]> {
    const parsed = mode ? transportModeSchema.parse(mode) : undefined;
    return this.listTransports.execute(parsed as TransportMode | undefined);
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
