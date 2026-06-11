import type { ErrorCode } from "@zinoflow/contracts";

/**
 * Base error cho toan he thong — map 1:1 voi error envelope (spec §12).
 * Cac lop nay la pure TS (khong import framework) de domain/application
 * layer dung duoc ma khong vi pham dependency rule.
 */
export class AppError extends Error {
  constructor(
    readonly errorCode: ErrorCode,
    message: string,
    readonly details: string[] = [],
    /** HTTP status de exception filter map ra response. */
    readonly httpStatus: number = 500,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Input khong hop le (request body, query, params). */
export class ValidationError extends AppError {
  constructor(message: string, details: string[] = []) {
    super("ValidationError", message, details, 400);
  }
}

/** Vi pham business rule (vd: transition trang thai khong hop le, approve khi gate fail). */
export class DomainRuleError extends AppError {
  constructor(message: string, details: string[] = []) {
    super("DomainRuleError", message, details, 422);
  }
}

/** Loi tu AI provider (Anthropic/OpenAI) sau khi da het retry. */
export class AiProviderError extends AppError {
  constructor(message: string, details: string[] = []) {
    super("AiProviderError", message, details, 502);
  }
}

/** Loi tu he thong ngoai (CMS cu, WordPress). */
export class UpstreamApiError extends AppError {
  constructor(message: string, details: string[] = []) {
    super("UpstreamApiError", message, details, 502);
  }
}
