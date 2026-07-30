import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { AiUsageLogEntry, AiUsageLogRow } from "@zinoflow/contracts";
import type {
  AiUsageReader,
  AiUsageSummaryData,
  ListAiUsageLogsFilter,
} from "../../application/ports/ai-usage-reader.port";
import { AiUsageLogEntity } from "../entities/ai-usage-log.entity";

/**
 * Tong hop ai_usage_logs bang SQL aggregate (SUM/COUNT/AVG, gop theo cot).
 * cost_usd la numeric -> pg driver tra string; parseFloat ve number cho contracts.
 */
@Injectable()
export class TypeOrmAiUsageReader implements AiUsageReader {
  constructor(
    @InjectRepository(AiUsageLogEntity)
    private readonly repo: Repository<AiUsageLogEntity>,
  ) {}

  async summarize(from: Date, toExclusive: Date): Promise<AiUsageSummaryData> {
    const range = (
      qb: ReturnType<Repository<AiUsageLogEntity>["createQueryBuilder"]>,
    ) =>
      qb
        .where("u.created_at >= :from", { from })
        .andWhere("u.created_at < :to", { to: toExclusive });

    const totalsRow = await range(this.repo.createQueryBuilder("u"))
      .select("COUNT(*)", "calls")
      .addSelect("COALESCE(SUM(u.input_tokens),0)", "inputTokens")
      .addSelect("COALESCE(SUM(u.output_tokens),0)", "outputTokens")
      .addSelect("COALESCE(SUM(u.cost_usd),0)", "costUsd")
      .addSelect("COALESCE(AVG(u.latency_ms),0)", "avgLatencyMs")
      .getRawOne<{
        calls: string;
        inputTokens: string;
        outputTokens: string;
        costUsd: string;
        avgLatencyMs: string;
      }>();

    const byModelRows = await range(this.repo.createQueryBuilder("u"))
      .select("u.provider", "provider")
      .addSelect("u.model", "model")
      .addSelect("COUNT(*)", "calls")
      .addSelect("COALESCE(SUM(u.input_tokens),0)", "inputTokens")
      .addSelect("COALESCE(SUM(u.output_tokens),0)", "outputTokens")
      .addSelect("COALESCE(SUM(u.cost_usd),0)", "costUsd")
      .groupBy("u.provider")
      .addGroupBy("u.model")
      .orderBy('"costUsd"', "DESC")
      .getRawMany<Record<string, string>>();

    const byOperationRows = await range(this.repo.createQueryBuilder("u"))
      .select("u.operation", "operation")
      .addSelect("COUNT(*)", "calls")
      .addSelect("COALESCE(SUM(u.cost_usd),0)", "costUsd")
      .groupBy("u.operation")
      .orderBy('"costUsd"', "DESC")
      .getRawMany<Record<string, string>>();

    const dailyRows = await range(this.repo.createQueryBuilder("u"))
      .select("to_char(u.created_at, 'YYYY-MM-DD')", "date")
      .addSelect("COUNT(*)", "calls")
      .addSelect("COALESCE(SUM(u.cost_usd),0)", "costUsd")
      .groupBy("date")
      .orderBy("date", "ASC")
      .getRawMany<Record<string, string>>();

    return {
      totals: {
        calls: Number(totalsRow?.calls ?? 0),
        inputTokens: Number(totalsRow?.inputTokens ?? 0),
        outputTokens: Number(totalsRow?.outputTokens ?? 0),
        costUsd: Number(totalsRow?.costUsd ?? 0),
        avgLatencyMs: Math.round(Number(totalsRow?.avgLatencyMs ?? 0)),
      },
      byModel: byModelRows.map((r) => ({
        provider: r.provider ?? "",
        model: r.model ?? "",
        calls: Number(r.calls),
        inputTokens: Number(r.inputTokens),
        outputTokens: Number(r.outputTokens),
        costUsd: Number(r.costUsd),
      })),
      byOperation: byOperationRows.map((r) => ({
        operation: r.operation ?? "",
        calls: Number(r.calls),
        costUsd: Number(r.costUsd),
      })),
      daily: dailyRows.map((r) => ({
        date: r.date ?? "",
        calls: Number(r.calls),
        costUsd: Number(r.costUsd),
      })),
    };
  }

  async listByJobId(jobId: string): Promise<AiUsageLogEntry[]> {
    const rows = await this.repo.find({
      where: { jobId },
      order: { createdAt: "ASC" },
    });
    return rows.map((r) => ({
      id: r.id,
      operation: r.operation,
      provider: r.provider,
      model: r.model,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      costUsd: Number(r.costUsd),
      latencyMs: r.latencyMs,
      promptText: r.promptText,
      responseText: r.responseText,
      promptKey: r.promptKey,
      promptVersion: r.promptVersion,
      promptSource: r.promptSource as "db" | "default" | null,
      sourceContextHash: r.sourceContextHash,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async listRecent(
    filter: ListAiUsageLogsFilter,
  ): Promise<{ rows: AiUsageLogRow[]; total: number; operations: string[] }> {
    let qb = this.repo.createQueryBuilder("u").orderBy("u.created_at", "DESC");
    if (filter.provider)
      qb = qb.andWhere("u.provider = :provider", { provider: filter.provider });
    if (filter.operation)
      qb = qb.andWhere("u.operation = :operation", {
        operation: filter.operation,
      });
    if (filter.from)
      qb = qb.andWhere("u.created_at >= :from", { from: filter.from });
    if (filter.to) qb = qb.andWhere("u.created_at < :to", { to: filter.to });

    const [entities, total] = await qb
      .skip((filter.page - 1) * filter.limit)
      .take(filter.limit)
      .getManyAndCount();

    const operationRows = await this.repo
      .createQueryBuilder("u")
      .select("DISTINCT u.operation", "operation")
      .orderBy("u.operation", "ASC")
      .getRawMany<{ operation: string }>();

    return {
      rows: entities.map((r) => ({
        id: r.id,
        jobId: r.jobId,
        operation: r.operation,
        provider: r.provider,
        model: r.model,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        costUsd: Number(r.costUsd),
        latencyMs: r.latencyMs,
        promptText: r.promptText,
        responseText: r.responseText,
        promptKey: r.promptKey,
        promptVersion: r.promptVersion,
        promptSource: r.promptSource as "db" | "default" | null,
        sourceContextHash: r.sourceContextHash,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      operations: operationRows.map((r) => r.operation),
    };
  }
}
