import { GetAiUsageSummaryUseCase } from "./get-ai-usage-summary.usecase";
import type { AiUsageReader, AiUsageSummaryData } from "../ports/ai-usage-reader.port";

const EMPTY: AiUsageSummaryData = {
  totals: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, avgLatencyMs: 0 },
  byModel: [],
  byOperation: [],
  daily: [],
};

describe("GetAiUsageSummaryUseCase", () => {
  function setup() {
    const calls: Array<{ from: Date; to: Date }> = [];
    const reader: AiUsageReader = {
      summarize: async (from, to) => {
        calls.push({ from, to });
        return EMPTY;
      },
      listByJobId: async () => [],
    };
    return { usecase: new GetAiUsageSummaryUseCase(reader), calls };
  }

  it("to bao gom tron ngay (toExclusive = to + 1 ngay)", async () => {
    const { usecase, calls } = setup();
    const res = await usecase.execute({ from: "2026-06-01", to: "2026-06-10" });
    expect(res.range).toEqual({ from: "2026-06-01", to: "2026-06-10" });
    expect(calls[0]!.from.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(calls[0]!.to.toISOString()).toBe("2026-06-11T00:00:00.000Z");
  });

  it("khong loc -> mac dinh 30 ngay gan nhat (from = to - 29 ngay)", async () => {
    const { usecase, calls } = setup();
    const res = await usecase.execute({ to: "2026-06-30" });
    expect(res.range.to).toBe("2026-06-30");
    expect(res.range.from).toBe("2026-06-01"); // 30 ngay tron: 01..30
    expect(calls[0]!.from.toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });
});
