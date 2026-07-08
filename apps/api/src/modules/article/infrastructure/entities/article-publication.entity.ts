import { Column, Entity, PrimaryColumn } from "typeorm";

/**
 * Anh xa 1 ContentJob (articleType=cam-nang) -> bai da publish ben SQL Server
 * (article-spec §8 khong de cap bang nay ro rang, nhung can de "Lam moi khoi
 * dong"/batch refresh biet publish lai bai nao). KHONG luu RawContent — chi
 * theo doi trang thai publish, nguon that van la content_drafts.
 */
@Entity("article_publications")
export class ArticlePublicationEntity {
  @PrimaryColumn({ name: "job_id", type: "uuid" })
  jobId!: string;

  @Column({ name: "site_id", type: "int" })
  siteId!: number;

  @Column({ type: "varchar", length: 128 })
  slug!: string;

  @Column({ name: "published_at", type: "timestamptz" })
  publishedAt!: Date;

  @Column({ name: "last_refreshed_at", type: "timestamptz", nullable: true })
  lastRefreshedAt!: Date | null;
}
