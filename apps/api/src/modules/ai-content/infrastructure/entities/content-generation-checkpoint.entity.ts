import { Column, Entity, PrimaryColumn } from "typeorm";

/**
 * Bang content_generation_checkpoints — luu tien do generate DANG DO (outline
 * da co + cac section da xong) de resume thay vi chay lai tu dau khi worker
 * chet giua chung (crash/restart/redeliver pg-boss). 1 row / job, xoa khi job
 * xong (DraftReady) hoac khi sua tham so sinh bai (outline cu khong con dung).
 */
@Entity("content_generation_checkpoints")
export class ContentGenerationCheckpointEntity {
  @PrimaryColumn("uuid", { name: "job_id" })
  jobId!: string;

  /** Outline da sinh (buoc 1) — null neu chua qua buoc nay. */
  @Column({ name: "outline_json", type: "jsonb", nullable: true })
  outlineJson!: object | null;

  /** Cac section DA XONG theo dung thu tu (buoc 2) — resume tiep tu section ke tiep. */
  @Column({ name: "sections_json", type: "jsonb" })
  sectionsJson!: object[];

  @Column({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
