import { randomUUID } from "node:crypto";
import { UpdateDraftUseCase } from "./update-draft.usecase";
import type { ContentJobRepository } from "../ports/content-job.repository";
import type { ContentDraftRepository, DraftRecord } from "../ports/content-draft.repository";
import { ContentJob } from "../../domain/content-job";

function makeJob(articleType: "guide-diem-den" | "cam-nang", status: "DraftReady" | "Approved" = "DraftReady") {
  const job = ContentJob.create({
    id: randomUUID(),
    siteCode: "dichoithoi",
    sourceType: "Manual",
    sourceRef: "da-lat",
    topic: "Đà Lạt",
    articleType,
    keywordSeed: [],
    toneProfile: null,
    sourceContext: null,
    contentTier: null,
    nodeKind: null,
    comparisonKey: null,
    originalityExcerpt: null,
    coverImageId: null,
    referenceUrls: null,
    category: null,
    aiProvider: "anthropic",
    aiModel: "manual",
  });
  job.transitionTo("DraftReady");
  if (status === "Approved") {
    job.transitionTo("InReview");
    job.transitionTo("Approved");
  }
  return job;
}

function makeRepos(job: ContentJob, latestDraft: DraftRecord) {
  const savedJobs: ContentJob[] = [];
  const savedDrafts: DraftRecord[] = [];
  const jobs: ContentJobRepository = {
    save: async (j) => {
      savedJobs.push(j);
    },
    findById: async (id) => (id === job.id ? job : null),
    findAll: async () => [job],
    findStatusesByIds: async () => new Map([[job.id, job.status]]),
    findLatestBySourceRef: async () => null,
  };
  const drafts: ContentDraftRepository = {
    save: async (d) => {
      savedDrafts.push(d);
    },
    findById: async (id) => (id === latestDraft.id ? latestDraft : null),
    findLatestByJobId: async (jobId) => (jobId === job.id ? latestDraft : null),
    listByJobId: async () => [latestDraft],
  };
  return { jobs, drafts, savedJobs, savedDrafts };
}

const destinationArticle = {
  title: "Đà Lạt: kinh nghiệm du lịch, đi mùa nào, chơi gì, ăn gì 2026",
  intro:
    "Đà Lạt là thành phố ngàn hoa nổi tiếng của Lâm Đồng, nơi khí hậu mát mẻ quanh năm " +
    "thu hút hàng triệu lượt khách. Bài viết tổng hợp kinh nghiệm thực tế cho chuyến đi đầu tiên.",
  quickFacts: {
    openingTime: "Tham quan tự do quanh năm",
    ticketPrice: "Tuỳ điểm tham quan cụ thể (có thể thay đổi)",
    transport: "Từ TP.HCM đi xe khách hoặc máy bay tới sân bay Liên Khương, khoảng 6-7 giờ.",
    food: "Bánh tráng nướng, lẩu gà lá é là món nên thử khi tới đây.",
    hotel: "Khu trung tâm Hoà Bình nhiều homestay, gần chợ đêm.",
    tip: "Mang áo ấm vì buổi tối se lạnh; đặt phòng sớm mùa lễ hội hoa.",
  },
  sections: [
    {
      heading: "Tổng quan về Đà Lạt",
      content: "Đà Lạt được mệnh danh thành phố ngàn hoa với khí hậu ôn đới mát mẻ quanh năm rất dễ chịu.",
      blockKey: "tong-quan",
    },
    {
      heading: "Nên đi Đà Lạt vào mùa nào",
      content: "Mùa khô từ tháng 12 đến tháng 3 trời đẹp nhất, ít mưa, thuận tiện tham quan các điểm ngoài trời.",
      blockKey: "mua-nao",
    },
    {
      heading: "Di chuyển tới Đà Lạt",
      content: "Có thể đi xe khách giường nằm hoặc bay tới sân bay Liên Khương rồi taxi vào trung tâm thành phố.",
      blockKey: "di-chuyen",
    },
  ],
  faq: [
    { question: "Đà Lạt có gì chơi?", answer: "Chợ đêm, hồ Xuân Hương, các vườn hoa nổi tiếng." },
    { question: "Nên đi mấy ngày?", answer: "2-3 ngày là hợp lý cho chuyến đi trọn vẹn." },
    { question: "Đi Đà Lạt tốn bao nhiêu?", answer: "Tuỳ dịch vụ, trung bình 2-3 triệu/người/chuyến ngắn." },
  ],
  metadata: {
    name: "Đà Lạt",
    slugSuggestion: "da-lat",
    metaTitle: "Đà Lạt: kinh nghiệm du lịch, đi mùa nào, chơi gì 2026",
    metaDescription:
      "Kinh nghiệm du lịch Đà Lạt: đi mùa nào đẹp, di chuyển thế nào, ăn gì, ở đâu — tổng hợp chi tiết cho chuyến đi đầu tiên của bạn.",
    description: "Đà Lạt là thành phố ngàn hoa nổi tiếng của Lâm Đồng, khí hậu mát mẻ quanh năm.",
    searchKeyword: "đà lạt, du lịch đà lạt, kinh nghiệm đà lạt",
  },
};

describe("UpdateDraftUseCase — nhanh article (redesign luong viet bai §Phase 2)", () => {
  it("validate article theo schema destination, render lai draftMarkdown dong bo, tang version", async () => {
    const job = makeJob("guide-diem-den");
    const latestDraft: DraftRecord = {
      id: randomUUID(),
      jobId: job.id,
      version: 1,
      title: "cu",
      outline: { title: "cu", sectionHeadings: [] },
      article: null,
      draftMarkdown: "# cu",
      createdAt: new Date(),
    };
    const { jobs, drafts, savedDrafts } = makeRepos(job, latestDraft);
    const usecase = new UpdateDraftUseCase(drafts, jobs);

    const result = await usecase.execute(latestDraft.id, { article: destinationArticle });

    expect(result.version).toBe(2);
    expect(result.title).toBe(destinationArticle.title);
    expect(result.article).toEqual(destinationArticle);
    // draftMarkdown phai duoc render lai TU article (khong con la markdown cu "# cu")
    expect(result.draftMarkdown).toContain("Đà Lạt");
    expect(result.draftMarkdown).not.toBe("# cu");
    expect(savedDrafts).toHaveLength(1);
  });

  it("sua bai da Approved qua nhanh article -> job quay ve InReview", async () => {
    const job = makeJob("guide-diem-den", "Approved");
    const latestDraft: DraftRecord = {
      id: randomUUID(),
      jobId: job.id,
      version: 1,
      title: destinationArticle.title,
      outline: { title: destinationArticle.title, sectionHeadings: [] },
      article: destinationArticle as unknown as DraftRecord["article"],
      draftMarkdown: "# cu",
      createdAt: new Date(),
    };
    const { jobs, drafts, savedJobs } = makeRepos(job, latestDraft);
    const usecase = new UpdateDraftUseCase(drafts, jobs);

    await usecase.execute(latestDraft.id, { article: destinationArticle });

    expect(job.status).toBe("InReview");
    expect(savedJobs).toHaveLength(1);
  });

  it("article khong hop le (thieu field bat buoc) bi tu choi (throw) — khong luu draft rac", async () => {
    const job = makeJob("guide-diem-den");
    const latestDraft: DraftRecord = {
      id: randomUUID(),
      jobId: job.id,
      version: 1,
      title: "cu",
      outline: null,
      article: null,
      draftMarkdown: "# cu",
      createdAt: new Date(),
    };
    const { jobs, drafts } = makeRepos(job, latestDraft);
    const usecase = new UpdateDraftUseCase(drafts, jobs);

    const { intro, ...invalidArticle } = destinationArticle; // thieu intro bat buoc
    void intro;

    await expect(usecase.execute(latestDraft.id, { article: invalidArticle })).rejects.toThrow();
  });
});

describe("UpdateDraftUseCase — nhanh draftMarkdown (hanh vi CU, cam-nang/affiliate)", () => {
  it("giu nguyen hanh vi cu: ghi markdown, khong dong article", async () => {
    const job = makeJob("cam-nang");
    const oldArticle = { title: "Bài cẩm nang cũ" } as unknown as DraftRecord["article"];
    const latestDraft: DraftRecord = {
      id: randomUUID(),
      jobId: job.id,
      version: 1,
      title: "Tiêu đề cũ",
      outline: null,
      article: oldArticle,
      draftMarkdown: "# Tiêu đề cũ\n\nNội dung cũ đủ dài để qua validate của request.",
      createdAt: new Date(),
    };
    const { jobs, drafts } = makeRepos(job, latestDraft);
    const usecase = new UpdateDraftUseCase(drafts, jobs);

    const newMarkdown = "# Tiêu đề mới\n\nNội dung mới đủ dài để qua validate của request markdown.";
    const result = await usecase.execute(latestDraft.id, { draftMarkdown: newMarkdown });

    expect(result.draftMarkdown).toBe(newMarkdown);
    expect(result.title).toBe("Tiêu đề mới");
    expect(result.article).toBe(oldArticle); // article JSON giu nguyen, dung hanh vi cu
  });
});
