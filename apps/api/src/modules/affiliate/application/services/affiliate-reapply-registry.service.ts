import { Injectable } from "@nestjs/common";
import type { AffiliateReapplyTarget } from "../ports/affiliate-reapply-target.port";

/**
 * So dang ky cac module tieu thu affiliate link (destination/hotel/tour) — thay
 * cho multi-provider injection (Nest khong ho tro nhieu provider tren 1 token nhu
 * Angular). Cac module goi register() trong onModuleInit cua chinh no.
 */
@Injectable()
export class AffiliateReapplyRegistry {
  private readonly targets: AffiliateReapplyTarget[] = [];

  register(target: AffiliateReapplyTarget): void {
    this.targets.push(target);
  }

  list(): readonly AffiliateReapplyTarget[] {
    return this.targets;
  }
}
