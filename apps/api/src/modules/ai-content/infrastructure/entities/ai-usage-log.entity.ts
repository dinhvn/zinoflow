import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import type { AiProviderKey } from "@zinoflow/contracts";

/**
 * Bang ai_usage_logs — ghi MOI call AI (spec §13): tokens, cost, latency.
 * Day la co so tinh gia von moi bai viet (KPI cost/bai trong delivery plan M5).
 */
@Entity("ai_usage_logs")
export class AiUsageLogEntity {
  @PrimaryColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "job_id", type: "uuid", nullable: true })
  jobId!: string | null;

  @Column({ type: "varchar", length: 20 })
  provider!: AiProviderKey;

  @Column({ type: "varchar", length: 100 })
  model!: string;

  /** "outline" | "section" | "title_variants" — buoc nao trong pipeline. */
  @Column({ type: "varchar", length: 50 })
  operation!: string;

  @Column({ name: "input_tokens", type: "int" })
  inputTokens!: number;

  @Column({ name: "output_tokens", type: "int" })
  outputTokens!: number;

  @Column({ name: "cost_usd", type: "numeric", precision: 12, scale: 6 })
  costUsd!: string; // numeric tra ve string tu pg driver

  @Column({ name: "latency_ms", type: "int" })
  latencyMs!: number;

  @Index()
  @Column({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
