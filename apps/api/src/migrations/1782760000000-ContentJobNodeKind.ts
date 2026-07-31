import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * content_jobs.node_kind: chi y nghia voi articleType guide-diem-den (dat tu
 * Kind cua diem den luc tao job — poi/cluster/province). Thay Phase 28.3
 * (truoc day dung content_tier de chon prompt POI vs Cum) — chon prompt gio
 * dua theo Kind, contentTier chi con la bien noi dung chinh do sau ben trong
 * prompt Cum (xem prompt-builder.ts).
 */
export class ContentJobNodeKind1782760000000 implements MigrationInterface {
  name = "ContentJobNodeKind1782760000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE content_jobs ADD COLUMN node_kind varchar(16) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE content_jobs DROP COLUMN node_kind`);
  }
}
