import { z } from "zod/v4";

/**
 * Hanh dong review — spec §4.1 ReviewRecord. Tach RIENG khoi content-draft.ts
 * (23/07/2026) de cat dut circular import phat hien thuc te: content-draft.ts
 * import destinationArticleSchema tu dichoithoi/destination-article.ts, file
 * do import qualityCheckSchema tu ai-content/quality.ts, quality.ts lai import
 * nguoc reviewActionSchema tu content-draft.ts — vong nay khien
 * `destinationArticleSchema` la `undefined` luc `draftArticleSchema` (union)
 * duoc xay dung (Node CommonJS tra module.exports DANG DO khi gap require
 * vong), lam draftArticleSchema.parse() crash noi bo zod ("Cannot read
 * properties of undefined (reading '_zod')") — anh huong TOAN BO trang chi
 * tiet bai viet (moi articleType), khong rieng cam-nang.
 */
export const reviewActionSchema = z.enum(["Approve", "RequestChange", "Reject"]);
export type ReviewAction = z.infer<typeof reviewActionSchema>;
