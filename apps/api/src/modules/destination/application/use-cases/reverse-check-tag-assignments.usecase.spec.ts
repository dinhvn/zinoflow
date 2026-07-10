import type { ZodType, z } from "zod/v4";
import { ReverseCheckTagAssignmentsUseCase } from "./reverse-check-tag-assignments.usecase";
import type {
  DichoithoiSiteDb,
  SiteTagAssignmentRow,
  SiteTagRow,
} from "../ports/dichoithoi-site-db.port";
import type {
  AiCallUsage,
  AiProviderRegistry,
  ContentAiProvider,
  StructuredGenerationRequest,
} from "../../../ai-content/application/ports/content-ai-provider.port";
import type { AiUsageRecorder } from "../../../ai-content/application/ports/ai-usage-recorder.port";

const TAGS: SiteTagRow[] = [
  { id: 1, slug: "hoang-so", name: "Hoang so", description: null, status: 0 },
  { id: 2, slug: "lang-man", name: "Lang man", description: null, status: 0 },
];

function fakeProvider(output: unknown): ContentAiProvider {
  return {
    key: "anthropic",
    isConfigured: () => true,
    generateStructured: async <TSchema extends ZodType>(
      _request: StructuredGenerationRequest,
      _schema: TSchema,
    ): Promise<{ output: z.infer<TSchema>; usage: AiCallUsage }> => ({
      output: output as z.infer<TSchema>,
      usage: { inputTokens: 5, outputTokens: 5, costUsd: 0, latencyMs: 1 },
    }),
  };
}

function buildUseCase(assignments: SiteTagAssignmentRow[], aiOutput: unknown) {
  const siteDb = {
    fetchTags: async () => TAGS,
    fetchTagAssignments: async () => assignments,
  } as unknown as DichoithoiSiteDb;
  return new ReverseCheckTagAssignmentsUseCase(
    siteDb,
    { resolve: () => fakeProvider(aiOutput) } as AiProviderRegistry,
    { record: async () => {} } as AiUsageRecorder,
  );
}

describe("ReverseCheckTagAssignmentsUseCase (destination-spec §2.4 buoc 2)", () => {
  it("bao tag duoi nguong so luong (khong can AI)", async () => {
    const assignments = [
      { destinationId: 1, destinationSlug: "da-lat", destinationName: "Đà Lạt", tagSlugs: ["lang-man"] },
    ];
    const usecase = buildUseCase(assignments, { findings: [] });

    const result = await usecase.execute();

    const underThreshold = result.findings.filter((f) => f.issue === "under-threshold");
    expect(underThreshold.map((f) => f.tagSlug).sort()).toEqual(["hoang-so", "lang-man"]);
    expect(underThreshold.every((f) => f.destinationSlug === null)).toBe(true);
  });

  it("them finding likely-wrong tu AI, loc bo cap khong ton tai that", async () => {
    const assignments = [
      { destinationId: 1, destinationSlug: "da-lat", destinationName: "Đà Lạt", tagSlugs: ["lang-man"] },
    ];
    const aiOutput = {
      findings: [
        { destinationSlug: "da-lat", tagSlug: "lang-man", reasoning: "Khong hop ly" },
        { destinationSlug: "da-lat", tagSlug: "hoang-so", reasoning: "Cap khong ton tai" },
      ],
    };
    const usecase = buildUseCase(assignments, aiOutput);

    const result = await usecase.execute();

    const likelyWrong = result.findings.filter((f) => f.issue === "likely-wrong");
    expect(likelyWrong).toEqual([
      { destinationSlug: "da-lat", tagSlug: "lang-man", issue: "likely-wrong", reasoning: "Khong hop ly" },
    ]);
  });

  it("khong co diem nao da gan tag -> khong goi AI", async () => {
    const siteDb = {
      fetchTags: async () => TAGS,
      fetchTagAssignments: async () => [
        { destinationId: 1, destinationSlug: "da-lat", destinationName: "Đà Lạt", tagSlugs: [] },
      ],
    } as unknown as DichoithoiSiteDb;
    const usecase = new ReverseCheckTagAssignmentsUseCase(
      siteDb,
      {
        resolve: () => {
          throw new Error("khong duoc goi AI");
        },
      } as AiProviderRegistry,
      { record: async () => {} } as AiUsageRecorder,
    );

    const result = await usecase.execute();

    expect(result.findings.every((f) => f.issue === "under-threshold")).toBe(true);
  });
});
