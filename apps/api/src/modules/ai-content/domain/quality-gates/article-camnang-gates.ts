import type { ArticleCamNang, QualityCheck } from "@zinoflow/contracts";
import { ARTICLE_FIELD_LIMITS } from "@zinoflow/contracts";
import { containsNormalized, countWords } from "./text-matching";
import { findTokensMissingHeadingAbove, parseBlockTokens } from "../../../shared/text/block-token";

/**
 * Quality gates cho bai cam nang (articleType "cam-nang") — dichoithoi-article-spec.md §6.
 * Chi kiem tra CU PHAP token (kind hop le, co H2/H3 ngay tren) — viec tham so
 * (type/province/slug) co TON TAI trong mirror hay khong la viec cua buoc
 * compile luc Publish (application layer, can DB), khong thuoc gate thuan nay.
 */

export interface ArticleCamNangGateInput {
  article: ArticleCamNang;
  draftMarkdown: string;
  keywordSeed: readonly string[];
}

const MIN_SECTION_WORDS = 30;

/**
 * Structure gate (§6.2): co intro, it nhat 1 section co noi dung, MOI token
 * phai cu phap hop le (kind nhan dien duoc) va co H2/H3 ngay phia tren.
 */
export function evaluateArticleCamNangStructureGate(input: ArticleCamNangGateInput): QualityCheck {
  const { article, draftMarkdown } = input;
  const details: string[] = [];

  if (countWords(article.intro) < 30) {
    details.push("Mở bài quá ngắn (cần tối thiểu ~80 từ theo khung bài)");
  }
  if (article.sections.length < 1) {
    details.push("Bài cần ít nhất 1 section");
  }
  for (const section of article.sections) {
    const words = countWords(section.content);
    if (words < MIN_SECTION_WORDS) {
      details.push(
        `Section "${section.heading}" quá ngắn: ${words} từ (tối thiểu ${MIN_SECTION_WORDS})`,
      );
    }
  }

  const tokens = parseBlockTokens(draftMarkdown);
  for (const token of tokens) {
    if (token.kind === null) {
      details.push(`Khối động cú pháp không hợp lệ: "${token.raw}"`);
    }
  }
  const missingHeading = findTokensMissingHeadingAbove(draftMarkdown);
  for (const token of missingHeading) {
    details.push(`Khối động "${token.raw}" cần có tiêu đề H2/H3 giới thiệu ngay phía trên`);
  }

  return { gateName: "structure", passed: details.length === 0, details, severity: "error" };
}

/** SEO gate (§6.3): keyword trong title/intro, meta day du, slug hop le. */
export function evaluateArticleCamNangSeoGate(input: ArticleCamNangGateInput): QualityCheck {
  const { article, keywordSeed } = input;
  const details: string[] = [];

  const primaryKeyword = keywordSeed[0]?.trim() || article.metadata.searchKeyword;
  if (!containsNormalized(article.title, primaryKeyword)) {
    details.push(`Từ khóa chính "${primaryKeyword}" chưa xuất hiện trong tiêu đề`);
  }
  if (!containsNormalized(article.intro, primaryKeyword)) {
    details.push(`Từ khóa chính "${primaryKeyword}" chưa xuất hiện trong mở bài`);
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(article.metadata.slugSuggestion)) {
    details.push(`Slug không hợp lệ: "${article.metadata.slugSuggestion}"`);
  }
  if (article.metadata.metaDescription.length > ARTICLE_FIELD_LIMITS.metaDescription) {
    details.push(`Meta description vượt ${ARTICLE_FIELD_LIMITS.metaDescription} ký tự`);
  }

  return { gateName: "seo", passed: details.length === 0, details, severity: "error" };
}

/** Chay ca 2 gate cam nang — Approve chi khi allPassed. */
export function evaluateArticleCamNangGates(input: ArticleCamNangGateInput): {
  checks: QualityCheck[];
  allPassed: boolean;
} {
  const checks = [
    evaluateArticleCamNangStructureGate(input),
    evaluateArticleCamNangSeoGate(input),
  ];
  return { checks, allPassed: checks.every((c) => c.passed) };
}
