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
  /**
   * Job MOI NHAT (theo createdAt) khop siteCode+sourceRef, bat ke con "active"
   * hay khong (publish clear activeContentJobId nhung job/draft van con) — dung
   * de trang detail diem den nap lai goi y AI sau khi retry job da publish
   * (bug 07/2026, xem ghi chu latestContentJobId trong contracts).
   */
  findLatestBySourceRef(siteCode: string, sourceRef: string): Promise<ContentJob | null>;
}
