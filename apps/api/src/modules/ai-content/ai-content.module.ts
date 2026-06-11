import { Module } from "@nestjs/common";
import { ContentController } from "./presentation/content.controller";
import { CreateContentJobUseCase } from "./application/use-cases/create-content-job.usecase";
import { CONTENT_JOB_REPOSITORY } from "./application/ports/content-job.repository";
import { InMemoryContentJobRepository } from "./infrastructure/repositories/in-memory-content-job.repository";
import { ContentGenerateWorker } from "./infrastructure/workers/content-generate.worker";

@Module({
  controllers: [ContentController],
  providers: [
    CreateContentJobUseCase,
    ContentGenerateWorker,
    // Day 3: doi useClass sang TypeOrmContentJobRepository
    { provide: CONTENT_JOB_REPOSITORY, useClass: InMemoryContentJobRepository },
  ],
})
export class AiContentModule {}
