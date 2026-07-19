import { z } from "zod/v4";
import { contentSectionSchema, faqItemSchema, type DestinationBlockKey } from "../ai-content/article";
import { qualityCheckSchema } from "../ai-content/quality";

/**
 * Bai viet DIEM DEN du lich (articleType "guide-diem-den") —
 * spec docs/dichoithoi/dichoithoi-destination-spec.md §4.
 * Output AI map THANG sang cot v2.DestinationContent (redesign doc §4.3):
 * quickFacts -> cot rieng, intro + sections + faq -> ContentHtml,
 * metadata -> MetaTitle/MetaDescription + Destination.ShortDescription/SearchKeyword.
 */

/** Gioi han do dai theo cot SQL Server (chua le an toan duoi limit cot). */
export const DESTINATION_FIELD_LIMITS = {
  quickFactShort: 500, // OpeningTime/TicketPrice: nvarchar(512)
  description: 950, // ShortDescription: nvarchar(1000)
  searchKeyword: 250, // SearchKeyword: nvarchar(256)
  metaTitle: 145, // MetaTitle: nvarchar(150)
  metaDescription: 295, // MetaDescription: nvarchar(300)
} as const;

/**
 * Quick facts — du lieu co cau truc hien thi dang card tren web.
 * Muc nao khong ap dung (vd diem mien phi) AI phai ghi ro "Miễn phí" /
 * "Không áp dụng" thay vi bo trong — structure gate kiem tra.
 */
export const destinationQuickFactsSchema = z.object({
  openingTime: z.string().min(1).max(DESTINATION_FIELD_LIMITS.quickFactShort),
  ticketPrice: z.string().min(1).max(DESTINATION_FIELD_LIMITS.quickFactShort),
  transport: z.string().min(1),
  food: z.string().min(1),
  hotel: z.string().min(1),
  tip: z.string().min(1),
});
export type DestinationQuickFacts = z.infer<typeof destinationQuickFactsSchema>;

export const destinationArticleMetadataSchema = z.object({
  /** Ten chuan hoa co dau cua diem den */
  name: z.string().min(2).max(128),
  /** Goi y slug — nguoi dung xac nhan (mode create), bo qua khi update */
  slugSuggestion: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug chỉ gồm chữ thường, số và dấu gạch ngang"),
  metaTitle: z.string().min(10).max(DESTINATION_FIELD_LIMITS.metaTitle),
  metaDescription: z.string().min(50).max(DESTINATION_FIELD_LIMITS.metaDescription),
  /** Mo ta ngan — do vao Destination.ShortDescription */
  description: z.string().min(50).max(DESTINATION_FIELD_LIMITS.description),
  searchKeyword: z.string().min(2).max(DESTINATION_FIELD_LIMITS.searchKeyword),
});

/**
 * Frame bai diem den = toan bai TRU sections (buoc 3 cua pipeline 3 buoc).
 * updateNotice: dong "thong tin cap nhat thang X/nam" — policy gate travel bat buoc.
 */
export const destinationArticleFrameSchema = z.object({
  title: z.string().min(10).max(100),
  intro: z.string().min(80),
  quickFacts: destinationQuickFactsSchema,
  faq: z.array(faqItemSchema).min(3).max(6),
  updateNotice: z.string().min(10),
  metadata: destinationArticleMetadataSchema,
});
export type DestinationArticleFrame = z.infer<typeof destinationArticleFrameSchema>;

/** Bai diem den hoan chinh = frame + sections. */
export const destinationArticleSchema = destinationArticleFrameSchema.extend({
  sections: z.array(contentSectionSchema).min(3),
});
export type DestinationArticle = z.infer<typeof destinationArticleSchema>;

/**
 * Dung thu tu hien thi + soan thao 7 khoi noi dung co dinh cua bai diem den
 * (khong tinh "khac") — dichoithoi-destination-spec.md §2.2. "trai-nghiem"
 * (khach se lam gi/trai nghiem gi o day — hanh dong cu the, KHAC "diem tham
 * quan" la danh sach dia diem) them 07/2026 sau khi doi chieu TripAdvisor: mo
 * ta dai KHONG thay the duoc danh sach hanh dong cu the, ngan, de scan.
 * "lich-trinh" (07/2026): TRUOC la field JSON rieng (ItineraryJson, co form
 * nhap tay + poiSlug auto-link + tour-CTA theo duration_days) — chuyen ve
 * prose thuong trong sections nhu moi khoi khac theo quyet dinh cua chu site
 * (chap nhan mat 2 tinh nang tu dong do de doi 1 UX soan bai duy nhat).
 * "meo-luu-y" BO KHOI list nay (07/2026, van con trong enum + label de tuong
 * thich nguoc voi bai cu da gan blockKey nay) — phat hien tren live site dang
 * trung 2 lan roi (cot Tip + feature PracticalNotesJson, 2 khoi <details>
 * canh nhau o #meo trong Detail.cshtml), them section thu 3 chi lam nang hon.
 * "Meo & luu y thuc te" gio CHI con qua PracticalNotesJson (nhom E).
 */
export const DESTINATION_SECTION_ORDER: readonly Exclude<DestinationBlockKey, "khac">[] = [
  "tong-quan",
  "trai-nghiem",
  "mua-nao",
  "lich-trinh",
  "di-chuyen",
  "an-gi",
  "qua-mang-ve",
];

/** Nhan tieng Viet hien thi cho tung khoi — dung chung FE/BE/prompt AI. */
export const DESTINATION_BLOCK_LABELS: Record<DestinationBlockKey, string> = {
  "tong-quan": "Tổng quan / giới thiệu",
  "trai-nghiem": "Trải nghiệm gì ở đây",
  "mua-nao": "Nên đi mùa nào",
  "lich-trinh": "Lịch trình gợi ý",
  "di-chuyen": "Di chuyển",
  "an-gi": "Ăn gì đặc trưng",
  /** Giu lai de hien thi dung nhan cho bai CU da gan blockKey nay — KHONG con trong DESTINATION_SECTION_ORDER (07/2026, trung PracticalNotesJson). */
  "meo-luu-y": "Mẹo & lưu ý thực tế (cũ)",
  "qua-mang-ve": "Quà mang về",
  khac: "Khác",
};

/** Khoi nao dung danh sach co cau truc (items) thay vi van xuoi thuan. */
export const DESTINATION_LIST_BLOCK_KEYS: readonly DestinationBlockKey[] = [
  "trai-nghiem",
  "an-gi",
  "qua-mang-ve",
];

/** So muc toi thieu cho danh sach co cau truc (an-gi/qua-mang-ve) — dung o gate + skeleton. */
export const MIN_LIST_ITEMS = 3;

/**
 * Outline buoc 1 — khong co plannedProducts (diem den khong co product).
 * sectionHeadings PHAI dung 7 phan tu, khop DESTINATION_SECTION_ORDER — truoc
 * day min(3).max(8) cho phep AI lo prompt (da noi ro "dung 7 muc") va tra ve
 * it hon, khien bai thieu khoi ma khong gate nao bat loi (bug phat hien 07/2026,
 * nguoi dung thay AI chi tao 1-2 block).
 */
export const destinationOutlineSchema = z.object({
  title: z.string(),
  sectionHeadings: z.array(z.string()).length(DESTINATION_SECTION_ORDER.length),
  plannedFaqQuestions: z.array(z.string()).min(3),
});
export type DestinationOutline = z.infer<typeof destinationOutlineSchema>;

/**
 * Request "dan bai co san" (redesign luong viet bai §Phase 2): nguoi dung dan 1 doan
 * text co san (tu AI khac hoac tu viet) de AI TACH LAI (khong viet moi) vao dung
 * cau truc DestinationArticle. Response tra ve luon la DestinationArticle hop le.
 */
export const restructurePastedContentRequestSchema = z.object({
  rawText: z.string().min(50, "Nội dung dán vào quá ngắn").max(20_000),
  topic: z.string().min(1).max(128),
  keywordSeed: z.array(z.string()).default([]),
  aiProvider: z.string().optional(),
  aiModel: z.string().optional(),
});
export type RestructurePastedContentRequest = z.infer<typeof restructurePastedContentRequestSchema>;

/**
 * Pivot gop editor vao trang detail — luu tay `draft_article` (redesign luong
 * viet bai lan 2). Nhan RAW object, KHONG validate chat theo destinationArticleSchema
 * o day (cho phep luu dat do, chua du 6 block/FAQ) — validate that chay o
 * gate-check/preview/publish qua destinationArticleSchema.safeParse().
 */
export const updateDestinationDraftArticleRequestSchema = z.object({
  draftArticle: z.record(z.string(), z.unknown()),
});
export type UpdateDestinationDraftArticleRequest = z.infer<
  typeof updateDestinationDraftArticleRequestSchema
>;

/** Request tao goi y AI cho DUNG 1 block (khong tao ContentJob/ContentDraft). */
export const generateDestinationBlockRequestSchema = z.object({
  aiProvider: z.string().optional(),
  aiModel: z.string().optional(),
});
export type GenerateDestinationBlockRequest = z.infer<typeof generateDestinationBlockRequestSchema>;

/**
 * Ket qua chay gate tren draft_article HIEN TAI cua 1 diem den, doc lap voi
 * draftId/job (khac runQualityChecksResponseSchema — schema do gan voi 1 draft
 * cu the trong luong ContentJob, khong dung duoc cho pivot nay).
 */
export const destinationDraftQualityChecksResponseSchema = z.object({
  checks: z.array(qualityCheckSchema),
  allPassed: z.boolean(),
});
export type DestinationDraftQualityChecksResponse = z.infer<
  typeof destinationDraftQualityChecksResponseSchema
>;
