import { Body, Controller, Get, NotFoundException, Param, Post } from "@nestjs/common";
import {
  createContentJobRequestSchema,
  type ContentJob as ContentJobDto,
  type CreateContentJobRequest,
  type CreateContentJobResponse,
  type ListAiProvidersResponse,
} from "@zinoflow/contracts";
import { ZodValidationPipe } from "../../shared/validation/zod-validation.pipe";
import { CreateContentJobUseCase } from "../application/use-cases/create-content-job.usecase";
import {
  CONTENT_JOB_REPOSITORY,
  type ContentJobRepository,
} from "../application/ports/content-job.repository";
import {
  CONTENT_DRAFT_REPOSITORY,
  type ContentDraftRepository,
  type DraftRecord,
} from "../application/ports/content-draft.repository";
import { Inject } from "@nestjs/common";

@Controller("content")
export class ContentController {
  constructor(
    private readonly createContentJob: CreateContentJobUseCase,
    @Inject(CONTENT_JOB_REPOSITORY) private readonly repository: ContentJobRepository,
    @Inject(CONTENT_DRAFT_REPOSITORY) private readonly drafts: ContentDraftRepository,
  ) {}

  @Post("jobs")
  async create(
    @Body(new ZodValidationPipe(createContentJobRequestSchema))
    request: CreateContentJobRequest,
  ): Promise<CreateContentJobResponse> {
    return this.createContentJob.execute(request);
  }

  @Get("jobs")
  async list(): Promise<ContentJobDto[]> {
    const jobs = await this.repository.findAll();
    return jobs.map((job) => this.toDto(job));
  }

  @Get("jobs/:id")
  async getById(@Param("id") id: string): Promise<ContentJobDto> {
    const job = await this.repository.findById(id);
    if (!job) throw new NotFoundException(`Content job ${id} not found`);
    return this.toDto(job);
  }

  /** Draft moi nhat cua job — UI dung de hien preview markdown + article blocks. */
  @Get("jobs/:id/draft")
  async getLatestDraft(@Param("id") id: string): Promise<DraftRecord> {
    const draft = await this.drafts.findLatestByJobId(id);
    if (!draft) throw new NotFoundException(`No draft found for job ${id}`);
    return draft;
  }

  /**
   * Danh sach provider/model cho UI dropdown (spec §7.1b).
   * isConfigured doc tu env de UI disable provider chua co key.
   */
  @Get("ai-providers")
  listAiProviders(): ListAiProvidersResponse {
    return {
      providers: [
        {
          key: "anthropic",
          displayName: "Anthropic (Claude)",
          isConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
          models: [
            { id: "claude-opus-4-8", displayName: "Claude Opus 4.8", tier: "quality", costNote: "$5/$25 per 1M tokens" },
            { id: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6", tier: "balanced", costNote: "$3/$15 per 1M tokens" },
            { id: "claude-haiku-4-5", displayName: "Claude Haiku 4.5", tier: "light", costNote: "$1/$5 per 1M tokens" },
          ],
        },
        {
          key: "openai",
          displayName: "OpenAI (ChatGPT)",
          isConfigured: Boolean(process.env.OPENAI_API_KEY),
          models: [],
        },
        {
          key: "gemini",
          displayName: "Google (Gemini)",
          isConfigured: Boolean(process.env.GEMINI_API_KEY),
          // Models dien khi implement GeminiContentAiProvider (tra cuu model id
          // moi nhat tu docs Google tai thoi diem do)
          models: [],
        },
      ],
    };
  }

  private toDto(job: import("../domain/content-job").ContentJob): ContentJobDto {
    const s = job.toSnapshot();
    return {
      id: s.id,
      siteCode: s.siteCode,
      sourceType: s.sourceType,
      sourceRef: s.sourceRef,
      topic: s.topic,
      status: s.status,
      aiProvider: s.aiProvider,
      aiModel: s.aiModel,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  }
}
