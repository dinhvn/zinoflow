import type { ContentJobStatus } from "@zinoflow/contracts";
import { assertTransition, canTransition } from "./content-job-state";
import { DomainRuleError } from "../../shared/errors/app-error";

describe("ContentJob state machine (spec §5)", () => {
  describe("happy path", () => {
    it("allows full flow Created -> GeneratingOutline -> DraftReady -> InReview -> Approved", () => {
      expect(canTransition("Created", "GeneratingOutline")).toBe(true);
      expect(canTransition("GeneratingOutline", "DraftReady")).toBe(true);
      expect(canTransition("DraftReady", "InReview")).toBe(true);
      expect(canTransition("InReview", "Approved")).toBe(true);
    });

    it("allows rejecting from InReview", () => {
      expect(canTransition("InReview", "Rejected")).toBe(true);
    });
  });

  describe("re-review rule", () => {
    it("editing an approved draft sends it back to InReview", () => {
      expect(canTransition("Approved", "InReview")).toBe(true);
    });
  });

  describe("manual draft rule (sourceType=Manual — dichoithoi-article-spec.md §1.1)", () => {
    it("allows Created -> DraftReady directly (bo qua GeneratingOutline)", () => {
      expect(canTransition("Created", "DraftReady")).toBe(true);
    });
  });

  describe("retry rules", () => {
    it("allows retry from Failed back to GeneratingOutline", () => {
      expect(canTransition("Failed", "GeneratingOutline")).toBe(true);
    });

    it("allows re-generating before review (DraftReady -> GeneratingOutline)", () => {
      expect(canTransition("DraftReady", "GeneratingOutline")).toBe(true);
    });
  });

  describe("full transition matrix (gate M2: moi transition co test)", () => {
    const ALL: ContentJobStatus[] = [
      "Created",
      "GeneratingOutline",
      "DraftReady",
      "InReview",
      "Approved",
      "Rejected",
      "Failed",
    ];
    // Bang ky vong doc lap voi implementation — sua state machine thi PHAI sua bang nay co y thuc
    const EXPECTED_ALLOWED: Record<ContentJobStatus, ContentJobStatus[]> = {
      Created: ["GeneratingOutline", "DraftReady", "Failed"],
      GeneratingOutline: ["DraftReady", "Failed"],
      DraftReady: ["InReview", "GeneratingOutline"],
      InReview: ["Approved", "Rejected", "DraftReady"], // DraftReady = RequestChange
      Approved: ["InReview"],
      Rejected: [],
      Failed: ["GeneratingOutline"],
    };

    it.each(ALL.flatMap((from) => ALL.map((to) => [from, to] as const)))(
      "%s -> %s matches spec §5",
      (from, to) => {
        expect(canTransition(from, to)).toBe(EXPECTED_ALLOWED[from].includes(to));
      },
    );
  });

  describe("invalid transitions", () => {
    it("blocks skipping review (DraftReady -> Approved)", () => {
      expect(canTransition("DraftReady", "Approved")).toBe(false);
    });

    it("blocks approving directly from Created", () => {
      expect(canTransition("Created", "Approved")).toBe(false);
    });

    it("Rejected is terminal", () => {
      expect(canTransition("Rejected", "InReview")).toBe(false);
      expect(canTransition("Rejected", "GeneratingOutline")).toBe(false);
    });

    it("assertTransition throws DomainRuleError with allowed transitions in details", () => {
      expect(() => assertTransition("Created", "Approved")).toThrow(DomainRuleError);
      try {
        assertTransition("Created", "Approved");
      } catch (error) {
        expect((error as DomainRuleError).details[0]).toContain("GeneratingOutline");
      }
    });
  });
});
