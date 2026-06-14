import { Inject, Injectable } from "@nestjs/common";
import {
  KHUYENMAI_SITE_ID,
  type ContentJobStatus,
  type DashboardSummaryResponse,
} from "@zinoflow/contracts";
import {
  CONTENT_JOB_REPOSITORY,
  type ContentJobRepository,
} from "../../ai-content/application/ports/content-job.repository";
import { GetAiUsageSummaryUseCase } from "../../ai-content/application/use-cases/get-ai-usage-summary.usecase";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../../destination/application/ports/destination-mirror.repository";
import { deriveContentState } from "../../destination/domain/destination-mirror";
import {
  CMS_POST_MIRROR_REPOSITORY,
  type CmsPostMirrorRepository,
} from "../../cms-content/application/ports/cms-post-mirror.repository";
import { deriveCmsContentState } from "../../cms-content/domain/cms-post";

const JOB_STATUSES: ContentJobStatus[] = [
  "Created",
  "GeneratingOutline",
  "DraftReady",
  "InReview",
  "Approved",
  "Rejected",
  "Failed",
];

const RECENT_JOB_LIMIT = 8;

/**
 * Tong hop du lieu trang chu (1 endpoint). Gom in-memory tu cac repository (quy mo
 * local-first nho): job pipeline, viec can lam, tien do theo kenh, chi phi AI.
 */
@Injectable()
export class GetDashboardSummaryUseCase {
  constructor(
    @Inject(CONTENT_JOB_REPOSITORY) private readonly jobs: ContentJobRepository,
    @Inject(DESTINATION_MIRROR_REPOSITORY) private readonly destinations: DestinationMirrorRepository,
    @Inject(CMS_POST_MIRROR_REPOSITORY) private readonly cmsPosts: CmsPostMirrorRepository,
    private readonly usageSummary: GetAiUsageSummaryUseCase,
  ) {}

  async execute(): Promise<DashboardSummaryResponse> {
    const allJobs = (await this.jobs.findAll()).map((j) => j.toSnapshot());

    const statusCount = (s: ContentJobStatus) => allJobs.filter((j) => j.status === s).length;
    const byStatus = JOB_STATUSES.map((status) => ({ status, count: statusCount(status) }));

    const recent = [...allJobs]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, RECENT_JOB_LIMIT)
      .map((j) => ({
        id: j.id,
        topic: j.topic,
        articleType: j.articleType,
        status: j.status,
        createdAt: j.createdAt.toISOString(),
      }));

    const channels = await this.buildChannels();
    const usage = await this.usageSummary.execute({});

    return {
      generatedAt: new Date().toISOString(),
      jobs: { total: allJobs.length, byStatus, recent },
      actions: {
        pendingReview: statusCount("InReview"),
        failed: statusCount("Failed"),
        approved: statusCount("Approved"),
      },
      channels,
      cost: {
        costUsd: usage.totals.costUsd,
        calls: usage.totals.calls,
        from: usage.range.from,
        to: usage.range.to,
        daily: usage.daily.map((d) => ({ date: d.date, costUsd: d.costUsd })),
      },
      system: { database: "connected" },
    };
  }

  private async buildChannels(): Promise<DashboardSummaryResponse["channels"]> {
    // Dichoithoi (diem den) — derive state tu mirror
    const dests = await this.destinations.findAll();
    const destState = (key: string) =>
      dests.filter(
        (d) =>
          deriveContentState({
            activeContentJobId: d.activeContentJobId,
            contentSource: d.contentSource,
            contentHash: d.contentHash,
          }) === key,
      ).length;

    const dichoithoi = {
      key: "dichoithoi" as const,
      label: "Dichoithoi (điểm đến)",
      total: dests.length,
      href: "/dichoithoi",
      states: [
        { key: "chua-co-bai", label: "Chưa có bài", count: destState("chua-co-bai") },
        { key: "bai-tay", label: "Bài tay", count: destState("bai-tay") },
        { key: "dang-soan", label: "Đang soạn", count: destState("dang-soan") },
        { key: "da-publish", label: "Đã đăng", count: destState("da-publish") },
      ],
    };

    const laruki = await this.cmsChannel("laruki", "Laruki", KHUYENMAI_SITE_ID.laruki);
    const dochoi3s = await this.cmsChannel("dochoi3s", "Dochoi3s", KHUYENMAI_SITE_ID.dochoi3s);

    return [dichoithoi, laruki, dochoi3s];
  }

  private async cmsChannel(
    key: "laruki" | "dochoi3s",
    label: string,
    siteId: number,
  ): Promise<DashboardSummaryResponse["channels"][number]> {
    const rows = await this.cmsPosts.findAllBySite(siteId);
    const stateCount = (s: string) =>
      rows.filter(
        (r) =>
          deriveCmsContentState({
            activeContentJobId: r.activeContentJobId,
            aiContentWrittenAt: r.aiContentWrittenAt,
            datePublished: r.datePublished,
          }) === s,
      ).length;

    return {
      key,
      label,
      total: rows.length,
      href: `/${key}`,
      states: [
        { key: "chua-co-bai", label: "Chưa có bài", count: stateCount("chua-co-bai") },
        { key: "dang-soan", label: "Đang soạn", count: stateCount("dang-soan") },
        { key: "da-ghi-cms", label: "Đã ghi CMS", count: stateCount("da-ghi-cms") },
        { key: "da-publish", label: "Đã đăng", count: stateCount("da-publish") },
      ],
    };
  }
}
