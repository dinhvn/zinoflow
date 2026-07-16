import { Column, Entity, PrimaryColumn } from "typeorm";
import type { DestinationAiExtractionFieldItem } from "@zinoflow/contracts";

/**
 * Bang staging cho tinh nang Claude trich xuat thong tin diem den (dichoithoi-
 * destination-ai-extraction-plan §2.1). 1 dong/diem den, upsert khi chay lai skill —
 * khong luu lich su nhieu phien ban. CMS doc bang nay de hien bang so sanh cu/moi.
 */
@Entity("dichoithoi_destination_ai_extractions")
export class DestinationAiExtractionEntity {
  @PrimaryColumn({ name: "destination_slug", type: "varchar", length: 64 })
  destinationSlug!: string;

  /** Google Maps link + web tham khao da doc lan trich xuat nay */
  @Column({ name: "source_urls", type: "jsonb" })
  sourceUrls!: string[];

  @Column({ name: "extracted_at", type: "timestamptz" })
  extractedAt!: Date;

  @Column({ type: "jsonb" })
  fields!: DestinationAiExtractionFieldItem[];
}
