import { Inject, Injectable, Logger } from "@nestjs/common";
import type { SyncDestinationsResult } from "@zinoflow/contracts";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { decideSyncAction } from "../../domain/destination-mirror";

/**
 * Dong bo mirror: SQL Server (schema moi) -> Postgres, mot chieu DOC.
 * Thuat toan spec dichoithoi-destination-spec §12.1 — idempotent:
 * upsert theo slug, phat hien edited-outside / conflict / orphan, khong tu xoa.
 */
@Injectable()
export class SyncDestinationsUseCase {
  private readonly logger = new Logger(SyncDestinationsUseCase.name);

  constructor(
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
  ) {}

  async execute(): Promise<SyncDestinationsResult> {
    const startedAt = Date.now();
    const siteRows = await this.siteDb.fetchAllDestinations();
    const mirrors = await this.mirrorRepo.findAll();
    const mirrorBySlug = new Map(mirrors.map((m) => [m.slug, m]));
    const syncedAt = new Date();

    const result: SyncDestinationsResult = {
      added: 0,
      updated: 0,
      unchanged: 0,
      editedOutside: [],
      conflicts: [],
      orphans: [],
      durationMs: 0,
    };

    const siteSlugs = new Set<string>();
    for (const row of siteRows) {
      siteSlugs.add(row.slug);
      const mirror = mirrorBySlug.get(row.slug);
      const decision = decideSyncAction(row, mirror && {
        slug: mirror.slug,
        contentHash: mirror.contentHash,
        hasLocalChanges: mirror.hasLocalChanges,
        // Phase A chua co publish tu AI tool -> moi thay doi hash deu la sua ngoai;
        // Phase C se so syncedAt voi publish record gan nhat.
        publishedSinceLastSync: false,
      });

      if (decision.action === "skip-conflict") {
        result.conflicts.push(row.slug);
        await this.mirrorRepo.setFlags(row.slug, ["conflict"]);
        continue;
      }
      if (decision.action === "insert") {
        await this.mirrorRepo.upsertFromSite(row, [], syncedAt);
        result.added++;
        continue;
      }
      await this.mirrorRepo.upsertFromSite(row, decision.flags, syncedAt);
      if (decision.flags.includes("edited-outside")) {
        result.editedOutside.push(row.slug);
        result.updated++;
      } else if (mirror && mirror.contentHash === row.contentHash) {
        result.unchanged++;
      } else {
        result.updated++;
      }
    }

    // Orphan: co o mirror nhung bien mat ben site — gan co, KHONG xoa (spec §12.1)
    for (const mirror of mirrors) {
      if (!siteSlugs.has(mirror.slug) && mirror.siteId !== null) {
        result.orphans.push(mirror.slug);
        await this.mirrorRepo.setFlags(mirror.slug, ["orphan"]);
      }
    }

    result.durationMs = Date.now() - startedAt;
    this.logger.log(
      `Sync mirror xong: +${result.added} ~${result.updated} =${result.unchanged} ` +
        `editedOutside=${result.editedOutside.length} conflicts=${result.conflicts.length} ` +
        `orphans=${result.orphans.length} (${result.durationMs}ms)`,
    );
    return result;
  }
}
