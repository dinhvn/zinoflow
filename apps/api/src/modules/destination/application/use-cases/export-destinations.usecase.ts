import { Inject, Injectable } from "@nestjs/common";
import {
  DESTINATION_BULK_EDIT_REVIEW_LABELS,
  type DestinationBulkEditFieldKey,
  type ExternalReviewUrlItem,
  type ListDestinationsQuery,
} from "@zinoflow/contracts";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";

/** "," / dấu nháy kép / xuống dòng -> escape theo RFC4180 (quote + nhân đôi "" nếu cần). */
function csvCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** facebookUrl/tripadvisorUrl khong phai cot rieng — lay tu entry khop nhan trong externalReviewUrls. */
function findReviewUrl(items: readonly ExternalReviewUrlItem[], label: string): string {
  return items.find((i) => i.label.trim().toLowerCase() === label.toLowerCase())?.url ?? "";
}

function fieldValue(e: DestinationMirrorEntity, f: DestinationBulkEditFieldKey): string {
  switch (f) {
    case "facebookUrl":
    case "tripadvisorUrl":
      return findReviewUrl(e.externalReviewUrls, DESTINATION_BULK_EDIT_REVIEW_LABELS[f]);
    case "googleMapsUrl":
      return e.googleMapsUrl ?? "";
    case "addressNew":
      return e.addressNew ?? "";
    case "addressOld":
      return e.addressOld ?? "";
    case "contactPhone":
      return e.contactPhone ?? "";
    case "contactWebsite":
      return e.contactWebsite ?? "";
    case "hotelGroupId":
      return e.hotelGroupId ?? "";
    case "shortDescription":
      return e.shortDescription ?? "";
    case "metaTitle":
      return e.metaTitle ?? "";
  }
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
      "q" | "provinceCode" | "parentSlug" | "kind" | "contentState" | "production"
    >,
  ): Promise<string> {
    const entities = await this.mirrorRepo.listAllMatching({
      ...filter,
      sortBy: "name",
      sortDir: "asc",
    });

    // "name" luon xuat kem slug de nguoi dung de nhan biet dong tren Google Sheet — chi tham khao,
    // KHONG nam trong DESTINATION_BULK_EDIT_FIELD_KEYS nen khi nhap lai se khong bao gio bi ghi de.
    const header = ["slug", "name", ...fields];
    const lines = [header.map(csvCell).join(",")];
    for (const e of entities) {
      const row = [e.slug, e.name, ...fields.map((f) => fieldValue(e, f))];
      lines.push(row.map((v) => csvCell(String(v))).join(","));
    }
    return lines.join("\n");
  }
}
