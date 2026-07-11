import { RenameDestinationSlugUseCase } from "./rename-destination-slug.usecase";
import { DomainRuleError } from "../../../shared/errors/app-error";
import type { DestinationMirrorRepository } from "../ports/destination-mirror.repository";
import type { DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import type { RecomputeRelatedService } from "../services/recompute-related.service";
import type { JobQueue } from "../../../shared/jobs/job-queue.port";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";

function mirror(overrides: Partial<DestinationMirrorEntity>): DestinationMirrorEntity {
  return {
    slug: "da-lat",
    siteId: null,
    parentSlug: null,
    activeContentJobId: null,
    ...overrides,
  } as DestinationMirrorEntity;
}

describe("RenameDestinationSlugUseCase", () => {
  function setup(existing: DestinationMirrorEntity | null, conflictingNewSlug = false) {
    const renameSlugCalls: Array<{ oldSlug: string; newSlug: string }> = [];
    const mirrorRepo = {
      findBySlug: async (slug: string) => {
        if (slug === existing?.slug) return existing;
        if (conflictingNewSlug) return mirror({ slug });
        return null;
      },
      renameSlug: async (oldSlug: string, newSlug: string) => {
        renameSlugCalls.push({ oldSlug, newSlug });
      },
    } as unknown as DestinationMirrorRepository;

    const siteDbRenameCalls: Array<{ siteId: number; oldSlug: string; newSlug: string }> = [];
    const siteDb = {
      renameSlug: async (siteId: number, oldSlug: string, newSlug: string) => {
        siteDbRenameCalls.push({ siteId, oldSlug, newSlug });
      },
    } as unknown as DichoithoiSiteDb;

    const recomputeCalls: string[][] = [];
    const recomputeRelated = {
      affectedSlugsForRename: async (slug: string) => [slug, "con-cua-da-lat"],
      recomputeFor: async (slugs: readonly string[]) => {
        recomputeCalls.push([...slugs]);
        return { scanned: slugs.length, updated: 0 };
      },
    } as unknown as RecomputeRelatedService;

    const jobQueueCalls: unknown[] = [];
    const jobQueue = {
      send: async (queue: string, data: unknown) => {
        jobQueueCalls.push({ queue, data });
        return "job-1";
      },
    } as unknown as JobQueue;

    const usecase = new RenameDestinationSlugUseCase(mirrorRepo, siteDb, recomputeRelated, jobQueue);
    return { usecase, renameSlugCalls, siteDbRenameCalls, recomputeCalls, jobQueueCalls };
  }

  it("cascade Postgres, SQL Server (khi da publish) va recompute voi affected-set da doi ten", async () => {
    const existing = mirror({ slug: "da-lat", siteId: 42 });
    const { usecase, renameSlugCalls, siteDbRenameCalls, recomputeCalls, jobQueueCalls } =
      setup(existing);

    const result = await usecase.execute("da-lat", "da-lat-moi");

    expect(result).toEqual({ oldSlug: "da-lat", newSlug: "da-lat-moi" });
    expect(renameSlugCalls).toEqual([{ oldSlug: "da-lat", newSlug: "da-lat-moi" }]);
    expect(siteDbRenameCalls).toEqual([
      { siteId: 42, oldSlug: "da-lat", newSlug: "da-lat-moi" },
    ]);
    expect(recomputeCalls).toEqual([["da-lat-moi", "con-cua-da-lat"]]);
    expect(jobQueueCalls).toEqual([{ queue: "destination.relink", data: {} }]);
  });

  it("bo qua cascade SQL Server khi diem CHUA publish (siteId=null)", async () => {
    const existing = mirror({ slug: "da-lat", siteId: null });
    const { usecase, siteDbRenameCalls } = setup(existing);

    await usecase.execute("da-lat", "da-lat-moi");

    expect(siteDbRenameCalls).toEqual([]);
  });

  it("tu choi khi khong tim thay diem den", async () => {
    const { usecase } = setup(null);
    await expect(usecase.execute("khong-ton-tai", "moi")).rejects.toThrow(DomainRuleError);
  });

  it("tu choi khi slug moi trung slug cu", async () => {
    const existing = mirror({ slug: "da-lat" });
    const { usecase } = setup(existing);
    await expect(usecase.execute("da-lat", "da-lat")).rejects.toThrow(DomainRuleError);
  });

  it("tu choi khi slug moi da ton tai", async () => {
    const existing = mirror({ slug: "da-lat" });
    const { usecase } = setup(existing, true);
    await expect(usecase.execute("da-lat", "sapa")).rejects.toThrow(DomainRuleError);
  });

  it("tu choi khi diem dang co job AI soan do", async () => {
    const existing = mirror({ slug: "da-lat", activeContentJobId: "job-123" });
    const { usecase } = setup(existing);
    await expect(usecase.execute("da-lat", "da-lat-moi")).rejects.toThrow(DomainRuleError);
  });
});
