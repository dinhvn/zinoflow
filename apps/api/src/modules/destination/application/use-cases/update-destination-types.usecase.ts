import { Inject, Injectable } from "@nestjs/common";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";

/** Ghi de TOAN BO Type cua 1 diem den — Kanban ra soat taxonomy (relations-plan §6.2). */
@Injectable()
export class UpdateDestinationTypesUseCase {
  constructor(@Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb) {}

  async execute(destinationSlug: string, typeSlugs: readonly string[]): Promise<void> {
    await this.siteDb.replaceTypeAssignments(destinationSlug, typeSlugs);
  }
}
