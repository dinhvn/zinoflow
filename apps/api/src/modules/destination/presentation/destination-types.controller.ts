import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
import {
  updateDestinationTypesRequestSchema,
  type GetTaxonomyKanbanBoardResponse,
  type UpdateDestinationTypesRequest,
} from "@zinoflow/contracts";
import { ZodValidationPipe } from "../../shared/validation/zod-validation.pipe";
import { GetTaxonomyKanbanBoardUseCase } from "../application/use-cases/get-taxonomy-kanban-board.usecase";
import { UpdateDestinationTypesUseCase } from "../application/use-cases/update-destination-types.usecase";

/** REST cho ban Kanban ra soat taxonomy Type (relations-plan §6.1-6.2, Giai doan B2) */
@Controller("destination-types")
export class DestinationTypesController {
  constructor(
    private readonly getBoard: GetTaxonomyKanbanBoardUseCase,
    private readonly updateTypes: UpdateDestinationTypesUseCase,
  ) {}

  @Get("kanban-board")
  kanbanBoard(): Promise<GetTaxonomyKanbanBoardResponse> {
    return this.getBoard.execute();
  }

  @Patch(":slug/types")
  async updateDestinationTypes(
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(updateDestinationTypesRequestSchema))
    request: UpdateDestinationTypesRequest,
  ): Promise<{ ok: true }> {
    await this.updateTypes.execute(slug, request.typeSlugs);
    return { ok: true };
  }
}
