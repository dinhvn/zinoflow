import { CreateManualDraftUseCase } from "./create-manual-draft.usecase";
import type { ContentJobRepository } from "../ports/content-job.repository";
import type { ContentDraftRepository } from "../ports/content-draft.repository";
import type { ContentJob } from "../../domain/content-job";

describe("CreateManualDraftUseCase (dichoithoi-article-spec §1.1)", () => {
  it("luu ContentJob TRUOC ContentDraft (draft.jobId la FK tro toi job — luu nguoc se vi pham constraint that)", async () => {
    const calls: string[] = [];
    const savedJobIds = new Set<string>();

    const jobs: ContentJobRepository = {
      save: async (job: ContentJob) => {
        calls.push("job");
        savedJobIds.add(job.id);
      },
      findById: async () => null,
      findAll: async () => [],
      findStatusesByIds: async () => new Map(),
      findLatestBySourceRef: async () => null,
    };

    const drafts: ContentDraftRepository = {
      save: async (draft) => {
        calls.push("draft");
        // Mo phong dung foreign key that: draft chi hop le neu job da ton tai truoc do.
        if (!savedJobIds.has(draft.jobId)) {
          throw new Error(
            `FK violation gia lap: draft tro toi jobId=${draft.jobId} nhung job chua duoc luu`,
          );
        }
      },
      findById: async () => null,
      findLatestByJobId: async () => null,
      listByJobId: async () => [],
    };

    const usecase = new CreateManualDraftUseCase(jobs, drafts);

    const result = await usecase.execute({
      siteCode: "dichoithoi",
      sourceRef: "cam-nang",
      topic: "Các con thác đẹp tại Đà Lạt",
      articleType: "cam-nang",
      keywordSeed: [],
    });

    expect(calls).toEqual(["job", "draft"]);
    expect(result.status).toBe("DraftReady");
  });
});
