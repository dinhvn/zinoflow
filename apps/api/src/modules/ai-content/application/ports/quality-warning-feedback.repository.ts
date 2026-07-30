export const QUALITY_WARNING_FEEDBACK_REPOSITORY = Symbol(
  "QUALITY_WARNING_FEEDBACK_REPOSITORY",
);

export interface QualityWarningFeedbackRecord {
  id: string;
  targetType: "content-job" | "destination";
  targetId: string;
  gateName: string;
  detailHash: string;
  reason: string;
  createdAt: Date;
}

/** Port ghi audit event dismiss warning; event cu khong bi sua/xoa. */
export interface QualityWarningFeedbackRepository {
  create(record: QualityWarningFeedbackRecord): Promise<void>;
}
