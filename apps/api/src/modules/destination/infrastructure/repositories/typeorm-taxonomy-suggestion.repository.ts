import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type {
  TaxonomySuggestionRepository,
  TaxonomySuggestionRow,
} from "../../application/ports/taxonomy-suggestion.repository";
import { TaxonomySuggestionEntity } from "../entities/taxonomy-suggestion.entity";

@Injectable()
export class TypeOrmTaxonomySuggestionRepository implements TaxonomySuggestionRepository {
  constructor(
    @InjectRepository(TaxonomySuggestionEntity)
    private readonly repo: Repository<TaxonomySuggestionEntity>,
  ) {}

  async findAll(): Promise<TaxonomySuggestionRow[]> {
    const rows = await this.repo.find();
    return rows.map((r) => ({
      destinationSlug: r.destinationSlug,
      suggestedTypes: r.suggestedTypes,
      reason: r.reason,
      status: r.status,
    }));
  }

  async upsertMany(rows: readonly Omit<TaxonomySuggestionRow, "status">[]): Promise<void> {
    if (rows.length === 0) return;
    await this.repo.upsert(
      rows.map((r) => ({
        destinationSlug: r.destinationSlug,
        suggestedTypes: r.suggestedTypes,
        reason: r.reason,
        status: "pending" as const,
      })),
      ["destinationSlug"],
    );
  }

  async markAccepted(destinationSlug: string): Promise<void> {
    await this.repo.update({ destinationSlug }, { status: "accepted" });
  }
}
