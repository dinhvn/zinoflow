import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Put, Query } from "@nestjs/common";
import {
  activatePromptVersionRequestSchema,
  aiProviderKeySchema,
  aiUsageSummaryQuerySchema,
  listAiUsageLogsQuerySchema,
  createContentJobRequestSchema,
  createManualDraftRequestSchema,
  createPromptVersionRequestSchema,
  reviewDraftRequestSchema,
  updateAiProviderSettingRequestSchema,
  updateContentJobRequestSchema,
  updateDraftRequestSchema,
  type ActivatePromptVersionRequest,
  type AiProviderInfo,
  type AiProviderKey,
  type AiUsageLogEntry,
  type AiUsageSummaryQuery,
  type AiUsageSummaryResponse,
  type ContentJob as ContentJobDto,
  type CreatePromptVersionRequest,
  type CreatePromptVersionResponse,
  type CreateContentJobRequest,
  type CreateContentJobResponse,
  type CreateManualDraftRequest,
  type ListAiProvidersResponse,
  type ListAiUsageLogsQuery,
  type ListAiUsageLogsResponse,
  type PromptTemplateDetail,
  type PromptTemplateListResponse,
  type ReviewDraftRequest,
  type RunQualityChecksResponse,
  type UpdateAiProviderSettingRequest,
  type UpdateContentJobRequest,
  type UpdateDraftRequest,
} from "@zinoflow/contracts";
import { ZodValidationPipe } from "../../shared/validation/zod-validation.pipe";
import { CreateContentJobUseCase } from "../application/use-cases/create-content-job.usecase";
import { CreateManualDraftUseCase } from "../application/use-cases/create-manual-draft.usecase";
import { RetryContentJobUseCase } from "../application/use-cases/retry-content-job.usecase";
import { CancelContentJobUseCase } from "../application/use-cases/cancel-content-job.usecase";
import { EditContentJobUseCase } from "../application/use-cases/edit-content-job.usecase";
import { RunQualityChecksUseCase } from "../application/use-cases/run-quality-checks.usecase";
import { SubmitForReviewUseCase } from "../application/use-cases/submit-for-review.usecase";
import { ReviewDraftUseCase } from "../application/use-cases/review-draft.usecase";
import { UpdateDraftUseCase } from "../application/use-cases/update-draft.usecase";
import { ExportDraftHtmlUseCase } from "../application/use-cases/export-draft-html.usecase";
import { ListPromptTemplatesUseCase } from "../application/use-cases/list-prompt-templates.usecase";
import { GetPromptTemplateUseCase } from "../application/use-cases/get-prompt-template.usecase";
import { CreatePromptVersionUseCase } from "../application/use-cases/create-prompt-version.usecase";
import { ActivatePromptVersionUseCase } from "../application/use-cases/activate-prompt-version.usecase";
import { GetAiUsageSummaryUseCase } from "../application/use-cases/get-ai-usage-summary.usecase";
import {
  QUALITY_RESULT_REPOSITORY,
  type QualityResultRepository,
} from "../application/ports/quality-result.repository";
import {
  REVIEW_RECORD_REPOSITORY,
  type ReviewRecordRepository,
} from "../application/ports/review-record.repository";
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
import { AI_USAGE_READER, type AiUsageReader } from "../application/ports/ai-usage-reader.port";
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
    private readonly createManualDraft: CreateManualDraftUseCase,
    private readonly retryContentJob: RetryContentJobUseCase,
    private readonly cancelContentJob: CancelContentJobUseCase,
    private readonly editContentJob: EditContentJobUseCase,
    private readonly runQualityChecks: RunQualityChecksUseCase,
    private readonly submitForReview: SubmitForReviewUseCase,
    private readonly reviewDraft: ReviewDraftUseCase,
    private readonly updateDraft: UpdateDraftUseCase,
    private readonly exportDraftHtml: ExportDraftHtmlUseCase,
    private readonly listPromptTemplates: ListPromptTemplatesUseCase,
    private readonly getPromptTemplate: GetPromptTemplateUseCase,
    private readonly createPromptVersion: CreatePromptVersionUseCase,
    private readonly activatePromptVersion: ActivatePromptVersionUseCase,
    private readonly getAiUsageSummary: GetAiUsageSummaryUseCase,
    @Inject(QUALITY_RESULT_REPOSITORY) private readonly qualityResults: QualityResultRepository,
    @Inject(REVIEW_RECORD_REPOSITORY) private readonly reviewRecords: ReviewRecordRepository,
    @Inject(CONTENT_JOB_REPOSITORY) private readonly repository: ContentJobRepository,
    @Inject(CONTENT_DRAFT_REPOSITORY) private readonly drafts: ContentDraftRepository,
    @Inject(AI_PROVIDER_SETTINGS) private readonly providerSettings: AiProviderSettings,
    @Inject(AI_USAGE_READER) private readonly usageReader: AiUsageReader,
  ) {}

  @Post("jobs")
  async create(
    @Body(new ZodValidationPipe(createContentJobRequestSchema))
    request: CreateContentJobRequest,
  ): Promise<CreateContentJobResponse> {
    return this.createContentJob.execute(request);
  }

  /** Tao draft VIET TAY, khong qua AI (dichoithoi-article-spec.md §1.1) */
  @Post("jobs/manual")
  async createManual(
    @Body(new ZodValidationPipe(createManualDraftRequestSchema))
    request: CreateManualDraftRequest,
  ): Promise<CreateContentJobResponse> {
    return this.createManualDraft.execute(request);
  }

  /** Retry job Failed / generate lai job DraftReady — trang thai khac bi 422 (state machine). */
  @Post("jobs/:id/retry")
  async retry(@Param("id") id: string): Promise<{ jobId: string; status: string }> {
    return this.retryContentJob.execute(id);
  }

  /**
   * Huy job dang chay (Created/GeneratingOutline) -> Failed. Dung khi worker
   * chet giua chung ma khong tu chuyen Failed (job "ket" mai o GeneratingOutline).
   * Sau khi huy co the bam Retry lai binh thuong.
   */
  @Post("jobs/:id/cancel")
  async cancel(@Param("id") id: string): Promise<{ jobId: string; status: string }> {
    return this.cancelContentJob.execute(id);
  }

  /**
   * Sua tham so sinh bai (topic/keyword/tone/provider/model) truoc khi chay lai.
   * Chi hop le khi job Failed/DraftReady — trang thai khac bi 422 (domain rule).
   * KHONG requeue: UI goi retry sau khi luu de chay lai.
   */
  @Patch("jobs/:id")
  async edit(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateContentJobRequestSchema)) request: UpdateContentJobRequest,
  ): Promise<ContentJobDto> {
    const job = await this.editContentJob.execute(id, request);
    return this.toDto(job);
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

  /** Gui draft vao review: DraftReady -> InReview. */
  @Post("jobs/:id/submit-review")
  async submitReview(@Param("id") id: string): Promise<{ jobId: string; status: string }> {
    return this.submitForReview.execute(id);
  }

  /** Tat ca version draft cua job (moi nhat truoc) — UI xem lich su version. */
  @Get("jobs/:id/drafts")
  async listDrafts(@Param("id") id: string) {
    const drafts = await this.drafts.listByJobId(id);
    return drafts.map((d) => ({
      id: d.id,
      version: d.version,
      title: d.title,
      createdAt: d.createdAt,
    }));
  }

  /** Lich su review cua job (moi version) — spec §7.6. */
  @Get("jobs/:id/reviews")
  async listReviews(@Param("id") id: string) {
    return this.reviewRecords.listByJobId(id);
  }

  /**
   * Lich su goi AI cua job (moi buoc outline/section/frame), kem prompt/response
   * tho — yeu cau nguoi dung 07/2026 de debug/audit (truoc day khong xem duoc
   * o dau ca, chi co tokens/cost trong ai_usage_logs).
   */
  @Get("jobs/:id/usage-logs")
  async listUsageLogs(@Param("id") id: string): Promise<AiUsageLogEntry[]> {
    return this.usageReader.listByJobId(id);
  }

  /** Chay 4 quality gates va luu ket qua — spec §7.4. */
  @Post("drafts/:draftId/quality-checks")
  async runChecks(@Param("draftId") draftId: string): Promise<RunQualityChecksResponse> {
    return this.runQualityChecks.execute(draftId);
  }

  /** Ket qua checks da luu cua draft (UI load lan dau, khong can chay lai). */
  @Get("drafts/:draftId/quality-checks")
  async getChecks(@Param("draftId") draftId: string) {
    const checks = await this.qualityResults.findByDraftId(draftId);
    return { draftId, checks, allPassed: checks.length > 0 && checks.every((c) => c.passed) };
  }

  /** Review action: Approve (chan khi gate fail) / RequestChange / Reject (can ly do). */
  @Post("drafts/:draftId/review")
  async review(
    @Param("draftId") draftId: string,
    @Body(new ZodValidationPipe(reviewDraftRequestSchema)) request: ReviewDraftRequest,
  ): Promise<{ newStatus: string }> {
    return this.reviewDraft.execute(draftId, request);
  }

  /** Sua noi dung draft -> version moi; sua bai Approved -> job ve InReview. */
  @Put("drafts/:draftId")
  async update(
    @Param("draftId") draftId: string,
    @Body(new ZodValidationPipe(updateDraftRequestSchema)) request: UpdateDraftRequest,
  ): Promise<DraftRecord> {
    return this.updateDraft.execute(draftId, request);
  }

  /** Export HTML sach (sanitize chong XSS) tu draft markdown. */
  @Get("drafts/:draftId/html")
  async exportHtml(@Param("draftId") draftId: string): Promise<{ draftId: string; html: string }> {
    return this.exportDraftHtml.execute(draftId);
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

  /** Tong hop chi phi AI (ai_usage_logs) cho man /usage — mac dinh 30 ngay gan nhat. */
  @Get("ai-usage/summary")
  aiUsageSummary(
    @Query(new ZodValidationPipe(aiUsageSummaryQuerySchema)) query: AiUsageSummaryQuery,
  ): Promise<AiUsageSummaryResponse> {
    return this.getAiUsageSummary.execute(query);
  }

  /**
   * Lich su TUNG luot goi AI toan he thong (khong chi theo 1 content job) — man
   * "Lich su goi AI" (/usage, tab Lich su), yeu cau nguoi dung 24/07/2026: xem lai
   * prompt/response da gui cho ca cac tac vu khong co job (vd goi y Type/Tag
   * taxonomy dichoithoi). Doc thang tu AI_USAGE_READER, khong qua use-case rieng
   * (cung pattern don gian nhu listUsageLogs theo jobId o tren).
   */
  @Get("ai-usage/logs")
  async listAiUsageLogs(
    @Query(new ZodValidationPipe(listAiUsageLogsQuerySchema)) query: ListAiUsageLogsQuery,
  ): Promise<ListAiUsageLogsResponse> {
    const { rows, total, operations } = await this.usageReader.listRecent(query);
    return { rows, total, page: query.page, limit: query.limit, operations };
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

  // ===== Prompt templates (man /prompts — xem/sua/version prompt sinh bai) =====

  /** Danh sach moi prompt quan ly duoc (gom theo loai bai) */
  @Get("prompt-templates")
  listPrompts(): Promise<PromptTemplateListResponse> {
    return this.listPromptTemplates.execute();
  }

  /** Chi tiet 1 prompt: noi dung dang dung + mac dinh + lich su version */
  @Get("prompt-templates/:key")
  getPrompt(@Param("key") key: string): Promise<PromptTemplateDetail> {
    return this.getPromptTemplate.execute(key);
  }

  /** Luu version moi (= active luon). Tra ve canh bao placeholder la neu co. */
  @Post("prompt-templates/:key/versions")
  createPromptVersionEndpoint(
    @Param("key") key: string,
    @Body(new ZodValidationPipe(createPromptVersionRequestSchema))
    request: CreatePromptVersionRequest,
  ): Promise<CreatePromptVersionResponse> {
    return this.createPromptVersion.execute(key, request.content);
  }

  /** Kich hoat lai version cu (rollback) */
  @Post("prompt-templates/:key/activate")
  activatePromptVersionEndpoint(
    @Param("key") key: string,
    @Body(new ZodValidationPipe(activatePromptVersionRequestSchema))
    request: ActivatePromptVersionRequest,
  ): Promise<{ activeVersion: number }> {
    return this.activatePromptVersion.execute(key, request.version);
  }

  private toDto(job: import("../domain/content-job").ContentJob): ContentJobDto {
    const s = job.toSnapshot();
    return {
      id: s.id,
      siteCode: s.siteCode,
      sourceType: s.sourceType,
      sourceRef: s.sourceRef,
      topic: s.topic,
      articleType: s.articleType,
      keywordSeed: [...s.keywordSeed],
      status: s.status,
      aiProvider: s.aiProvider,
      aiModel: s.aiModel,
      coverImageId: s.coverImageId,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  }
}
