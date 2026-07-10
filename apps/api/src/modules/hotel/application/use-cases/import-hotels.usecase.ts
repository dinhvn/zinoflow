import { Inject, Injectable, Logger } from "@nestjs/common";
import type {
  HotelImportRow,
  ImportHotelRowResult,
  ImportHotelsRequest,
  ImportHotelsResult,
} from "@zinoflow/contracts";
import { HOTEL_REPOSITORY, type HotelRepository } from "../ports/hotel.repository";
import { matchImportRow, type ImportMatchCandidate } from "../../../shared/sheet-import/import-matcher";
import { UpsertHotelUseCase } from "./upsert-hotel.usecase";

/**
 * Import hang loat khach san tu Google Sheet (hotel-spec §5, product-spec §5.1):
 * dry-run tra bao cao (create/update/needsConfirm/loi) tung dong, KHONG ghi
 * DB; apply (dryRun=false) ghi that create/update — needsConfirm CHI ghi khi
 * `confirmMergeIds[sourceUrl]` khop dung matchedId (an toan, khong am tham
 * ghi de ban ghi nhap tay truoc do).
 */
@Injectable()
export class ImportHotelsUseCase {
  private readonly logger = new Logger(ImportHotelsUseCase.name);

  constructor(
    @Inject(HOTEL_REPOSITORY) private readonly hotels: HotelRepository,
    private readonly upsertHotel: UpsertHotelUseCase,
  ) {}

  async execute(request: ImportHotelsRequest): Promise<ImportHotelsResult> {
    const existing = await this.hotels.findAll();
    const candidates: ImportMatchCandidate[] = existing.map((h) => ({
      id: h.id,
      sourceUrl: h.sourceUrl,
      name: h.name,
      provinceCode: h.provinceCode,
    }));

    const rows: ImportHotelRowResult[] = [];
    let created = 0;
    let updated = 0;
    let needsConfirm = 0;
    let errors = 0;

    for (const item of request.items) {
      const action = matchImportRow(candidates, {
        sourceUrl: item.sourceUrl.trim(),
        name: item.name.trim(),
        provinceCode: item.provinceCode ?? null,
      });

      try {
        if (action.type === "create") {
          if (!request.dryRun) await this.upsertHotel.create(item);
          created += 1;
          rows.push(toRowResult(item, action, !request.dryRun));
        } else if (action.type === "update") {
          if (!request.dryRun) await this.upsertHotel.update(action.matchedId, item);
          updated += 1;
          rows.push(toRowResult(item, action, !request.dryRun));
        } else {
          needsConfirm += 1;
          const confirmedId = request.confirmMergeIds?.[item.sourceUrl.trim()];
          const shouldApply = !request.dryRun && confirmedId === action.matchedId;
          if (shouldApply) await this.upsertHotel.update(action.matchedId, item);
          rows.push(toRowResult(item, action, shouldApply));
        }
      } catch (err) {
        errors += 1;
        rows.push({
          sourceUrl: item.sourceUrl,
          name: item.name,
          action: action.type,
          matchedId: action.type === "create" ? null : action.matchedId,
          reason: action.type === "needsConfirm" ? action.reason : null,
          applied: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    this.logger.log(
      `Import khách sạn ${request.dryRun ? "(dry-run) " : ""}: ${created} mới, ${updated} cập nhật, ` +
        `${needsConfirm} chờ xác nhận, ${errors} lỗi`,
    );
    return { dryRun: request.dryRun, created, updated, needsConfirm, errors, rows };
  }
}

function toRowResult(
  item: HotelImportRow,
  action: { type: "create" } | { type: "update"; matchedId: string } | { type: "needsConfirm"; matchedId: string; reason: string },
  applied: boolean,
): ImportHotelRowResult {
  return {
    sourceUrl: item.sourceUrl,
    name: item.name,
    action: action.type,
    matchedId: action.type === "create" ? null : action.matchedId,
    reason: action.type === "needsConfirm" ? action.reason : null,
    applied,
    error: null,
  };
}
