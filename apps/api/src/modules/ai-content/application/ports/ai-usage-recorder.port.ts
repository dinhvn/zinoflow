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
  /** Prompt day du (system + user) da gui cho AI — de debug/audit, hien tren UI content draft. */
  promptText?: string | null;
  /** Response tho (structured output JSON) AI tra ve. */
  responseText?: string | null;
  promptKey?: string | null;
  promptVersion?: number | null;
  promptSource?: "db" | "default" | null;
  sourceContextHash?: string | null;
}

export interface AiUsageRecorder {
  record(entry: AiUsageEntry): Promise<void>;
}
