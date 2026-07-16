import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { DestinationAiExtractionFieldItem } from "@zinoflow/contracts";
import type {
  DestinationAiExtractionRecord,
  DestinationAiExtractionRepository,
} from "../../application/ports/destination-ai-extraction.repository";
import { DestinationAiExtractionEntity } from "../entities/destination-ai-extraction.entity";

function toRecord(e: DestinationAiExtractionEntity): DestinationAiExtractionRecord {
  return {
    destinationSlug: e.destinationSlug,
    sourceUrls: e.sourceUrls,
    extractedAt: e.extractedAt,
    fields: e.fields,
  };
}

@Injectable()
export class TypeOrmDestinationAiExtractionRepository implements DestinationAiExtractionRepository {
  constructor(
    @InjectRepository(DestinationAiExtractionEntity)
    private readonly repo: Repository<DestinationAiExtractionEntity>,
  ) {}

  async findBySlug(slug: string): Promise<DestinationAiExtractionRecord | null> {
    const row = await this.repo.findOneBy({ destinationSlug: slug });
    return row ? toRecord(row) : null;
  }

  async updateFields(slug: string, fields: DestinationAiExtractionFieldItem[]): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- "any" bat buoc:
    // _QueryDeepPartialEntity cua TypeORM recurse loi voi "unknown" (newValue/currentValue)
    // trong cot jsonb, cung workaround voi draft_article (destination-mirror.entity.ts).
    await this.repo.update({ destinationSlug: slug }, { fields: fields as any });
  }
}
