import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type {
  DestinationTicketRecord,
  DestinationTicketRepository,
  UpsertDestinationTicketInput,
} from "../../application/ports/destination-ticket.repository";
import { DestinationTicketEntity } from "../entities/destination-ticket.entity";

function toRecord(e: DestinationTicketEntity): DestinationTicketRecord {
  return {
    id: e.id,
    destinationSlug: e.destinationSlug,
    label: e.label,
    provider: e.provider,
    sourceUrl: e.sourceUrl,
    affiliateUrl: e.affiliateUrl,
    linkStatus: e.linkStatus,
    price: e.price === null ? null : Number(e.price),
    thumbnailUrl: e.thumbnailUrl,
    order: e.order,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

@Injectable()
export class TypeOrmDestinationTicketRepository implements DestinationTicketRepository {
  constructor(
    @InjectRepository(DestinationTicketEntity)
    private readonly repo: Repository<DestinationTicketEntity>,
  ) {}

  async findAll(): Promise<DestinationTicketRecord[]> {
    const rows = await this.repo.find({ order: { destinationSlug: "ASC", order: "ASC" } });
    return rows.map(toRecord);
  }

  async findById(id: string): Promise<DestinationTicketRecord | null> {
    const row = await this.repo.findOneBy({ id });
    return row ? toRecord(row) : null;
  }

  async findByDestinationSlug(destinationSlug: string): Promise<DestinationTicketRecord[]> {
    const rows = await this.repo.find({ where: { destinationSlug }, order: { order: "ASC" } });
    return rows.map(toRecord);
  }

  async create(
    destinationSlug: string,
    input: UpsertDestinationTicketInput,
  ): Promise<DestinationTicketRecord> {
    const saved = await this.repo.save(
      this.repo.create({ destinationSlug, ...input, price: input.price?.toString() ?? null }),
    );
    return toRecord(saved);
  }

  async update(id: string, input: UpsertDestinationTicketInput): Promise<DestinationTicketRecord> {
    await this.repo.update({ id }, { ...input, price: input.price?.toString() ?? null });
    const updated = await this.findById(id);
    if (!updated) throw new Error(`Vé điểm đến id=${id} biến mất sau update`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }
}
