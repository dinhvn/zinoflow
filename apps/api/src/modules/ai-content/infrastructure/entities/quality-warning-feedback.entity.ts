import { Column, Entity, Index, PrimaryColumn } from "typeorm";

/** Audit event reviewer dismiss warning; append-only o application layer. */
@Entity("quality_warning_feedback")
export class QualityWarningFeedbackEntity {
  @PrimaryColumn("uuid")
  id!: string;

  @Column({ name: "target_type", type: "varchar", length: 20 })
  targetType!: string;

  @Index()
  @Column({ name: "target_id", type: "varchar", length: 128 })
  targetId!: string;

  @Column({ name: "gate_name", type: "varchar", length: 50 })
  gateName!: string;

  @Column({ name: "detail_hash", type: "varchar", length: 64 })
  detailHash!: string;

  @Column({ type: "text" })
  reason!: string;

  @Column({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
