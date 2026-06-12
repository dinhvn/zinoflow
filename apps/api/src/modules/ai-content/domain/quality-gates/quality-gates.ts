import type { Article, QualityCheck } from "@zinoflow/contracts";
import { containsNormalized, countWords } from "./text-matching";

/**
 * 4 quality gates bat buoc truoc Approve — spec §9 + §17.5. Code thuan, khong goi AI.
 * Moi gate tra ve danh sach loi TIENG VIET CO DAU (hien thi truc tiep tren UI review).
 * Gate pass khi danh sach loi rong.
 */

export interface QualityGateInput {
  article: Article;
  draftMarkdown: string;
  keywordSeed: readonly string[];
}

// Rule §17.3: moi H2 nen co 120-250 tu. Gate chi chan duoi (qua ngan = chua du noi dung),
// khong chan tren (dai hon mot chut khong phai loi chat luong).
const MIN_SECTION_WORDS = 60;

/** Cum tu claim qua da bi cam (policy gate) — mo rong dan theo niche o M4 (SiteProfile). */
const BANNED_PHRASES: readonly string[] = [
  "tốt nhất thị trường",
  "số 1 thị trường",
  "cam kết 100%",
  "đảm bảo 100%",
  "hiệu quả 100%",
  "chữa khỏi",
  "trị dứt điểm",
  "không đối thủ",
  "rẻ nhất việt nam",
];

/** URL placeholder do AI sinh khi thieu du lieu san pham — data gate phai chan. */
const PLACEHOLDER_URL_MARKER = "example.com";

/** Structure gate: du 8 block, 1 H1 duy nhat, section du noi dung — spec §17.5.1. */
export function evaluateStructureGate(input: QualityGateInput): QualityCheck {
  const { article, draftMarkdown } = input;
  const details: string[] = [];

  const h1Count = (draftMarkdown.match(/^# /gm) ?? []).length;
  if (h1Count !== 1) {
    details.push(`Bài viết phải có đúng 1 tiêu đề H1 (hiện có ${h1Count})`);
  }
  if (article.hero.title.length < 10 || article.hero.title.length > 100) {
    details.push(`Tiêu đề nên dài 10-100 ký tự (hiện ${article.hero.title.length})`);
  }
  if (article.sections.length < 2) {
    details.push(`Bài cần ít nhất 2 section nội dung chính (hiện có ${article.sections.length})`);
  }
  for (const section of article.sections) {
    const words = countWords(section.content);
    if (words < MIN_SECTION_WORDS) {
      details.push(`Section "${section.heading}" quá ngắn: ${words} từ (tối thiểu ${MIN_SECTION_WORDS})`);
    }
  }

  return { gateName: "structure", passed: details.length === 0, details };
}

/** SEO gate: keyword trong H1 + intro, meta day du, >=2 internal links — spec §17.5.2. */
export function evaluateSeoGate(input: QualityGateInput): QualityCheck {
  const { article, keywordSeed } = input;
  const details: string[] = [];

  // Keyword dau tien la primary keyword; khong nhap keyword thi bo qua check keyword
  const primaryKeyword = keywordSeed[0]?.trim();
  if (primaryKeyword) {
    if (!containsNormalized(article.hero.title, primaryKeyword)) {
      details.push(`Từ khóa chính "${primaryKeyword}" chưa xuất hiện trong tiêu đề H1`);
    }
    // "Intro" = cac block mo bai: intent + quickAnswer + subtitle
    const introText = [
      article.hero.subtitle,
      article.intent.forWho,
      article.intent.problem,
      ...article.quickAnswer.bullets,
    ].join(" ");
    if (!containsNormalized(introText, primaryKeyword)) {
      details.push(`Từ khóa chính "${primaryKeyword}" chưa xuất hiện trong phần mở bài`);
    }
  }

  if (article.metadata.metaTitle.trim().length === 0) {
    details.push("Thiếu metaTitle");
  }
  if (article.metadata.metaDescription.trim().length === 0) {
    details.push("Thiếu metaDescription");
  }
  if (article.metadata.internalLinkSuggestions.length < 2) {
    details.push(
      `Cần ít nhất 2 internal link (hiện có ${article.metadata.internalLinkSuggestions.length})`,
    );
  }

  return { gateName: "seo", passed: details.length === 0, details };
}

/** Policy gate: co affiliate disclosure, khong co claim qua da — spec §17.5.3. */
export function evaluatePolicyGate(input: QualityGateInput): QualityCheck {
  const { article } = input;
  const details: string[] = [];

  if (article.hero.affiliateDisclosure.trim().length < 10) {
    details.push("Thiếu câu khai báo tiếp thị liên kết (affiliate disclosure)");
  }

  // Quet toan bo text cua bai (markdown da gom du noi dung cac block)
  const fullText = input.draftMarkdown;
  for (const phrase of BANNED_PHRASES) {
    if (containsNormalized(fullText, phrase)) {
      details.push(`Chứa cụm từ claim quá đà bị cấm: "${phrase}"`);
    }
  }

  return { gateName: "policy", passed: details.length === 0, details };
}

/** Data gate: product URL hop le (khong placeholder), khong block rong — spec §17.5.4. */
export function evaluateDataGate(input: QualityGateInput): QualityCheck {
  const { article } = input;
  const details: string[] = [];

  if (article.productRecommendations.length === 0) {
    details.push("Bài chưa có sản phẩm gợi ý nào");
  }
  for (const product of article.productRecommendations) {
    if (!isValidHttpUrl(product.productUrl)) {
      details.push(`Sản phẩm "${product.name}" có URL không hợp lệ: ${product.productUrl}`);
    } else if (product.productUrl.includes(PLACEHOLDER_URL_MARKER)) {
      details.push(
        `Sản phẩm "${product.name}" đang dùng URL placeholder — cần thay bằng link sản phẩm thật`,
      );
    }
  }

  if (article.faq.length < 3) {
    details.push(`FAQ cần ít nhất 3 câu hỏi (hiện có ${article.faq.length})`);
  }
  for (const item of article.faq) {
    if (item.answer.trim().length === 0) {
      details.push(`Câu hỏi FAQ "${item.question}" chưa có câu trả lời`);
    }
  }
  if (article.finalCta.text.trim().length === 0) {
    details.push("Thiếu nội dung kết luận (final CTA)");
  }

  return { gateName: "data", passed: details.length === 0, details };
}

/** Chay ca 4 gate theo thu tu co dinh. Approve chi duoc phep khi allPassed. */
export function evaluateAllGates(input: QualityGateInput): {
  checks: QualityCheck[];
  allPassed: boolean;
} {
  const checks = [
    evaluateStructureGate(input),
    evaluateSeoGate(input),
    evaluatePolicyGate(input),
    evaluateDataGate(input),
  ];
  return { checks, allPassed: checks.every((c) => c.passed) };
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
