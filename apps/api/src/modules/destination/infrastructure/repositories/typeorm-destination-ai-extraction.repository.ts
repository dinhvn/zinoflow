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
    source: e.source,
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

  async findBySlugAndSource(
    slug: string,
    source: DestinationAiExtractionRecord["source"],
  ): Promise<DestinationAiExtractionRecord | null> {
    const row = await this.repo.findOneBy({ destinationSlug: slug, source });
    return row ? toRecord(row) : null;
  }

  async findAllBySlug(slug: string): Promise<DestinationAiExtractionRecord[]> {
    const rows = await this.repo.find({ where: { destinationSlug: slug }, order: { source: "ASC" } });
    return rows.map(toRecord);
  }

  async updateFields(
    slug: string,
    source: DestinationAiExtractionRecord["source"],
    fields: DestinationAiExtractionFieldItem[],
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- "any" bat buoc:
    // _QueryDeepPartialEntity cua TypeORM recurse loi voi "unknown" (newValue/currentValue)
    // trong cot jsonb, cung workaround voi draft_article (destination-mirror.entity.ts).
    await this.repo.update({ destinationSlug: slug, source }, { fields: fields as any });
  }

  async upsert(record: DestinationAiExtractionRecord): Promise<void> {
    await this.repo.upsert(
      {
        destinationSlug: record.destinationSlug,
        source: record.source,
        sourceUrls: record.sourceUrls,
        extractedAt: record.extractedAt,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- xem ghi chu updateFields
        fields: record.fields as any,
      },
      ["destinationSlug", "source"],
    );
  }
}
