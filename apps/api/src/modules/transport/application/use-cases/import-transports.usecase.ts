import { Inject, Injectable, Logger } from "@nestjs/common";
import type {
  ImportTransportRowResult,
  ImportTransportsRequest,
  ImportTransportsResult,
  TransportImportRow,
  UpsertTransportRequest,
} from "@zinoflow/contracts";
import { slugifyVietnamese } from "../../../shared/text/vietnamese";
import { TRANSPORT_REPOSITORY, type TransportRepository } from "../ports/transport.repository";
import { UpsertTransportUseCase } from "./upsert-transport.usecase";

type MatchAction =
  | { readonly type: "create" }
  | { readonly type: "update"; readonly matchedId: string }
  | { readonly type: "needsConfirm"; readonly matchedId: string; readonly reason: string };

/**
 * Import hang loat tuyen xe khach tu Google Sheet (transport-plan §3, cung
 * co che product-spec §5.1) — dry-run tra bao cao tung dong, khong ghi DB;
 * apply (dryRun=false) ghi that. KHONG dung chung matcher voi Hotel (sourceUrl
 * co the RONG cho nhieu nha xe chi co SDT) — khoa chinh la sourceUrl KHI CO,
 * khoa phu la operatorName + originSlug + destinationSlug (chuan hoa) khi
 * sourceUrl rong hoac khong khop — tra ve needsConfirm, khong tu ghi de.
 */
@Injectable()
export class ImportTransportsUseCase {
  private readonly logger = new Logger(ImportTransportsUseCase.name);

  constructor(
    @Inject(TRANSPORT_REPOSITORY) private readonly transports: TransportRepository,
    private readonly upsertTransport: UpsertTransportUseCase,
  ) {}

  async execute(request: ImportTransportsRequest): Promise<ImportTransportsResult> {
    const existing = await this.transports.findAll("bus");

    const rows: ImportTransportRowResult[] = [];
    let created = 0;
    let updated = 0;
    let needsConfirm = 0;
    let errors = 0;

    for (let index = 0; index < request.items.length; index++) {
      const item = request.items[index]!;
      const action = matchRow(existing, item);

      try {
        if (action.type === "create") {
          if (!request.dryRun) await this.upsertTransport.create(toUpsertBody(item));
          created += 1;
          rows.push(toRowResult(index, item, action, !request.dryRun));
        } else if (action.type === "update") {
          if (!request.dryRun) await this.upsertTransport.update(action.matchedId, toUpsertBody(item));
          updated += 1;
          rows.push(toRowResult(index, item, action, !request.dryRun));
        } else {
          needsConfirm += 1;
          const shouldApply = !request.dryRun && (request.confirmMergeIndexes ?? []).includes(index);
          if (shouldApply) await this.upsertTransport.update(action.matchedId, toUpsertBody(item));
          rows.push(toRowResult(index, item, action, shouldApply));
        }
      } catch (err) {
        errors += 1;
        rows.push({
          index,
          operatorName: item.operatorName,
          originSlug: item.originSlug,
          destinationSlug: item.destinationSlug,
          action: action.type,
          matchedId: action.type === "create" ? null : action.matchedId,
          reason: action.type === "needsConfirm" ? action.reason : null,
          applied: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    this.logger.log(
      `Import tuyến xe ${request.dryRun ? "(dry-run) " : ""}: ${created} mới, ${updated} cập nhật, ` +
        `${needsConfirm} chờ xác nhận, ${errors} lỗi`,
    );
    return { dryRun: request.dryRun, created, updated, needsConfirm, errors, rows };
  }
}

function toUpsertBody(item: TransportImportRow): UpsertTransportRequest {
  return {
    mode: "bus",
    operatorName: item.operatorName.trim(),
    phone: item.phone ?? null,
    vehicleType: item.vehicleType ?? null,
    priceFrom: item.priceFrom ?? null,
    thumbnailUrl: item.thumbnailUrl ?? null,
    provider: item.provider ?? null,
    sourceUrl: item.sourceUrl?.trim() || null,
    stops: [
      { destinationSlug: item.originSlug, role: "origin", seqOrder: 0 },
      { destinationSlug: item.destinationSlug, role: "destination", seqOrder: 0 },
      ...(item.waypointSlugs ?? []).map((slug, i) => ({
        destinationSlug: slug,
        role: "waypoint" as const,
        seqOrder: i + 1,
      })),
    ],
  };
}

function matchRow(
  existing: Array<{
    id: string;
    sourceUrl: string | null;
    operatorName: string;
    stops: Array<{ destinationSlug: string; role: string }>;
  }>,
  row: TransportImportRow,
): MatchAction {
  const sourceUrl = row.sourceUrl?.trim() || null;
  if (sourceUrl) {
    const bySourceUrl = existing.find((e) => e.sourceUrl === sourceUrl);
    if (bySourceUrl) return { type: "update", matchedId: bySourceUrl.id };
  }

  const normalizedName = slugifyVietnamese(row.operatorName);
  const byCombo = existing.find((e) => {
    const origin = e.stops.find((s) => s.role === "origin")?.destinationSlug;
    const destination = e.stops.find((s) => s.role === "destination")?.destinationSlug;
    return (
      slugifyVietnamese(e.operatorName) === normalizedName &&
      origin === row.originSlug &&
      destination === row.destinationSlug
    );
  });
  if (byCombo) {
    return {
      type: "needsConfirm",
      matchedId: byCombo.id,
      reason: `Trùng nhà xe + tuyến (${row.originSlug} → ${row.destinationSlug}) với bản ghi đã có — xác nhận gộp?`,
    };
  }

  return { type: "create" };
}

function toRowResult(
  index: number,
  item: TransportImportRow,
  action: MatchAction,
  applied: boolean,
): ImportTransportRowResult {
  return {
    index,
    operatorName: item.operatorName,
    originSlug: item.originSlug,
    destinationSlug: item.destinationSlug,
    action: action.type,
    matchedId: action.type === "create" ? null : action.matchedId,
    reason: action.type === "needsConfirm" ? action.reason : null,
    applied,
    error: null,
  };
}
