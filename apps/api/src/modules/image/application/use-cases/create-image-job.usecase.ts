import { Inject, Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import type { CreateImageJobRequest, CreateImageJobResponse } from "@zinoflow/contracts";
import { ValidationError } from "../../../shared/errors/app-error";
import { JOB_QUEUE, QUEUE_NAMES, type JobQueue } from "../../../shared/jobs/job-queue.port";
import { IMAGE_JOB_REPOSITORY, type ImageJobRepository } from "../ports/image-job.repository";

/**
 * Buoc 5: tao job render batch — luu job + items roi day vao pg-boss (spec §9, §11).
 * NEVER render inline trong request handler (CLAUDE.md §3) — chi enqueue.
 */
@Injectable()
export class CreateImageJobUseCase {
  constructor(
    @Inject(IMAGE_JOB_REPOSITORY) private readonly repo: ImageJobRepository,
    @Inject(JOB_QUEUE) private readonly jobQueue: JobQueue,
  ) {}

  async execute(request: CreateImageJobRequest): Promise<CreateImageJobResponse> {
    const first = request.items[0];
    if (!first) throw new ValidationError("items rong");

    const jobId = uuidv4();
    const items = request.items.map((props, index) => ({ id: uuidv4(), index, props }));

    await this.repo.create({
      id: jobId,
      aspect: first.aspect,
      perImage: first.perImage,
      totalItems: request.items.length,
      exportFormat: request.exportOptions.format,
      exportQuality: request.exportOptions.quality,
      exportScale: request.exportOptions.scale,
      items,
    });

    await this.jobQueue.send(QUEUE_NAMES.imageRender, {
      jobId,
      format: request.exportOptions.format,
      quality: request.exportOptions.quality,
      scale: request.exportOptions.scale,
    });

    return { jobId, status: "Created", totalItems: request.items.length };
  }
}
