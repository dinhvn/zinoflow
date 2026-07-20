import type { ZodType, z } from "zod/v4";
import { randomUUID } from "node:crypto";
import { GenerateContentUseCase } from "./generate-content.usecase";
import { PromptBuilder } from "../services/prompt-builder";
import { ContentJob } from "../../domain/content-job";
import { InMemoryContentJobRepository } from "../../infrastructure/repositories/in-memory-content-job.repository";
import { StubContentAiProvider } from "../../infrastructure/ai-providers/stub-content-ai.provider";
import type {
  AiCallUsage,
  ContentAiProvider,
  StructuredGenerationRequest,
} from "../ports/content-ai-provider.port";
import type { ContentDraftRepository, DraftRecord } from "../ports/content-draft.repository";
import type { AiUsageRecorder } from "../ports/ai-usage-recorder.port";
import type {
  ContentGenerationCheckpointRepository,
  GenerationCheckpoint,
} from "../ports/content-generation-checkpoint.repository";
import { AiProviderError } from "../../../shared/errors/app-error";

class InMemoryCheckpointRepository implements ContentGenerationCheckpointRepository {
  private readonly byJobId = new Map<string, GenerationCheckpoint>();
  async findByJobId(jobId: string): Promise<GenerationCheckpoint | null> {
    return this.byJobId.get(jobId) ?? null;
  }
  async save(checkpoint: GenerationCheckpoint): Promise<void> {
    this.byJobId.set(checkpoint.jobId, checkpoint);
  }
  async clear(jobId: string): Promise<void> {
    this.byJobId.delete(jobId);
  }
}

/**
 * Test gate: "Loi tam thoi o buoc content -> retry ca buoc do, job khong chet
 * ngay lan dau." (Option 3, 09/2026 — thay gate M2 cu ve retry-tung-section,
 * xem generate-content.usecase.ts).
 */

class InMemoryDraftRepository implements ContentDraftRepository {
  readonly saved: DraftRecord[] = [];
  async save(draft: DraftRecord): Promise<void> {
    this.saved.push(draft);
  }
  async findById(id: string): Promise<DraftRecord | null> {
    return this.saved.find((d) => d.id === id) ?? null;
  }
  async findLatestByJobId(jobId: string): Promise<DraftRecord | null> {
    return (await this.listByJobId(jobId))[0] ?? null;
  }
  async listByJobId(jobId: string): Promise<DraftRecord[]> {
    return this.saved.filter((d) => d.jobId === jobId).sort((a, b) => b.version - a.version);
  }
}

/** Provider boc stub, nem loi cho N lan goi "content" dau tien. */
class FlakyProvider implements ContentAiProvider {
  readonly key = "stub" as const;
  private readonly stub = new StubContentAiProvider();
  contentCalls = 0;

  constructor(private failFirstNContentCalls: number) {}

  isConfigured(): boolean {
    return true;
  }

  async generateStructured<TSchema extends ZodType>(
    request: StructuredGenerationRequest,
    schema: TSchema,
  ): Promise<{ output: z.infer<TSchema>; usage: AiCallUsage }> {
    if (request.operation === "content") {
      this.contentCalls++;
      if (this.contentCalls <= this.failFirstNContentCalls) {
        throw new AiProviderError("Loi tam thoi (gia lap) khi generate content");
      }
    }
    return this.stub.generateStructured(request, schema);
  }
}

/** Provider boc stub, nem loi VINH VIEN tu 1 diem trong pipeline — dung mo phong crash sau outline. */
class FailAfterOutlineProvider implements ContentAiProvider {
  readonly key = "stub" as const;
  private readonly stub = new StubContentAiProvider();
  outlineCalls = 0;
  contentCalls = 0;

  constructor(private shouldFailContent: boolean) {}

  isConfigured(): boolean {
    return true;
  }

  async generateStructured<TSchema extends ZodType>(
    request: StructuredGenerationRequest,
    schema: TSchema,
  ): Promise<{ output: z.infer<TSchema>; usage: AiCallUsage }> {
    if (request.operation === "outline") this.outlineCalls++;
    if (request.operation === "content") {
      this.contentCalls++;
      if (this.shouldFailContent) {
        throw new AiProviderError("Loi vinh vien (gia lap) khi generate content");
      }
    }
    return this.stub.generateStructured(request, schema);
  }
}

function buildUseCase(provider: ContentAiProvider) {
  const jobs = new InMemoryContentJobRepository();
  const drafts = new InMemoryDraftRepository();
  const usageRecords: Array<{ operation: string }> = [];
  const usage: AiUsageRecorder = {
    record: async (entry) => {
      usageRecords.push({ operation: entry.operation });
    },
  };
  // Template repo rong -> PromptBuilder fallback DEFAULT_PROMPTS (hop le theo thiet ke)
  const prompts = new PromptBuilder({
    findActive: async () => null,
    findActiveMany: async () => [],
    findVersions: async () => [],
    createVersion: async () => {
      throw new Error("not used");
    },
    activateVersion: async () => {},
  });
  const checkpoints = new InMemoryCheckpointRepository();
  const useCase = new GenerateContentUseCase(
    jobs,
    drafts,
    { resolve: () => provider },
    { findProducts: async () => [] },
    usage,
    checkpoints,
    prompts,
  );
  // Bo delay giua cac lan retry de test chay nhanh
  jest.spyOn(useCase as unknown as { delay: () => Promise<void> }, "delay").mockResolvedValue();
  return { useCase, jobs, drafts, usageRecords, checkpoints };
}

function createJob(): ContentJob {
  return ContentJob.create({
    id: randomUUID(),
    siteCode: "laruki",
    sourceType: "Topic",
    sourceRef: "test",
    topic: "Top 5 túi xách nữ công sở",
    articleType: "toplist",
    keywordSeed: ["túi xách nữ"],
    toneProfile: null,
    sourceContext: null,
    contentTier: null,
    comparisonKey: null,
    originalityExcerpt: null,
    coverImageId: null,
    aiProvider: "anthropic",
    aiModel: "stub-model",
  });
}

describe("GenerateContentUseCase (Option 3 - 2 buoc: outline -> content gop)", () => {
  it("generates draft through outline -> content and reaches DraftReady", async () => {
    const provider = new FlakyProvider(0);
    const { useCase, jobs, drafts, usageRecords } = buildUseCase(provider);
    const job = createJob();
    await jobs.save(job);

    await useCase.execute(job.id);

    expect((await jobs.findById(job.id))?.status).toBe("DraftReady");
    expect(drafts.saved).toHaveLength(1);
    expect(drafts.saved[0]?.version).toBe(1);
    expect(drafts.saved[0]?.article?.sections.length).toBeGreaterThan(0);
    const operations = usageRecords.map((u) => u.operation);
    expect(operations).toContain("outline");
    expect(operations).toContain("content");
  });

  it("retries the content step on transient failure and the job survives", async () => {
    const provider = new FlakyProvider(1); // content fail 1 lan roi ok
    const { useCase, jobs, drafts } = buildUseCase(provider);
    const job = createJob();
    await jobs.save(job);

    await useCase.execute(job.id);

    expect((await jobs.findById(job.id))?.status).toBe("DraftReady");
    expect(drafts.saved).toHaveLength(1);
    expect(provider.contentCalls).toBe(2); // 1 lan fail + 1 lan thanh cong
  });

  it("marks job Failed after the content step exhausts all attempts", async () => {
    const provider = new FlakyProvider(Number.MAX_SAFE_INTEGER);
    const { useCase, jobs, drafts } = buildUseCase(provider);
    const job = createJob();
    await jobs.save(job);

    await expect(useCase.execute(job.id)).rejects.toThrow(AiProviderError);
    expect((await jobs.findById(job.id))?.status).toBe("Failed");
    expect(drafts.saved).toHaveLength(0);
  });

  it("resumes from checkpoint after a crash after outline — does not regenerate outline", async () => {
    const jobs = new InMemoryContentJobRepository();
    const drafts = new InMemoryDraftRepository();
    const checkpoints = new InMemoryCheckpointRepository();
    const usage: AiUsageRecorder = { record: async () => {} };
    const prompts = new PromptBuilder({
      findActive: async () => null,
      findActiveMany: async () => [],
      findVersions: async () => [],
      createVersion: async () => {
        throw new Error("not used");
      },
      activateVersion: async () => {},
    });
    const job = createJob();
    await jobs.save(job);

    // Lan 1: outline xong nhung content fail vinh vien -> job Failed, checkpoint con outline
    const crashingProvider = new FailAfterOutlineProvider(true);
    const useCase1 = new GenerateContentUseCase(
      jobs,
      drafts,
      { resolve: () => crashingProvider },
      { findProducts: async () => [] },
      usage,
      checkpoints,
      prompts,
    );
    jest.spyOn(useCase1 as unknown as { delay: () => Promise<void> }, "delay").mockResolvedValue();
    await expect(useCase1.execute(job.id)).rejects.toThrow(AiProviderError);
    expect((await jobs.findById(job.id))?.status).toBe("Failed");

    const checkpointAfterCrash = await checkpoints.findByJobId(job.id);
    expect(checkpointAfterCrash?.outline).not.toBeNull();

    // Lan 2 (resume, vd sau khi bam Retry): provider khong loi nua
    const healthyProvider = new FailAfterOutlineProvider(false);
    const jobRetry = await jobs.findById(job.id);
    jobRetry!.transitionTo("GeneratingOutline");
    await jobs.save(jobRetry!);
    const useCase2 = new GenerateContentUseCase(
      jobs,
      drafts,
      { resolve: () => healthyProvider },
      { findProducts: async () => [] },
      usage,
      checkpoints,
      prompts,
    );
    jest.spyOn(useCase2 as unknown as { delay: () => Promise<void> }, "delay").mockResolvedValue();
    await useCase2.execute(job.id);

    expect((await jobs.findById(job.id))?.status).toBe("DraftReady");
    expect(drafts.saved).toHaveLength(1);
    // Resume: outline khong goi lai; content duoc goi 1 lan
    expect(healthyProvider.outlineCalls).toBe(0);
    expect(healthyProvider.contentCalls).toBe(1);
    // Checkpoint da xoa sau khi job xong
    expect(await checkpoints.findByJobId(job.id)).toBeNull();
  });

  it("re-generating saves a new draft version instead of overwriting", async () => {
    const provider = new FlakyProvider(0);
    const { useCase, jobs, drafts } = buildUseCase(provider);
    const job = createJob();
    await jobs.save(job);

    await useCase.execute(job.id);
    // Generate lai (DraftReady -> GeneratingOutline la transition hop le)
    const saved = await jobs.findById(job.id);
    saved?.transitionTo("GeneratingOutline");
    await jobs.save(saved!);
    await useCase.execute(job.id);

    expect(drafts.saved.map((d) => d.version)).toEqual([1, 2]);
  });
});

describe("GenerateContentUseCase — bai diem den ep cung 7 chu de co dinh (fix 07/2026)", () => {
  it("luon tao dung 7 section theo dung DESTINATION_SECTION_ORDER, du outline/blockKey AI tra ve khac", async () => {
    const provider = new FlakyProvider(0);
    const { useCase, jobs, drafts } = buildUseCase(provider);
    const job = ContentJob.create({
      id: randomUUID(),
      siteCode: "dichoithoi",
      sourceType: "Topic",
      sourceRef: "dalat-fairytale-land",
      topic: "Dalat Fairytale Land",
      articleType: "guide-diem-den",
      keywordSeed: ["dalat fairytale land"],
      toneProfile: null,
      sourceContext: null,
      contentTier: "standard",
      comparisonKey: null,
      originalityExcerpt: null,
      coverImageId: null,
      aiProvider: "anthropic",
      aiModel: "stub-model",
    });
    await jobs.save(job);

    await useCase.execute(job.id);

    expect((await jobs.findById(job.id))?.status).toBe("DraftReady");
    const article = drafts.saved[0]?.article as { sections: Array<{ blockKey?: string | null }> };
    expect(article.sections.map((s) => s.blockKey)).toEqual([
      "tong-quan",
      "trai-nghiem",
      "mua-nao",
      "lich-trinh",
      "di-chuyen",
      "an-gi",
      "qua-mang-ve",
    ]);
  });
});
