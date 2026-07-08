import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * M4 (Phase 3) — bang affiliate_link_rules: nguon su that duy nhat cho co che
 * chuyen doi sourceUrl -> affiliateUrl dung chung cho ticketLinks/hotel/tour.
 * Spec: docs/dichoithoi/dichoithoi-affiliate-link-conversion-spec.md §2.
 */
export class AffiliateLinkRules1781900000000 implements MigrationInterface {
  name = "AffiliateLinkRules1781900000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await queryRunner.query(`
      CREATE TABLE affiliate_link_rules (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        provider      varchar(64) NOT NULL UNIQUE,
        match_domain  varchar(256) NULL,
        template      varchar(1024) NOT NULL,
        placeholder   varchar(16) NOT NULL DEFAULT '{url_enc}',
        is_active     boolean NOT NULL DEFAULT true,
        notes         text NULL,
        created_at    timestamptz NOT NULL DEFAULT now(),
        updated_at    timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_affiliate_link_rules_active ON affiliate_link_rules (is_active)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS affiliate_link_rules`);
  }
}
