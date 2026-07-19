import { Injectable } from "@nestjs/common";
import type { ContentJobStatus } from "@zinoflow/contracts";
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

  async findStatusesByIds(ids: string[]): Promise<Map<string, ContentJobStatus>> {
    const result = new Map<string, ContentJobStatus>();
    for (const id of ids) {
      const job = this.jobs.get(id);
      if (job) result.set(id, job.toSnapshot().status);
    }
    return result;
  }

  async findLatestBySourceRef(siteCode: string, sourceRef: string): Promise<ContentJob | null> {
    const matches = [...this.jobs.values()]
      .filter((j) => {
        const s = j.toSnapshot();
        return s.siteCode === siteCode && s.sourceRef === sourceRef;
      })
      .sort((a, b) => b.toSnapshot().createdAt.getTime() - a.toSnapshot().createdAt.getTime());
    return matches[0] ?? null;
  }
}
