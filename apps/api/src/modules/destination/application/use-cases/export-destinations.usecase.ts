import { Inject, Injectable } from "@nestjs/common";
import type { DestinationBulkEditFieldKey, ListDestinationsQuery } from "@zinoflow/contracts";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";

/** "," / dấu nháy kép / xuống dòng -> escape theo RFC4180 (quote + nhân đôi "" nếu cần). */
function csvCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Xuat CSV "slug" + cac cot field co ban da chon (googleMapsUrl/addressNew/...) —
 * dung de nguoi dung sua hang loat qua Google Sheet roi nhap lai (BulkUpdate
 * DestinationFieldsUseCase). Luon xuat HET diem den khop filter, KHONG cat
 * trang (khac /destinations list — filter theo dung bo loc dang xem, nhung
 * khong gioi han boi trang hien tai).
 */
@Injectable()
export class ExportDestinationsUseCase {
  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
  ) {}

  async execute(
    fields: readonly DestinationBulkEditFieldKey[],
    filter: Pick<
      ListDestinationsQuery,
      "q" | "provinceCode" | "kind" | "contentState" | "production"
    >,
  ): Promise<string> {
    const entities = await this.mirrorRepo.listAllMatching({
      ...filter,
      sortBy: "name",
      sortDir: "asc",
    });

    const header = ["slug", ...fields];
    const lines = [header.map(csvCell).join(",")];
    for (const e of entities) {
      const row = [e.slug, ...fields.map((f) => e[f] ?? "")];
      lines.push(row.map((v) => csvCell(String(v))).join(","));
    }
    return lines.join("\n");
  }
}
