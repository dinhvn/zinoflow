import { Inject, Injectable, Logger } from "@nestjs/common";
import type {
  ImportToursRequest,
  ImportToursResult,
  ImportTourRowResult,
  TourImportRow,
} from "@zinoflow/contracts";
import { TOUR_REPOSITORY, type TourRepository } from "../ports/tour.repository";
import { matchImportRow, type ImportMatchCandidate } from "../../../shared/sheet-import/import-matcher";
import { UpsertTourUseCase } from "./upsert-tour.usecase";

/**
 * Import hang loat tour tu Google Sheet (tour-spec §5, product-spec §5.1) —
 * cung co che voi ImportHotelsUseCase (UPSERT theo sourceUrl + khoa phu
 * ten+tinh can xac nhan).
 */
@Injectable()
export class ImportToursUseCase {
  private readonly logger = new Logger(ImportToursUseCase.name);

  constructor(
    @Inject(TOUR_REPOSITORY) private readonly tours: TourRepository,
    private readonly upsertTour: UpsertTourUseCase,
  ) {}

  async execute(request: ImportToursRequest): Promise<ImportToursResult> {
    const existing = await this.tours.findAll();
    const candidates: ImportMatchCandidate[] = existing.map((t) => ({
      id: t.id,
      sourceUrl: t.sourceUrl,
      name: t.name,
      provinceCode: t.provinceCode,
    }));

    const rows: ImportTourRowResult[] = [];
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
          if (!request.dryRun) await this.upsertTour.create(item);
          created += 1;
          rows.push(toRowResult(item, action, !request.dryRun));
        } else if (action.type === "update") {
          if (!request.dryRun) await this.upsertTour.update(action.matchedId, item);
          updated += 1;
          rows.push(toRowResult(item, action, !request.dryRun));
        } else {
          needsConfirm += 1;
          const confirmedId = request.confirmMergeIds?.[item.sourceUrl.trim()];
          const shouldApply = !request.dryRun && confirmedId === action.matchedId;
          if (shouldApply) await this.upsertTour.update(action.matchedId, item);
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
      `Import tour ${request.dryRun ? "(dry-run) " : ""}: ${created} mới, ${updated} cập nhật, ` +
        `${needsConfirm} chờ xác nhận, ${errors} lỗi`,
    );
    return { dryRun: request.dryRun, created, updated, needsConfirm, errors, rows };
  }
}

function toRowResult(
  item: TourImportRow,
  action: { type: "create" } | { type: "update"; matchedId: string } | { type: "needsConfirm"; matchedId: string; reason: string },
  applied: boolean,
): ImportTourRowResult {
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
