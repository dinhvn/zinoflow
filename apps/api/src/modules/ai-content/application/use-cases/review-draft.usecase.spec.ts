import { randomUUID } from "node:crypto";
import type { DestinationArticle, QualityCheck } from "@zinoflow/contracts";
import { ReviewDraftUseCase } from "./review-draft.usecase";
import { ContentJob } from "../../domain/content-job";
import type { ContentJobRepository } from "../ports/content-job.repository";
import type { ContentDraftRepository, DraftRecord } from "../ports/content-draft.repository";
import type { QualityResultRepository } from "../ports/quality-result.repository";
import type { ReviewRecordRepository } from "../ports/review-record.repository";
import type { OriginalityCorpusRepository } from "../ports/originality-corpus.repository";
import type { SimilarDestinationExcerpt } from "../../domain/quality-gates/originality-gate";

function makeJob(comparisonKey: string | null = null): ContentJob {
  const job = ContentJob.create({
    id: randomUUID(),
    siteCode: "dichoithoi",
    sourceType: "Topic",
    sourceRef: "da-lat",
    topic: "Đà Lạt",
    articleType: "guide-diem-den",
    keywordSeed: ["Đà Lạt"],
    toneProfile: null,
    sourceContext: null,
    contentTier: null,
    comparisonKey,
    originalityExcerpt: null,
    aiProvider: "anthropic",
    aiModel: "claude-opus-4-8",
  });
  job.transitionTo("DraftReady");
  job.transitionTo("InReview");
  return job;
}

// 18 tu/cau x 12 lan = 216 tu/section x 3 section + mo bai > 800 tu (MIN_TOTAL_WORDS)
// — dung cach dung nhu destination-gates.spec.ts de qua het structure gate.
const longContent = (topic: string): string =>
  `${topic} là điểm dừng chân được nhiều người yêu thích khi ghé thăm khu vực này. `.repeat(14);

const validArticle: DestinationArticle = {
  title: "Đà Lạt: kinh nghiệm du lịch, đi mùa nào, chơi gì, ăn gì 2026",
  intro:
    "Đà Lạt là thành phố ngàn hoa nổi tiếng của Lâm Đồng, nơi khí hậu mát mẻ quanh năm " +
    "thu hút hàng triệu lượt khách. Bài viết tổng hợp kinh nghiệm thực tế cho chuyến đi đầu tiên, " +
    "từ cách di chuyển, chọn thời điểm cho tới các lưu ý cần biết trước khi khởi hành.",
  quickFacts: {
    openingTime: "Tham quan tự do quanh năm",
    ticketPrice: "Tuỳ điểm tham quan cụ thể (có thể thay đổi)",
    transport: "Từ TP.HCM đi xe khách hoặc máy bay tới sân bay Liên Khương, khoảng 6-7 giờ.",
    food: "Bánh tráng nướng, lẩu gà lá é là món nên thử khi tới đây.",
    hotel: "Khu trung tâm Hoà Bình nhiều homestay, gần chợ đêm.",
    tip: "Mang áo ấm vì buổi tối se lạnh; đặt phòng sớm mùa lễ hội hoa.",
  },
  sections: [
    { heading: "Tổng quan về Đà Lạt", content: longContent("Đà Lạt") },
    { heading: "Câu chuyện văn hoá - lịch sử Đà Lạt", content: longContent("Người Pháp xưa") },
    { heading: "Di chuyển tới Đà Lạt", content: longContent("Sân bay Liên Khương") },
  ],
  faq: [
    { question: "Đà Lạt có gì chơi?", answer: "Chợ đêm, hồ Xuân Hương, các vườn hoa nổi tiếng." },
    { question: "Nên đi mấy ngày?", answer: "2-3 ngày là hợp lý cho chuyến đi trọn vẹn." },
    { question: "Đi Đà Lạt tốn bao nhiêu?", answer: "Tuỳ dịch vụ, trung bình 2-3 triệu/người/chuyến ngắn." },
  ],
  updateNotice: "Thông tin trong bài cập nhật tháng 6/2026, giá vé và giờ mở cửa có thể thay đổi.",
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

function buildUseCase(
  job: ContentJob,
  draft: DraftRecord,
  similarTo: readonly SimilarDestinationExcerpt[] = [],
) {
  const savedJobs: ContentJob[] = [];
  let savedChecks: readonly QualityCheck[] = [];

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
    save: async () => {},
    findById: async (id) => (id === draft.id ? draft : null),
    findLatestByJobId: async (jobId) => (jobId === job.id ? draft : null),
    listByJobId: async () => [draft],
  };
  const results: QualityResultRepository = {
    replaceForDraft: async (_draftId, checks) => {
      savedChecks = checks;
    },
    findByDraftId: async () => [...savedChecks],
  };
  const reviews: ReviewRecordRepository = {
    save: async () => {},
    listByJobId: async () => [],
  };
  const originalityCorpus: OriginalityCorpusRepository = {
    findSimilar: async () => [...similarTo],
  };

  const usecase = new ReviewDraftUseCase(drafts, jobs, results, reviews, originalityCorpus);
  return { usecase, savedJobs, getSavedChecks: () => savedChecks };
}

describe("ReviewDraftUseCase — Approve + gate originality (warning khong chan)", () => {
  it("Approve thanh cong khi khong co comparisonKey (gate originality bi bo qua hoan toan)", async () => {
    const job = makeJob(null);
    const draft: DraftRecord = {
      id: randomUUID(),
      jobId: job.id,
      version: 1,
      title: validArticle.title,
      outline: { title: validArticle.title, sectionHeadings: [] },
      article: validArticle,
      draftMarkdown: "# " + validArticle.title,
      createdAt: new Date(),
    };
    const { usecase, savedJobs, getSavedChecks } = buildUseCase(job, draft);

    await usecase.execute(draft.id, { action: "Approve" });

    expect(job.status).toBe("Approved");
    expect(savedJobs).toHaveLength(1);
    expect(getSavedChecks().some((c) => c.gateName === "originality")).toBe(false);
  });

  it("Approve THANH CONG du gate originality fail (similarity vuot nguong) — chi canh bao, khong chan", async () => {
    const job = makeJob("79"); // ma tinh gia lap
    const draft: DraftRecord = {
      id: randomUUID(),
      jobId: job.id,
      version: 1,
      title: validArticle.title,
      outline: { title: validArticle.title, sectionHeadings: [] },
      article: validArticle,
      draftMarkdown: "# " + validArticle.title,
      createdAt: new Date(),
    };
    const { usecase, savedJobs, getSavedChecks } = buildUseCase(job, draft, [
      { slug: "thac-pongour", score: 0.7 },
    ]);

    await usecase.execute(draft.id, { action: "Approve" });

    expect(job.status).toBe("Approved");
    const originalityCheck = getSavedChecks().find((c) => c.gateName === "originality");
    expect(originalityCheck?.passed).toBe(false);
    expect(originalityCheck?.severity).toBe("warning");
    expect(originalityCheck?.details[0]).toContain("thac-pongour");
    // Excerpt duoc ghi lai vao job (lam corpus so sanh cho job sau) sau khi Approve thanh cong
    expect(job.toSnapshot().originalityExcerpt).toContain("Đà Lạt");
    expect(savedJobs).toHaveLength(1);
  });

  it("Approve VAN bi chan khi 1 trong 4 gate loi that (severity error) fail, bat ke gate originality", async () => {
    const job = makeJob("79");
    const invalidArticle: DestinationArticle = { ...validArticle, faq: [] }; // vi pham structure gate (FAQ >= 3)
    const draft: DraftRecord = {
      id: randomUUID(),
      jobId: job.id,
      version: 1,
      title: invalidArticle.title,
      outline: { title: invalidArticle.title, sectionHeadings: [] },
      article: invalidArticle,
      draftMarkdown: "# " + invalidArticle.title,
      createdAt: new Date(),
    };
    const { usecase, savedJobs } = buildUseCase(job, draft, [{ slug: "thac-pongour", score: 0.9 }]);

    await expect(usecase.execute(draft.id, { action: "Approve" })).rejects.toThrow();

    expect(job.status).toBe("InReview"); // khong chuyen sang Approved
    expect(savedJobs).toHaveLength(0);
  });
});
