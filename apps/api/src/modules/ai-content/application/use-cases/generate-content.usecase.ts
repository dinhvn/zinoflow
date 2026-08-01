import { Inject, Injectable, Logger } from "@nestjs/common";
import { type ContentSection } from "@zinoflow/contracts";
import {
  getArticleTypeProfile,
  type AnyArticle,
} from "../services/article-type-profiles";
import {
  CONTENT_JOB_REPOSITORY,
  type ContentJobRepository,
} from "../ports/content-job.repository";
import {
  AI_PROVIDER_REGISTRY,
  type AiCallUsage,
  type AiProviderRegistry,
  type ContentAiProvider,
  type StructuredGenerationRequest,
} from "../ports/content-ai-provider.port";
import {
  AI_USAGE_RECORDER,
  type AiUsageRecorder,
} from "../ports/ai-usage-recorder.port";
import {
  CONTENT_GENERATION_CHECKPOINT_REPOSITORY,
  type ContentGenerationCheckpointRepository,
} from "../ports/content-generation-checkpoint.repository";
import { PromptBuilder } from "../services/prompt-builder";
import { buildPromptLogText } from "../services/prompt-log-text";
import type { OutlineLike } from "../services/article-type-profiles";
import { ContentJobContextBuilder } from "../services/content-job-context.builder";
import {
  finalizeArticle,
  ContentDraftPersister,
} from "../services/content-generation-result-applier";
import type { ZodType } from "zod/v4";

/**
 * Use case: generate noi dung cho 1 content job (chay trong pg-boss worker) —
 * Option 3 (09/2026, thay M2 3-buoc): 2 buoc.
 *
 * Flow: GeneratingOutline
 *   buoc 1: outline (khung bai — 7 heading co dinh voi bai diem den)
 *   buoc 2: content — TOAN BO bai (moi khoi noi dung + frame: intro/quickFacts/
 *           faq/metadata...) trong 1 lan goi AI duy nhat.
 * -> validate bang chinh contentSchema cua articleType -> save draft (version
 *    tang dan) -> DraftReady.
 *
 * Ly do gop buoc 2+3 cu (section-per-block + frame rieng, 9 request cho bai diem
 * den) lam 1: model viet frame (intro/quickFacts) truoc day CHI thay outline +
 * cau dau moi section, khong thay het noi dung sections da viet — gay trung lap
 * that (mo bai lap "Tong quan", quickFacts.food/transport lap section an-gi/
 * di-chuyen, phat hien 07/2026). Gop lam 1 request giai quyet tan goc vi model
 * thay TOAN BO noi dung no dang viet trong cung 1 luot, dong thoi giam manh
 * token overhead (system prompt chi gui 1 lan thay vi 7-9 lan/bai).
 *
 * Loi sau khi het retry: job -> Failed (pg-boss retry ca job, Failed -> GeneratingOutline hop le).
 *
 * Checkpoint/resume: outline (sau normalize) duoc luu ngay sau khi xong — worker
 * chet giua chung (crash, restart dev --watch, pg-boss redeliver het
 * expireInSeconds) thi lan chay lai doc checkpoint, KHONG goi lai AI cho outline
 * da xong. Buoc content khong con checkpoint duoc GIUA CHUNG nua (1 request duy
 * nhat, khong co "giua chung" de luu) — neu loi phai goi lai TOAN BO buoc content,
 * chap nhan duoc vi retry ca content van it request hon tong so request cu.
 * Checkpoint bi xoa khi job xong (DraftReady) hoac khi sua tham so sinh bai
 * (outline cu het dung — EditContentJobUseCase).
 */
@Injectable()
export class GenerateContentUseCase {
  private readonly logger = new Logger(GenerateContentUseCase.name);

  /** So lan goi toi da cho buoc content truoc khi coi nhu job fail. */
  private static readonly CONTENT_MAX_ATTEMPTS = 3;
  /** Cho giua 2 lan retry content (loi tam thoi thuong het sau vai giay). */
  private static readonly CONTENT_RETRY_DELAY_MS = 2_000;

  constructor(
    @Inject(CONTENT_JOB_REPOSITORY) private readonly jobs: ContentJobRepository,
    @Inject(AI_PROVIDER_REGISTRY)
    private readonly providers: AiProviderRegistry,
    @Inject(AI_USAGE_RECORDER) private readonly usage: AiUsageRecorder,
    @Inject(CONTENT_GENERATION_CHECKPOINT_REPOSITORY)
    private readonly checkpoints: ContentGenerationCheckpointRepository,
    private readonly prompts: PromptBuilder,
    private readonly contextBuilder: ContentJobContextBuilder,
    private readonly draftPersister: ContentDraftPersister,
  ) {}

  async execute(contentJobId: string): Promise<void> {
    const job = await this.jobs.findById(contentJobId);
    if (!job) {
      this.logger.warn(`Content job ${contentJobId} not found - skipping`);
      return;
    }

    // Idempotency: pg-boss co the giao lai job da xu ly xong
    if (
      job.status === "DraftReady" ||
      job.status === "InReview" ||
      job.status === "Approved"
    ) {
      this.logger.log(`Job ${job.id} already at ${job.status} - skipping`);
      return;
    }

    const snapshot = job.toSnapshot();
    // Khong transition neu da o GeneratingOutline (pg-boss redelivery sau crash giua chung)
    if (job.status !== "GeneratingOutline") {
      job.transitionTo("GeneratingOutline");
      await this.jobs.save(job);
    }

    try {
      const provider = this.providers.resolve(snapshot.aiProvider);
      // Profile theo loai bai (spec §19.3): schema + render rieng tung loai
      const profile = getArticleTypeProfile(snapshot.articleType);
      const ctx = await this.contextBuilder.build(snapshot, profile);

      // Resume: doc checkpoint truoc — co outline da xong thi khong goi lai AI cho buoc do.
      const checkpoint = await this.checkpoints.findByJobId(job.id);

      // Buoc 1 — outline (bo qua neu checkpoint da co san)
      let outline: OutlineLike;
      if (checkpoint?.outline) {
        outline = checkpoint.outline;
        this.logger.log(`Job ${job.id} resume: dung lai outline tu checkpoint`);
      } else {
        const outlineRequest = await this.prompts.buildOutline(ctx);
        const { output: rawOutline, usage: outlineUsage } =
          await provider.generateStructured(
            outlineRequest,
            profile.outlineSchema,
          );
        await this.recordUsage(
          job.id,
          provider,
          snapshot.aiModel,
          "outline",
          outlineUsage,
          outlineRequest,
          profile.outlineSchema,
          rawOutline,
        );
        // Ep cung sectionHeadings/blockKey theo dung 7 chu de co dinh cho bai diem den
        // (destinationProfile.normalizeOutline) — khong tin AI tu dat dung tieu de/thu
        // tu, tranh lac de (bug 07/2026, xem ghi chu o ArticleTypeProfile.normalizeOutline).
        // Cac profile khac khong khai bao hook nay -> giu nguyen outline goc.
        outline = profile.normalizeOutline
          ? profile.normalizeOutline(rawOutline, snapshot.topic)
          : rawOutline;
        await this.checkpoints.save({
          jobId: job.id,
          outline: outline as OutlineLike & Record<string, unknown>,
          sections: [],
        });
      }

      // Buoc 2 — TOAN BO noi dung (7 khoi + frame) trong 1 lan goi AI (Option 3).
      const contentRequest = await this.prompts.buildContent(ctx, outline);
      const rawArticle = await this.generateContentWithRetry(
        provider,
        job.id,
        snapshot.aiModel,
        contentRequest,
        profile.contentSchema,
        () =>
          provider.generateStructured(contentRequest, profile.contentSchema),
      );

      // Ep cung blockKey theo DUNG VI TRI trong DESTINATION_SECTION_ORDER (bai diem
      // den) — khong tin AI tu gan lai blockKey dung, cung nguyen tac da dung o
      // GenerateDestinationBlockUseCase (xem ArticleTypeProfile.normalizeSection).
      const article = finalizeArticle(rawArticle, profile, outline, snapshot.sourceContext);
      await this.draftPersister.saveNewVersion(job.id, profile, outline, article);

      job.transitionTo("DraftReady");
      await this.jobs.save(job);
      // Xong roi — xoa checkpoint, khong con can resume nua
      await this.checkpoints.clear(job.id);
      const sectionCount = (article as { sections: ContentSection[] }).sections.length;
      this.logger.log(
        `Job ${job.id} -> DraftReady (provider: ${provider.key}, ${sectionCount} sections)`,
      );
    } catch (error) {
      // Danh dau Failed roi rethrow de pg-boss ap retry policy.
      // KHONG xoa checkpoint — retry sau se resume tu outline da xong (neu co),
      // khong chay lai tu dau.
      job.transitionTo("Failed");
      await this.jobs.save(job);
      this.logger.error(
        `Job ${job.id} generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Goi generate cho buoc content, fail thi retry CA buoc (khong con retry duoc
   * tung khoi rieng le nhu truoc — 1 request duy nhat gom het). Usage duoc ghi
   * cho moi lan goi thanh cong, operation "content".
   */
  private async generateContentWithRetry(
    provider: ContentAiProvider,
    jobId: string,
    model: string,
    request: StructuredGenerationRequest,
    schema: ZodType,
    call: () => Promise<{ output: AnyArticle; usage: AiCallUsage }>,
  ): Promise<AnyArticle> {
    let lastError: unknown;

    for (
      let attempt = 1;
      attempt <= GenerateContentUseCase.CONTENT_MAX_ATTEMPTS;
      attempt++
    ) {
      try {
        const { output, usage } = await call();
        await this.recordUsage(
          jobId,
          provider,
          model,
          "content",
          usage,
          request,
          schema,
          output,
        );
        return output;
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `Job ${jobId} content attempt ${attempt}/${GenerateContentUseCase.CONTENT_MAX_ATTEMPTS} failed: ` +
            (error instanceof Error ? error.message : String(error)),
        );
        if (attempt < GenerateContentUseCase.CONTENT_MAX_ATTEMPTS) {
          await this.delay(
            GenerateContentUseCase.CONTENT_RETRY_DELAY_MS * attempt,
          );
        }
      }
    }
    throw lastError;
  }

  private async recordUsage(
    jobId: string,
    provider: ContentAiProvider,
    model: string,
    operation: string,
    usage: {
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
      latencyMs: number;
    },
    request: StructuredGenerationRequest,
    schema: ZodType,
    output: unknown,
  ): Promise<void> {
    await this.usage.record({
      ...usage,
      jobId,
      provider: provider.key,
      model,
      operation,
      promptText: buildPromptLogText(request.system, request.prompt, schema),
      responseText: JSON.stringify(output),
      promptKey: request.promptTrace?.key ?? null,
      promptVersion: request.promptTrace?.version ?? null,
      promptSource: request.promptTrace?.source ?? null,
      sourceContextHash: request.promptTrace?.sourceContextHash ?? null,
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
