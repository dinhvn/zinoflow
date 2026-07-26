import type { ZodType, z } from "zod/v4";
import { SuggestTagAssignmentsUseCase } from "./suggest-tag-assignments.usecase";
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
import type { DestinationMirrorRepository } from "../ports/destination-mirror.repository";

const emptyMirrorRepo = { findAll: async () => [] } as unknown as DestinationMirrorRepository;

const TAGS: SiteTagRow[] = [
  { id: 1, slug: "hoang-so", name: "Hoang so", description: null, metaDescription: null, status: 0 },
  { id: 2, slug: "lang-man", name: "Lang man", description: null, metaDescription: null, status: 0 },
];

function fakeAssignment(overrides: Partial<SiteTagAssignmentRow> = {}): SiteTagAssignmentRow {
  return {
    destinationId: 1,
    destinationSlug: "da-lat",
    destinationName: "Đà Lạt",
    tagSlugs: [],
    ...overrides,
  };
}

function fakeSiteDb(assignments: SiteTagAssignmentRow[]): DichoithoiSiteDb {
  return {
    isConfigured: () => true,
    fetchTags: async () => TAGS,
    fetchTagAssignments: async () => assignments,
  } as unknown as DichoithoiSiteDb;
}

function fakeProvider(output: unknown): ContentAiProvider {
  return {
    key: "anthropic",
    isConfigured: () => true,
    generateStructured: async <TSchema extends ZodType>(
      _request: StructuredGenerationRequest,
      _schema: TSchema,
    ): Promise<{ output: z.infer<TSchema>; usage: AiCallUsage }> => ({
      output: output as z.infer<TSchema>,
      usage: { inputTokens: 10, outputTokens: 10, costUsd: 0, latencyMs: 1 },
    }),
  };
}

describe("SuggestTagAssignmentsUseCase (destination-spec §2.4 buoc 1)", () => {
  it("chi goi AI cho diem CHUA co tag khi khong chi dinh destinationSlugs", async () => {
    const assignments = [
      fakeAssignment({ destinationSlug: "da-lat", tagSlugs: [] }),
      fakeAssignment({ destinationSlug: "sapa", tagSlugs: ["hoang-so"] }),
    ];
    const provider = fakeProvider({
      suggestions: [{ destinationSlug: "da-lat", tagSlugs: ["lang-man"], reasoning: "Lang man" }],
    });
    const usageRecords: string[] = [];
    const usecase = new SuggestTagAssignmentsUseCase(
      fakeSiteDb(assignments),
      { resolve: () => provider } as AiProviderRegistry,
      { record: async (e) => void usageRecords.push(e.operation) } as AiUsageRecorder,
      emptyMirrorRepo,
    );

    const result = await usecase.execute({});

    expect(result.suggestions).toEqual([
      { destinationSlug: "da-lat", tagSlugs: ["lang-man"], reasoning: "Lang man" },
    ]);
    expect(usageRecords).toEqual(["suggest-destination-tags"]);
  });

  it("loc bo tagSlug/destinationSlug AI bia ra khong co trong danh sach that", async () => {
    const assignments = [fakeAssignment({ destinationSlug: "da-lat", tagSlugs: [] })];
    const provider = fakeProvider({
      suggestions: [
        { destinationSlug: "da-lat", tagSlugs: ["lang-man", "khong-ton-tai"], reasoning: "x" },
        { destinationSlug: "khong-co-that", tagSlugs: ["lang-man"], reasoning: "y" },
      ],
    });
    const usecase = new SuggestTagAssignmentsUseCase(
      fakeSiteDb(assignments),
      { resolve: () => provider } as AiProviderRegistry,
      { record: async () => {} } as AiUsageRecorder,
      emptyMirrorRepo,
    );

    const result = await usecase.execute({});

    expect(result.suggestions).toEqual([
      { destinationSlug: "da-lat", tagSlugs: ["lang-man"], reasoning: "x" },
    ]);
  });

  it("khong co diem nao can goi y -> khong goi AI", async () => {
    const assignments = [fakeAssignment({ destinationSlug: "sapa", tagSlugs: ["hoang-so"] })];
    const usecase = new SuggestTagAssignmentsUseCase(
      fakeSiteDb(assignments),
      {
        resolve: () => {
          throw new Error("khong duoc goi AI");
        },
      } as AiProviderRegistry,
      { record: async () => {} } as AiUsageRecorder,
      emptyMirrorRepo,
    );

    const result = await usecase.execute({});

    expect(result.suggestions).toEqual([]);
  });
});
