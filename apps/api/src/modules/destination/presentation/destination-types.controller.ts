import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import {
  suggestTaxonomyTypesRequestSchema,
  updateDestinationTypesRequestSchema,
  type GetTaxonomyKanbanBoardResponse,
  type SuggestTaxonomyTypesRequest,
  type SuggestTaxonomyTypesResponse,
  type UpdateDestinationTypesRequest,
} from "@zinoflow/contracts";
import { ZodValidationPipe } from "../../shared/validation/zod-validation.pipe";
import { GetTaxonomyKanbanBoardUseCase } from "../application/use-cases/get-taxonomy-kanban-board.usecase";
import { SuggestTaxonomyTypesUseCase } from "../application/use-cases/suggest-taxonomy-types.usecase";
import { UpdateDestinationTypesUseCase } from "../application/use-cases/update-destination-types.usecase";

/** REST cho ban Kanban ra soat taxonomy Type (relations-plan §6.1-6.3, Giai doan B2-B3) */
@Controller("destination-types")
export class DestinationTypesController {
  constructor(
    private readonly getBoard: GetTaxonomyKanbanBoardUseCase,
    private readonly updateTypes: UpdateDestinationTypesUseCase,
    private readonly suggestTypes: SuggestTaxonomyTypesUseCase,
  ) {}

  @Get("kanban-board")
  kanbanBoard(): Promise<GetTaxonomyKanbanBoardResponse> {
    return this.getBoard.execute();
  }

  @Post("suggest")
  suggest(
    @Body(new ZodValidationPipe(suggestTaxonomyTypesRequestSchema))
    request: SuggestTaxonomyTypesRequest,
  ): Promise<SuggestTaxonomyTypesResponse> {
    return this.suggestTypes.execute(request);
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
