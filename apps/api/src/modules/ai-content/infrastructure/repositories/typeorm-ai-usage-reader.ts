import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type {
  AiUsageReader,
  AiUsageSummaryData,
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
    const range = (qb: ReturnType<Repository<AiUsageLogEntity>["createQueryBuilder"]>) =>
      qb.where("u.created_at >= :from", { from }).andWhere("u.created_at < :to", { to: toExclusive });

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
      .orderBy("\"costUsd\"", "DESC")
      .getRawMany<Record<string, string>>();

    const byOperationRows = await range(this.repo.createQueryBuilder("u"))
      .select("u.operation", "operation")
      .addSelect("COUNT(*)", "calls")
      .addSelect("COALESCE(SUM(u.cost_usd),0)", "costUsd")
      .groupBy("u.operation")
      .orderBy("\"costUsd\"", "DESC")
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
}
