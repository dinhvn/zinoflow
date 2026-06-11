import { Column, Entity, PrimaryColumn, Unique } from "typeorm";

/**
 * Bang prompt_templates — prompt luu DB + version (spec §4.1).
 * Doi prompt = tao version moi + chuyen is_active, KHONG sua version cu
 * (de doi chieu duoc bai nao generate boi prompt nao).
 */
@Entity("prompt_templates")
@Unique(["templateKey", "version"])
export class PromptTemplateEntity {
  @PrimaryColumn("uuid")
  id!: string;

  /** vd: "toplist.outline.vi", "toplist.section.vi", "review.outline.vi" */
  @Column({ name: "template_key", type: "varchar", length: 100 })
  templateKey!: string;

  @Column({ type: "int", default: 1 })
  version!: number;

  @Column({ type: "text" })
  content!: string;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @Column({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
