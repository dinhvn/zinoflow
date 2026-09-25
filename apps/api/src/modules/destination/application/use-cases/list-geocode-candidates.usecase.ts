import { Inject, Injectable } from "@nestjs/common";
import type { ListGeocodeCandidatesResponse } from "@zinoflow/contracts";
import {
  DESTINATION_GEOCODE_CANDIDATE_REPOSITORY,
  type DestinationGeocodeCandidateRepository,
} from "../ports/destination-geocode-candidate.repository";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";

/** listAllMatching() join san quan he "province" (AdminProvinceEntity) qua QueryBuilder — xem typeorm-destination-mirror.repository.ts */
type EntityWithProvince = DestinationMirrorEntity & { province?: { shortName: string } | null };

/**
 * Danh sach dong staging con "pending"/"not-found" — dung cho bang duyet hang
 * loat (Giai doan 1b) hoac 1 dong CU THE (`slug` — dung cho khung "Tim
 * Google Maps" ngay trong tab AI ho tro cua trang chi tiet 1 diem den, thong
 * nhat 05/08/2026: xem GeocodeCandidatesPanel voi prop `slugFilter`). Join
 * them ten/cum cha/tinh cua CHINH diem den (khong phai ung vien Google) de
 * bang duyet de doc hon chi hien slug (yeu cau 06/08/2026).
 */
@Injectable()
export class ListGeocodeCandidatesUseCase {
  constructor(
    @Inject(DESTINATION_GEOCODE_CANDIDATE_REPOSITORY)
    private readonly repo: DestinationGeocodeCandidateRepository,
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
  ) {}

  async execute(slug?: string): Promise<ListGeocodeCandidatesResponse> {
    const records = slug
      ? await this.repo
          .findBySlug(slug)
          .then((r) =>
            r && (r.status === "pending" || r.status === "not-found" || r.status === "ambiguous") ? [r] : [],
          )
      : await this.repo.findPending();

    const all = (await this.mirrorRepo.listAllMatching({
      sortBy: "name",
      sortDir: "asc",
    })) as EntityWithProvince[];
    const bySlug = new Map(all.map((d) => [d.slug, d]));

    return {
      records: records.map((r) => {
        const dest = bySlug.get(r.destinationSlug);
        const parent = dest?.parentSlug ? bySlug.get(dest.parentSlug) : undefined;
        return {
          destinationSlug: r.destinationSlug,
          destinationName: dest?.name ?? null,
          parentName: parent?.name ?? null,
          provinceName: dest?.province?.shortName ?? null,
          foundAt: r.foundAt.toISOString(),
          candidates: r.candidates,
          status: r.status,
        };
      }),
    };
  }
}
