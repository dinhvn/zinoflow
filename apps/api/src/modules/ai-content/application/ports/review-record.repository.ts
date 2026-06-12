import type { ReviewAction } from "@zinoflow/contracts";

/** Port luu lich su review (bang content_review_records) — spec §4.1 ReviewRecord. */
export const REVIEW_RECORD_REPOSITORY = Symbol("REVIEW_RECORD_REPOSITORY");

export interface ReviewRecordEntry {
  id: string;
  draftId: string;
  action: ReviewAction;
  note: string | null;
  actor: string;
  createdAt: Date;
}

export interface ReviewRecordRepository {
  save(record: ReviewRecordEntry): Promise<void>;
  /** Lich su review cua MOI version draft thuoc job, moi nhat truoc. */
  listByJobId(jobId: string): Promise<Array<ReviewRecordEntry & { draftVersion: number }>>;
}
