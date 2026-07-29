import { Inject, Injectable } from "@nestjs/common";
import { CONTENT_JOB_REPOSITORY, type ContentJobRepository } from "../../../ai-content/application/ports/content-job.repository";
import { GetCoverageScoresUseCase } from "./get-coverage-scores.usecase";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";

/** Diem duoi nguong nay bi tinh la "do phu thap" (destination-spec §7.2) */
const LOW_COVERAGE_THRESHOLD_PERCENT = 60;
/** content-freshness-plan.md Giai doan F — canh bao SOM HON 1 thang so voi nguong
 * an badge phia website (6 thang), de co khoang dem ra lai truoc khi badge bien mat. */
const STALE_CONTENT_THRESHOLD_MONTHS = 5;
/** Phai khop MIN_DESTINATIONS_PER_TAG cua ReverseCheckTagAssignmentsUseCase
 * (khong import truc tiep de tranh keo theo dependency AI provider/usage
 * chi de lay 1 hang so — xem ghi chu o do neu doi nguong). */
const MIN_DESTINATIONS_PER_TAG = 3;

export interface DichoithoiDashboardAlert {
  key: string;
  label: string;
  count: number;
  /** Duong dan CMS de nhay thang toi danh sach da loc (destination-spec §7.2 — moi muc la 1 link) */
  href: string;
}

export interface DichoithoiDashboardAlertsResponse {
  alerts: DichoithoiDashboardAlert[];
  /** % diem publish dat do phu >= nguong — 1 dong suc khoe tong (destination-spec §7.2) */
  coverageHealthPercent: number;
}

/**
 * Khoi "Viec can lam" tren hub CMS dichoithoi (destination-spec §7.2, Phase 23
 * 07/2026). CHI tong hop du lieu da co san (khong bang/job moi) — 1 query/goi
 * usecase co san moi dong. Chi tra ve muc co count > 0 (nguyen tac "khong
 * hien muc chi de biet").
 *
 * Pham vi CHU Y CAT BOT so voi thiet ke day du: 2 dong "X diem Chu luc chua co
 * bai cam nang topic" (can ArticleDestinationMap — Phase 26, chua build) va
 * "X link affiliate no-rule/chet" (trai dai nhieu module Hotel/Tour/Product,
 * de phase rieng) CHUA co o day — se bo sung khi cac phan do xong.
 */
@Injectable()
export class GetDichoithoiDashboardAlertsUseCase {
  constructor(
    @Inject(CONTENT_JOB_REPOSITORY) private readonly jobs: ContentJobRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    private readonly coverageScores: GetCoverageScoresUseCase,
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
  ) {}

  async execute(): Promise<DichoithoiDashboardAlertsResponse> {
    const [coverage, tags, tagAssignments, allJobs, coverageRows, mirrors] = await Promise.all([
      this.coverageScores.execute(),
      this.siteDb.fetchTags(),
      this.siteDb.fetchTagAssignments(),
      this.jobs.findAll(),
      this.siteDb.fetchContentCoverageRows(),
      this.mirrorRepo.findAll(),
    ]);

    const lowCoverageCount = coverage.items.filter(
      (i) => i.scorePercent < LOW_COVERAGE_THRESHOLD_PERCENT,
    ).length;
    const coverageHealthPercent =
      coverage.items.length === 0
        ? 100
        : Math.round(
            (coverage.items.filter((i) => i.scorePercent >= LOW_COVERAGE_THRESHOLD_PERCENT).length /
              coverage.items.length) *
              100,
          );

    // Gom them POI CHUA publish (siteId=null) — tag cua nhom nay o mirror.tags,
    // dam bao dem dung khop voi ReverseCheckTagAssignmentsUseCase (phan hoi
    // nguoi dung 26/07/2026), khong de dashboard bao "duoi nguong" sai vi thieu
    // diem draft da gan tag.
    const draftTagSlugs = mirrors
      .filter((m) => m.kind === "poi" && m.siteId === null)
      .flatMap((m) => m.tags);
    const countByTag = new Map<string, number>();
    for (const a of tagAssignments) {
      for (const slug of a.tagSlugs) countByTag.set(slug, (countByTag.get(slug) ?? 0) + 1);
    }
    for (const slug of draftTagSlugs) countByTag.set(slug, (countByTag.get(slug) ?? 0) + 1);
    const underThresholdTagCount = tags.filter(
      (t) => (countByTag.get(t.slug) ?? 0) < MIN_DESTINATIONS_PER_TAG,
    ).length;

    const dichoithoiJobs = allJobs
      .map((j) => j.toSnapshot())
      .filter((j) => j.siteCode === "dichoithoi");
    const pendingReviewCount = dichoithoiJobs.filter((j) => j.status === "InReview").length;
    const failedJobCount = dichoithoiJobs.filter((j) => j.status === "Failed").length;

    const missingGalleryCount = coverageRows.filter((r) => !r.hasGallery).length;

    // content-freshness-plan.md Giai doan F — bai publish lau khong ai ra lai gia ve/gio mo
    // cua/noi dung (ca 2 moc ContentUpdatedAt/LastVerifiedAt deu null hoac cu hon nguong).
    const staleContentThreshold = new Date();
    staleContentThreshold.setMonth(staleContentThreshold.getMonth() - STALE_CONTENT_THRESHOLD_MONTHS);
    const staleContentCount = coverageRows.filter((r) => {
      const latest =
        !r.contentUpdatedAt || (r.lastVerifiedAt && r.lastVerifiedAt > r.contentUpdatedAt)
          ? r.lastVerifiedAt
          : r.contentUpdatedAt;
      return !latest || latest < staleContentThreshold;
    }).length;

    // Cum/diem thieu toa do (khong tinh tinh) -> khong tinh duoc khoang cach
    // duong bo that (ORS) cho node do (dichoithoi-poi-distance-plan.md), phai
    // sua tay Google Maps link truoc.
    const missingCoordsCount = mirrors.filter(
      (m) => m.kind !== "province" && (m.lat === null || m.lng === null),
    ).length;

    const alerts: DichoithoiDashboardAlert[] = [
      {
        key: "low-coverage",
        label: `${lowCoverageCount} điểm độ phủ nội dung < ${LOW_COVERAGE_THRESHOLD_PERCENT}%`,
        count: lowCoverageCount,
        href: "/dichoithoi/do-phu",
      },
      {
        key: "under-threshold-tag",
        label: `${underThresholdTagCount} chủ đề (tag) dưới ngưỡng ${MIN_DESTINATIONS_PER_TAG} điểm`,
        count: underThresholdTagCount,
        href: "/dichoithoi/chu-de",
      },
      {
        key: "pending-review",
        label: `${pendingReviewCount} draft chờ duyệt`,
        count: pendingReviewCount,
        href: "/content",
      },
      {
        key: "failed-job",
        label: `${failedJobCount} job lỗi`,
        count: failedJobCount,
        href: "/content",
      },
      {
        key: "missing-gallery",
        label: `${missingGalleryCount} điểm không có ảnh gallery`,
        count: missingGalleryCount,
        href: "/dichoithoi",
      },
      {
        key: "missing-coords",
        label: `${missingCoordsCount} cụm/điểm đến chưa có toạ độ`,
        count: missingCoordsCount,
        href: "/dichoithoi?missingCoords=true",
      },
      {
        key: "stale-content",
        label: `${staleContentCount} điểm chưa rà lại nội dung > ${STALE_CONTENT_THRESHOLD_MONTHS} tháng`,
        count: staleContentCount,
        href: "/dichoithoi",
      },
    ].filter((a) => a.count > 0);

    return { alerts, coverageHealthPercent };
  }
}
