import { destinationArticleSchema, type DestinationArticle } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";

/**
 * Validate CHAT draft_article (raw, luu long luc PATCH) theo destinationArticleSchema —
 * chay o gate-check/preview/publish (khong chay luc luu tay, de cho phep dang soan dat do).
 * Loi tra ve la DomainRuleError liet ke tung truong con thieu/sai, tieng Viet de hien UI.
 */
export function parseDraftArticleOrThrow(
  raw: unknown,
  destinationName: string,
): DestinationArticle {
  if (!raw) {
    throw new DomainRuleError(`Điểm đến "${destinationName}" chưa có nội dung bài viết nào`, [
      "Viết tay hoặc tạo bài AI trước khi xuất bản",
    ]);
  }
  const result = destinationArticleSchema.safeParse(raw);
  if (!result.success) {
    throw new DomainRuleError(
      `Bài viết của "${destinationName}" chưa đủ điều kiện xuất bản`,
      result.error.issues.map((issue) => `${issue.path.join(".") || "(gốc)"}: ${issue.message}`),
    );
  }
  return result.data;
}
