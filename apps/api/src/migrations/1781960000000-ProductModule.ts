import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Phase 16 — module San pham (dichoithoi-product-spec.md §3). Postgres-only,
 * KHONG dong bo SQL Server — compile thang vao ContentHtml luc publish bai
 * (khac Hotel/Tour, khong can card render truc tiep tren trang dia diem).
 */
export class ProductModule1781960000000 implements MigrationInterface {
  name = "ProductModule1781960000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE products (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name          varchar(256) NOT NULL,
        category      varchar(64) NOT NULL,
        tags          text[] NOT NULL DEFAULT '{}',
        thumbnail_url varchar(512),
        price         numeric(12,0),
        provider      varchar(64),
        source_url    varchar(512) NOT NULL,
        affiliate_url varchar(512),
        link_status   varchar(20) NOT NULL DEFAULT 'no-rule',
        source        smallint NOT NULL DEFAULT 0,
        status        smallint NOT NULL DEFAULT 1,
        created_at    timestamptz NOT NULL DEFAULT now(),
        updated_at    timestamptz NOT NULL DEFAULT now()
      );
    `);
    // GIN index cho tags[] — truy van "&&" (overlap) khi match tag OR trong compiler
    await queryRunner.query(`CREATE INDEX IX_products_tags ON products USING GIN (tags);`);
    await queryRunner.query(`CREATE INDEX IX_products_category ON products (category);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE products`);
  }
}
