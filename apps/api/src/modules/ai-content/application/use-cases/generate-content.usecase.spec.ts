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
import { AiProviderError } from "../../../shared/errors/app-error";

/**
 * Test gate M2: "Generate fail 1 section -> chi retry section do, job khong chet."
 * Provider gia lap loi tam thoi o buoc section; outline/frame dung stub that.
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

/** Provider boc stub, nem loi cho N lan goi "section" dau tien. */
class FlakyProvider implements ContentAiProvider {
  readonly key = "stub" as const;
  private readonly stub = new StubContentAiProvider();
  sectionCalls = 0;

  constructor(private failFirstNSectionCalls: number) {}

  isConfigured(): boolean {
    return true;
  }

  async generateStructured<TSchema extends ZodType>(
    request: StructuredGenerationRequest,
    schema: TSchema,
  ): Promise<{ output: z.infer<TSchema>; usage: AiCallUsage }> {
    if (request.operation === "section") {
      this.sectionCalls++;
      if (this.sectionCalls <= this.failFirstNSectionCalls) {
        throw new AiProviderError("Loi tam thoi (gia lap) khi generate section");
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
  const prompts = new PromptBuilder({ findActive: async () => null });
  const useCase = new GenerateContentUseCase(
    jobs,
    drafts,
    { resolve: () => provider },
    { findProducts: async () => [] },
    usage,
    prompts,
  );
  // Bo delay giua cac lan retry de test chay nhanh
  jest.spyOn(useCase as unknown as { delay: () => Promise<void> }, "delay").mockResolvedValue();
  return { useCase, jobs, drafts, usageRecords };
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
    aiProvider: "anthropic",
    aiModel: "stub-model",
  });
}

describe("GenerateContentUseCase (M2 - 3 buoc + per-section retry)", () => {
  it("generates draft through outline -> sections -> frame and reaches DraftReady", async () => {
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
    expect(operations).toContain("section:1");
    expect(operations).toContain("frame");
  });

  it("retries ONLY the failed section and the job survives (gate M2)", async () => {
    const provider = new FlakyProvider(1); // section dau fail 1 lan roi ok
    const { useCase, jobs, drafts } = buildUseCase(provider);
    const job = createJob();
    await jobs.save(job);

    await useCase.execute(job.id);

    expect((await jobs.findById(job.id))?.status).toBe("DraftReady");
    expect(drafts.saved).toHaveLength(1);
    // 2 section tu stub outline + 1 lan fail = 3 lan goi section, khong generate lai outline
    expect(provider.sectionCalls).toBe(3);
  });

  it("marks job Failed after a section exhausts all attempts", async () => {
    const provider = new FlakyProvider(Number.MAX_SAFE_INTEGER);
    const { useCase, jobs, drafts } = buildUseCase(provider);
    const job = createJob();
    await jobs.save(job);

    await expect(useCase.execute(job.id)).rejects.toThrow(AiProviderError);
    expect((await jobs.findById(job.id))?.status).toBe("Failed");
    expect(drafts.saved).toHaveLength(0);
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
