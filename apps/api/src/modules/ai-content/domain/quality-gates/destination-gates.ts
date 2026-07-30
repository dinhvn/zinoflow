import type {
  ContentSection,
  DestinationArticle,
  QualityCheck,
} from "@zinoflow/contracts";
import {
  DESTINATION_BLOCK_LABELS,
  DESTINATION_FIELD_LIMITS,
  DESTINATION_LIST_BLOCK_KEYS,
  DESTINATION_SECTION_ORDER,
  MIN_LIST_ITEMS,
} from "@zinoflow/contracts";
import { containsNormalized } from "./text-matching";

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
  /**
   * flagship | standard | null — chi anh huong structure gate (Phase 28.3):
   * Flagship doi yeu cau "cau chuyen van hoa-lich su" thanh "mua/thoi diem dep
   * nhat" (diem tong quan ca vung khong hop voi khung 1 diem tham quan don le).
   */
  contentTier?: "flagship" | "standard" | null;
  /** Snapshot nguon dung sinh bai; undefined thi bo qua numeric grounding warning. */
  sourceContext?: string | null;
}

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
const MISSING_DATA_MARKERS = [
  "cần kiểm tra",
  "không áp dụng",
  "miễn phí",
  "chưa có thông tin",
  "chưa có dữ liệu",
  "tuỳ điểm tham quan cụ thể",
];

const HIGH_CONFIDENCE_CLICHES = [
  "nếu bạn đang tìm kiếm",
  "điểm đến không thể bỏ qua",
  "chắc chắn sẽ không làm bạn thất vọng",
];

/**
 * 1 trong cac tu khoa nay phai xuat hien trong 1 heading section — bat buoc co
 * khoi "cau chuyen/y nghia van hoa - lich su" (content-seo-ux-plan §5.6, don bay
 * E-E-A-T that su, khong chi nhoi tu khoa kho khan gio mo cua/gia ve).
 */
export const CULTURAL_STORY_HEADING_KEYWORDS: readonly string[] = [
  "văn hoá",
  "văn hóa",
  "lịch sử",
  "câu chuyện",
  "truyền thuyết",
  "ý nghĩa",
];

/**
 * Bai Flagship (tinh/cum tong hop) thay yeu cau "cau chuyen van hoa-lich su"
 * bang yeu cau "mua/thoi diem dep nhat" — cau hoi search intent hang dau voi
 * diem den lon, khung 1 diem tham quan don le khong hop (Phase 28.3).
 */
export const SEASON_HEADING_KEYWORDS: readonly string[] = ["mùa", "thời điểm"];

/**
 * Structure gate (§6.1): 1 H1, >=3 section du noi dung, FAQ >=3,
 * quick facts khong bo trong, neu input co dia chi cu + moi thi bai phai neu ca 2.
 */
export function evaluateDestinationStructureGate(
  input: DestinationGateInput,
): QualityCheck {
  const { article, draftMarkdown } = input;
  const details: string[] = [];

  const h1Count = (draftMarkdown.match(/^# /gm) ?? []).length;
  if (h1Count !== 1) {
    details.push(`Bài viết phải có đúng 1 tiêu đề H1 (hiện có ${h1Count})`);
  }
  if (article.sections.length < 3) {
    details.push(
      `Bài điểm đến cần ít nhất 3 section (hiện có ${article.sections.length})`,
    );
  }
  for (const section of article.sections) {
    if (isListBlockSection(section)) {
      const listError = evaluateListSection(section);
      if (listError) details.push(listError);
    }
  }

  // Uu tien check theo blockKey co dinh (7 khoi chuan) khi bai da gan blockKey;
  // bai cu chua co blockKey nao thi fallback ve keyword-matching heading nhu truoc.
  const hasAnyBlockKey = article.sections.some((section) =>
    Boolean(section.blockKey),
  );

  // Bai co gan blockKey (tao/sua sau 07/2026) phai phu du 7 khoi co dinh — truoc
  // day khong gate nao check dieu nay, AI co the tra ve thieu khoi (chi 1-2 block)
  // ma van qua duoc structure gate (bug phat hien 07/2026).
  if (hasAnyBlockKey) {
    const presentKeys = new Set(article.sections.map((s) => s.blockKey));
    const missingKeys = DESTINATION_SECTION_ORDER.filter(
      (key) => !presentKeys.has(key),
    );
    if (missingKeys.length > 0) {
      const missingLabels = missingKeys
        .map((k) => DESTINATION_BLOCK_LABELS[k])
        .join(", ");
      details.push(`Bài thiếu khối nội dung cố định: ${missingLabels}`);
    }
  }

  if (input.contentTier === "flagship") {
    const hasSeasonSection = hasAnyBlockKey
      ? article.sections.some((section) => section.blockKey === "mua-nao")
      : article.sections.some((section) =>
          SEASON_HEADING_KEYWORDS.some((kw) =>
            containsNormalized(section.heading, kw),
          ),
        );
    if (!hasSeasonSection) {
      details.push(
        'Thiếu section "mùa/thời điểm đẹp nhất để đi" (bắt buộc với bài điểm đến Flagship)',
      );
    }
  } else if (!hasAnyBlockKey) {
    const hasCulturalStorySection = article.sections.some((section) =>
      CULTURAL_STORY_HEADING_KEYWORDS.some((kw) =>
        containsNormalized(section.heading, kw),
      ),
    );
    if (!hasCulturalStorySection) {
      details.push(
        'Thiếu section "câu chuyện/ý nghĩa văn hoá - lịch sử" (bắt buộc theo khung bài §5.6)',
      );
    }
  }
  // Bai da co blockKey nhung khong phai flagship: khong con bat buoc rieng
  // "van hoa-lich su" vi khung 6 khoi co dinh da bao phu du (tong-quan/mua-nao/...).

  return {
    gateName: "structure",
    passed: details.length === 0,
    details,
    severity: "error",
  };
}

/** Section co thuoc khoi dang danh sach co cau truc (an-gi/qua-mang-ve) va co gan items khong. */
function isListBlockSection(section: ContentSection): boolean {
  return Boolean(
    section.blockKey &&
    DESTINATION_LIST_BLOCK_KEYS.includes(section.blockKey) &&
    section.items,
  );
}

/**
 * Kiem tra rieng cho khoi dang danh sach co cau truc (an-gi/qua-mang-ve):
 * Muc B cho phep list rong khi nguon thieu; neu co item thi moi item phai co mo ta.
 */
function evaluateListSection(section: ContentSection): string | null {
  if (!section.items) return null;

  if (section.items.length < MIN_LIST_ITEMS) {
    return `Section "${section.heading}" cần ít nhất ${MIN_LIST_ITEMS} mục (hiện có ${section.items.length})`;
  }
  const emptyItem = section.items.find((item) => item.moTa.trim().length === 0);
  if (emptyItem) {
    return `Mục "${emptyItem.ten}" trong section "${section.heading}" chưa có mô tả`;
  }
  return null;
}

/** SEO gate (§6.2): keyword trong H1 + mo bai, meta day du, slug hop le. */
export function evaluateDestinationSeoGate(
  input: DestinationGateInput,
): QualityCheck {
  const { article, keywordSeed } = input;
  const details: string[] = [];

  // Keyword chinh mac dinh la ten diem den (metadata.name)
  const primaryKeyword = keywordSeed[0]?.trim() || article.metadata.name;
  if (!containsNormalized(article.title, primaryKeyword)) {
    details.push(
      `Từ khóa chính "${primaryKeyword}" chưa xuất hiện trong tiêu đề H1`,
    );
  }
  if (!containsNormalized(article.intro, primaryKeyword)) {
    details.push(
      `Từ khóa chính "${primaryKeyword}" chưa xuất hiện trong mở bài`,
    );
  }
  if (!containsNormalized(article.metadata.metaDescription, primaryKeyword)) {
    details.push(
      `Meta description chưa chứa từ khóa chính "${primaryKeyword}"`,
    );
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(article.metadata.slugSuggestion)) {
    details.push(`Slug không hợp lệ: "${article.metadata.slugSuggestion}"`);
  }
  if (
    article.metadata.description.length > DESTINATION_FIELD_LIMITS.description
  ) {
    details.push(
      `Mô tả ngắn vượt ${DESTINATION_FIELD_LIMITS.description} ký tự`,
    );
  }

  return {
    gateName: "seo",
    passed: details.length === 0,
    details,
    severity: "error",
  };
}

/**
 * Policy gate travel (§6.3 + spec chinh §19.5.3): gia ve kem luu y thay doi,
 * khong claim tuyet doi. Truoc day con check dong "updateNotice" phai co
 * thang/nam — bo (content-freshness-plan.md Giai doan E): badge "cap nhat"
 * gio tinh dong tu ContentUpdatedAt/LastVerifiedAt (v2.DestinationContent),
 * khong con la text AI viet cung.
 */
export function evaluateDestinationPolicyGate(
  input: DestinationGateInput,
): QualityCheck {
  const { article, draftMarkdown } = input;
  const details: string[] = [];

  // Gia ve: hoac kem luu y thay doi, hoac la gia tri "mien phi"/"can kiem tra"
  const price = article.quickFacts.ticketPrice;
  const priceHasCaveat =
    containsNormalized(price, "có thể thay đổi") ||
    MISSING_DATA_MARKERS.some((m) => containsNormalized(price, m));
  if (!priceHasCaveat) {
    details.push(
      'Giá vé phải kèm lưu ý "có thể thay đổi" (hoặc ghi Miễn phí / Cần kiểm tra)',
    );
  }

  for (const phrase of BANNED_TRAVEL_PHRASES) {
    if (containsNormalized(draftMarkdown, phrase)) {
      details.push(`Chứa claim tuyệt đối bị cấm: "${phrase}"`);
    }
  }

  return {
    gateName: "policy",
    passed: details.length === 0,
    details,
    severity: "error",
  };
}

/**
 * Data gate (§6.4): khong field rong/bia, do dai khop gioi han cot SQL,
 * slug khong trung diem den khac (mode create).
 */
export function evaluateDestinationDataGate(
  input: DestinationGateInput,
): QualityCheck {
  const { article, existingSlugs } = input;
  const details: string[] = [];

  const facts: Array<[string, string, number]> = [
    [
      "Giờ mở cửa",
      article.quickFacts.openingTime,
      DESTINATION_FIELD_LIMITS.quickFactShort,
    ],
    [
      "Giá vé",
      article.quickFacts.ticketPrice,
      DESTINATION_FIELD_LIMITS.quickFactShort,
    ],
    ["Di chuyển", article.quickFacts.transport, Number.MAX_SAFE_INTEGER],
    ["Ăn uống", article.quickFacts.food, Number.MAX_SAFE_INTEGER],
    ["Lưu trú", article.quickFacts.hotel, Number.MAX_SAFE_INTEGER],
    ["Mẹo & lưu ý", article.quickFacts.tip, Number.MAX_SAFE_INTEGER],
  ];
  for (const [label, value, maxLength] of facts) {
    if (value.trim().length === 0) {
      details.push(
        `Mục "${label}" đang bỏ trống — ghi "Không áp dụng" nếu không có`,
      );
    } else if (value.length > maxLength) {
      details.push(
        `Mục "${label}" vượt ${maxLength} ký tự (giới hạn cột dữ liệu website)`,
      );
    }
  }

  if (
    article.metadata.searchKeyword.length >
    DESTINATION_FIELD_LIMITS.searchKeyword
  ) {
    details.push(
      `searchKeyword vượt ${DESTINATION_FIELD_LIMITS.searchKeyword} ký tự`,
    );
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

  return {
    gateName: "data",
    passed: details.length === 0,
    details,
    severity: "error",
  };
}

/** Canh bao cum van mau co do chinh xac cao; khong chan publish. */
export function evaluateDestinationStyleGate(
  input: DestinationGateInput,
): QualityCheck {
  const details = HIGH_CONFIDENCE_CLICHES.filter((phrase) =>
    containsNormalized(input.draftMarkdown, phrase),
  ).map((phrase) => `Cụm văn mẫu cần xem lại: "${phrase}"`);
  return {
    gateName: "style",
    passed: details.length === 0,
    details,
    severity: "warning",
  };
}

/** Canh bao cau dai gan trung nhau giua intro/quick facts/section/FAQ. */
export function evaluateDestinationRedundancyGate(
  input: DestinationGateInput,
): QualityCheck {
  const reportedPairs = new Set<string>();
  const chunks: Array<{ location: string; text: string }> = [
    { location: "Mở bài", text: input.article.intro },
    ...Object.entries(input.article.quickFacts).map(([key, text]) => ({
      location: `Thông tin nhanh.${key}`,
      text,
    })),
    ...input.article.sections.map((section) => ({
      location: `Section "${section.heading}"`,
      text: section.content,
    })),
    ...input.article.faq.map((item) => ({
      location: `FAQ "${item.question}"`,
      text: item.answer,
    })),
  ];
  const sentences = chunks.flatMap((chunk) =>
    splitLongSentences(chunk.text).map((text) => ({ ...chunk, text })),
  );
  const details: string[] = [];
  for (let left = 0; left < sentences.length; left += 1) {
    for (let right = left + 1; right < sentences.length; right += 1) {
      const a = sentences[left]!;
      const b = sentences[right]!;
      if (a.location === b.location || wordOverlap(a.text, b.text) < 0.82)
        continue;
      const pair = `${a.location}\u0000${b.location}`;
      if (reportedPairs.has(pair)) continue;
      reportedPairs.add(pair);
      details.push(`Nội dung gần trùng giữa ${a.location} và ${b.location}`);
      if (details.length === 5) break;
    }
    if (details.length === 5) break;
  }
  return {
    gateName: "redundancy",
    passed: details.length === 0,
    details,
    severity: "warning",
  };
}

/** Chi check claim co hinh thuc gio/tien; day la warning lexical, khong phai fact verification. */
export function evaluateDestinationGroundingGate(
  input: DestinationGateInput,
): QualityCheck {
  if (!input.sourceContext) {
    return {
      gateName: "grounding",
      passed: true,
      details: [],
      severity: "warning",
    };
  }
  const claims =
    input.draftMarkdown.match(
      /\b\d{1,2}:\d{2}\b|\b\d[\d.,]*\s?(?:đ|vnd|đồng)(?=\s|[),.;]|$)/giu,
    ) ?? [];
  const normalizedSource = normalizeClaim(input.sourceContext);
  const unsupported = [...new Set(claims)].filter(
    (claim) => !normalizedSource.includes(normalizeClaim(claim)),
  );
  return {
    gateName: "grounding",
    passed: unsupported.length === 0,
    details: unsupported.map(
      (claim) => `Số liệu giờ/giá chưa thấy trong source snapshot: "${claim}"`,
    ),
    severity: "warning",
  };
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
    evaluateDestinationStyleGate(input),
    evaluateDestinationRedundancyGate(input),
    evaluateDestinationGroundingGate(input),
  ];
  return {
    checks,
    allPassed: checks.every(
      (check) => check.severity === "warning" || check.passed,
    ),
  };
}

function splitLongSentences(text: string): string[] {
  return text
    .split(/[.!?]+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 70);
}

function wordOverlap(left: string, right: string): number {
  const a = new Set(normalizeClaim(left).split(" ").filter(Boolean));
  const b = new Set(normalizeClaim(right).split(" ").filter(Boolean));
  if (a.size < 8 || b.size < 8) return 0;
  const intersection = [...a].filter((word) => b.has(word)).length;
  return intersection / Math.max(a.size, b.size);
}

function normalizeClaim(value: string): string {
  return value
    .toLocaleLowerCase("vi-VN")
    .replace(/[^\p{L}\p{N}:]+/gu, " ")
    .trim();
}
