import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { type ContentSection } from "@zinoflow/contracts";
import { getArticleTypeProfile } from "../services/article-type-profiles";
import {
  CONTENT_JOB_REPOSITORY,
  type ContentJobRepository,
} from "../ports/content-job.repository";
import {
  CONTENT_DRAFT_REPOSITORY,
  type ContentDraftRepository,
} from "../ports/content-draft.repository";
import {
  AI_PROVIDER_REGISTRY,
  type AiCallUsage,
  type AiProviderRegistry,
  type ContentAiProvider,
  type StructuredGenerationRequest,
} from "../ports/content-ai-provider.port";
import { PRODUCT_CATALOG, type ProductCatalog } from "../ports/product-catalog.port";
import { AI_USAGE_RECORDER, type AiUsageRecorder } from "../ports/ai-usage-recorder.port";
import {
  CONTENT_GENERATION_CHECKPOINT_REPOSITORY,
  type ContentGenerationCheckpointRepository,
} from "../ports/content-generation-checkpoint.repository";
import { PromptBuilder, type PromptJobContext } from "../services/prompt-builder";
import type { OutlineLike } from "../services/article-type-profiles";

/**
 * Use case: generate noi dung cho 1 content job (chay trong pg-boss worker) — M2: 3 buoc.
 *
 * Flow: GeneratingOutline
 *   buoc 1: outline (khung bai)
 *   buoc 2: expand TUNG section — fail section nao chi retry section do
 *           (job khong chet vi 1 section loi tam thoi — gate M2)
 *   buoc 3: frame (hero/FAQ/metadata...) -> assemble = frame + sections
 * -> validate articleSchema -> save draft (version tang dan) -> DraftReady.
 *
 * Loi sau khi het retry: job -> Failed (pg-boss retry ca job, Failed -> GeneratingOutline hop le).
 *
 * Checkpoint/resume: outline (sau normalize) va tung section DA XONG duoc luu ngay
 * vao content_generation_checkpoints sau moi buoc. Neu worker chet giua chung (crash,
 * restart dev --watch, pg-boss redeliver het expireInSeconds), lan chay lai se doc
 * checkpoint va TIEP TUC tu section con thieu — khong goi lai AI cho outline/section
 * da xong (bug 07/2026: job chay lai tu dau, ton AI 2 lan khi worker bi giet giua chung).
 * Checkpoint bi xoa khi job xong (DraftReady) hoac khi sua tham so sinh bai (outline cu
 * het dung — EditContentJobUseCase).
 */
@Injectable()
export class GenerateContentUseCase {
  private readonly logger = new Logger(GenerateContentUseCase.name);

  /** So lan goi toi da cho MOT section truoc khi coi nhu job fail. */
  private static readonly SECTION_MAX_ATTEMPTS = 3;
  /** Cho giua 2 lan retry section (loi tam thoi thuong het sau vai giay). */
  private static readonly SECTION_RETRY_DELAY_MS = 2_000;

  constructor(
    @Inject(CONTENT_JOB_REPOSITORY) private readonly jobs: ContentJobRepository,
    @Inject(CONTENT_DRAFT_REPOSITORY) private readonly drafts: ContentDraftRepository,
    @Inject(AI_PROVIDER_REGISTRY) private readonly providers: AiProviderRegistry,
    @Inject(PRODUCT_CATALOG) private readonly catalog: ProductCatalog,
    @Inject(AI_USAGE_RECORDER) private readonly usage: AiUsageRecorder,
    @Inject(CONTENT_GENERATION_CHECKPOINT_REPOSITORY)
    private readonly checkpoints: ContentGenerationCheckpointRepository,
    private readonly prompts: PromptBuilder,
  ) {}

  async execute(contentJobId: string): Promise<void> {
    const job = await this.jobs.findById(contentJobId);
    if (!job) {
      this.logger.warn(`Content job ${contentJobId} not found - skipping`);
      return;
    }

    // Idempotency: pg-boss co the giao lai job da xu ly xong
    if (job.status === "DraftReady" || job.status === "InReview" || job.status === "Approved") {
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
      // Profile theo loai bai (spec §19.3): schema + assemble + render rieng tung loai
      const profile = getArticleTypeProfile(snapshot.articleType);
      const products = profile.usesProductCatalog
        ? await this.catalog.findProducts({
            siteCode: snapshot.siteCode,
            topic: snapshot.topic,
            keywords: snapshot.keywordSeed,
          })
        : [];
      const ctx: PromptJobContext = {
        model: snapshot.aiModel,
        articleType: snapshot.articleType,
        topic: snapshot.topic,
        siteCode: snapshot.siteCode,
        keywordSeed: snapshot.keywordSeed,
        toneProfile: snapshot.toneProfile,
        sourceContext: snapshot.sourceContext,
        contentTier: snapshot.contentTier,
        products,
      };

      // Resume: doc checkpoint truoc — co outline/section da xong thi khong goi lai AI
      // cho cac buoc do (bug 07/2026: worker chet giua chung -> chay lai tu dau, ton AI).
      const checkpoint = await this.checkpoints.findByJobId(job.id);

      // Buoc 1 — outline (bo qua neu checkpoint da co san)
      let outline: OutlineLike;
      if (checkpoint?.outline) {
        outline = checkpoint.outline;
        this.logger.log(`Job ${job.id} resume: dung lai outline tu checkpoint`);
      } else {
        const outlineRequest = await this.prompts.buildOutline(ctx);
        const { output: rawOutline, usage: outlineUsage } = await provider.generateStructured(
          outlineRequest,
          profile.outlineSchema,
        );
        await this.recordUsage(job.id, provider, snapshot.aiModel, "outline", outlineUsage, outlineRequest, rawOutline);
        // Ep cung sectionHeadings/blockKey theo dung 7 chu de co dinh cho bai diem den
        // (destinationProfile.normalizeOutline) — khong tin AI tu dat dung tieu de/thu
        // tu, tranh lac de (bug 07/2026, xem ghi chu o ArticleTypeProfile.normalizeOutline).
        // Cac profile khac khong khai bao hook nay -> giu nguyen outline goc.
        outline = profile.normalizeOutline ? profile.normalizeOutline(rawOutline, snapshot.topic) : rawOutline;
        await this.checkpoints.save({
          jobId: job.id,
          outline: outline as OutlineLike & Record<string, unknown>,
          sections: checkpoint?.sections ?? [],
        });
      }

      // Buoc 2 — expand tung section, retry per-section; section da co trong checkpoint
      // (resume) thi bo qua, khong goi lai AI.
      const sections: ContentSection[] = checkpoint?.sections ? [...checkpoint.sections] : [];
      const resumeFromIndex = sections.length;
      for (const [index, heading] of outline.sectionHeadings.entries()) {
        if (index < resumeFromIndex) continue;
        const sectionRequest = await this.prompts.buildSection(ctx, outline, heading);
        const rawSection = await this.generateSectionWithRetry(
          provider,
          job.id,
          snapshot.aiModel,
          index,
          sectionRequest,
          () => provider.generateStructured(sectionRequest, profile.sectionSchema),
        );
        sections.push(profile.normalizeSection ? profile.normalizeSection(rawSection, index) : rawSection);
        // Luu ngay sau moi section — worker chet giua chung van resume duoc tu day
        await this.checkpoints.save({
          jobId: job.id,
          outline: outline as OutlineLike & Record<string, unknown>,
          sections,
        });
      }

      // Buoc 3 — frame (moi block tru sections) + assemble
      const frameRequest = await this.prompts.buildFrame(ctx, outline, sections);
      const { output: frame, usage: frameUsage } = await provider.generateStructured(
        frameRequest,
        profile.frameSchema,
      );
      await this.recordUsage(job.id, provider, snapshot.aiModel, "frame", frameUsage, frameRequest, frame);

      // Assemble + validate lai toan bai — schema toan bai la nguon su that cuoi cung
      const article = profile.assemble(frame, sections);

      const latest = await this.drafts.findLatestByJobId(job.id);
      await this.drafts.save({
        id: randomUUID(),
        jobId: job.id,
        version: (latest?.version ?? 0) + 1, // generate lai -> version moi, khong de unique conflict
        title: profile.extractTitle(article),
        outline: outline as { title: string; sectionHeadings: string[] } & Record<string, unknown>,
        article,
        draftMarkdown: profile.renderMarkdown(article),
        createdAt: new Date(),
      });

      job.transitionTo("DraftReady");
      await this.jobs.save(job);
      // Xong roi — xoa checkpoint, khong con can resume nua
      await this.checkpoints.clear(job.id);
      this.logger.log(
        `Job ${job.id} -> DraftReady (provider: ${provider.key}, ${sections.length} sections)`,
      );
    } catch (error) {
      // Danh dau Failed roi rethrow de pg-boss ap retry policy.
      // KHONG xoa checkpoint — retry sau se resume tu outline/section da xong,
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
   * Goi generate cho 1 section, fail thi retry CHI section nay (gate M2:
   * "Generate fail 1 section -> chi retry section do, job khong chet").
   * Usage duoc ghi cho moi lan goi thanh cong (operation "section:N").
   */
  private async generateSectionWithRetry(
    provider: ContentAiProvider,
    jobId: string,
    model: string,
    sectionIndex: number,
    request: StructuredGenerationRequest,
    call: () => Promise<{ output: ContentSection; usage: AiCallUsage }>,
  ): Promise<ContentSection> {
    const operation = `section:${sectionIndex + 1}`;
    let lastError: unknown;

    for (let attempt = 1; attempt <= GenerateContentUseCase.SECTION_MAX_ATTEMPTS; attempt++) {
      try {
        const { output, usage } = await call();
        await this.recordUsage(jobId, provider, model, operation, usage, request, output);
        return output;
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `Job ${jobId} ${operation} attempt ${attempt}/${GenerateContentUseCase.SECTION_MAX_ATTEMPTS} failed: ` +
            (error instanceof Error ? error.message : String(error)),
        );
        if (attempt < GenerateContentUseCase.SECTION_MAX_ATTEMPTS) {
          await this.delay(GenerateContentUseCase.SECTION_RETRY_DELAY_MS * attempt);
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
    usage: { inputTokens: number; outputTokens: number; costUsd: number; latencyMs: number },
    request: StructuredGenerationRequest,
    output: unknown,
  ): Promise<void> {
    await this.usage.record({
      ...usage,
      jobId,
      provider: provider.key,
      model,
      operation,
      promptText: `${request.system}\n\n${request.prompt}`,
      responseText: JSON.stringify(output),
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
