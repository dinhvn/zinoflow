import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import type { AffiliateLinkStatus } from "@zinoflow/contracts";

/**
 * Bang products (Postgres) — nguon su that duy nhat, KHONG dong bo SQL Server
 * (dichoithoi-product-spec.md §3). Compile thang vao ContentHtml luc publish bai.
 */
@Entity("products")
export class ProductEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 256 })
  name!: string;

  /** 1 gia tri co kiem soat, dung de duyet/loc man quan ly (KHONG dung de match) */
  @Column({ type: "varchar", length: 64 })
  category!: string;

  /** Nhieu gia tri tu do, dung de match tham so tag= trong token chen bai */
  @Column({ type: "text", array: true, default: () => "'{}'" })
  tags!: string[];

  @Column({ name: "thumbnail_url", type: "varchar", length: 512, nullable: true })
  thumbnailUrl!: string | null;

  @Column({ type: "decimal", precision: 12, scale: 0, nullable: true })
  price!: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  provider!: string | null;

  @Column({ name: "source_url", type: "varchar", length: 512 })
  sourceUrl!: string;

  @Column({ name: "affiliate_url", type: "varchar", length: 512, nullable: true })
  affiliateUrl!: string | null;

  @Column({ name: "link_status", type: "varchar", length: 20, default: "no-rule" })
  linkStatus!: AffiliateLinkStatus;

  /** 0 nhap tay, 1 cao */
  @Column({ type: "smallint", default: 0 })
  source!: number;

  /** 0 an, 1 published — mac dinh 1, chua co UI toggle o MVP */
  @Column({ type: "smallint", default: 1 })
  status!: number;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
