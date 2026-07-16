import { Inject, Injectable } from "@nestjs/common";
import type { DestinationMapItem, GetDestinationsMapResponse } from "@zinoflow/contracts";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { IMAGE_CHECKER, type ImageChecker } from "../ports/image-checker.port";

/**
 * DTO nhe cho trang ban do tong quan CMS (relations-plan §5.1-5.2, Giai doan A4) —
 * tra TOAN BO diem den (khong phan trang, khac GET /destinations thuong), chi
 * cac field can cho marker/popup, tranh keo theo cac cot jsonb nang (gallery,
 * draftArticle...) qua network.
 */
@Injectable()
export class GetDestinationsMapUseCase {
  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(IMAGE_CHECKER) private readonly imageChecker: ImageChecker,
  ) {}

  async execute(): Promise<GetDestinationsMapResponse> {
    const [all, provinces] = await Promise.all([
      this.mirrorRepo.findAll(),
      this.mirrorRepo.listProvinces(),
    ]);
    const provinceNameByCode = new Map(provinces.map((p) => [p.provinceCode, p.shortName]));

    const items: DestinationMapItem[] = all.map((d) => ({
      slug: d.slug,
      name: d.name,
      kind: d.kind as DestinationMapItem["kind"],
      lat: d.lat === null ? null : Number(d.lat),
      lng: d.lng === null ? null : Number(d.lng),
      imageUrl: this.imageChecker.buildUrl(d.thumbnail),
      siteId: d.siteId,
      siteStatus: d.siteStatus,
      contentTier: d.contentTier,
      provinceCode: d.provinceCode,
      provinceName: d.provinceCode ? (provinceNameByCode.get(d.provinceCode) ?? null) : null,
    }));

    return { items };
  }
}
