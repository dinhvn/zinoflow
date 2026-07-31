import type { TransportStopRole } from "@zinoflow/contracts";

export const TRANSPORT_SITE_DB = Symbol("TRANSPORT_SITE_DB");

export interface PublishTransportInput {
  siteId: number | null;
  mode: number;
  operatorName: string;
  phone: string | null;
  vehicleType: string | null;
  priceFrom: number | null;
  thumbnailUrl: string | null;
  provider: string | null;
  sourceUrl: string | null;
  affiliateUrl: string | null;
  linkStatus: string;
}

export interface PublishTransportStopInput {
  destinationSlug: string;
  role: TransportStopRole;
  seqOrder: number;
}

/**
 * 1 the "🚌 Vé xe khách" cho khoi "Cach toi day" (transport-plan §2, Giai
 * doan 4) — shape khop voi TransportCardModel ben website.
 */
export interface TransportCardData {
  id: number;
  mode: number;
  operatorName: string;
  phone: string | null;
  vehicleType: string | null;
  priceFrom: number | null;
  thumbnailUrl: string | null;
  affiliateUrl: string | null;
  sourceUrl: string | null;
  linkStatus: string;
}

/**
 * Adapter SQL Server cho v2.Transport/v2.TransportStop (transport-plan §2).
 * Publish khong qua 2 chot duyet — ghi thang khi tao/sua (giong Hotel).
 */
export interface TransportSiteDb {
  isConfigured(): boolean;
  /** Insert (siteId=null) hoac update (siteId co gia tri) — tra ve siteId */
  upsertTransport(input: PublishTransportInput): Promise<{ siteId: number }>;
  /** Xoa/ghi lai toan bo diem dung cua 1 transport — resolve slug -> DestinationId */
  replaceStops(transportSiteId: number, stops: PublishTransportStopInput[]): Promise<void>;
  /**
   * The Van chuyen cho 1 diem den — neu diem la POI (Kind=3) tu dong resolve
   * sang ParentId (cum cha) truoc khi tra, dung cho ca origin lan
   * destination (khong hien waypoint) — transport-plan §2.
   */
  findCardsForDestination(destinationSiteId: number, mode: number): Promise<TransportCardData[]>;
  /** Slug cac POI con TRUC TIEP cua 1 cum — de recompute lai the cho tung POI khi tuyen doi (fan-out) */
  findPoiChildSlugs(clusterSiteId: number): Promise<string[]>;
  /** Xoa han 1 tuyen — xoa TransportStop truoc (khong co ON DELETE CASCADE) roi xoa Transport */
  deleteTransport(transportSiteId: number): Promise<void>;
}
