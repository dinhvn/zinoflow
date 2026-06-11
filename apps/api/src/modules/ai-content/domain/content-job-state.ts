import type { ContentJobStatus } from "@zinoflow/contracts";
import { DomainRuleError } from "../../shared/errors/app-error";

/**
 * State machine cua content job — spec ai-content-technical-spec.md §5.
 *
 * Created -> GeneratingOutline -> DraftReady -> InReview -> Approved | Rejected
 * Failed: tu cac buoc generate; Failed -> GeneratingOutline (retry policy).
 * Approved -> InReview: sua noi dung draft da approve se tao version moi
 * va bat buoc review lai (transition rule trong spec §5).
 */
const ALLOWED_TRANSITIONS: Record<ContentJobStatus, readonly ContentJobStatus[]> = {
  Created: ["GeneratingOutline", "Failed"],
  GeneratingOutline: ["DraftReady", "Failed"],
  DraftReady: ["InReview", "GeneratingOutline"], // cho phep generate lai truoc khi review
  InReview: ["Approved", "Rejected"],
  Approved: ["InReview"],
  Rejected: [], // terminal — muon lam lai thi tao job moi
  Failed: ["GeneratingOutline"], // retry
};

export function canTransition(from: ContentJobStatus, to: ContentJobStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Nem DomainRuleError neu transition khong hop le — dung trong moi use case doi status. */
export function assertTransition(from: ContentJobStatus, to: ContentJobStatus): void {
  if (!canTransition(from, to)) {
    throw new DomainRuleError(`Invalid status transition: ${from} -> ${to}`, [
      `Allowed from ${from}: ${ALLOWED_TRANSITIONS[from].join(", ") || "(none - terminal state)"}`,
    ]);
  }
}
