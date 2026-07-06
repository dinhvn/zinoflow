import type { ContentJobStatus } from "@zinoflow/contracts";
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
  /**
   * Lay status cua nhieu job trong 1 query (tranh N+1 khi list diem den can suy
   * trang thai bai). Chi tra status — khong nan ca domain object cho nhe.
   */
  findStatusesByIds(ids: string[]): Promise<Map<string, ContentJobStatus>>;
}
