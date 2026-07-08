import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import {
  assignHotelRequestSchema,
  upsertHotelRequestSchema,
  type AssignHotelRequest,
  type Hotel,
  type UpsertHotelRequest,
} from "@zinoflow/contracts";
import { ZodValidationPipe } from "../../shared/validation/zod-validation.pipe";
import { ListHotelsUseCase } from "../application/use-cases/list-hotels.usecase";
import { UpsertHotelUseCase } from "../application/use-cases/upsert-hotel.usecase";
import { AssignHotelToDestinationUseCase } from "../application/use-cases/assign-hotel-to-destination.usecase";
import { ListHotelsForDestinationUseCase } from "../application/use-cases/list-hotels-for-destination.usecase";

/** REST man "Khách sạn" (hotel-spec §6) */
@Controller("hotels")
export class HotelsController {
  constructor(
    private readonly listHotels: ListHotelsUseCase,
    private readonly upsertHotel: UpsertHotelUseCase,
    private readonly assignHotel: AssignHotelToDestinationUseCase,
    private readonly listForDestination: ListHotelsForDestinationUseCase,
  ) {}

  @Get()
  list(): Promise<Hotel[]> {
    return this.listHotels.execute();
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
}
