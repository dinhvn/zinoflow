import type {
  AiUsageDailyStat,
  AiUsageLogEntry,
  AiUsageModelStat,
  AiUsageOperationStat,
  AiUsageTotals,
} from "@zinoflow/contracts";

/** Port doc/tong hop ai_usage_logs cho man dashboard chi phi (/usage). */
export const AI_USAGE_READER = Symbol("AI_USAGE_READER");

export interface AiUsageSummaryData {
  totals: AiUsageTotals;
  byModel: AiUsageModelStat[];
  byOperation: AiUsageOperationStat[];
  daily: AiUsageDailyStat[];
}

export interface AiUsageReader {
  /** Tong hop trong khoang [from, to] (from <= createdAt < toExclusive). */
  summarize(from: Date, toExclusive: Date): Promise<AiUsageSummaryData>;
  /** Tat ca lan goi AI (kem prompt/response tho) cua 1 job, cu nhat truoc. */
  listByJobId(jobId: string): Promise<AiUsageLogEntry[]>;
}
