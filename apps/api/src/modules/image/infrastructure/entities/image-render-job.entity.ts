import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from "typeorm";

/**
 * Job render anh collage — spec image-tool §10, §13.
 * 1 job = 1 lan export batch; moi anh la 1 ImageRenderItem.
 */
@Entity("image_render_jobs")
export class ImageRenderJobEntity {
  @PrimaryColumn({ type: "uuid" })
  id!: string;

  @Column({ type: "varchar", length: 16 })
  aspect!: string;

  @Column({ name: "per_image", type: "int" })
  perImage!: number;

  /** Created | Rendering | Completed | Failed */
  @Column({ type: "varchar", length: 16 })
  @Index()
  status!: string;

  @Column({ name: "total_items", type: "int" })
  totalItems!: number;

  @Column({ name: "completed_items", type: "int", default: 0 })
  completedItems!: number;

  @Column({ name: "export_format", type: "varchar", length: 8 })
  exportFormat!: string;

  @Column({ name: "export_quality", type: "int" })
  exportQuality!: number;

  @Column({ name: "export_scale", type: "decimal", precision: 4, scale: 2 })
  exportScale!: string;

  @Column({ name: "output_dir", type: "varchar", length: 512, nullable: true })
  outputDir!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  @Index()
  createdAt!: Date;
}
