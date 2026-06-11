import { Injectable } from "@nestjs/common";
import { ContentJob } from "../../domain/content-job";
import type { ContentJobRepository } from "../../application/ports/content-job.repository";

/**
 * Repo tam cho Day 2 (mat data khi restart). Day 3 thay bang TypeORM repo —
 * giu nguyen interface ContentJobRepository.
 */
@Injectable()
export class InMemoryContentJobRepository implements ContentJobRepository {
  private readonly jobs = new Map<string, ContentJob>();

  async save(job: ContentJob): Promise<void> {
    this.jobs.set(job.id, job);
  }

  async findById(id: string): Promise<ContentJob | null> {
    return this.jobs.get(id) ?? null;
  }

  async findAll(): Promise<ContentJob[]> {
    return [...this.jobs.values()];
  }
}
