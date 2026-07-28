import { UpsertDestinationUseCase } from "./upsert-destination.usecase";
import type { DestinationMirrorRepository } from "../ports/destination-mirror.repository";
import type { DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import type { RecomputeRelatedService } from "../services/recompute-related.service";
import type { ParseMapsLinkUseCase } from "./parse-maps-link.usecase";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";
import type { UpsertDestinationRequest } from "@zinoflow/contracts";

function mirror(overrides: Partial<DestinationMirrorEntity>): DestinationMirrorEntity {
  return {
    slug: "poi",
    siteId: null,
    kind: "poi",
    parentSlug: null,
    provinceCode: null,
    ...overrides,
  } as DestinationMirrorEntity;
}

function baseRequest(overrides: Partial<UpsertDestinationRequest>): UpsertDestinationRequest {
  return {
    slug: "cum-moi",
    name: "Cụm mới",
    kind: "cluster",
    priority: 3,
    ...overrides,
  } as UpsertDestinationRequest;
}

describe("UpsertDestinationUseCase — tu suy ra tinh cha cho CUM (deriveClusterParent)", () => {
  function setup(all: DestinationMirrorEntity[]) {
    const created: Array<{ slug: string; meta: unknown }> = [];
    const mirrorRepo = {
      findBySlug: async (slug: string) => all.find((d) => d.slug === slug) ?? null,
      findAll: async () => all,
      createLocal: async (slug: string, meta: unknown) => {
        created.push({ slug, meta });
      },
    } as unknown as DestinationMirrorRepository;

    const usecase = new UpsertDestinationUseCase(
      mirrorRepo,
      {} as DichoithoiSiteDb,
      {} as RecomputeRelatedService,
      { execute: async () => ({ lat: null, lng: null }) } as unknown as ParseMapsLinkUseCase,
    );
    return { usecase, created };
  }

  it("CUM khong chon Diem cha nhung co chon Tinh -> tu gan vao tinh do", async () => {
    const province = mirror({ slug: "tinh-lam-dong", kind: "province", provinceCode: "68" });
    const { usecase, created } = setup([province]);

    await usecase.create(baseRequest({ provinceCode: "68" }));

    expect(created).toHaveLength(1);
    expect(created[0]!.meta).toMatchObject({ parentSlug: "tinh-lam-dong" });
  });

  it("da chon san Diem cha -> KHONG ghi de bang tinh suy ra", async () => {
    const province = mirror({ slug: "tinh-lam-dong", kind: "province", provinceCode: "68" });
    const otherCluster = mirror({ slug: "bao-loc", kind: "cluster", provinceCode: "68" });
    const { usecase, created } = setup([province, otherCluster]);

    await usecase.create(baseRequest({ provinceCode: "68", parentSlug: "bao-loc" }));

    expect(created[0]!.meta).toMatchObject({ parentSlug: "bao-loc" });
  });

  it("khong co Tinh khop provinceCode -> parentSlug van null (khong bia du lieu)", async () => {
    const { usecase, created } = setup([]);

    await usecase.create(baseRequest({ provinceCode: "99" }));

    expect(created[0]!.meta).toMatchObject({ parentSlug: null });
  });

  it("kind=poi (khong phai cluster) -> KHONG tu gan thang vao tinh, giu parentSlug null", async () => {
    const province = mirror({ slug: "tinh-lam-dong", kind: "province", provinceCode: "68" });
    const { usecase, created } = setup([province]);

    await usecase.create(baseRequest({ kind: "poi", provinceCode: "68" }));

    expect(created[0]!.meta).toMatchObject({ parentSlug: null });
  });
});
