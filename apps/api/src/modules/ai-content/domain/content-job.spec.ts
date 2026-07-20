import type { ContentJobStatus } from "@zinoflow/contracts";
import { ContentJob, type ContentJobProps } from "./content-job";
import { DomainRuleError } from "../../shared/errors/app-error";

function makeJob(status: ContentJobStatus): ContentJob {
  const props: ContentJobProps = {
    id: "11111111-1111-1111-1111-111111111111",
    siteCode: "laruki",
    sourceType: "Topic",
    sourceRef: "manual",
    topic: "Chủ đề cũ",
    articleType: "toplist",
    keywordSeed: ["cũ"],
    toneProfile: null,
    sourceContext: null,
    contentTier: null,
    comparisonKey: null,
    originalityExcerpt: null,
    coverImageId: null,
    status,
    aiProvider: "anthropic",
    aiModel: "claude-opus-4-8",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  return ContentJob.restore(props);
}

describe("ContentJob.updateGenerationParams", () => {
  it("cập nhật topic/keyword/provider/model khi job Failed", () => {
    const job = makeJob("Failed");
    job.updateGenerationParams({
      topic: "Chủ đề mới đầy đủ",
      keywordSeed: ["a", "b"],
      aiProvider: "gemini",
      aiModel: "gemini-2.5-pro",
    });
    const s = job.toSnapshot();
    expect(s.topic).toBe("Chủ đề mới đầy đủ");
    expect(s.keywordSeed).toEqual(["a", "b"]);
    expect(s.aiProvider).toBe("gemini");
    expect(s.aiModel).toBe("gemini-2.5-pro");
  });

  it("chỉ ghi đè field có trong input (undefined = giữ nguyên)", () => {
    const job = makeJob("DraftReady");
    job.updateGenerationParams({ aiModel: "claude-haiku-4-5" });
    const s = job.toSnapshot();
    expect(s.aiModel).toBe("claude-haiku-4-5");
    expect(s.topic).toBe("Chủ đề cũ"); // khong doi
    expect(s.aiProvider).toBe("anthropic");
  });

  it.each(["Failed", "DraftReady"] as const)("cho phép sửa khi job %s", (status) => {
    expect(() => makeJob(status).updateGenerationParams({ topic: "abcdef" })).not.toThrow();
  });

  it.each(["Created", "GeneratingOutline", "InReview", "Approved", "Rejected"] as const)(
    "chặn sửa khi job %s (DomainRuleError)",
    (status) => {
      expect(() => makeJob(status).updateGenerationParams({ topic: "abcdef" })).toThrow(
        DomainRuleError,
      );
    },
  );
});
