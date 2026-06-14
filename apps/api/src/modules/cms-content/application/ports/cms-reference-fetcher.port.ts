/**
 * Port fetch text tu URL nguon tham khao cho bai CMS (gom trang tieng Anh cho dochoi3s).
 * Implementation tai dung HttpReferenceFetcher (cung logic fetch tinh + SSRF guard
 * + cat 8k ky tu da dung o dichoithoi).
 */
export const CMS_REFERENCE_FETCHER = Symbol("CMS_REFERENCE_FETCHER");

export interface CmsReferenceFetcher {
  fetchText(url: string): Promise<string>;
}
