import { Injectable, OnModuleInit } from "@nestjs/common";
import { QUEUE_NAMES } from "../../../shared/jobs/job-queue.port";
import { PgBossService } from "../../../shared/jobs/pg-boss.service";
import { GenerateContentUseCase } from "../../application/use-cases/generate-content.usecase";

/**
 * Worker consume queue content.generate — chi la lop noi pg-boss voi use case.
 * Toan bo logic generation nam trong GenerateContentUseCase (application layer).
 */
@Injectable()
export class ContentGenerateWorker implements OnModuleInit {
  constructor(
    private readonly pgBoss: PgBossService,
    private readonly generateContent: GenerateContentUseCase,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.pgBoss.registerWorker(QUEUE_NAMES.contentGenerate, async (data) => {
      const { contentJobId } = data as { contentJobId: string };
      await this.generateContent.execute(contentJobId);
    });
  }
}
