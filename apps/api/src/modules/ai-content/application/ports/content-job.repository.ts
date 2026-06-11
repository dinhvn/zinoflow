import type { ContentJob } from "../../domain/content-job";

/**
 * Port persistence cho content job. Day 2: InMemoryContentJobRepository.
 * Day 3 thay bang TypeOrmContentJobRepository — use case khong doi 1 dong nao.
 */
export const CONTENT_JOB_REPOSITORY = Symbol("CONTENT_JOB_REPOSITORY");

export interface ContentJobRepository {
  save(job: ContentJob): Promise<void>;
  findById(id: string): Promise<ContentJob | null>;
  findAll(): Promise<ContentJob[]>;
}
