import { Column, Entity, PrimaryColumn } from "typeorm";
import type { DestinationAiExtractionFieldItem, DestinationAiExtractionSource } from "@zinoflow/contracts";

/**
 * Bang staging cho tinh nang trich xuat thong tin diem den (dichoithoi-
 * destination-ai-extraction-plan §2.1, §6 A1). PK composite (destination_slug,
 * source) — toi da 2 dong/diem den (source="skill" tu Claude thu cong qua VS
 * Code, source="gsg" tu Gemini+Google Search Grounding tu dong trong app), upsert
 * khi chay lai CUNG nguon — khong luu lich su nhieu phien ban. CMS doc bang nay
 * de hien bang so sanh cu/moi.
 */
@Entity("dichoithoi_destination_ai_extractions")
export class DestinationAiExtractionEntity {
  @PrimaryColumn({ name: "destination_slug", type: "varchar", length: 64 })
  destinationSlug!: string;

  @PrimaryColumn({ name: "source", type: "varchar", length: 8 })
  source!: DestinationAiExtractionSource;

  /** Google Maps link + web tham khao da doc lan trich xuat nay (rong voi nguon gsg — xem §5.0) */
  @Column({ name: "source_urls", type: "jsonb" })
  sourceUrls!: string[];

  @Column({ name: "extracted_at", type: "timestamptz" })
  extractedAt!: Date;

  @Column({ type: "jsonb" })
  fields!: DestinationAiExtractionFieldItem[];
}
