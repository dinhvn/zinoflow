import type { AffiliateLinkStatus } from "@zinoflow/contracts";

export const DESTINATION_TICKET_REPOSITORY = Symbol("DESTINATION_TICKET_REPOSITORY");

export interface DestinationTicketRecord {
  readonly id: string;
  readonly destinationSlug: string;
  readonly label: string | null;
  readonly provider: string;
  readonly sourceUrl: string;
  readonly affiliateUrl: string;
  readonly linkStatus: AffiliateLinkStatus;
  readonly price: number | null;
  readonly thumbnailUrl: string | null;
  readonly order: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface UpsertDestinationTicketInput {
  readonly label: string | null;
  readonly provider: string;
  readonly sourceUrl: string;
  readonly affiliateUrl: string;
  readonly linkStatus: AffiliateLinkStatus;
  readonly price: number | null;
  readonly thumbnailUrl: string | null;
  readonly order: number;
}

/** Repository bang destination_tickets (Postgres — nguon su that vé tham quan, doc §11.5) */
export interface DestinationTicketRepository {
  findAll(): Promise<DestinationTicketRecord[]>;
  findById(id: string): Promise<DestinationTicketRecord | null>;
  findByDestinationSlug(destinationSlug: string): Promise<DestinationTicketRecord[]>;
  create(destinationSlug: string, input: UpsertDestinationTicketInput): Promise<DestinationTicketRecord>;
  update(id: string, input: UpsertDestinationTicketInput): Promise<DestinationTicketRecord>;
  delete(id: string): Promise<void>;
}
