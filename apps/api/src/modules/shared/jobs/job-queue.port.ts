/**
 * Port cho job queue — application layer chi biet interface nay,
 * khong biet pg-boss (dependency rule). Implementation: PgBossService.
 */
export const JOB_QUEUE = Symbol("JOB_QUEUE");

export interface JobQueue {
  /**
   * Day 1 job vao queue. Tra ve jobId, hoac null neu queue chua san sang
   * (vd: DATABASE_URL chua cau hinh) — caller tu quyet dinh fail hay bo qua.
   */
  send(queueName: string, data: object): Promise<string | null>;
}

/** Ten cac queue trong he thong — khai bao tap trung de tranh typo. */
export const QUEUE_NAMES = {
  systemPing: "system.ping",
  contentGenerate: "content.generate",
  imageRender: "image.render",
  hotelAutoAssign: "hotel.auto-assign",
  hotelImageIngest: "hotel.image-ingest",
  tourImageIngest: "tour.image-ingest",
  destinationRelink: "destination.relink",
  affiliateReapply: "affiliate.reapply",
} as const;
