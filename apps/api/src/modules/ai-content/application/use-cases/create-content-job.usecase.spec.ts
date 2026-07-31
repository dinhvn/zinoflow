import { CreateContentJobUseCase } from "./create-content-job.usecase";
import type { ContentJob } from "../../domain/content-job";
import type { ContentJobRepository } from "../ports/content-job.repository";
import type { AiProviderSettings } from "../ports/ai-provider-settings.port";
import type { JobQueue } from "../../../shared/jobs/job-queue.port";
import type { CreateContentJobRequest } from "@zinoflow/contracts";

function buildUseCase() {
  const savedJobs: ContentJob[] = [];
  const queued: Array<{ queueName: string; data: object }> = [];
  const repository: ContentJobRepository = {
    save: async (job) => {
      savedJobs.push(job);
    },
    findById: async () => null,
    findAll: async () => [],
    findStatusesByIds: async () => new Map(),
    findLatestBySourceRef: async () => null,
  };
  const jobQueue: JobQueue = {
    send: async (queueName, data) => {
      queued.push({ queueName, data });
      return "queue-msg-1";
    },
  };
  const providerSettings: AiProviderSettings = {
    isEnabled: async () => true,
    setEnabled: async () => {},
    getAll: async () => ({}),
  };
  const usecase = new CreateContentJobUseCase(repository, jobQueue, providerSettings);
  return { usecase, savedJobs, queued };
}

const baseRequest: CreateContentJobRequest = {
  siteCode: "dichoithoi",
  sourceType: "Topic",
  sourceRef: "cam-nang",
  topic: "Chủ đề thử nghiệm",
  articleType: "toplist",
  keywordSeed: [],
};

describe("CreateContentJobUseCase — auto-queue theo articleType (article-ai-extraction-plan.md GĐ1)", () => {
  it("tu dong queue generate ngay cho articleType khac cam-nang", async () => {
    const { usecase, queued } = buildUseCase();
    const result = await usecase.execute(baseRequest);
    expect(result.status).toBe("Created");
    expect(queued).toHaveLength(1);
    expect(queued[0]!.queueName).toBe("content.generate");
  });

  it("KHONG tu queue generate cho articleType=cam-nang — cho trich xuat nguon truoc", async () => {
    const { usecase, queued, savedJobs } = buildUseCase();
    const result = await usecase.execute({
      ...baseRequest,
      articleType: "cam-nang",
      referenceUrls: ["https://example.com/a", "https://example.com/b"],
    });
    expect(result.status).toBe("Created");
    expect(queued).toHaveLength(0);
    expect(savedJobs[0]!.toSnapshot().referenceUrls).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
  });
});
