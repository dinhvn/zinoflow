import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Thay affiliate_link_rules (1 provider = 1 template) bang mo hinh 2 tang:
 * affiliate_networks (mang affiliate, vd Accesstrade — template DUNG CHUNG cho
 * moi doi tac) + affiliate_partners (doi tac cu the, gan vao 1 mang). Bang cu
 * chua co du lieu that (kiem tra truoc khi viet migration) — xoa thang, khong
 * migrate. Doc: dichoithoi-affiliate-provider-management-analysis.md §3.
 */
export class AffiliateNetworksPartners1782080000000 implements MigrationInterface {
  name = "AffiliateNetworksPartners1782080000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS affiliate_link_rules`);

    await queryRunner.query(`
      CREATE TABLE affiliate_networks (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code        varchar(64) NOT NULL UNIQUE,
        name        varchar(128) NOT NULL,
        template    varchar(1024) NOT NULL,
        placeholder varchar(16) NOT NULL DEFAULT '{url_enc}',
        is_active   boolean NOT NULL DEFAULT true,
        notes       text NULL,
        created_at  timestamptz NOT NULL DEFAULT now(),
        updated_at  timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE affiliate_partners (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code          varchar(64) NOT NULL UNIQUE,
        name          varchar(128) NOT NULL,
        homepage_url  varchar(512) NULL,
        description   text NULL,
        network_id    uuid NULL REFERENCES affiliate_networks(id) ON DELETE SET NULL,
        match_domain  varchar(256) NULL,
        is_active     boolean NOT NULL DEFAULT true,
        created_at    timestamptz NOT NULL DEFAULT now(),
        updated_at    timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_affiliate_partners_network ON affiliate_partners (network_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_affiliate_partners_active ON affiliate_partners (is_active)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS affiliate_partners`);
    await queryRunner.query(`DROP TABLE IF EXISTS affiliate_networks`);
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
  }
}
