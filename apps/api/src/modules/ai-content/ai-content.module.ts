import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ContentController } from "./presentation/content.controller";
import { CreateContentJobUseCase } from "./application/use-cases/create-content-job.usecase";
import { GenerateContentUseCase } from "./application/use-cases/generate-content.usecase";
import { RetryContentJobUseCase } from "./application/use-cases/retry-content-job.usecase";
import { RunQualityChecksUseCase } from "./application/use-cases/run-quality-checks.usecase";
import { SubmitForReviewUseCase } from "./application/use-cases/submit-for-review.usecase";
import { ReviewDraftUseCase } from "./application/use-cases/review-draft.usecase";
import { UpdateDraftUseCase } from "./application/use-cases/update-draft.usecase";
import { ExportDraftHtmlUseCase } from "./application/use-cases/export-draft-html.usecase";
import { QUALITY_RESULT_REPOSITORY } from "./application/ports/quality-result.repository";
import { REVIEW_RECORD_REPOSITORY } from "./application/ports/review-record.repository";
import { TypeOrmQualityResultRepository } from "./infrastructure/repositories/typeorm-quality-result.repository";
import { TypeOrmReviewRecordRepository } from "./infrastructure/repositories/typeorm-review-record.repository";
import { PromptBuilder } from "./application/services/prompt-builder";
import { PROMPT_TEMPLATE_REPOSITORY } from "./application/ports/prompt-template.repository";
import { PRODUCT_CATALOG } from "./application/ports/product-catalog.port";
import { TypeOrmPromptTemplateRepository } from "./infrastructure/repositories/typeorm-prompt-template.repository";
import { MockProductCatalog } from "./infrastructure/product-catalog/mock-product-catalog";
import { CmsHttpProductCatalog } from "./infrastructure/product-catalog/cms-http-product-catalog";
import { OpenAiContentAiProvider } from "./infrastructure/ai-providers/openai-content-ai.provider";
import { CONTENT_JOB_REPOSITORY } from "./application/ports/content-job.repository";
import { CONTENT_DRAFT_REPOSITORY } from "./application/ports/content-draft.repository";
import { AI_USAGE_RECORDER } from "./application/ports/ai-usage-recorder.port";
import { AI_PROVIDER_REGISTRY } from "./application/ports/content-ai-provider.port";
import { TypeOrmContentJobRepository } from "./infrastructure/repositories/typeorm-content-job.repository";
import { TypeOrmContentDraftRepository } from "./infrastructure/repositories/typeorm-content-draft.repository";
import { TypeOrmAiUsageRecorder } from "./infrastructure/repositories/typeorm-ai-usage-recorder";
import { StubContentAiProvider } from "./infrastructure/ai-providers/stub-content-ai.provider";
import { AnthropicContentAiProvider } from "./infrastructure/ai-providers/anthropic-content-ai.provider";
import { GeminiContentAiProvider } from "./infrastructure/ai-providers/gemini-content-ai.provider";
import { DefaultAiProviderRegistry } from "./infrastructure/ai-providers/ai-provider.registry";
import { ContentGenerateWorker } from "./infrastructure/workers/content-generate.worker";
import { ContentJobEntity } from "./infrastructure/entities/content-job.entity";
import { ContentDraftEntity } from "./infrastructure/entities/content-draft.entity";
import { ContentReviewRecordEntity } from "./infrastructure/entities/content-review-record.entity";
import { PromptTemplateEntity } from "./infrastructure/entities/prompt-template.entity";
import { ContentQualityResultEntity } from "./infrastructure/entities/content-quality-result.entity";
import { AiUsageLogEntity } from "./infrastructure/entities/ai-usage-log.entity";
import { AiProviderSettingEntity } from "./infrastructure/entities/ai-provider-setting.entity";
import { AI_PROVIDER_SETTINGS } from "./application/ports/ai-provider-settings.port";
import { TypeOrmAiProviderSettings } from "./infrastructure/repositories/typeorm-ai-provider-settings";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContentJobEntity,
      ContentDraftEntity,
      ContentReviewRecordEntity,
      PromptTemplateEntity,
      ContentQualityResultEntity,
      AiUsageLogEntity,
      AiProviderSettingEntity,
    ]),
  ],
  controllers: [ContentController],
  providers: [
    CreateContentJobUseCase,
    GenerateContentUseCase,
    RetryContentJobUseCase,
    RunQualityChecksUseCase,
    SubmitForReviewUseCase,
    ReviewDraftUseCase,
    UpdateDraftUseCase,
    ExportDraftHtmlUseCase,
    PromptBuilder,
    ContentGenerateWorker,
    StubContentAiProvider,
    AnthropicContentAiProvider,
    GeminiContentAiProvider,
    OpenAiContentAiProvider,
    DefaultAiProviderRegistry,
    MockProductCatalog,
    CmsHttpProductCatalog,
    { provide: CONTENT_JOB_REPOSITORY, useClass: TypeOrmContentJobRepository },
    { provide: CONTENT_DRAFT_REPOSITORY, useClass: TypeOrmContentDraftRepository },
    { provide: AI_USAGE_RECORDER, useClass: TypeOrmAiUsageRecorder },
    { provide: AI_PROVIDER_SETTINGS, useClass: TypeOrmAiProviderSettings },
    { provide: PROMPT_TEMPLATE_REPOSITORY, useClass: TypeOrmPromptTemplateRepository },
    { provide: QUALITY_RESULT_REPOSITORY, useClass: TypeOrmQualityResultRepository },
    { provide: REVIEW_RECORD_REPOSITORY, useClass: TypeOrmReviewRecordRepository },
    {
      provide: PRODUCT_CATALOG,
      // CMS_BASE_URL co gia tri -> goi CMS that; chua co -> mock (du lieu mau theo site)
      useFactory: (mock: MockProductCatalog, cms: CmsHttpProductCatalog) =>
        process.env.CMS_BASE_URL ? cms : mock,
      inject: [MockProductCatalog, CmsHttpProductCatalog],
    },
    {
      provide: AI_PROVIDER_REGISTRY,
      // Provider that dang ky tai day — them adapter moi thi inject them
      useFactory: (
        registry: DefaultAiProviderRegistry,
        anthropic: AnthropicContentAiProvider,
        gemini: GeminiContentAiProvider,
        openai: OpenAiContentAiProvider,
      ) => {
        registry.register(anthropic);
        registry.register(gemini);
        registry.register(openai);
        return registry;
      },
      inject: [
        DefaultAiProviderRegistry,
        AnthropicContentAiProvider,
        GeminiContentAiProvider,
        OpenAiContentAiProvider,
      ],
    },
  ],
  // DestinationModule tao job diem den qua use case nay (khong goi AI truc tiep)
  exports: [CreateContentJobUseCase],
})
export class AiContentModule {}
