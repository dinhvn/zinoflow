import { Inject, Injectable } from "@nestjs/common";
import type { AiUsageSummaryQuery, AiUsageSummaryResponse } from "@zinoflow/contracts";
import { AI_USAGE_READER, type AiUsageReader } from "../ports/ai-usage-reader.port";

const DEFAULT_RANGE_DAYS = 30;

/** Tong hop chi phi AI cho man /usage — mac dinh 30 ngay gan nhat neu khong loc. */
@Injectable()
export class GetAiUsageSummaryUseCase {
  constructor(@Inject(AI_USAGE_READER) private readonly reader: AiUsageReader) {}

  async execute(query: AiUsageSummaryQuery): Promise<AiUsageSummaryResponse> {
    const { from, toExclusive, fromLabel, toLabel } = resolveRange(query);
    const data = await this.reader.summarize(from, toExclusive);
    return { range: { from: fromLabel, to: toLabel }, ...data };
  }
}

/** from <= createdAt < toExclusive (to bao gom tron ngay 'to'). */
function resolveRange(query: AiUsageSummaryQuery): {
  from: Date;
  toExclusive: Date;
  fromLabel: string;
  toLabel: string;
} {
  const toLabel = query.to ?? toDateLabel(new Date());
  const toDay = new Date(`${toLabel}T00:00:00.000Z`);
  const toExclusive = new Date(toDay.getTime() + 24 * 60 * 60 * 1000);

  const fromLabel =
    query.from ?? toDateLabel(new Date(toDay.getTime() - (DEFAULT_RANGE_DAYS - 1) * 24 * 60 * 60 * 1000));
  const from = new Date(`${fromLabel}T00:00:00.000Z`);

  return { from, toExclusive, fromLabel, toLabel };
}

function toDateLabel(d: Date): string {
  return d.toISOString().slice(0, 10);
}
