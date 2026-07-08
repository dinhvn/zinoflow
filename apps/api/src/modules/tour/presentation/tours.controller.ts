import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import {
  assignTourRequestSchema,
  upsertTourRequestSchema,
  type AssignTourRequest,
  type Tour,
  type UpsertTourRequest,
} from "@zinoflow/contracts";
import { ZodValidationPipe } from "../../shared/validation/zod-validation.pipe";
import { ListToursUseCase } from "../application/use-cases/list-tours.usecase";
import { UpsertTourUseCase } from "../application/use-cases/upsert-tour.usecase";
import { AssignTourToDestinationUseCase } from "../application/use-cases/assign-tour-to-destination.usecase";
import { ListToursForDestinationUseCase } from "../application/use-cases/list-tours-for-destination.usecase";

/** REST man "Tour" (tour-spec §6) */
@Controller("tours")
export class ToursController {
  constructor(
    private readonly listTours: ListToursUseCase,
    private readonly upsertTour: UpsertTourUseCase,
    private readonly assignTour: AssignTourToDestinationUseCase,
    private readonly listForDestination: ListToursForDestinationUseCase,
  ) {}

  @Get()
  list(): Promise<Tour[]> {
    return this.listTours.execute();
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
