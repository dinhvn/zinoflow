import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  PRODUCT_REPOSITORY,
  type ProductRepository,
} from "../ports/product.repository";
import { matchProducts } from "../../domain/product-matcher";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../../../destination/application/ports/destination-mirror.repository";
import {
  DICHOITHOI_SITE_DB,
  type DichoithoiSiteDb,
} from "../../../destination/application/ports/dichoithoi-site-db.port";

/** MUST khop SOUVENIR_CARD_TAKE ben website neu sau nay them query song. */
const SOUVENIR_CARD_TAKE = 6;

interface SouvenirProductCardData {
  name: string;
  category: string;
  price: number | null;
  thumbnailUrl: string | null;
  href: string;
}

/**
 * Tinh lai SouvenirProductsJson cho 1/nhieu diem den (Phase 27 — "Quà mang
 * về" MVP, content-seo-ux-plan §10.6.2 khối 8b). Khac Hotel/Tour: KHONG co
 * bang map rieng — Product duoc gan diem den qua chinh `tags` (vd tag
 * "da-lat" => hien o trang Đà Lạt), match qua `matchProducts` dung chung
 * engine voi khoi `[[block:products]]` trong bai.
 */
@Injectable()
export class RecomputeSouvenirProductsUseCase {
  private readonly logger = new Logger(RecomputeSouvenirProductsUseCase.name);

  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly destinationRepo: DestinationMirrorRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly destinationSiteDb: DichoithoiSiteDb,
  ) {}

  async forDestination(destinationSlug: string): Promise<void> {
    const destination = await this.destinationRepo.findBySlug(destinationSlug);
    if (!destination || destination.siteId === null) return;

    const all = await this.products.findAll();
    const byId = new Map(all.map((p) => [p.id, p]));
    const matched = matchProducts(all, { tags: [destinationSlug], limit: SOUVENIR_CARD_TAKE });
    const cards: SouvenirProductCardData[] = matched
      .map((m) => byId.get(m.id))
      .filter((p): p is (typeof all)[number] => p !== undefined)
      .map((p) => ({
        name: p.name,
        category: p.category,
        price: p.price,
        thumbnailUrl: p.thumbnailUrl,
        href: p.affiliateUrl ?? p.sourceUrl,
      }));
    await this.destinationSiteDb.updateSouvenirProducts(destination.siteId, JSON.stringify(cards));
  }

  /** Reverse trigger — san pham doi tag/gia/anh -> tinh lai moi diem den lien quan */
  async forProduct(productId: string): Promise<void> {
    const product = await this.products.findById(productId);
    if (!product) return;

    const allDestinations = await this.destinationRepo.findAll();
    const slugsWithSite = new Set(
      allDestinations.filter((d) => d.siteId !== null).map((d) => d.slug),
    );
    const tagSlugs = product.tags.filter((t) => slugsWithSite.has(t));
    for (const slug of tagSlugs) {
      await this.forDestination(slug);
    }
    this.logger.log(
      `Tính lại SouvenirProductsJson cho ${tagSlugs.length} điểm đến gắn sản phẩm ${productId}`,
    );
  }
}
