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

/**
 * Google tam chan (CAPTCHA/"unusual traffic") khi scrape Google Maps qua
 * Playwright (thay Places API do billing bi chan khu vuc VN — xem memory
 * dichoithoi-destination-geocode-audit-plan-open.md). Tach rieng UpstreamApiError
 * de vong lap batch (ProcessGeocodeBatchUseCase) DUNG SOM thay vi log-va-tiep-tuc
 * nhu loi 1 lan — goi lien tuc luc dang bi chan chi lam moi viec te hon.
 */
export class GeocodeBlockedError extends UpstreamApiError {
  constructor(message: string) {
    super(message);
    this.name = "GeocodeBlockedError";
  }
}

/**
 * Tin hieu "bo qua tam" (KHONG phai loi that) — dung khi che do quickOnly
 * gap trang danh sach nhieu ket qua (mo ho) va chu dong khong ghe tung ket
 * qua de tiet kiem thoi gian, uu tien xu ly het cac diem ra dung 1 ket qua
 * truoc (yeu cau 06/08/2026: chay qua dem, uu tien diem "vao la ra ngay").
 * ProcessGeocodeBatchUseCase bat rieng loai nay: KHONG ghi vao staging (de
 * diem nay con duoc coi la "chua tung quet", tu dong duoc thu lai o lan
 * chay sau — vd chay lai voi quickOnly=false).
 */
export class AmbiguousResultsSkippedError extends AppError {
  constructor(message: string) {
    super("DomainRuleError", message, [], 422);
    this.name = "AmbiguousResultsSkippedError";
  }
}
