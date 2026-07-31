import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Module Van chuyen (Ve xe khach mode=2, Ve may bay mode=1 du phong) — bang
 * transports + transport_stops (Postgres, nguon su that). Gan theo TUYEN co
 * diem dung (khong theo POI). Spec:
 * docs/dichoithoi/dichoithoi-transport-vexekhach-plan.md §2.
 */
export class TransportModule1782840000000 implements MigrationInterface {
  name = "TransportModule1782840000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE transports (
        id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        mode           smallint NOT NULL,
        operator_name  varchar(256) NOT NULL,
        phone          varchar(32) NULL,
        vehicle_type   varchar(64) NULL,
        price_from     decimal(12,0) NULL,
        thumbnail_url  varchar(512) NULL,
        provider       varchar(64) NULL,
        source_url     varchar(512) NULL,
        affiliate_url  varchar(512) NULL,
        link_status    varchar(20) NOT NULL DEFAULT 'no-rule',
        source         smallint NOT NULL DEFAULT 0,
        site_id        int NULL,
        created_at     timestamptz NOT NULL DEFAULT now(),
        updated_at     timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_transports_mode ON transports (mode)`);

    await queryRunner.query(`
      CREATE TABLE transport_stops (
        transport_id      uuid NOT NULL REFERENCES transports(id) ON DELETE CASCADE,
        destination_slug  varchar(64) NOT NULL,
        role               smallint NOT NULL,
        seq_order          smallint NOT NULL DEFAULT 0,
        PRIMARY KEY (transport_id, destination_slug)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_transport_stops_destination ON transport_stops (destination_slug)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS transport_stops`);
    await queryRunner.query(`DROP TABLE IF EXISTS transports`);
  }
}
