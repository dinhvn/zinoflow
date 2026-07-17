import { SuggestTaxonomyTypesUseCase } from "./suggest-taxonomy-types.usecase";
import type { DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import type { TaxonomySuggestionRepository } from "../ports/taxonomy-suggestion.repository";
import type { AiProviderRegistry } from "../../../ai-content/application/ports/content-ai-provider.port";
import type { AiUsageRecorder } from "../../../ai-content/application/ports/ai-usage-recorder.port";

function fakeSiteDb(): DichoithoiSiteDb {
  return {
    fetchAllDestinations: async () => [
      {
        siteId: 1,
        slug: "vinh-ha-long",
        kind: "poi",
        parentSlug: "quang-ninh",
        name: "Vịnh Hạ Long",
        thumbnail: null,
      },
      {
        siteId: 2,
        slug: "da-lat-poi-khac",
        kind: "poi",
        parentSlug: "da-lat",
        name: "Điểm khác cụm",
        thumbnail: null,
      },
      {
        siteId: 3,
        slug: "da-vong-loai",
        kind: "poi",
        parentSlug: "quang-ninh",
        name: "Điểm đã duyệt",
        thumbnail: null,
      },
    ],
    fetchAllContentRows: async () => [
      { siteId: 1, slug: "vinh-ha-long", contentHtml: "<p>Vịnh biển đảo nổi tiếng thế giới</p>" },
    ],
    fetchTaxonomyContent: async () => ({
      groups: [],
      types: [
        { id: 1, groupId: 1, slug: "bien-dao", name: "Biển - Đảo", description: null },
        { id: 7, groupId: 2, slug: "di-tich-lich-su", name: "Di tích lịch sử", description: null },
      ],
      provinces: [],
    }),
  } as unknown as DichoithoiSiteDb;
}

function fakeRegistry(output: unknown): AiProviderRegistry {
  return {
    resolve: () => ({
      key: "anthropic",
      generateStructured: async () => ({
        output,
        usage: { inputTokens: 10, outputTokens: 10, costUsd: 0 },
      }),
    }),
  } as unknown as AiProviderRegistry;
}

function fakeUsageRecorder(): AiUsageRecorder {
  return { record: async () => {} } as unknown as AiUsageRecorder;
}

describe("SuggestTaxonomyTypesUseCase (relations-plan §6.3, Giai doan B3)", () => {
  it("chi danh gia diem kind=poi trong dung cum, bo qua diem da accepted, luu vao bang nhap", async () => {
    const upserted: unknown[] = [];
    const suggestionRepo = {
      findAll: async () => [
        { destinationSlug: "da-vong-loai", suggestedTypes: ["bien-dao"], reason: "cu", status: "accepted" },
      ],
      upsertMany: async (rows: unknown[]) => {
        upserted.push(...rows);
      },
    } as unknown as TaxonomySuggestionRepository;

    const useCase = new SuggestTaxonomyTypesUseCase(
      fakeSiteDb(),
      suggestionRepo,
      fakeRegistry({
        suggestions: [
          {
            destinationSlug: "vinh-ha-long",
            suggestedTypeSlugs: ["bien-dao", "khong-hop-le"],
            reason: "Là vịnh biển đảo, không phải di tích",
          },
        ],
      }),
      fakeUsageRecorder(),
    );

    const result = await useCase.execute({ clusterSlug: "quang-ninh" });

    // chi con vinh-ha-long trong danh sach can danh gia (da-vong-loai bi loai vi accepted)
    expect(result.suggestions).toEqual([
      {
        destinationSlug: "vinh-ha-long",
        suggestedTypeSlugs: ["bien-dao"], // "khong-hop-le" bi loc vi khong nam trong 16 loai
        reason: "Là vịnh biển đảo, không phải di tích",
      },
    ]);
    expect(upserted).toEqual([
      {
        destinationSlug: "vinh-ha-long",
        suggestedTypes: ["bien-dao"],
        reason: "Là vịnh biển đảo, không phải di tích",
      },
    ]);
  });

  it("tra ve rong neu cum khong co diem nao can danh gia, khong goi AI", async () => {
    const suggestionRepo = {
      findAll: async () => [],
      upsertMany: async () => {
        throw new Error("khong duoc goi khi rong");
      },
    } as unknown as TaxonomySuggestionRepository;
    const registry = {
      resolve: () => {
        throw new Error("khong duoc goi AI khi khong co ung vien");
      },
    } as unknown as AiProviderRegistry;

    const useCase = new SuggestTaxonomyTypesUseCase(
      fakeSiteDb(),
      suggestionRepo,
      registry,
      fakeUsageRecorder(),
    );

    const result = await useCase.execute({ clusterSlug: "cum-khong-ton-tai" });
    expect(result.suggestions).toEqual([]);
  });
});
