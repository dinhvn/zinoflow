import { BulkUpdateDestinationFieldsUseCase } from "./bulk-update-destination-fields.usecase";
import type { DestinationMirrorRepository } from "../ports/destination-mirror.repository";
import type { DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import type { ParseMapsLinkUseCase } from "./parse-maps-link.usecase";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";
import type { DestinationBulkEditRow } from "@zinoflow/contracts";

function mirror(overrides: Partial<DestinationMirrorEntity>): DestinationMirrorEntity {
  return {
    slug: "da-lat",
    siteId: null,
    kind: "cluster",
    parentSlug: null,
    provinceCode: "68",
    name: "Đà Lạt",
    shortDescription: "Mô tả cũ",
    thumbnail: null,
    googleMapsUrl: null,
    lat: null,
    lng: null,
    addressNew: "Địa chỉ cũ",
    addressOld: null,
    contactPhone: null,
    contactWebsite: null,
    hotelGroupId: null,
    priority: 3,
    contentTier: null,
    externalReviewUrls: [],
    ...overrides,
  } as DestinationMirrorEntity;
}

function row(overrides: Partial<DestinationBulkEditRow>): DestinationBulkEditRow {
  return { slug: "da-lat", ...overrides } as DestinationBulkEditRow;
}

describe("BulkUpdateDestinationFieldsUseCase", () => {
  function setup(entities: DestinationMirrorEntity[]) {
    const updateCalls: Array<{ slug: string; meta: unknown }> = [];
    const mirrorRepo = {
      findBySlug: async (slug: string) => entities.find((e) => e.slug === slug) ?? null,
      updateMetadata: async (slug: string, meta: unknown) => {
        updateCalls.push({ slug, meta });
      },
      setMetaTitle: async () => {},
      setExternalReviewUrls: async () => {},
    } as unknown as DestinationMirrorRepository;

    const siteDb = { updateMetadata: async () => {} } as unknown as DichoithoiSiteDb;
    const parseMapsLink = {
      execute: async () => ({ lat: 11.94, lng: 108.44 }),
    } as unknown as ParseMapsLinkUseCase;

    const usecase = new BulkUpdateDestinationFieldsUseCase(mirrorRepo, siteDb, parseMapsLink);
    return { usecase, updateCalls };
  }

  it("o CSV rong -> giu nguyen gia tri cu; o co gia tri -> ghi de", async () => {
    const existing = mirror({ shortDescription: "Mô tả cũ", addressNew: "Địa chỉ cũ" });
    const { usecase, updateCalls } = setup([existing]);

    const result = await usecase.execute([
      row({ shortDescription: "  ", addressNew: "Địa chỉ mới" }),
    ]);

    expect(result).toEqual({ updated: 1, errors: [] });
    expect(updateCalls[0]!.meta).toMatchObject({
      shortDescription: "Mô tả cũ",
      addressNew: "Địa chỉ mới",
    });
  });

  it("1 dong loi khong lam hong cac dong khac (error isolation)", async () => {
    const existing = mirror({ slug: "da-lat" });
    const { usecase } = setup([existing]);

    const result = await usecase.execute([
      row({ slug: "khong-ton-tai", addressNew: "x" }),
      row({ slug: "da-lat", addressNew: "Địa chỉ mới" }),
    ]);

    expect(result.updated).toBe(1);
    expect(result.errors).toEqual([
      { row: 1, slug: "khong-ton-tai", message: expect.stringContaining("Không tìm thấy") },
    ]);
  });

  it("priority khong hop le (ngoai 1-5) -> bao loi, khong ghi", async () => {
    const existing = mirror({});
    const { usecase, updateCalls } = setup([existing]);

    const result = await usecase.execute([row({ priority: "9" })]);

    expect(result.updated).toBe(0);
    expect(result.errors[0]!.message).toContain("1-5");
    expect(updateCalls).toHaveLength(0);
  });

  it("priority rong -> giu nguyen; co gia tri hop le -> doi", async () => {
    const existing = mirror({ priority: 3 });
    const { usecase, updateCalls } = setup([existing]);

    await usecase.execute([row({ priority: "" }), row({ priority: "1" })]);

    // Chi 1 dong (cung slug "da-lat" ca 2 lan) — lay lan ghi cuoi cung de kiem tra gia tri hop le.
    expect(updateCalls.at(-1)!.meta).toMatchObject({ priority: 1 });
  });

  it("doi googleMapsUrl -> parse lai toa do; khong doi -> giu toa do cu", async () => {
    const existing = mirror({ googleMapsUrl: "https://maps.google.com/old", lat: "1", lng: "2" });
    const { usecase, updateCalls } = setup([existing]);

    await usecase.execute([row({ googleMapsUrl: "https://maps.google.com/new" })]);

    expect(updateCalls[0]!.meta).toMatchObject({ lat: 11.94, lng: 108.44 });
  });

  it("mergeReviewUrls: them moi facebook, giu nguyen nhan khac da co", async () => {
    const existing = mirror({
      externalReviewUrls: [{ label: "TripAdvisor", url: "https://tripadvisor.example" }],
    });

    const setCalls: unknown[] = [];
    const mirrorRepo = {
      findBySlug: async () => existing,
      updateMetadata: async () => {},
      setMetaTitle: async () => {},
      setExternalReviewUrls: async (_slug: string, urls: unknown) => setCalls.push(urls),
    } as unknown as DestinationMirrorRepository;
    const siteDb = { updateMetadata: async () => {} } as unknown as DichoithoiSiteDb;
    const parseMapsLink = { execute: async () => ({ lat: null, lng: null }) } as unknown as ParseMapsLinkUseCase;
    const usecase = new BulkUpdateDestinationFieldsUseCase(mirrorRepo, siteDb, parseMapsLink);

    await usecase.execute([row({ facebookUrl: "https://facebook.example" })]);

    expect(setCalls[0]).toEqual([
      { label: "TripAdvisor", url: "https://tripadvisor.example" },
      { label: "Facebook", url: "https://facebook.example" },
    ]);
  });
});
