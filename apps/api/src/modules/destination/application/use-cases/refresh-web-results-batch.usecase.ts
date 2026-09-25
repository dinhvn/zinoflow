import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import {
  PLACE_GEOCODING_PROVIDER,
  type PlaceGeocodingProvider,
} from "../ports/place-geocoding-provider.port";
import {
  DESTINATION_GEOCODE_CANDIDATE_REPOSITORY,
  type DestinationGeocodeCandidateRepository,
} from "../ports/destination-geocode-candidate.repository";
import { truncateLabel } from "../../../shared/text/truncate-label";

/**
 * Vet lai "Ket qua tren web" cho cac diem den DA "Chap nhan" (accepted) TRUOC
 * khi 2 bug lien tiep duoc sua 08/08/2026 (heading kiem tra truoc khi cuon +
 * regex tieu de neo cung thieu tien to "Cac") khien muc nay LUON tra ve rong.
 * Yeu cau nguoi dung 09/08/2026: "chỉ cần mở map hiện tại ra, kéo xuống và
 * đọc thôi" — KHONG tim kiem lai tu dau, dung thang googleMapsUrl da co san
 * cua destination (`geocoder.getDetails()`), merge ket qua moi vao
 * aiReferenceUrls (dedupe theo url, giong AcceptGeocodeCandidatesUseCase).
 *
 * Tu theo doi tien do: sau khi vet 1 diem (co ket qua hay khong), ghi lai
 * vao candidate dang luu trong bang staging (candidates[].webResultUrlsAtDiscovery)
 * — lan chay sau se tu loai diem da co ket qua khoi danh sach can vet, KHONG
 * can bang/cot theo doi rieng.
 */
@Injectable()
export class RefreshWebResultsBatchUseCase {
  private readonly logger = new Logger(RefreshWebResultsBatchUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(PLACE_GEOCODING_PROVIDER)
    private readonly geocoder: PlaceGeocodingProvider,
    @Inject(DESTINATION_GEOCODE_CANDIDATE_REPOSITORY)
    private readonly candidateRepo: DestinationGeocodeCandidateRepository,
  ) {}

  async execute(): Promise<void> {
    if (!this.geocoder.isConfigured()) {
      this.logger.error("Chưa cấu hình geocoder — bỏ qua vét lại Kết quả trên web");
      return;
    }

    const acceptedRows = await this.candidateRepo.findAccepted();
    const destinations = await this.mirrorRepo.listAllMatching({ sortBy: "name", sortDir: "asc" });
    const destBySlug = new Map(destinations.map((d) => [d.slug, d]));

    const targets = acceptedRows.flatMap((row) => {
      const dest = destBySlug.get(row.destinationSlug);
      if (!dest?.googleMapsUrl) return [];
      const candidate = row.candidates.find(
        (c) => (c.googleMapsUrlAtDiscovery ?? c.placeId) === dest.googleMapsUrl,
      );
      if (!candidate) return [];
      if (candidate.webResultUrlsAtDiscovery && candidate.webResultUrlsAtDiscovery.length > 0) return [];
      return [{ row, dest, candidatePlaceId: candidate.placeId, googleMapsUrl: dest.googleMapsUrl }];
    });

    this.logger.log(`Vét lại "Kết quả trên web": ${targets.length} điểm chưa có kết quả`);

    let processed = 0;
    let withResults = 0;
    for (const target of targets) {
      try {
        const fresh = await this.geocoder.getDetails(target.googleMapsUrl);
        const webResultUrls = fresh?.webResultUrls ?? [];

        const updatedCandidates = target.row.candidates.map((c) =>
          c.placeId === target.candidatePlaceId ? { ...c, webResultUrlsAtDiscovery: webResultUrls } : c,
        );
        await this.candidateRepo.upsert({
          destinationSlug: target.row.destinationSlug,
          foundAt: target.row.foundAt,
          candidates: updatedCandidates,
          status: target.row.status,
        });

        if (webResultUrls.length > 0) {
          withResults += 1;
          const existingUrls = new Set(target.dest.aiReferenceUrls.map((u) => u.url));
          const newUrls = webResultUrls
            .filter((u) => !existingUrls.has(u.url))
            .map((u) => ({ label: truncateLabel(u.label, 100), url: u.url }));
          if (newUrls.length > 0) {
            await this.mirrorRepo.saveAiInputs(target.dest.slug, target.dest.aiNotes, [
              ...target.dest.aiReferenceUrls,
              ...newUrls,
            ]);
          }
        }
      } catch (err) {
        this.logger.error(
          `Vét "Kết quả trên web" lỗi cho "${target.row.destinationSlug}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      processed += 1;
    }

    this.logger.log(
      `Vét "Kết quả trên web" hoàn tất: ${processed}/${targets.length} điểm đã xử lý, ${withResults} điểm lấy được link mới`,
    );
  }
}
