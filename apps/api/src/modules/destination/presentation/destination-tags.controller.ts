import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import {
  applyTagAssignmentsRequestSchema,
  createDestinationTagRequestSchema,
  generateTagDescriptionRequestSchema,
  suggestTagAssignmentsRequestSchema,
  updateDestinationTagRequestSchema,
  updateTagDescriptionRequestSchema,
  type ApplyTagAssignmentsRequest,
  type ApplyTagAssignmentsResponse,
  type CreateDestinationTagRequest,
  type GenerateTagDescriptionRequest,
  type GenerateTagDescriptionResponse,
  type ListDestinationTagAssignmentsResponse,
  type ReverseCheckTagAssignmentsResponse,
  type SuggestTagAssignmentsRequest,
  type SuggestTagAssignmentsResponse,
  type UpdateDestinationTagRequest,
  type UpdateTagDescriptionRequest,
} from "@zinoflow/contracts";
import { ZodValidationPipe } from "../../shared/validation/zod-validation.pipe";
import { ListDestinationTagAssignmentsUseCase } from "../application/use-cases/list-destination-tag-assignments.usecase";
import { SuggestTagAssignmentsUseCase } from "../application/use-cases/suggest-tag-assignments.usecase";
import { ApplyTagAssignmentsUseCase } from "../application/use-cases/apply-tag-assignments.usecase";
import { ReverseCheckTagAssignmentsUseCase } from "../application/use-cases/reverse-check-tag-assignments.usecase";
import { GenerateTagDescriptionUseCase } from "../application/use-cases/generate-tag-description.usecase";
import { UpdateTagDescriptionUseCase } from "../application/use-cases/update-tag-description.usecase";
import { CreateDestinationTagUseCase } from "../application/use-cases/create-destination-tag.usecase";
import { UpdateDestinationTagUseCase } from "../application/use-cases/update-destination-tag.usecase";
import { DeleteDestinationTagUseCase } from "../application/use-cases/delete-destination-tag.usecase";

/** REST man "Chủ đề" (destination-spec §2.4) — AI gợi ý gán tag hàng loạt + duyệt */
@Controller("destination-tags")
export class DestinationTagsController {
  constructor(
    private readonly listAssignments: ListDestinationTagAssignmentsUseCase,
    private readonly suggestAssignments: SuggestTagAssignmentsUseCase,
    private readonly applyAssignments: ApplyTagAssignmentsUseCase,
    private readonly reverseCheck: ReverseCheckTagAssignmentsUseCase,
    private readonly generateDescription: GenerateTagDescriptionUseCase,
    private readonly updateDescription: UpdateTagDescriptionUseCase,
    private readonly createTag: CreateDestinationTagUseCase,
    private readonly updateTag: UpdateDestinationTagUseCase,
    private readonly deleteTag: DeleteDestinationTagUseCase,
  ) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(createDestinationTagRequestSchema))
    request: CreateDestinationTagRequest,
  ): Promise<{ ok: true }> {
    return this.createTag.execute(request);
  }

  @Patch(":slug")
  update(
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(updateDestinationTagRequestSchema))
    request: UpdateDestinationTagRequest,
  ): Promise<{ ok: true }> {
    return this.updateTag.execute(slug, request);
  }

  @Delete(":slug")
  remove(@Param("slug") slug: string): Promise<{ ok: true }> {
    return this.deleteTag.execute(slug);
  }

  @Get()
  list(): Promise<ListDestinationTagAssignmentsResponse> {
    return this.listAssignments.execute();
  }

  @Post("suggest")
  suggest(
    @Body(new ZodValidationPipe(suggestTagAssignmentsRequestSchema))
    request: SuggestTagAssignmentsRequest,
  ): Promise<SuggestTagAssignmentsResponse> {
    return this.suggestAssignments.execute(request);
  }

  @Post("apply")
  apply(
    @Body(new ZodValidationPipe(applyTagAssignmentsRequestSchema))
    request: ApplyTagAssignmentsRequest,
  ): Promise<ApplyTagAssignmentsResponse> {
    return this.applyAssignments.execute(request);
  }

  @Post("reverse-check")
  reverseCheckAssignments(): Promise<ReverseCheckTagAssignmentsResponse> {
    return this.reverseCheck.execute();
  }

  @Post(":slug/generate-description")
  generateTagDescription(
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(generateTagDescriptionRequestSchema.omit({ tagSlug: true })))
    body: Omit<GenerateTagDescriptionRequest, "tagSlug">,
  ): Promise<GenerateTagDescriptionResponse> {
    return this.generateDescription.execute({ ...body, tagSlug: slug });
  }

  @Patch(":slug/description")
  saveDescription(
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(updateTagDescriptionRequestSchema))
    request: UpdateTagDescriptionRequest,
  ): Promise<{ ok: true }> {
    return this.updateDescription.execute(slug, request.description);
  }
}
