import { Body, Controller, Get, NotFoundException, Param, Patch, Post } from "@nestjs/common";
import {
  aiProviderKeySchema,
  createContentJobRequestSchema,
  updateAiProviderSettingRequestSchema,
  type AiProviderInfo,
  type AiProviderKey,
  type ContentJob as ContentJobDto,
  type CreateContentJobRequest,
  type CreateContentJobResponse,
  type ListAiProvidersResponse,
  type UpdateAiProviderSettingRequest,
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
import {
  AI_PROVIDER_SETTINGS,
  type AiProviderSettings,
} from "../application/ports/ai-provider-settings.port";
import { Inject } from "@nestjs/common";

/**
 * Catalog provider/model cho UI — isConfigured doc tu env, isEnabled doc tu DB.
 * Them provider moi: them entry o day + adapter + registry.
 */
const PROVIDER_CATALOG: Array<Omit<AiProviderInfo, "isConfigured" | "isEnabled"> & { envKey: string }> = [
  {
    key: "anthropic",
    displayName: "Anthropic (Claude)",
    envKey: "ANTHROPIC_API_KEY",
    models: [
      { id: "claude-opus-4-8", displayName: "Claude Opus 4.8", tier: "quality", costNote: "$5/$25 per 1M tokens" },
      { id: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6", tier: "balanced", costNote: "$3/$15 per 1M tokens" },
      { id: "claude-haiku-4-5", displayName: "Claude Haiku 4.5", tier: "light", costNote: "$1/$5 per 1M tokens" },
    ],
  },
  {
    key: "openai",
    displayName: "OpenAI (ChatGPT)",
    envKey: "OPENAI_API_KEY",
    models: [],
  },
  {
    key: "gemini",
    displayName: "Google (Gemini)",
    envKey: "GEMINI_API_KEY",
    models: [
      { id: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro", tier: "quality", costNote: "$1.25/$10 per 1M tokens" },
      { id: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash", tier: "balanced", costNote: "$0.30/$2.50 per 1M tokens" },
      { id: "gemini-2.5-flash-lite", displayName: "Gemini 2.5 Flash Lite", tier: "light", costNote: "$0.10/$0.40 per 1M tokens" },
    ],
  },
];

@Controller("content")
export class ContentController {
  constructor(
    private readonly createContentJob: CreateContentJobUseCase,
    @Inject(CONTENT_JOB_REPOSITORY) private readonly repository: ContentJobRepository,
    @Inject(CONTENT_DRAFT_REPOSITORY) private readonly drafts: ContentDraftRepository,
    @Inject(AI_PROVIDER_SETTINGS) private readonly providerSettings: AiProviderSettings,
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
   * Danh sach provider/model cho UI dropdown + Settings page (spec §7.1b).
   * isConfigured tu env, isEnabled tu DB (Settings).
   */
  @Get("ai-providers")
  async listAiProviders(): Promise<ListAiProvidersResponse> {
    const enabledMap = await this.providerSettings.getAll(PROVIDER_CATALOG.map((p) => p.key));
    return {
      providers: PROVIDER_CATALOG.map(({ envKey, ...provider }) => ({
        ...provider,
        isConfigured: Boolean(process.env[envKey]),
        isEnabled: enabledMap[provider.key] ?? true,
      })),
    };
  }

  /** Bat/tat provider tu Settings page. */
  @Patch("ai-providers/:key")
  async updateAiProviderSetting(
    @Param("key", new ZodValidationPipe(aiProviderKeySchema)) key: AiProviderKey,
    @Body(new ZodValidationPipe(updateAiProviderSettingRequestSchema))
    request: UpdateAiProviderSettingRequest,
  ): Promise<{ key: AiProviderKey; isEnabled: boolean }> {
    await this.providerSettings.setEnabled(key, request.isEnabled);
    return { key, isEnabled: request.isEnabled };
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
