import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import {
  bulkApplyTaxonomySuggestionsRequestSchema,
  suggestTaxonomyTypesRequestSchema,
  updateDestinationTypesRequestSchema,
  type BulkApplyTaxonomySuggestionsRequest,
  type BulkApplyTaxonomySuggestionsResponse,
  type GetTaxonomyKanbanBoardResponse,
  type PreviewPromptResponse,
  type SuggestTaxonomyTypesRequest,
  type SuggestTaxonomyTypesResponse,
  type UpdateDestinationTypesRequest,
} from "@zinoflow/contracts";
import { ZodValidationPipe } from "../../shared/validation/zod-validation.pipe";
import { GetTaxonomyKanbanBoardUseCase } from "../application/use-cases/get-taxonomy-kanban-board.usecase";
import { SuggestTaxonomyTypesUseCase } from "../application/use-cases/suggest-taxonomy-types.usecase";
import { PreviewTaxonomyTypeSuggestPromptUseCase } from "../application/use-cases/preview-taxonomy-type-suggest-prompt.usecase";
import { UpdateDestinationTypesUseCase } from "../application/use-cases/update-destination-types.usecase";
import { BulkApplyTaxonomySuggestionsUseCase } from "../application/use-cases/bulk-apply-taxonomy-suggestions.usecase";

/** REST cho ban Kanban ra soat taxonomy Type (relations-plan §6.1-6.3, Giai doan B2-B3) */
@Controller("destination-types")
export class DestinationTypesController {
  constructor(
    private readonly getBoard: GetTaxonomyKanbanBoardUseCase,
    private readonly updateTypes: UpdateDestinationTypesUseCase,
    private readonly suggestTypes: SuggestTaxonomyTypesUseCase,
    private readonly previewSuggestPrompt: PreviewTaxonomyTypeSuggestPromptUseCase,
    private readonly bulkApplySuggestions: BulkApplyTaxonomySuggestionsUseCase,
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

  @Post("suggest/preview")
  previewSuggest(
    @Body(new ZodValidationPipe(suggestTaxonomyTypesRequestSchema.pick({ clusterSlug: true })))
    request: Pick<SuggestTaxonomyTypesRequest, "clusterSlug">,
  ): Promise<PreviewPromptResponse> {
    return this.previewSuggestPrompt.execute(request.clusterSlug);
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

  @Post("bulk-apply-suggestions")
  bulkApply(
    @Body(new ZodValidationPipe(bulkApplyTaxonomySuggestionsRequestSchema))
    request: BulkApplyTaxonomySuggestionsRequest,
  ): Promise<BulkApplyTaxonomySuggestionsResponse> {
    return this.bulkApplySuggestions.execute(request.destinationSlugs);
  }
}
