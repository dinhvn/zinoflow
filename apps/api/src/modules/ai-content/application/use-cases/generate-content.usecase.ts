import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
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
  type AiProviderRegistry,
  type ProductContext,
} from "../ports/content-ai-provider.port";
import { AI_USAGE_RECORDER, type AiUsageRecorder } from "../ports/ai-usage-recorder.port";
import { renderArticleMarkdown } from "../services/article-markdown.renderer";

/**
 * Use case: generate noi dung cho 1 content job (chay trong pg-boss worker).
 * Flow: GeneratingOutline -> outline -> article -> markdown -> save draft -> DraftReady.
 * Loi o bat ky buoc nao: job -> Failed (pg-boss se retry, Failed -> GeneratingOutline hop le).
 */
@Injectable()
export class GenerateContentUseCase {
  private readonly logger = new Logger(GenerateContentUseCase.name);

  constructor(
    @Inject(CONTENT_JOB_REPOSITORY) private readonly jobs: ContentJobRepository,
    @Inject(CONTENT_DRAFT_REPOSITORY) private readonly drafts: ContentDraftRepository,
    @Inject(AI_PROVIDER_REGISTRY) private readonly providers: AiProviderRegistry,
    @Inject(AI_USAGE_RECORDER) private readonly usage: AiUsageRecorder,
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
      // M2: products lay tu CMS cu theo sourceRef. Hien tai: mang rong (stub tu mock).
      const products: ProductContext[] = [];
      const baseInput = {
        model: snapshot.aiModel,
        topic: snapshot.topic,
        siteCode: snapshot.siteCode,
        keywordSeed: snapshot.keywordSeed,
        toneProfile: snapshot.toneProfile,
        products,
      };

      const { outline, usage: outlineUsage } = await provider.generateOutline(baseInput);
      await this.usage.record({
        ...outlineUsage,
        jobId: job.id,
        provider: provider.key,
        model: snapshot.aiModel,
        operation: "outline",
      });

      const { article, usage: articleUsage } = await provider.generateArticle({
        ...baseInput,
        outline,
      });
      await this.usage.record({
        ...articleUsage,
        jobId: job.id,
        provider: provider.key,
        model: snapshot.aiModel,
        operation: "article",
      });

      await this.drafts.save({
        id: randomUUID(),
        jobId: job.id,
        version: 1,
        title: article.hero.title,
        outline,
        article,
        draftMarkdown: renderArticleMarkdown(article),
        createdAt: new Date(),
      });

      job.transitionTo("DraftReady");
      await this.jobs.save(job);
      this.logger.log(`Job ${job.id} -> DraftReady (provider: ${provider.key})`);
    } catch (error) {
      // Danh dau Failed roi rethrow de pg-boss ap retry policy
      job.transitionTo("Failed");
      await this.jobs.save(job);
      this.logger.error(
        `Job ${job.id} generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
