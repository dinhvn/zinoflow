import { Inject, Injectable, Logger } from "@nestjs/common";
import type {
  DeleteDestinationImpactItem,
  DeleteDestinationResponse,
  PreviewDeleteDestinationResponse,
} from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import { CACHE_PURGE, type CachePurgePort } from "../ports/cache-purge.port";
import { IMAGE_UPLOADER, type ImageUploader } from "../../../shared/media/ports/image-uploader.port";
import { resolveImageFilePaths } from "../services/gallery-json.util";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";

/**
 * Xoa han 1 diem den (kind=poi, khong con chau) hoac 1 cum (kind=cluster,
 * xoa CA con chau ben trong — user request 27/07/2026: "xóa cụm thì xóa toàn
 * bộ điểm trong cụm"). Ho tro xoa CA diem/cum DA PUBLISH tren site that
 * (khong chi draft) — xoa cung tren SQL Server + don gallery/thumbnail tren
 * hosting + don moi bang tham chieu Postgres khong co FK, tat ca theo thu tu
 * CON TRUOC CHA de an toan voi rang buoc ParentId (neu co) ben SQL Server.
 *
 * KHONG ho tro xoa kind=province truc tiep — pham vi qua rong (ca 1 tinh),
 * ngoai yeu cau ("xóa điểm đến, xóa cụm") — chan som, huong dan xoa tung
 * cum/diem ben trong truoc.
 */
@Injectable()
export class DeleteDestinationUseCase {
  private readonly logger = new Logger(DeleteDestinationUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    @Inject(IMAGE_UPLOADER) private readonly uploader: ImageUploader,
    @Inject(CACHE_PURGE) private readonly cachePurge: CachePurgePort,
  ) {}

  async preview(slug: string): Promise<PreviewDeleteDestinationResponse> {
    const all = await this.mirrorRepo.findAll();
    const self = all.find((d) => d.slug === slug);
    if (!self) throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}"`);
    this.assertDeletable(self);

    const descendants = collectDescendantsBottomUp(slug, all).reverse(); // hien thi cha->con cho de doc
    return {
      target: toImpactItem(self),
      descendants: descendants.map(toImpactItem),
    };
  }

  async execute(slug: string): Promise<DeleteDestinationResponse> {
    const all = await this.mirrorRepo.findAll();
    const self = all.find((d) => d.slug === slug);
    if (!self) throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}"`);
    this.assertDeletable(self);

    const descendants = collectDescendantsBottomUp(slug, all);
    const orderedBottomUp = [...descendants, self];

    // 1) Xoa tren SQL Server (neu da publish) — con truoc cha, purge cache trang
    // da xoa (khong purge duoc, se 404 tu nhien nhung purge de dam bao khong con
    // cache CDN cu phuc vu nham noi dung da xoa)
    for (const item of orderedBottomUp) {
      if (item.siteId !== null) {
        await this.siteDb.deleteDestination(item.siteId, item.slug);
        await this.cachePurge.purgeDestination(item.slug);
      }
    }

    // 2) Don anh vat ly tren hosting (best-effort, khong chan neu loi)
    for (const item of orderedBottomUp) {
      const paths: string[] = [];
      if (item.thumbnail) paths.push(...resolveImageFilePaths(item.thumbnail));
      for (const g of item.gallery) paths.push(...resolveImageFilePaths(g.path));
      if (paths.length > 0) await this.uploader.remove(paths);
    }

    // 3) Xoa mirror Postgres + moi bang tham chieu khac (1 transaction)
    const deletedSlugs = orderedBottomUp.map((d) => d.slug);
    await this.mirrorRepo.deleteCascade(deletedSlugs);

    this.logger.log(
      `Xoá điểm đến "${slug}"${descendants.length > 0 ? ` + ${descendants.length} con cháu` : ""}`,
    );
    return { deletedSlugs };
  }

  private assertDeletable(entity: DestinationMirrorEntity): void {
    if (entity.kind === "province") {
      throw new DomainRuleError(
        `Không hỗ trợ xoá cấp Tỉnh "${entity.name}" trực tiếp — phạm vi quá rộng`,
        ["Xoá từng cụm/điểm đến bên trong tỉnh này trước"],
      );
    }
  }
}

function toImpactItem(d: DestinationMirrorEntity): DeleteDestinationImpactItem {
  return {
    slug: d.slug,
    name: d.name,
    kind: d.kind as DeleteDestinationImpactItem["kind"],
    isPublished: d.siteId !== null,
  };
}

/**
 * BFS/post-order theo parent_slug — tra ve TOAN BO con chau cua rootSlug,
 * CON SAU (cang sau cang o cuoi mang) de xoa an toan tu duoi len (con truoc
 * cha), tranh vi pham rang buoc ParentId (neu co) khi xoa tren SQL Server.
 */
function collectDescendantsBottomUp(
  rootSlug: string,
  all: readonly DestinationMirrorEntity[],
): DestinationMirrorEntity[] {
  const childrenOf = new Map<string, DestinationMirrorEntity[]>();
  for (const d of all) {
    if (!d.parentSlug) continue;
    const arr = childrenOf.get(d.parentSlug) ?? [];
    arr.push(d);
    childrenOf.set(d.parentSlug, arr);
  }

  const result: DestinationMirrorEntity[] = [];
  const visit = (slug: string): void => {
    for (const child of childrenOf.get(slug) ?? []) {
      visit(child.slug);
      result.push(child);
    }
  };
  visit(rootSlug);
  return result;
}
