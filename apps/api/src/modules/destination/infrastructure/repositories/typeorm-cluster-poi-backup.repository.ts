import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import type { ClusterPoiBackupRepository } from "../../application/ports/cluster-poi-backup.repository";
import { ClusterPoiBackupEntity } from "../entities/cluster-poi-backup.entity";

@Injectable()
export class TypeOrmClusterPoiBackupRepository implements ClusterPoiBackupRepository {
  constructor(
    @InjectRepository(ClusterPoiBackupEntity)
    private readonly repo: Repository<ClusterPoiBackupEntity>,
  ) {}

  async tableExists(): Promise<boolean> {
    const rows: Array<{ exists: boolean }> = await this.repo.manager.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables WHERE table_name = 'dichoithoi_destinations_backup'
       ) AS exists`,
    );
    return rows[0]?.exists ?? false;
  }

  async findUnrestoredByProvince(provinceCode: string | null): Promise<ClusterPoiBackupEntity[]> {
    if (!(await this.tableExists())) return [];
    return this.repo.find({
      where: {
        provinceCode: provinceCode ?? IsNull(),
        restoredToSlug: IsNull(),
        restoreNote: IsNull(),
      },
    });
  }

  async findBySlug(slug: string): Promise<ClusterPoiBackupEntity | null> {
    if (!(await this.tableExists())) return null;
    return this.repo.findOneBy({ slug });
  }

  /** "Con lai chua xu ly" = chua khoi phuc VA chua bam "Bo han" (GD7). */
  async findAllUnrestored(): Promise<ClusterPoiBackupEntity[]> {
    if (!(await this.tableExists())) return [];
    return this.repo.find({
      where: { restoredToSlug: IsNull(), restoreNote: IsNull() },
      order: { name: "ASC" },
    });
  }

  async countUnrestored(): Promise<number> {
    if (!(await this.tableExists())) return 0;
    return this.repo.countBy({ restoredToSlug: IsNull(), restoreNote: IsNull() });
  }

  async markRestored(slug: string, restoredToSlug: string): Promise<void> {
    await this.repo.update({ slug }, { restoredToSlug });
  }

  async markSkipped(slug: string, note: string): Promise<void> {
    // "restored_to_slug" giu NULL that su (khong khoi phuc), dung restore_note de
    // phan biet "da xu ly xong (bo han)" voi "chua ai dong cham" — man GD7 loc theo
    // ca 2 cot: restoredToSlug IS NULL AND restoreNote IS NULL la CHUA xu ly.
    await this.repo.update({ slug }, { restoreNote: note });
  }
}
