import { AcceptGeocodeCandidatesUseCase } from "./accept-geocode-candidates.usecase";
import type {
  DestinationMetadataInput,
  DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import type { DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import type {
  DestinationGeocodeCandidateRecord,
  DestinationGeocodeCandidateRepository,
} from "../ports/destination-geocode-candidate.repository";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";

function makeDestination(overrides: Partial<DestinationMirrorEntity>): DestinationMirrorEntity {
  return {
    slug: "test",
    siteId: null,
    kind: "poi",
    parentSlug: "a-pa-chai",
    provinceCode: "11",
    name: "Test",
    nameUnaccented: "test",
    shortDescription: null,
    thumbnail: null,
    lat: null,
    lng: null,
    googleMapsUrl: null,
    addressNew: null,
    addressOld: null,
    contactPhone: null,
    contactWebsite: null,
    ticketLinks: [],
    ticketPrice: null,
    priceBreakdown: [],
    practicalNotes: [],
    editorialReview: null,
    metaTitle: null,
    externalReviewUrls: [],
    hotelGroupId: null,
    priority: 3,
    contentTier: null,
    order: 0,
    distanceFromCenter: null,
    siteStatus: null,
    contentSource: null,
    contentHash: null,
    activeContentJobId: null,
    aiNotes: null,
    aiReferenceUrls: [],
    syncFlags: [],
    types: [],
    tags: [],
    hasLocalChanges: false,
    siteUpdatedAt: null,
    syncedAt: null,
    draftArticle: null,
    gallery: [],
    heroImageMeta: null,
    openingHours: null,
    aiReferenceSummary: null,
    aiReferenceSummaryUpdatedAt: null,
    aiReferenceSummaryGsg: null,
    aiReferenceSummaryGsgUpdatedAt: null,
    ...overrides,
  } as DestinationMirrorEntity;
}

function makeStagedRecord(
  destinationSlug: string,
  lat: number,
  lng: number,
): DestinationGeocodeCandidateRecord {
  return {
    destinationSlug,
    foundAt: new Date(),
    status: "pending",
    candidates: [
      {
        placeId: `https://maps.google.com/${destinationSlug}`,
        displayNameAtDiscovery: "A Pa Chải",
        confidenceScore: 0.5,
        distanceToParentMetersAtDiscovery: null,
        latAtDiscovery: lat,
        lngAtDiscovery: lng,
        googleMapsUrlAtDiscovery: `https://maps.google.com/${destinationSlug}`,
      },
    ],
  };
}

describe("AcceptGeocodeCandidatesUseCase", () => {
  it("từ chối khi toạ độ trùng với 1 POI khác đã có sẵn trong cùng cụm (dấu hiệu Google trả về địa danh chung)", async () => {
    const existingSibling = makeDestination({
      slug: "thap-muong-luan",
      name: "Tháp Mường Luân",
      parentSlug: "a-pa-chai",
      lat: "22.417999" as unknown as string,
      lng: "102.180010" as unknown as string,
    });
    const target = makeDestination({
      slug: "cot-moc-0-a-pa-chai",
      name: "Cột mốc 0 A Pa Chải",
      parentSlug: "a-pa-chai",
    });

    const mirrorRepo: Partial<DestinationMirrorRepository> = {
      findBySlug: async (slug) => (slug === target.slug ? target : null),
      listAllMatching: async () => [existingSibling],
      updateMetadata: async () => {
        throw new Error("KHÔNG được gọi updateMetadata khi phát hiện trùng toạ độ");
      },
    };
    const candidateRepo: Partial<DestinationGeocodeCandidateRepository> = {
      findBySlug: async () => makeStagedRecord(target.slug, 22.417999, 102.18001),
      setStatus: async () => {
        throw new Error("KHÔNG được set status accepted khi phát hiện trùng toạ độ");
      },
    };
    const siteDb: Partial<DichoithoiSiteDb> = {};

    const usecase = new AcceptGeocodeCandidatesUseCase(
      mirrorRepo as DestinationMirrorRepository,
      siteDb as DichoithoiSiteDb,
      candidateRepo as DestinationGeocodeCandidateRepository,
    );

    const result = await usecase.execute({
      selections: [{ destinationSlug: target.slug, placeId: `https://maps.google.com/${target.slug}` }],
    });

    expect(result.updated).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toContain("Tháp Mường Luân");
  });

  it("chấp nhận bình thường khi toạ độ không trùng POI nào khác trong cụm", async () => {
    const distantSibling = makeDestination({
      slug: "diem-khac",
      name: "Điểm khác",
      parentSlug: "a-pa-chai",
      lat: "22.500000" as unknown as string,
      lng: "102.300000" as unknown as string,
    });
    const target = makeDestination({
      slug: "cot-moc-0-a-pa-chai",
      name: "Cột mốc 0 A Pa Chải",
      parentSlug: "a-pa-chai",
    });

    const updatedMetas: DestinationMetadataInput[] = [];
    const mirrorRepo: Partial<DestinationMirrorRepository> = {
      findBySlug: async (slug) => (slug === target.slug ? target : null),
      listAllMatching: async () => [distantSibling],
      updateMetadata: async (_slug: string, meta: DestinationMetadataInput) => {
        updatedMetas.push(meta);
      },
    };
    const statusesSet: string[] = [];
    const candidateRepo: Partial<DestinationGeocodeCandidateRepository> = {
      findBySlug: async () => makeStagedRecord(target.slug, 22.417999, 102.18001),
      setStatus: async (_slug: string, status: string) => {
        statusesSet.push(status);
      },
    };
    const siteDb: Partial<DichoithoiSiteDb> = {};

    const usecase = new AcceptGeocodeCandidatesUseCase(
      mirrorRepo as DestinationMirrorRepository,
      siteDb as DichoithoiSiteDb,
      candidateRepo as DestinationGeocodeCandidateRepository,
    );

    const result = await usecase.execute({
      selections: [{ destinationSlug: target.slug, placeId: `https://maps.google.com/${target.slug}` }],
    });

    expect(result.errors).toHaveLength(0);
    expect(result.updated).toBe(1);
    expect(statusesSet).toEqual(["accepted"]);
    expect(updatedMetas[0]?.lat).toBe(22.417999);
  });
});
