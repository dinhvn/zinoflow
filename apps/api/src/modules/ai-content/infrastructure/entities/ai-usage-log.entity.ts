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

  /** Prompt day du (system + user) da gui cho AI — de debug/audit (07/2026, xem dichoithoi-backlog). */
  @Column({ name: "prompt_text", type: "text", nullable: true })
  promptText!: string | null;

  /** Response tho (JSON structured output) AI tra ve — cung muc dich voi promptText. */
  @Column({ name: "response_text", type: "text", nullable: true })
  responseText!: string | null;

  @Column({ name: "prompt_key", type: "varchar", length: 100, nullable: true })
  promptKey!: string | null;

  @Column({ name: "prompt_version", type: "int", nullable: true })
  promptVersion!: number | null;

  @Column({
    name: "prompt_source",
    type: "varchar",
    length: 16,
    nullable: true,
  })
  promptSource!: string | null;

  @Column({
    name: "source_context_hash",
    type: "varchar",
    length: 64,
    nullable: true,
  })
  sourceContextHash!: string | null;

  @Index()
  @Column({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
