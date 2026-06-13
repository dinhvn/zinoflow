import { Inject, Injectable, Logger } from "@nestjs/common";
import type { DestinationImportRow, ImportDestinationsResult } from "@zinoflow/contracts";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMetadataInput,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { slugifyVietnamese } from "../../../shared/text/vietnamese";

/**
 * Import danh sach diem den hang loat (UPSERT theo slug, KHONG bao gio wipe).
 * Khac CMS cu (import = xoa sach roi insert -> mat bai AI): o day moi dong
 * la create (slug moi) hoac update metadata (slug da co). Loi 1 dong khong
 * lam hong ca lo — gom vao errors[] de nguoi dung sua rieng dong do.
 * Diem chi nam o mirror (siteId=null) cho toi khi publish tung bai.
 */
@Injectable()
export class ImportDestinationsUseCase {
  private readonly logger = new Logger(ImportDestinationsUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
  ) {}

  async execute(rows: readonly DestinationImportRow[]): Promise<ImportDestinationsResult> {
    const existing = new Set((await this.mirrorRepo.findAll()).map((d) => d.slug));
    const result: ImportDestinationsResult = { created: 0, updated: 0, errors: [] };
    // Slug trung trong CHINH file import -> bao loi thay vi ghi de am tham
    const seenInBatch = new Set<string>();

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i]!;
      const slug = row.slug?.trim() || slugifyVietnamese(row.name);
      try {
        if (!slug) throw new Error("Không sinh được slug từ tên");
        if (seenInBatch.has(slug)) throw new Error(`Slug "${slug}" bị trùng trong file import`);
        seenInBatch.add(slug);

        const meta = toMeta(row);
        if (existing.has(slug)) {
          await this.mirrorRepo.updateMetadata(slug, meta);
          result.updated += 1;
        } else {
          await this.mirrorRepo.createLocal(slug, meta);
          existing.add(slug);
          result.created += 1;
        }

        // Luu thong tin cho AI neu dong co cung cap (ghi de gia tri cu)
        if (row.aiNotes !== undefined || row.referenceUrls !== undefined) {
          await this.mirrorRepo.saveAiInputs(
            slug,
            row.aiNotes?.trim() ? row.aiNotes.trim() : null,
            row.referenceUrls ?? [],
          );
        }
      } catch (err) {
        result.errors.push({
          row: i + 1,
          slug,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    this.logger.log(
      `Import diem den: tao ${result.created}, cap nhat ${result.updated}, loi ${result.errors.length}`,
    );
    return result;
  }
}

/** Dong import -> metadata input (optional/undefined -> null). */
function toMeta(row: DestinationImportRow): DestinationMetadataInput {
  return {
    name: row.name.trim(),
    kind: row.kind,
    parentSlug: row.parentSlug ?? null,
    provinceCode: row.provinceCode ?? null,
    shortDescription: row.shortDescription ?? null,
    thumbnail: row.thumbnail ?? null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    addressNew: row.addressNew ?? null,
    addressOld: row.addressOld ?? null,
    contactPhone: row.contactPhone ?? null,
    contactWebsite: row.contactWebsite ?? null,
    bookingUrl: row.bookingUrl ?? null,
    hotelGroupId: row.hotelGroupId ?? null,
    isFeatured: row.isFeatured ?? false,
  };
}
