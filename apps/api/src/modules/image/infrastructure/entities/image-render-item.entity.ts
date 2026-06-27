import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import type { ImageProps } from "@zinoflow/contracts";

/**
 * 1 anh trong job (1 ImageProps) — spec §10.
 * propsJson luu nguyen props da merge BatchConfig de worker render = preview (parity).
 */
@Entity("image_render_items")
export class ImageRenderItemEntity {
  @PrimaryColumn({ type: "uuid" })
  id!: string;

  @Column({ name: "job_id", type: "uuid" })
  @Index()
  jobId!: string;

  @Column({ type: "int" })
  index!: number;

  @Column({ name: "props_json", type: "jsonb" })
  propsJson!: ImageProps;

  @Column({ name: "output_file", type: "varchar", length: 512, nullable: true })
  outputFile!: string | null;

  /** Pending | Completed | Failed */
  @Column({ type: "varchar", length: 16, default: "Pending" })
  status!: string;

  @Column({ type: "text", nullable: true })
  error!: string | null;
}
