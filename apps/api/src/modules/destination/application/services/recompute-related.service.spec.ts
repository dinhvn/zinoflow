import { RecomputeRelatedService } from "./recompute-related.service";
import type {
  DestinationMirrorRepository,
  DestinationRelationRepository,
} from "../ports/destination-mirror.repository";
import type { DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import type { CachePurgePort } from "../ports/cache-purge.port";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";

function entity(slug: string, parentSlug: string | null): DestinationMirrorEntity {
  return { slug, parentSlug } as DestinationMirrorEntity;
}

describe("RecomputeRelatedService.affectedSlugsForRename", () => {
  function makeService(all: DestinationMirrorEntity[], sourcesLinkingTo: string[] = []) {
    const mirrorRepo = { findAll: async () => all } as unknown as DestinationMirrorRepository;
    const relationRepo = {
      findSourcesLinkingTo: async () => sourcesLinkingTo,
    } as unknown as DestinationRelationRepository;
    const siteDb = {} as DichoithoiSiteDb;
    const cachePurge = {} as CachePurgePort;
    return new RecomputeRelatedService(mirrorRepo, relationRepo, siteDb, cachePurge);
  }

  it("gom chinh no + cha + toan bo con chau (BFS nhieu tang)", async () => {
    const all = [
      entity("lam-dong", null),
      entity("da-lat", "lam-dong"),
      entity("thung-lung-tinh-yeu", "da-lat"),
      entity("ho-xuan-huong", "da-lat"),
      entity("sapa", null), // khong lien quan
    ];
    const service = makeService(all);

    const result = await service.affectedSlugsForRename("da-lat");

    expect(new Set(result)).toEqual(
      new Set(["da-lat", "lam-dong", "thung-lung-tinh-yeu", "ho-xuan-huong"]),
    );
  });

  it("gom them nguon co quan he/nhac toi slug dang doi", async () => {
    const all = [entity("da-lat", null)];
    const service = makeService(all, ["bai-viet-nhac-da-lat"]);

    const result = await service.affectedSlugsForRename("da-lat");

    expect(new Set(result)).toEqual(new Set(["da-lat", "bai-viet-nhac-da-lat"]));
  });

  it("diem khong ton tai (da bi xoa) van tra ve chinh no, khong throw", async () => {
    const service = makeService([]);

    const result = await service.affectedSlugsForRename("khong-ton-tai");

    expect(result).toEqual(["khong-ton-tai"]);
  });
});
