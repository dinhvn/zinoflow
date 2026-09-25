import { Inject, Injectable, Logger } from "@nestjs/common";
import type { RunGeocodeBatchRequest } from "@zinoflow/contracts";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";

/** listAllMatching() gan them provinceName (join AdminProvinceEntity) — xem typeorm-destination-mirror.repository.ts */
type EntityWithProvince = DestinationMirrorEntity & { provinceName?: string | null };
import {
  PLACE_GEOCODING_PROVIDER,
  type PlaceGeocodingProvider,
} from "../ports/place-geocoding-provider.port";
import { GeocodeBlockedError } from "../../../shared/errors/app-error";
import {
  DESTINATION_GEOCODE_CANDIDATE_REPOSITORY,
  type DestinationGeocodeCandidateRepository,
} from "../ports/destination-geocode-candidate.repository";
import { MACHINE_CONTROL, type MachineControlPort } from "../ports/machine-control.port";
import { excludeAlreadyAttempted, matchesGeocodeFilter } from "../services/geocode-target-filter";
import { buildStagedCandidates, LOCATION_BIAS_RADIUS_METERS } from "../services/geocode-candidate-scoring";

/** So lan thu lai TAI CHO khi bi Google chan truoc khi bo cuoc ("thu vai lan" — yeu cau 06/08/2026). */
const MAX_BLOCKED_RETRIES = 5;
/** Cach nhau giua cac lan thu lai khi bi chan — cho Google co co hoi tu go chan. */
const BLOCKED_RETRY_DELAY_MS = 5 * 60_000;
/**
 * Tu hon so nay -> LUU TEN ung vien de xem lai thay vi tu mo het (yeu cau
 * 10/08/2026: "bạn quản lý, tìm, phân tích... do bạn quyết định hết. Điểm
 * nào không được thì tôi sẽ làm tay" — Claude tu xem qua chat, KHONG goi AI
 * API tu dong nua) — 2 ket qua van tu mo ca 2 nhu cu.
 */
const QUICK_SKIP_MIN_RESULTS = 2;

/**
 * Vong lap that cua Giai doan 1b — chay trong worker (GeocodeBatchWorker),
 * KHONG phai batch AI (khong goi LLM). Provider (PlaywrightGoogleMapsProvider)
 * tu throttle 8-20s/lan + nghi dai moi 50 lan bang trong no, khong can logic
 * rieng o day.
 *
 * 2 co che dac biet (yeu cau 06/08/2026, chay qua dem khong nguoi giam sat):
 * 1. `quickOnly` (mac dinh bat khi filter, tat khi truyen slugs cu the): bo
 *    qua NGAY cac diem Google tra ve nhieu ket qua (mo ho, can ghe tung
 *    trang moi biet dung cai nao) — uu tien xong het cac diem "vao la ra
 *    dung 1 ket qua" truoc, tiet kiem thoi gian. Diem bi bo qua duoc GHI
 *    status "ambiguous" (KHONG de trong) — de loai khoi excludeAlreadyAttempted()
 *    o lan chay sau, tranh quet lai tu dau danh sach moi lan restart/chay
 *    lai (bug thuc te 07/08/2026, xem contracts geocode.ts). Nguoi dung tu
 *    chon quet ky lai (quickOnly=false, truyen slugs cu the) khi muon xu ly.
 * 2. Neu bi Google chan (GeocodeBlockedError) — thu lai TAI CHO toi da
 *    MAX_BLOCKED_RETRIES lan, cach nhau BLOCKED_RETRY_DELAY_MS (block co the
 *    chi tam thoi). Neu van con chan sau tung do lan — TAT MAY that (qua
 *    MachineControlPort, xac nhan nguoi dung 06/08/2026: uu tien tiet kiem
 *    dien hon la de server treo cho vo ich qua dem).
 */
@Injectable()
export class ProcessGeocodeBatchUseCase {
  private readonly logger = new Logger(ProcessGeocodeBatchUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(PLACE_GEOCODING_PROVIDER)
    private readonly geocoder: PlaceGeocodingProvider,
    @Inject(DESTINATION_GEOCODE_CANDIDATE_REPOSITORY)
    private readonly candidateRepo: DestinationGeocodeCandidateRepository,
    @Inject(MACHINE_CONTROL)
    private readonly machineControl: MachineControlPort,
  ) {}

  async execute(payload: RunGeocodeBatchRequest): Promise<void> {
    if (!this.geocoder.isConfigured()) {
      this.logger.error("Chưa cấu hình GOOGLE_MAPS_API_KEY — bỏ qua batch geocode");
      return;
    }

    const all = (await this.mirrorRepo.listAllMatching({
      sortBy: "name",
      sortDir: "asc",
    })) as EntityWithProvince[];
    const parentCoords = new Map<string, { lat: number; lng: number }>();
    for (const d of all) {
      if (d.lat !== null && d.lng !== null) {
        parentCoords.set(d.slug, { lat: Number(d.lat), lng: Number(d.lng) });
      }
    }
    const attemptedSlugs = new Set(await this.candidateRepo.findAllAttemptedSlugs());
    const hasExplicitSlugs = Boolean(payload.slugs && payload.slugs.length > 0);
    const targets = excludeAlreadyAttempted(
      all.filter((d) => matchesGeocodeFilter(d, payload)),
      attemptedSlugs,
      hasExplicitSlugs,
    );
    const quickOnly = payload.quickOnly ?? !hasExplicitSlugs;

    // Chay LAN LUOT theo Tinh -> Cum -> ten diem, thay vi thu tu bat ky tu
    // findAll() (yeu cau 08/08/2026: "chạy random?... muốn chạy lần lượt theo
    // tỉnh, cụm từ trên xuống dưới") — de nguoi dung theo doi/duyet theo tung
    // khu vuc lien tuc thay vi nhay lung tung khap ban do.
    targets.sort((a, b) => {
      const provA = a.provinceName ?? "";
      const provB = b.provinceName ?? "";
      if (provA !== provB) return provA.localeCompare(provB, "vi");
      const parentA = (a.parentSlug ? all.find((d) => d.slug === a.parentSlug)?.name : null) ?? "";
      const parentB = (b.parentSlug ? all.find((d) => d.slug === b.parentSlug)?.name : null) ?? "";
      if (parentA !== parentB) return parentA.localeCompare(parentB, "vi");
      return a.name.localeCompare(b.name, "vi");
    });

    let processed = 0;
    let leftAmbiguous = 0;
    for (const dest of targets) {
      try {
        const parent = dest.parentSlug ? parentCoords.get(dest.parentSlug) : undefined;
        const locationBias = parent
          ? { lat: parent.lat, lng: parent.lng, radiusMeters: LOCATION_BIAS_RADIUS_METERS }
          : undefined;
        const parentName = dest.parentSlug ? all.find((d) => d.slug === dest.parentSlug)?.name : null;
        // Them ten tinh sau ten cum (yeu cau 10/08/2026: "Search map = ten + ten cum + ten tinh")
        // — giup Google dinh vi dung khu vuc khi ten diem/cum trung voi noi khac.
        const query = [dest.name, parentName, dest.provinceName].filter(Boolean).join(", ");

        // Doc ten NGAY tu trang danh sach (khong mo trang nao) — nhanh. Khi ra
        // qua nhieu ket qua (quickOnly), LUU LAI ten cac ung vien (khong bo
        // trong nhu truoc) de nguoi dung (hoac Claude xem truc tiep trong chat,
        // yeu cau 10/08/2026: "bạn quản lý, tìm, phân tích... do bạn quyết định
        // hết" — KHONG goi AI API tu dong, de nguoi/AI xem qua chat tu chon) tu
        // xem lai ma khong can quet lai tu dau.
        const previews = await this.retryOnBlock(
          () => this.geocoder.searchTextList(query, locationBias),
          dest.slug,
        );

        let finalResults: Awaited<ReturnType<typeof this.geocoder.getDetails>>[] = [];
        if (previews.length === 0) {
          finalResults = [];
        } else if (previews.length === 1 || previews.length <= QUICK_SKIP_MIN_RESULTS || !quickOnly) {
          // 1 ket qua, hoac <=2 (thuong 1 trong 2 dung), hoac quickOnly=false
          // (nguoi dung chu dong muon xem het de tu chon) — mo het nhu cu.
          for (const p of previews) {
            finalResults.push(await this.retryOnBlock(() => this.geocoder.getDetails(p.href), dest.slug));
          }
        } else {
          leftAmbiguous += 1;
          await this.candidateRepo.upsert({
            destinationSlug: dest.slug,
            foundAt: new Date(),
            candidates: previews.map((p) => ({
              placeId: p.href,
              displayNameAtDiscovery: p.name,
              confidenceScore: 0,
              distanceToParentMetersAtDiscovery: null,
            })),
            status: "ambiguous",
          });
          processed += 1;
          continue;
        }

        const results = finalResults.filter((r): r is NonNullable<typeof r> => r !== null);
        const staged = buildStagedCandidates(dest.name, results, locationBias);
        await this.candidateRepo.upsert({
          destinationSlug: dest.slug,
          foundAt: new Date(),
          candidates: staged,
          status: staged.length === 0 ? "not-found" : "pending",
        });
      } catch (err) {
        this.logger.error(
          `Geocode lỗi cho "${dest.slug}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      processed += 1;
    }

    this.logger.log(
      `Batch geocode hoàn tất: ${processed}/${targets.length} điểm đã xử lý` +
        (leftAmbiguous > 0
          ? ` (${leftAmbiguous} còn "mơ hồ" nhiều ứng viên — đã lưu tên để xem lại, chưa tự chọn)`
          : ""),
    );
  }

  /**
   * Bi Google chan -> thu lai TAI CHO (khong bo qua diem nay, khong sang diem
   * khac — chan la dieu kien TOAN CUC, diem ke tiep cung se bi chan ngay).
   * Het luot van chan -> tat may that, nem lai loi de dung han batch.
   */
  private async retryOnBlock<T>(fn: () => Promise<T>, slug: string): Promise<T> {
    for (let attempt = 1; attempt <= MAX_BLOCKED_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (!(err instanceof GeocodeBlockedError)) throw err;
        if (attempt >= MAX_BLOCKED_RETRIES) {
          const reason = `Bị Google chặn ${MAX_BLOCKED_RETRIES} lần liên tiếp ở "${slug}", không tự giải được`;
          this.logger.error(`${reason} — tắt máy theo yêu cầu người dùng (06/08/2026)`);
          await this.machineControl.shutdown(reason);
          throw err;
        }
        this.logger.warn(
          `Bị Google chặn (lần ${attempt}/${MAX_BLOCKED_RETRIES}) ở "${slug}" — chờ ` +
            `${BLOCKED_RETRY_DELAY_MS / 60_000} phút rồi thử lại, tự giải CAPTCHA trong cửa sổ Chrome nếu có thể`,
        );
        await sleep(BLOCKED_RETRY_DELAY_MS);
      }
    }
    // Khong bao gio toi day (loop luon return hoac throw) — chi de TS thoa man kieu tra ve.
    throw new GeocodeBlockedError("Google đang chặn — hết lượt thử lại");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
