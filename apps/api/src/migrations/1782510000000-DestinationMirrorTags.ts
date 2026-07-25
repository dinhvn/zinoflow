import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Mirror hoa tap Tag (nhieu-nhieu) sang Postgres — tin hieu doc lap voi "types"
 * trong thuat toan cham diem quan he (relations-plan §1.3): Type = "la gi" (ban
 * chat vat ly), Tag = "phu hop trai nghiem gi" (cat ngang). Xem
 * SyncDestinationsUseCase/fetchAllDestinations() cho chieu dong bo. Mang rong =
 * chua co Tag nao hoac kind != poi (province/cluster khong gan Tag).
 */
export class DestinationMirrorTags1782510000000 implements MigrationInterface {
  name = "DestinationMirrorTags1782510000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "dichoithoi_destinations" ADD COLUMN "tags" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "dichoithoi_destinations" DROP COLUMN "tags"`);
  }
}
