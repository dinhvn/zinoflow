import { Column, Entity, PrimaryColumn } from "typeorm";
import type { ArticleAiExtractionSource } from "@zinoflow/contracts";

/**
 * Bang staging trich xuat thong tin nguon cho bai cam nang TRUOC khi AI viet
 * (article-ai-extraction-plan.md GĐ2/GĐ3) — khac han
 * dichoithoi_destination_ai_extractions (gan theo destination_slug, nhieu
 * field co dinh): bang nay gan theo job_id, chi 1 field text tu do.
 */
@Entity("article_ai_extractions")
export class ArticleAiExtractionEntity {
  @PrimaryColumn({ name: "job_id", type: "uuid" })
  jobId!: string;

  @PrimaryColumn({ type: "varchar", length: 20 })
  source!: ArticleAiExtractionSource;

  @Column({ name: "source_urls", type: "jsonb", default: () => "'[]'" })
  sourceUrls!: string[];

  @Column({ name: "extracted_summary", type: "text", default: "" })
  extractedSummary!: string;

  @Column({ name: "extracted_at", type: "timestamptz" })
  extractedAt!: Date;
}
