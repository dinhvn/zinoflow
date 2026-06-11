import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ContentController } from "./presentation/content.controller";
import { CreateContentJobUseCase } from "./application/use-cases/create-content-job.usecase";
import { GenerateContentUseCase } from "./application/use-cases/generate-content.usecase";
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
    ContentGenerateWorker,
    StubContentAiProvider,
    AnthropicContentAiProvider,
    GeminiContentAiProvider,
    DefaultAiProviderRegistry,
    { provide: CONTENT_JOB_REPOSITORY, useClass: TypeOrmContentJobRepository },
    { provide: CONTENT_DRAFT_REPOSITORY, useClass: TypeOrmContentDraftRepository },
    { provide: AI_USAGE_RECORDER, useClass: TypeOrmAiUsageRecorder },
    { provide: AI_PROVIDER_SETTINGS, useClass: TypeOrmAiProviderSettings },
    {
      provide: AI_PROVIDER_REGISTRY,
      // Provider that dang ky tai day — them OpenAI adapter thi inject them
      useFactory: (
        registry: DefaultAiProviderRegistry,
        anthropic: AnthropicContentAiProvider,
        gemini: GeminiContentAiProvider,
      ) => {
        registry.register(anthropic);
        registry.register(gemini);
        return registry;
      },
      inject: [DefaultAiProviderRegistry, AnthropicContentAiProvider, GeminiContentAiProvider],
    },
  ],
})
export class AiContentModule {}
