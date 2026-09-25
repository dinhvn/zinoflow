import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import type { DestinationGeocodeCandidateStatus } from "@zinoflow/contracts";
import type {
  DestinationGeocodeCandidateRecord,
  DestinationGeocodeCandidateRepository,
} from "../../application/ports/destination-geocode-candidate.repository";
import { DestinationGeocodeCandidateEntity } from "../entities/destination-geocode-candidate.entity";

function toRecord(e: DestinationGeocodeCandidateEntity): DestinationGeocodeCandidateRecord {
  return {
    destinationSlug: e.destinationSlug,
    foundAt: e.foundAt,
    candidates: e.candidates,
    status: e.status,
  };
}

@Injectable()
export class TypeOrmDestinationGeocodeCandidateRepository
  implements DestinationGeocodeCandidateRepository
{
  constructor(
    @InjectRepository(DestinationGeocodeCandidateEntity)
    private readonly repo: Repository<DestinationGeocodeCandidateEntity>,
  ) {}

  async upsert(record: DestinationGeocodeCandidateRecord): Promise<void> {
    await this.repo.upsert(
      {
        destinationSlug: record.destinationSlug,
        foundAt: record.foundAt,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- "any" bat buoc:
        // _QueryDeepPartialEntity cua TypeORM recurse loi voi cot jsonb array, cung
        // workaround voi cluster-poi-candidate repo.
        candidates: record.candidates as any,
        status: record.status,
      },
      ["destinationSlug"],
    );
  }

  async findPending(): Promise<DestinationGeocodeCandidateRecord[]> {
    const rows = await this.repo.findBy({ status: In(["pending", "not-found", "ambiguous"]) });
    return rows.map(toRecord);
  }

  async findBySlug(slug: string): Promise<DestinationGeocodeCandidateRecord | null> {
    const row = await this.repo.findOneBy({ destinationSlug: slug });
    return row ? toRecord(row) : null;
  }

  async findAccepted(): Promise<DestinationGeocodeCandidateRecord[]> {
    const rows = await this.repo.findBy({ status: "accepted" });
    return rows.map(toRecord);
  }

  async setStatus(slug: string, status: DestinationGeocodeCandidateStatus): Promise<void> {
    await this.repo.update({ destinationSlug: slug }, { status });
  }

  async findAllAttemptedSlugs(): Promise<string[]> {
    const rows = await this.repo.find({ select: { destinationSlug: true } });
    return rows.map((r) => r.destinationSlug);
  }
}
