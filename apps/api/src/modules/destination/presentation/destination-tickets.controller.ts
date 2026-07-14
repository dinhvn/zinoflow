import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import {
  createDestinationTicketRequestSchema,
  importDestinationTicketsRequestSchema,
  updateDestinationTicketRequestSchema,
  type CreateDestinationTicketRequest,
  type DestinationTicket,
  type DestinationTicketWithDestination,
  type ImportDestinationTicketsRequest,
  type ImportDestinationTicketsResult,
  type UpdateDestinationTicketRequest,
} from "@zinoflow/contracts";
import { ZodValidationPipe } from "../../shared/validation/zod-validation.pipe";
import { ManageDestinationTicketsUseCase } from "../application/use-cases/manage-destination-tickets.usecase";
import { ImportDestinationTicketsUseCase } from "../application/use-cases/import-destination-tickets.usecase";

/** REST "Vé tham quan" — bảng destination_tickets, quản lý giống Hotel/Tour (doc §11.5) */
@Controller()
export class DestinationTicketsController {
  constructor(
    private readonly manageTickets: ManageDestinationTicketsUseCase,
    private readonly importTickets: ImportDestinationTicketsUseCase,
  ) {}

  /** Toàn bộ vé (mọi điểm đến) — cho trang /dichoithoi/ve */
  @Get("tickets")
  listAll(): Promise<DestinationTicketWithDestination[]> {
    return this.manageTickets.listAll();
  }

  /** Import hàng loạt từ Google Sheet public (client tự parse CSV) — lưu thẳng, không preview */
  @Post("tickets/import")
  importBulk(
    @Body(new ZodValidationPipe(importDestinationTicketsRequestSchema))
    request: ImportDestinationTicketsRequest,
  ): Promise<ImportDestinationTicketsResult> {
    return this.importTickets.execute(request);
  }

  @Patch("tickets/:id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateDestinationTicketRequestSchema))
    request: UpdateDestinationTicketRequest,
  ): Promise<DestinationTicket> {
    return this.manageTickets.update(id, request);
  }

  @Delete("tickets/:id")
  async delete(@Param("id") id: string): Promise<{ ok: true }> {
    await this.manageTickets.delete(id);
    return { ok: true };
  }

  @Get("destinations/:slug/tickets")
  listForDestination(@Param("slug") slug: string): Promise<DestinationTicket[]> {
    return this.manageTickets.listForDestination(slug);
  }

  @Post("destinations/:slug/tickets")
  create(
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(createDestinationTicketRequestSchema))
    request: CreateDestinationTicketRequest,
  ): Promise<DestinationTicket> {
    return this.manageTickets.create(slug, request);
  }
}
