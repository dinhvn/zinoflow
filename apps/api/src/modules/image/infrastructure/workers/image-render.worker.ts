import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { exportOptionsSchema } from "@zinoflow/contracts";
import { QUEUE_NAMES } from "../../../shared/jobs/job-queue.port";
import { PgBossService } from "../../../shared/jobs/pg-boss.service";
import { RenderImageJobUseCase } from "../../application/use-cases/render-image-job.usecase";

/**
 * Worker consume queue image.render — noi pg-boss voi RenderImageJobUseCase.
 * Toan bo logic render nam o application layer.
 */
@Injectable()
export class ImageRenderWorker implements OnModuleInit {
  private readonly logger = new Logger(ImageRenderWorker.name);

  constructor(
    private readonly pgBoss: PgBossService,
    private readonly renderJob: RenderImageJobUseCase,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.pgBoss.registerWorker(QUEUE_NAMES.imageRender, async (data) => {
      const payload = data as { jobId: string; format?: string; quality?: number; scale?: number };
      const exportOptions = exportOptionsSchema.parse({
        format: payload.format,
        quality: payload.quality,
        scale: payload.scale,
      });
      await this.renderJob.execute(payload.jobId, exportOptions);
    });
  }
}
