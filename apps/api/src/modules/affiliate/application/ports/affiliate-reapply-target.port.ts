/**
 * Moi module tieu thu co che affiliate (destination/ticketLinks, hotel, tour) tu
 * dang ky 1 target vao AffiliateReapplyRegistry (goi registry.register(this) o
 * onModuleInit) — AffiliateModule KHONG tu biet Destination/Hotel/Tour (spec §4).
 */
export interface AffiliateReapplyTarget {
  /** Ten hien thi tren UI/report (vd "Vé điểm đến", "Khách sạn", "Tour") */
  readonly label: string;

  /**
   * Ap dung lai affiliateUrl cho moi link module nay dang quan ly co provider
   * khop rule (hoac TOAN BO neu ruleId=null), bo qua linkStatus='manual-override'.
   * Tra so link da ghi de.
   */
  reapply(ruleId: string | null): Promise<{ updatedCount: number }>;
}
