import type {
  AiUsageDailyStat,
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
}
