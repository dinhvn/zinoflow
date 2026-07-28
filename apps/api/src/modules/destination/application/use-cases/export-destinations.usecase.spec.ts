import { ExportDestinationsUseCase } from "./export-destinations.usecase";
import type { DestinationMirrorRepository } from "../ports/destination-mirror.repository";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";

function fakeEntity(overrides: Partial<DestinationMirrorEntity> = {}): DestinationMirrorEntity {
  return {
    slug: "poi-1",
    siteId: null,
    kind: "poi",
    parentSlug: null,
    provinceCode: "68",
    name: "Điểm 1",
    nameUnaccented: "diem 1",
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
    priceBreakdown: [],
    practicalNotes: [],
    editorialReview: null,
    externalReviewUrls: [],
    hotelGroupId: null,
    priority: 3,
    contentTier: null,
    siteStatus: null,
    contentSource: null,
    contentHash: null,
    activeContentJobId: null,
    aiNotes: null,
    aiReferenceUrls: [],
    syncFlags: [],
    hasLocalChanges: false,
    siteUpdatedAt: null,
    syncedAt: null,
    ...overrides,
  } as DestinationMirrorEntity;
}

describe("ExportDestinationsUseCase", () => {
  it("them cot province + parent (tham khao) truoc cac cot bulk-edit, tra dung ten cum/tinh", async () => {
    const cluster = fakeEntity({ slug: "da-lat", kind: "cluster", name: "Đà Lạt", parentSlug: "tinh-lam-dong" });
    const province = fakeEntity({ slug: "tinh-lam-dong", kind: "province", name: "Lâm Đồng" });
    const poi = fakeEntity({
      slug: "cho-dem-da-lat",
      name: "Chợ đêm Đà Lạt",
      parentSlug: "da-lat",
    }) as DestinationMirrorEntity & { provinceName?: string | null };
    poi.provinceName = "Lâm Đồng";

    const mirrorRepo: Pick<DestinationMirrorRepository, "listAllMatching" | "findAll"> = {
      listAllMatching: async () => [poi],
      findAll: async () => [cluster, province, poi],
    };

    const usecase = new ExportDestinationsUseCase(mirrorRepo as DestinationMirrorRepository);
    const csv = await usecase.execute(["priority"], {});
    const [header, row] = csv.split("\n");

    expect(header).toBe("slug,name,province,parent,priority");
    expect(row).toBe("cho-dem-da-lat,Chợ đêm Đà Lạt,Lâm Đồng,Đà Lạt,3");
  });

  it("khong co parentSlug -> cot parent rong", async () => {
    const province = fakeEntity({
      slug: "tinh-lam-dong",
      kind: "province",
      name: "Lâm Đồng",
      parentSlug: null,
    }) as DestinationMirrorEntity & { provinceName?: string | null };
    province.provinceName = null;

    const mirrorRepo: Pick<DestinationMirrorRepository, "listAllMatching" | "findAll"> = {
      listAllMatching: async () => [province],
      findAll: async () => [province],
    };

    const usecase = new ExportDestinationsUseCase(mirrorRepo as DestinationMirrorRepository);
    const csv = await usecase.execute(["priority"], {});
    const [, row] = csv.split("\n");

    expect(row).toBe("tinh-lam-dong,Lâm Đồng,,,3");
  });
});
