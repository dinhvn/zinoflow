import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { ClusterPoiCandidateItem } from "@zinoflow/contracts";
import type {
  ClusterPoiCandidateRecord,
  ClusterPoiCandidateRepository,
} from "../../application/ports/cluster-poi-candidate.repository";
import { ClusterPoiCandidateEntity } from "../entities/cluster-poi-candidate.entity";

function toRecord(e: ClusterPoiCandidateEntity): ClusterPoiCandidateRecord {
  return {
    clusterSlug: e.clusterSlug,
    extractedAt: e.extractedAt,
    candidates: e.candidates,
  };
}

@Injectable()
export class TypeOrmClusterPoiCandidateRepository implements ClusterPoiCandidateRepository {
  constructor(
    @InjectRepository(ClusterPoiCandidateEntity)
    private readonly repo: Repository<ClusterPoiCandidateEntity>,
  ) {}

  async findByClusterSlug(clusterSlug: string): Promise<ClusterPoiCandidateRecord | null> {
    const row = await this.repo.findOneBy({ clusterSlug });
    return row ? toRecord(row) : null;
  }

  async updateCandidates(clusterSlug: string, candidates: ClusterPoiCandidateItem[]): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- "any" bat buoc:
    // _QueryDeepPartialEntity cua TypeORM recurse loi voi cot jsonb array o day,
    // cung workaround voi cac bang staging jsonb khac (xem destination-ai-extraction repo).
    await this.repo.update({ clusterSlug }, { candidates: candidates as any });
  }

  async upsert(record: ClusterPoiCandidateRecord): Promise<void> {
    await this.repo.upsert(
      {
        clusterSlug: record.clusterSlug,
        extractedAt: record.extractedAt,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- xem ghi chu updateCandidates
        candidates: record.candidates as any,
      },
      ["clusterSlug"],
    );
  }
}
