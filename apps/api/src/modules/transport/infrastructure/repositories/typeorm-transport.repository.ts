import { Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { TransportLinkStatus, TransportMode, TransportStopRole } from "@zinoflow/contracts";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../../../destination/application/ports/destination-mirror.repository";
import { TransportEntity } from "../entities/transport.entity";
import { TransportStopEntity } from "../entities/transport-stop.entity";
import type {
  TransportRecord,
  TransportRepository as ITransportRepository,
  TransportStopRecord,
  UpsertTransportInput,
} from "../../application/ports/transport.repository";

const MODE_TO_NUM: Record<TransportMode, number> = { flight: 1, bus: 2 };
const NUM_TO_MODE: Record<number, TransportMode> = { 1: "flight", 2: "bus" };
const ROLE_TO_NUM: Record<TransportStopRole, number> = { origin: 1, destination: 2, waypoint: 3 };
const NUM_TO_ROLE: Record<number, TransportStopRole> = { 1: "origin", 2: "destination", 3: "waypoint" };

function toInputColumns(input: UpsertTransportInput): Partial<TransportEntity> {
  return {
    mode: MODE_TO_NUM[input.mode],
    operatorName: input.operatorName,
    phone: input.phone,
    vehicleType: input.vehicleType,
    priceFrom: input.priceFrom === null ? null : input.priceFrom.toString(),
    thumbnailUrl: input.thumbnailUrl,
    provider: input.provider,
    sourceUrl: input.sourceUrl,
    affiliateUrl: input.affiliateUrl,
    linkStatus: input.linkStatus,
  };
}

@Injectable()
export class TypeOrmTransportRepository implements ITransportRepository {
  constructor(
    @InjectRepository(TransportEntity) private readonly repo: Repository<TransportEntity>,
    @InjectRepository(TransportStopEntity)
    private readonly stopRepo: Repository<TransportStopEntity>,
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly destinations: DestinationMirrorRepository,
  ) {}

  async findAll(mode?: TransportMode): Promise<TransportRecord[]> {
    const where = mode ? { mode: MODE_TO_NUM[mode] } : {};
    const rows = await this.repo.find({ where, order: { operatorName: "ASC" } });
    return Promise.all(rows.map((r) => this.toRecord(r)));
  }

  async findById(id: string): Promise<TransportRecord | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toRecord(row) : null;
  }

  async create(input: UpsertTransportInput): Promise<TransportRecord> {
    const saved = await this.repo.save(this.repo.create(toInputColumns(input)));
    await this.replaceStops(saved.id, input.stops);
    const created = await this.findById(saved.id);
    if (!created) throw new Error("Transport bien mat ngay sau khi tao");
    return created;
  }

  async update(id: string, input: UpsertTransportInput): Promise<TransportRecord> {
    await this.repo.update({ id }, toInputColumns(input));
    await this.replaceStops(id, input.stops);
    const updated = await this.findById(id);
    if (!updated) throw new Error("Transport bien mat ngay sau khi cap nhat");
    return updated;
  }

  async setSiteId(id: string, siteId: number): Promise<void> {
    await this.repo.update({ id }, { siteId });
  }

  private async replaceStops(
    transportId: string,
    stops: UpsertTransportInput["stops"],
  ): Promise<void> {
    await this.stopRepo.delete({ transportId });
    if (stops.length === 0) return;
    await this.stopRepo.insert(
      stops.map((s) => ({
        transportId,
        destinationSlug: s.destinationSlug,
        role: ROLE_TO_NUM[s.role],
        seqOrder: s.seqOrder,
      })),
    );
  }

  private async toRecord(e: TransportEntity): Promise<TransportRecord> {
    const stopRows = await this.stopRepo.find({
      where: { transportId: e.id },
      order: { seqOrder: "ASC" },
    });
    const stops: TransportStopRecord[] = await Promise.all(
      stopRows.map(async (s) => {
        const dest = await this.destinations.findBySlug(s.destinationSlug);
        return {
          destinationSlug: s.destinationSlug,
          destinationName: dest?.name ?? s.destinationSlug,
          role: NUM_TO_ROLE[s.role]!,
          seqOrder: s.seqOrder,
        };
      }),
    );
    return {
      id: e.id,
      mode: NUM_TO_MODE[e.mode]!,
      operatorName: e.operatorName,
      phone: e.phone,
      vehicleType: e.vehicleType,
      priceFrom: e.priceFrom === null ? null : Number(e.priceFrom),
      thumbnailUrl: e.thumbnailUrl,
      provider: e.provider,
      sourceUrl: e.sourceUrl,
      affiliateUrl: e.affiliateUrl,
      linkStatus: e.linkStatus as TransportLinkStatus,
      source: e.source,
      siteId: e.siteId,
      stops,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }
}
