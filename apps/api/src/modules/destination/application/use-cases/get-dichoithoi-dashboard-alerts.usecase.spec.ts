import { GetDichoithoiDashboardAlertsUseCase } from "./get-dichoithoi-dashboard-alerts.usecase";
import { GetCoverageScoresUseCase } from "./get-coverage-scores.usecase";
import { ContentJob, type ContentJobProps } from "../../../ai-content/domain/content-job";
import type { ContentJobRepository } from "../../../ai-content/application/ports/content-job.repository";
import type { DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";

function fakeJob(overrides: Partial<ContentJobProps>): ContentJob {
  return ContentJob.restore({
    id: "job-1",
    siteCode: "dichoithoi",
    sourceType: "Topic",
    sourceRef: "cam-nang",
    topic: "Chủ đề",
    articleType: "cam-nang",
    keywordSeed: [],
    toneProfile: null,
    sourceContext: null,
    contentTier: null,
    comparisonKey: null,
    originalityExcerpt: null,
    coverImageId: null,
    referenceUrls: null,
    category: null,
    status: "Created",
    aiProvider: "gemini",
    aiModel: "gemini-2.5-flash",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
    nodeKind: overrides.nodeKind ?? null,
  });
}

describe("GetDichoithoiDashboardAlertsUseCase (destination-spec §7.2, Phase 23)", () => {
  function setup(overrides: {
    jobs?: ContentJob[];
    tags?: Awaited<ReturnType<DichoithoiSiteDb["fetchTags"]>>;
    tagAssignments?: Awaited<ReturnType<DichoithoiSiteDb["fetchTagAssignments"]>>;
    coverageRows?: Awaited<ReturnType<DichoithoiSiteDb["fetchContentCoverageRows"]>>;
    mirrors?: unknown[];
  } = {}) {
    const jobsRepo: ContentJobRepository = {
      save: async () => {},
      findById: async () => null,
      findAll: async () => overrides.jobs ?? [],
      findStatusesByIds: async () => new Map(),
      findLatestBySourceRef: async () => null,
    };
    const siteDb = {
      fetchTags: async () => overrides.tags ?? [],
      fetchTagAssignments: async () => overrides.tagAssignments ?? [],
      fetchContentCoverageRows: async () => overrides.coverageRows ?? [],
      fetchArticleTopicCoverage: async () => [],
    } as unknown as DichoithoiSiteDb;
    const mirrorRepo = { findAll: async () => overrides.mirrors ?? [] } as unknown as ConstructorParameters<
      typeof GetCoverageScoresUseCase
    >[0];
    const coverageScores = new GetCoverageScoresUseCase(mirrorRepo, siteDb);
    const usecase = new GetDichoithoiDashboardAlertsUseCase(jobsRepo, siteDb, coverageScores, mirrorRepo);
    return { usecase };
  }

  it("khong hien muc nao khi moi thu deu on (nguyen tac chi hien count > 0)", async () => {
    const { usecase } = setup();
    const result = await usecase.execute();
    expect(result.alerts).toEqual([]);
    expect(result.coverageHealthPercent).toBe(100);
  });

  it("dem dung draft cho duyet + job loi, CHI cua dichoithoi (bo qua site khac)", async () => {
    const jobs = [
      fakeJob({ id: "a", status: "InReview" }),
      fakeJob({ id: "b", status: "Failed" }),
      fakeJob({ id: "c", siteCode: "laruki", status: "InReview" }),
      fakeJob({ id: "d", status: "DraftReady" }),
    ];
    const { usecase } = setup({ jobs });
    const result = await usecase.execute();

    const pending = result.alerts.find((a) => a.key === "pending-review");
    const failed = result.alerts.find((a) => a.key === "failed-job");
    expect(pending?.count).toBe(1);
    expect(failed?.count).toBe(1);
  });

  it("dem dung tag duoi nguong (< 3 diem gan)", async () => {
    const tags = [
      { id: 1, slug: "hoang-so", name: "Hoang so", description: null, status: 1 },
      { id: 2, slug: "pho-bien", name: "Pho bien", description: null, status: 1 },
    ] as unknown as Awaited<ReturnType<DichoithoiSiteDb["fetchTags"]>>;
    const tagAssignments = [
      { destinationId: 1, destinationSlug: "a", destinationName: "A", tagSlugs: ["hoang-so"] },
      { destinationId: 2, destinationSlug: "b", destinationName: "B", tagSlugs: ["pho-bien"] },
      { destinationId: 3, destinationSlug: "c", destinationName: "C", tagSlugs: ["pho-bien"] },
      { destinationId: 4, destinationSlug: "d", destinationName: "D", tagSlugs: ["pho-bien"] },
    ];
    const { usecase } = setup({ tags, tagAssignments });
    const result = await usecase.execute();

    const underThreshold = result.alerts.find((a) => a.key === "under-threshold-tag");
    expect(underThreshold?.count).toBe(1); // chi "hoang-so" (1 diem) duoi nguong 3
  });

  it("gom ca diem draft (siteId=null) da gan tag qua mirror.tags vao dem nguong", async () => {
    const tags = [
      { id: 1, slug: "hoang-so", name: "Hoang so", description: null, status: 1 },
    ] as unknown as Awaited<ReturnType<DichoithoiSiteDb["fetchTags"]>>;
    const tagAssignments = [
      { destinationId: 1, destinationSlug: "a", destinationName: "A", tagSlugs: ["hoang-so"] },
      { destinationId: 2, destinationSlug: "b", destinationName: "B", tagSlugs: ["hoang-so"] },
    ];
    const mirrors = [
      { kind: "poi", siteId: null, tags: ["hoang-so"] },
      { kind: "cluster", siteId: null, tags: ["hoang-so"] }, // khong phai poi -> khong tinh
    ];
    const { usecase } = setup({ tags, tagAssignments, mirrors });
    const result = await usecase.execute();

    const underThreshold = result.alerts.find((a) => a.key === "under-threshold-tag");
    // 2 (SQL) + 1 (draft poi) = 3, dat nguong -> khong con alert nao
    expect(underThreshold).toBeUndefined();
  });

  it("dem dung diem thieu anh gallery", async () => {
    const coverageRows = [
      { destinationId: 1, hasOpeningTime: true, hasTicketPrice: true, hasFaq: true, hasPracticalNotes: true, hasTicketLinks: true, hasMainContent: true, hasGallery: false, contentUpdatedAt: null, lastVerifiedAt: null },
      { destinationId: 2, hasOpeningTime: true, hasTicketPrice: true, hasFaq: true, hasPracticalNotes: true, hasTicketLinks: true, hasMainContent: true, hasGallery: true, contentUpdatedAt: null, lastVerifiedAt: null },
    ];
    const { usecase } = setup({ coverageRows });
    const result = await usecase.execute();

    const missingGallery = result.alerts.find((a) => a.key === "missing-gallery");
    expect(missingGallery?.count).toBe(1);
  });

  it("dem dung diem chua ra lai noi dung > 5 thang (content-freshness-plan.md Giai doan F)", async () => {
    const now = new Date();
    const recent = new Date(now);
    recent.setMonth(recent.getMonth() - 1);
    const stale = new Date(now);
    stale.setMonth(stale.getMonth() - 6);
    const coverageRows = [
      // moi (ContentUpdatedAt gan day) -> khong tinh
      { destinationId: 1, hasOpeningTime: true, hasTicketPrice: true, hasFaq: true, hasPracticalNotes: true, hasTicketLinks: true, hasMainContent: true, hasGallery: true, contentUpdatedAt: recent, lastVerifiedAt: null },
      // LastVerifiedAt gan day, ContentUpdatedAt cu -> lay moc moi nhat, khong tinh
      { destinationId: 2, hasOpeningTime: true, hasTicketPrice: true, hasFaq: true, hasPracticalNotes: true, hasTicketLinks: true, hasMainContent: true, hasGallery: true, contentUpdatedAt: stale, lastVerifiedAt: recent },
      // ca 2 deu cu hon 5 thang -> tinh
      { destinationId: 3, hasOpeningTime: true, hasTicketPrice: true, hasFaq: true, hasPracticalNotes: true, hasTicketLinks: true, hasMainContent: true, hasGallery: true, contentUpdatedAt: stale, lastVerifiedAt: null },
      // ca 2 deu null (chua tung qua co che moi) -> tinh
      { destinationId: 4, hasOpeningTime: true, hasTicketPrice: true, hasFaq: true, hasPracticalNotes: true, hasTicketLinks: true, hasMainContent: true, hasGallery: true, contentUpdatedAt: null, lastVerifiedAt: null },
    ];
    const { usecase } = setup({ coverageRows });
    const result = await usecase.execute();

    const staleContent = result.alerts.find((a) => a.key === "stale-content");
    expect(staleContent?.count).toBe(2);
  });

  it("dem dung cum/diem thieu toa do, bo qua tinh", async () => {
    const mirrors = [
      { kind: "cluster", siteId: 1, tags: [], lat: null, lng: null },
      { kind: "poi", siteId: 1, tags: [], lat: "11.94", lng: "108.44" },
      { kind: "poi", siteId: null, tags: [], lat: null, lng: "108.44" },
      { kind: "province", siteId: 1, tags: [], lat: null, lng: null }, // tinh -> bo qua
    ];
    const { usecase } = setup({ mirrors });
    const result = await usecase.execute();

    const missingCoords = result.alerts.find((a) => a.key === "missing-coords");
    expect(missingCoords?.count).toBe(2);
    expect(missingCoords?.href).toBe("/dichoithoi?missingCoords=true");
  });
});
