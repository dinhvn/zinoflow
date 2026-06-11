import type { AiProviderKey } from "@zinoflow/contracts";
import type { AiCallUsage } from "./content-ai-provider.port";

/** Port ghi ai_usage_logs — MOI call AI deu phai di qua day (spec §13). */
export const AI_USAGE_RECORDER = Symbol("AI_USAGE_RECORDER");

export interface AiUsageEntry extends AiCallUsage {
  jobId: string | null;
  provider: AiProviderKey | "stub";
  model: string;
  /** Buoc nao trong pipeline: "outline" | "article" | "section" | ... */
  operation: string;
}

export interface AiUsageRecorder {
  record(entry: AiUsageEntry): Promise<void>;
}
