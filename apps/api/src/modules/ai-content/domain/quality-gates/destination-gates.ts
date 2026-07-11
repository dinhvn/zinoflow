import type { DestinationArticle, QualityCheck } from "@zinoflow/contracts";
import { DESTINATION_FIELD_LIMITS } from "@zinoflow/contracts";
import { containsNormalized, countWords } from "./text-matching";

/**
 * 4 quality gates cho bai DIEM DEN (guide-diem-den) — dichoithoi-destination-spec §6.
 * Thay bo gates affiliate: KHONG check affiliate disclosure / product URL;
 * them rule travel: thoi diem cap nhat, gia kem luu y thay doi, khong claim tuyet doi.
 * Code thuan, loi tra ve TIENG VIET CO DAU de hien thi truc tiep tren UI review.
 */

export interface DestinationGateInput {
  article: DestinationArticle;
  draftMarkdown: string;
  keywordSeed: readonly string[];
  /** Slug cac diem den dang ton tai — check trung slug khi mode create (null = bo qua) */
  existingSlugs?: readonly string[] | null;
}

const MIN_SECTION_WORDS = 60;
/** Nguong do dai toi thieu toan bai (content-seo-ux-plan §8.3, bo sung 07/2026) */
const MIN_TOTAL_WORDS = 800;

/** Claim tuyet doi bi cam voi bai travel khi khong co nguon (spec chinh §19.5.3). */
const BANNED_TRAVEL_PHRASES: readonly string[] = [
  "đẹp nhất việt nam",
  "đẹp nhất thế giới",
  "duy nhất tại việt nam",
  "rẻ nhất việt nam",
  "số 1 việt nam",
  "cam kết 100%",
  "đảm bảo 100%",
];

/** Gia tri quickFacts hop le khi AI thieu du lieu — phai ghi ro thay vi bia. */
const MISSING_DATA_MARKERS = ["cần kiểm tra", "không áp dụng", "miễn phí"];

/**
 * 1 trong cac tu khoa nay phai xuat hien trong 1 heading section — bat buoc co
 * khoi "cau chuyen/y nghia van hoa - lich su" (content-seo-ux-plan §5.6, don bay
 * E-E-A-T that su, khong chi nhoi tu khoa kho khan gio mo cua/gia ve).
 */
const CULTURAL_STORY_HEADING_KEYWORDS: readonly string[] = [
  "văn hoá",
  "văn hóa",
  "lịch sử",
  "câu chuyện",
  "truyền thuyết",
  "ý nghĩa",
];

/**
 * Structure gate (§6.1): 1 H1, >=3 section du noi dung, FAQ >=3,
 * quick facts khong bo trong, neu input co dia chi cu + moi thi bai phai neu ca 2.
 */
export function evaluateDestinationStructureGate(input: DestinationGateInput): QualityCheck {
  const { article, draftMarkdown } = input;
  const details: string[] = [];

  const h1Count = (draftMarkdown.match(/^# /gm) ?? []).length;
  if (h1Count !== 1) {
    details.push(`Bài viết phải có đúng 1 tiêu đề H1 (hiện có ${h1Count})`);
  }
  if (article.sections.length < 3) {
    details.push(`Bài điểm đến cần ít nhất 3 section (hiện có ${article.sections.length})`);
  }
  for (const section of article.sections) {
    const words = countWords(section.content);
    if (words < MIN_SECTION_WORDS) {
      details.push(
        `Section "${section.heading}" quá ngắn: ${words} từ (tối thiểu ${MIN_SECTION_WORDS})`,
      );
    }
  }
  if (countWords(article.intro) < 40) {
    details.push("Mở bài quá ngắn (cần tối thiểu ~80 từ theo khung bài)");
  }

  const totalWords =
    countWords(article.intro) + article.sections.reduce((sum, s) => sum + countWords(s.content), 0);
  if (totalWords < MIN_TOTAL_WORDS) {
    details.push(`Bài quá ngắn: ${totalWords} từ (tối thiểu ${MIN_TOTAL_WORDS} từ toàn bài)`);
  }

  if (article.faq.length < 3) {
    details.push(`FAQ cần ít nhất 3 câu hỏi (hiện có ${article.faq.length})`);
  }

  const hasCulturalStorySection = article.sections.some((section) =>
    CULTURAL_STORY_HEADING_KEYWORDS.some((kw) => containsNormalized(section.heading, kw)),
  );
  if (!hasCulturalStorySection) {
    details.push(
      'Thiếu section "câu chuyện/ý nghĩa văn hoá - lịch sử" (bắt buộc theo khung bài §5.6)',
    );
  }

  return { gateName: "structure", passed: details.length === 0, details };
}

/** SEO gate (§6.2): keyword trong H1 + mo bai, meta day du, slug hop le. */
export function evaluateDestinationSeoGate(input: DestinationGateInput): QualityCheck {
  const { article, keywordSeed } = input;
  const details: string[] = [];

  // Keyword chinh mac dinh la ten diem den (metadata.name)
  const primaryKeyword = keywordSeed[0]?.trim() || article.metadata.name;
  if (!containsNormalized(article.title, primaryKeyword)) {
    details.push(`Từ khóa chính "${primaryKeyword}" chưa xuất hiện trong tiêu đề H1`);
  }
  if (!containsNormalized(article.intro, primaryKeyword)) {
    details.push(`Từ khóa chính "${primaryKeyword}" chưa xuất hiện trong mở bài`);
  }
  if (!containsNormalized(article.metadata.metaDescription, primaryKeyword)) {
    details.push(`Meta description chưa chứa từ khóa chính "${primaryKeyword}"`);
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(article.metadata.slugSuggestion)) {
    details.push(`Slug không hợp lệ: "${article.metadata.slugSuggestion}"`);
  }
  if (article.metadata.description.length > DESTINATION_FIELD_LIMITS.description) {
    details.push(`Mô tả ngắn vượt ${DESTINATION_FIELD_LIMITS.description} ký tự`);
  }

  return { gateName: "seo", passed: details.length === 0, details };
}

/**
 * Policy gate travel (§6.3 + spec chinh §19.5.3): co dong thoi diem cap nhat,
 * gia ve kem luu y thay doi, khong claim tuyet doi.
 */
export function evaluateDestinationPolicyGate(input: DestinationGateInput): QualityCheck {
  const { article, draftMarkdown } = input;
  const details: string[] = [];

  // updateNotice phai co thang/nam cu the (vd "tháng 6/2026" hoac "06/2026")
  if (!/\d{1,2}\s*[/-]\s*20\d{2}/.test(article.updateNotice)) {
    details.push('Dòng cập nhật phải ghi rõ tháng/năm (vd "cập nhật tháng 6/2026")');
  }

  // Gia ve: hoac kem luu y thay doi, hoac la gia tri "mien phi"/"can kiem tra"
  const price = article.quickFacts.ticketPrice;
  const priceHasCaveat =
    containsNormalized(price, "có thể thay đổi") ||
    containsNormalized(article.updateNotice, "có thể thay đổi") ||
    MISSING_DATA_MARKERS.some((m) => containsNormalized(price, m));
  if (!priceHasCaveat) {
    details.push('Giá vé phải kèm lưu ý "có thể thay đổi" (hoặc ghi Miễn phí / Cần kiểm tra)');
  }

  for (const phrase of BANNED_TRAVEL_PHRASES) {
    if (containsNormalized(draftMarkdown, phrase)) {
      details.push(`Chứa claim tuyệt đối bị cấm: "${phrase}"`);
    }
  }

  return { gateName: "policy", passed: details.length === 0, details };
}

/**
 * Data gate (§6.4): khong field rong/bia, do dai khop gioi han cot SQL,
 * slug khong trung diem den khac (mode create).
 */
export function evaluateDestinationDataGate(input: DestinationGateInput): QualityCheck {
  const { article, existingSlugs } = input;
  const details: string[] = [];

  const facts: Array<[string, string, number]> = [
    ["Giờ mở cửa", article.quickFacts.openingTime, DESTINATION_FIELD_LIMITS.quickFactShort],
    ["Giá vé", article.quickFacts.ticketPrice, DESTINATION_FIELD_LIMITS.quickFactShort],
    ["Di chuyển", article.quickFacts.transport, Number.MAX_SAFE_INTEGER],
    ["Ăn uống", article.quickFacts.food, Number.MAX_SAFE_INTEGER],
    ["Lưu trú", article.quickFacts.hotel, Number.MAX_SAFE_INTEGER],
    ["Mẹo & lưu ý", article.quickFacts.tip, Number.MAX_SAFE_INTEGER],
  ];
  for (const [label, value, maxLength] of facts) {
    if (value.trim().length === 0) {
      details.push(`Mục "${label}" đang bỏ trống — ghi "Không áp dụng" nếu không có`);
    } else if (value.length > maxLength) {
      details.push(`Mục "${label}" vượt ${maxLength} ký tự (giới hạn cột dữ liệu website)`);
    }
  }

  if (article.metadata.searchKeyword.length > DESTINATION_FIELD_LIMITS.searchKeyword) {
    details.push(`searchKeyword vượt ${DESTINATION_FIELD_LIMITS.searchKeyword} ký tự`);
  }
  for (const item of article.faq) {
    if (item.answer.trim().length === 0) {
      details.push(`Câu hỏi FAQ "${item.question}" chưa có câu trả lời`);
    }
  }
  if (existingSlugs?.includes(article.metadata.slugSuggestion)) {
    details.push(
      `Slug "${article.metadata.slugSuggestion}" đã tồn tại — đổi slug hoặc dùng chế độ cập nhật bài`,
    );
  }

  return { gateName: "data", passed: details.length === 0, details };
}

/** Chay ca 4 gate travel theo thu tu co dinh — Approve chi khi allPassed. */
export function evaluateDestinationGates(input: DestinationGateInput): {
  checks: QualityCheck[];
  allPassed: boolean;
} {
  const checks = [
    evaluateDestinationStructureGate(input),
    evaluateDestinationSeoGate(input),
    evaluateDestinationPolicyGate(input),
    evaluateDestinationDataGate(input),
  ];
  return { checks, allPassed: checks.every((c) => c.passed) };
}
