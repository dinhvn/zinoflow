import { DeleteDestinationUseCase } from "./delete-destination.usecase";
import type { DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import type { DestinationMirrorRepository } from "../ports/destination-mirror.repository";
import type { ImageUploader } from "../../../shared/media/ports/image-uploader.port";
import type { CachePurgePort } from "../ports/cache-purge.port";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";

function entity(partial: Partial<DestinationMirrorEntity> & { slug: string }): DestinationMirrorEntity {
  return {
    siteId: null,
    kind: "poi",
    parentSlug: null,
    name: partial.slug,
    thumbnail: null,
    gallery: [],
    ...partial,
  } as DestinationMirrorEntity;
}

function buildUsecase(all: DestinationMirrorEntity[]) {
  const deleteCascadeCalls: string[][] = [];
  const siteDbDeleteCalls: Array<{ siteId: number; slug: string }> = [];
  const purgeCalls: string[] = [];
  const removeCalls: string[][] = [];

  const mirrorRepo = {
    findAll: async () => all,
    deleteCascade: async (slugs: readonly string[]) => {
      deleteCascadeCalls.push([...slugs]);
    },
  } as unknown as DestinationMirrorRepository;

  const siteDb = {
    deleteDestination: async (siteId: number, slug: string) => {
      siteDbDeleteCalls.push({ siteId, slug });
    },
  } as unknown as DichoithoiSiteDb;

  const uploader = {
    remove: async (paths: string[]) => {
      removeCalls.push([...paths]);
    },
  } as unknown as ImageUploader;

  const cachePurge = {
    purgeDestination: async (slug: string) => {
      purgeCalls.push(slug);
    },
  } as unknown as CachePurgePort;

  const usecase = new DeleteDestinationUseCase(mirrorRepo, siteDb, uploader, cachePurge);
  return { usecase, deleteCascadeCalls, siteDbDeleteCalls, purgeCalls, removeCalls };
}

describe("DeleteDestinationUseCase", () => {
  it("xoa 1 POI don le (draft) — chi don mirror, khong dong cham SQL Server", async () => {
    const all = [entity({ slug: "thac-a", kind: "poi", thumbnail: "thac-a/thac-a-thumb.webp" })];
    const { usecase, deleteCascadeCalls, siteDbDeleteCalls, removeCalls } = buildUsecase(all);

    const result = await usecase.execute("thac-a");

    expect(result.deletedSlugs).toEqual(["thac-a"]);
    expect(deleteCascadeCalls).toEqual([["thac-a"]]);
    expect(siteDbDeleteCalls).toEqual([]);
    expect(removeCalls).toEqual([
      ["thac-a/thac-a-hero.webp", "thac-a/thac-a-medium.webp", "thac-a/thac-a-thumb.webp"],
    ]);
  });

  it("xoa 1 CUM — cascade xoa CA con chau, thu tu con TRUOC cha", async () => {
    const all = [
      entity({ slug: "da-teh", kind: "cluster", parentSlug: null }),
      entity({ slug: "thac-a", kind: "poi", parentSlug: "da-teh" }),
      entity({ slug: "thac-b", kind: "poi", parentSlug: "da-teh" }),
      entity({ slug: "khac-cum", kind: "poi", parentSlug: "khac" }), // khong lien quan
    ];
    const { usecase, deleteCascadeCalls } = buildUsecase(all);

    const result = await usecase.execute("da-teh");

    // "da-teh" (cha) phai o CUOI mang — con truoc cha
    expect(result.deletedSlugs).toEqual(
      expect.arrayContaining(["thac-a", "thac-b", "da-teh"]),
    );
    expect(result.deletedSlugs[result.deletedSlugs.length - 1]).toBe("da-teh");
    expect(result.deletedSlugs).not.toContain("khac-cum");
    expect(deleteCascadeCalls[0]![deleteCascadeCalls[0]!.length - 1]).toBe("da-teh");
  });

  it("diem DA publish — xoa tren SQL Server + purge cache, ngoai xoa mirror", async () => {
    const all = [entity({ slug: "thac-a", kind: "poi", siteId: 42 })];
    const { usecase, siteDbDeleteCalls, purgeCalls } = buildUsecase(all);

    await usecase.execute("thac-a");

    expect(siteDbDeleteCalls).toEqual([{ siteId: 42, slug: "thac-a" }]);
    expect(purgeCalls).toEqual(["thac-a"]);
  });

  it("khong xoa neu la kind=province — chan som, huong dan xoa tung phan ben trong", async () => {
    const all = [entity({ slug: "lam-dong", kind: "province" })];
    const { usecase } = buildUsecase(all);

    await expect(usecase.execute("lam-dong")).rejects.toThrow(/Tỉnh/);
  });

  it("khong tim thay slug -> throw", async () => {
    const { usecase } = buildUsecase([]);
    await expect(usecase.execute("khong-ton-tai")).rejects.toThrow(/Không tìm thấy/);
  });

  it("preview() tra ve target + danh sach con chau, KHONG xoa gi ca", async () => {
    const all = [
      entity({ slug: "da-teh", kind: "cluster", name: "Đạ Tẻh", siteId: 1 }),
      entity({ slug: "thac-a", kind: "poi", parentSlug: "da-teh", name: "Thác A" }),
    ];
    const { usecase, deleteCascadeCalls } = buildUsecase(all);

    const preview = await usecase.preview("da-teh");

    expect(preview.target).toEqual({ slug: "da-teh", name: "Đạ Tẻh", kind: "cluster", isPublished: true });
    expect(preview.descendants).toEqual([
      { slug: "thac-a", name: "Thác A", kind: "poi", isPublished: false },
    ]);
    expect(deleteCascadeCalls).toEqual([]);
  });

  it("anh cu (1 file .webp, khong theo mau -thumb) chi xoa dung 1 file, khong bia hero/medium", async () => {
    const all = [entity({ slug: "thac-cu", kind: "poi", thumbnail: "thac-cu.webp" })];
    const { usecase, removeCalls } = buildUsecase(all);

    await usecase.execute("thac-cu");

    expect(removeCalls).toEqual([["thac-cu.webp"]]);
  });

  it("gallery item MOI (basename, khong duoi file) xoa du 3 bien the", async () => {
    const all = [
      entity({
        slug: "thac-a",
        kind: "poi",
        gallery: [{ path: "thac-a/gallery/anh-1-123", altText: null, caption: null, credit: null }],
      }),
    ];
    const { usecase, removeCalls } = buildUsecase(all);

    await usecase.execute("thac-a");

    expect(removeCalls).toEqual([
      [
        "thac-a/gallery/anh-1-123-hero.webp",
        "thac-a/gallery/anh-1-123-medium.webp",
        "thac-a/gallery/anh-1-123-thumb.webp",
      ],
    ]);
  });
});
