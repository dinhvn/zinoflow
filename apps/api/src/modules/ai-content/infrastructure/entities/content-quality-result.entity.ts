import { Column, Entity, Index, PrimaryColumn } from "typeorm";

/** Bang content_quality_results — ket qua tung gate cho 1 draft (spec §9). */
@Entity("content_quality_results")
export class ContentQualityResultEntity {
  @PrimaryColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "draft_id", type: "uuid" })
  draftId!: string;

  /** "structure" | "seo" | "policy" | "data" */
  @Column({ name: "gate_name", type: "varchar", length: 50 })
  gateName!: string;

  @Column({ type: "boolean" })
  passed!: boolean;

  /** Danh sach ly do fail (mang string) de UI hien checklist. */
  @Column({ type: "jsonb", default: () => "'[]'" })
  details!: string[];

  @Column({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
