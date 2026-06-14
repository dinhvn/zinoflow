import { GetDashboardSummaryUseCase } from "./get-dashboard-summary.usecase";
import type { ContentJobRepository } from "../../ai-content/application/ports/content-job.repository";
import type { DestinationMirrorRepository } from "../../destination/application/ports/destination-mirror.repository";
import type { CmsPostMirrorRepository } from "../../cms-content/application/ports/cms-post-mirror.repository";
import type { GetAiUsageSummaryUseCase } from "../../ai-content/application/use-cases/get-ai-usage-summary.usecase";

const job = (status: string, topic = "x") => ({
  toSnapshot: () => ({
    id: `${status}-${topic}`,
    topic,
    articleType: "toplist",
    status,
    createdAt: new Date("2026-06-10"),
  }),
});

describe("GetDashboardSummaryUseCase", () => {
  function build(jobs: ReturnType<typeof job>[]) {
    const jobRepo = { findAll: async () => jobs } as unknown as ContentJobRepository;
    const destRepo = { findAll: async () => [] } as unknown as DestinationMirrorRepository;
    const cmsRepo = { findAllBySite: async () => [] } as unknown as CmsPostMirrorRepository;
    const usage = {
      execute: async () => ({
        range: { from: "2026-05-16", to: "2026-06-14" },
        totals: { calls: 5, inputTokens: 0, outputTokens: 0, costUsd: 0.12, avgLatencyMs: 0 },
        byModel: [],
        byOperation: [],
        daily: [{ date: "2026-06-10", calls: 5, costUsd: 0.12 }],
      }),
    } as unknown as GetAiUsageSummaryUseCase;
    return new GetDashboardSummaryUseCase(jobRepo, destRepo, cmsRepo, usage);
  }

  it("dem job theo status + map viec can lam (InReview/Failed/Approved)", async () => {
    const usecase = build([
      job("InReview"),
      job("InReview"),
      job("Failed"),
      job("Approved"),
      job("DraftReady"),
    ]);
    const r = await usecase.execute();

    expect(r.jobs.total).toBe(5);
    expect(r.actions).toEqual({ pendingReview: 2, failed: 1, approved: 1 });
    expect(r.jobs.byStatus.find((s) => s.status === "InReview")?.count).toBe(2);
    expect(r.jobs.byStatus.find((s) => s.status === "Created")?.count).toBe(0);
    expect(r.cost.costUsd).toBe(0.12);
    expect(r.channels.map((c) => c.key)).toEqual(["dichoithoi", "laruki", "dochoi3s"]);
  });

  it("recent gioi han 8 bai", async () => {
    const usecase = build(Array.from({ length: 12 }, (_, i) => job("DraftReady", `t${i}`)));
    const r = await usecase.execute();
    expect(r.jobs.recent).toHaveLength(8);
  });
});
