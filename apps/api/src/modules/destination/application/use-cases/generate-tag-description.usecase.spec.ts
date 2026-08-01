import type { ZodType, z } from "zod/v4";
import { GenerateTagDescriptionUseCase } from "./generate-tag-description.usecase";
import type { DichoithoiSiteDb, SiteTagRow } from "../ports/dichoithoi-site-db.port";
import type {
  AiCallUsage,
  AiProviderRegistry,
  ContentAiProvider,
  StructuredGenerationRequest,
} from "../../../ai-content/application/ports/content-ai-provider.port";
import type { AiUsageRecorder } from "../../../ai-content/application/ports/ai-usage-recorder.port";
import { DomainRuleError } from "../../../shared/errors/app-error";
import type { DestinationMirrorRepository } from "../ports/destination-mirror.repository";

const emptyMirrorRepo = { findAll: async () => [] } as unknown as DestinationMirrorRepository;

const TAGS: SiteTagRow[] = [
  { id: 1, slug: "lang-man", name: "Lang man — Check-in cap doi", description: null, metaDescription: null, status: 0 },
];

function fakeProvider(output: unknown): ContentAiProvider {
  return {
    key: "anthropic",
    isConfigured: () => true,
    supportsBatch: false,
    generateStructured: async <TSchema extends ZodType>(
      _request: StructuredGenerationRequest,
      _schema: TSchema,
    ): Promise<{ output: z.infer<TSchema>; usage: AiCallUsage }> => ({
      output: output as z.infer<TSchema>,
      usage: { inputTokens: 5, outputTokens: 5, costUsd: 0, latencyMs: 1 },
    }),
  };
}

describe("GenerateTagDescriptionUseCase (destination-spec §2.4 buoc 3)", () => {
  it("tra ve mo ta AI goi y, ghi usage", async () => {
    const siteDb = {
      fetchTags: async () => TAGS,
      fetchDestinationsForTag: async () => [],
    } as unknown as DichoithoiSiteDb;
    const usageRecords: string[] = [];
    const usecase = new GenerateTagDescriptionUseCase(
      siteDb,
      { resolve: () => fakeProvider({ description: "Mo ta lang man" }) } as AiProviderRegistry,
      { record: async (e) => void usageRecords.push(e.operation) } as AiUsageRecorder,
      emptyMirrorRepo,
    );

    const result = await usecase.execute({ tagSlug: "lang-man" });

    expect(result).toEqual({ description: "Mo ta lang man" });
    expect(usageRecords).toEqual(["generate-tag-description"]);
  });

  it("nem loi khi tag khong ton tai", async () => {
    const siteDb = {
      fetchTags: async () => TAGS,
      fetchDestinationsForTag: async () => [],
    } as unknown as DichoithoiSiteDb;
    const usecase = new GenerateTagDescriptionUseCase(
      siteDb,
      { resolve: () => fakeProvider({ description: "x" }) } as AiProviderRegistry,
      { record: async () => {} } as AiUsageRecorder,
      emptyMirrorRepo,
    );

    await expect(usecase.execute({ tagSlug: "khong-ton-tai" })).rejects.toThrow(DomainRuleError);
  });
});
