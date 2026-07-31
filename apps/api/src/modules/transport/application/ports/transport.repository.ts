import type { TransportLinkStatus, TransportMode, TransportStopRole } from "@zinoflow/contracts";

export const TRANSPORT_REPOSITORY = Symbol("TRANSPORT_REPOSITORY");

export interface TransportStopRecord {
  readonly destinationSlug: string;
  readonly destinationName: string;
  readonly role: TransportStopRole;
  readonly seqOrder: number;
}

export interface TransportRecord {
  readonly id: string;
  readonly mode: TransportMode;
  readonly operatorName: string;
  readonly phone: string | null;
  readonly vehicleType: string | null;
  readonly priceFrom: number | null;
  readonly thumbnailUrl: string | null;
  readonly provider: string | null;
  readonly sourceUrl: string | null;
  readonly affiliateUrl: string | null;
  readonly linkStatus: TransportLinkStatus;
  readonly source: number;
  readonly siteId: number | null;
  readonly stops: TransportStopRecord[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface UpsertTransportStopInput {
  readonly destinationSlug: string;
  readonly role: TransportStopRole;
  readonly seqOrder: number;
}

export interface UpsertTransportInput {
  readonly mode: TransportMode;
  readonly operatorName: string;
  readonly phone: string | null;
  readonly vehicleType: string | null;
  readonly priceFrom: number | null;
  readonly thumbnailUrl: string | null;
  readonly provider: string | null;
  readonly sourceUrl: string | null;
  readonly affiliateUrl: string | null;
  readonly linkStatus: TransportLinkStatus;
  readonly stops: UpsertTransportStopInput[];
}

/** Repository bang transports + transport_stops (Postgres — nguon su that) */
export interface TransportRepository {
  findAll(mode?: TransportMode): Promise<TransportRecord[]>;
  findById(id: string): Promise<TransportRecord | null>;
  create(input: UpsertTransportInput): Promise<TransportRecord>;
  update(id: string, input: UpsertTransportInput): Promise<TransportRecord>;
  setSiteId(id: string, siteId: number): Promise<void>;
  /** Xoa han 1 tuyen — transport_stops tu xoa theo qua ON DELETE CASCADE (Postgres) */
  delete(id: string): Promise<void>;
}
