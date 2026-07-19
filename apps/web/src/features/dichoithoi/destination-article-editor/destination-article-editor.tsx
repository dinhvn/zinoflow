"use client";

import {
  DESTINATION_BLOCK_LABELS,
  DESTINATION_FIELD_LIMITS,
  DESTINATION_LIST_BLOCK_KEYS,
  DESTINATION_SECTION_ORDER,
  type ContentSection,
  type DestinationArticle,
  type DestinationBlockKey,
} from "@zinoflow/contracts";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { DestinationItemListEditor } from "./destination-item-list-editor";

/** Dem tu don gian — khop dung cong thuc voi destination-gates.ts (BE) de UI bao dung nguong gate. */
function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

const MIN_SECTION_WORDS = 60;
const MIN_INTRO_WORDS = 40;

/** Mo ta muc dich tung khoi — hien duoi nhan de nguoi viet phan biet intro vs khoi "tong-quan". */
const INTRO_HINT =
  "Đoạn dẫn nhập ngắn ngay dưới tiêu đề (H1) — hook người đọc, tóm tắt nhanh trước khi vào các khối nội dung chi tiết bên dưới. KHÔNG lặp lại nội dung khối \"Tổng quan / giới thiệu\".";

const DESTINATION_BLOCK_HINTS: Record<DestinationBlockKey, string> = {
  "tong-quan": "Khối H2 đầu tiên, viết đầy đủ hơn phần mở bài — giới thiệu chi tiết: điểm đến là gì, đặc điểm nổi bật, vì sao đáng đến.",
  "trai-nghiem": "Danh sách hoạt động/trải nghiệm cụ thể du khách có thể làm tại đây.",
  "mua-nao": "Thời điểm/mùa nào trong năm nên đến, thời tiết từng mùa ảnh hưởng trải nghiệm ra sao.",
  "lich-trinh": "Gợi ý lịch trình tham quan (thứ tự ghé, thời gian nên dành) — không phải lịch trình đa ngày (đã có field riêng ItineraryJson).",
  "di-chuyen": "Cách di chuyển tới điểm đến: phương tiện, tuyến đường, thời gian di chuyển.",
  "an-gi": "Danh sách món/đặc sản/quán ăn gắn với điểm đến.",
  "meo-luu-y": "Khối cũ (đã thay bằng Lưu ý thực tế/PracticalNotesJson) — chỉ còn hiển thị đúng nhãn cho bài cũ, không dùng cho bài mới.",
  "qua-mang-ve": "Danh sách đặc sản/quà lưu niệm gắn với điểm đến (khác Product \"Quà mang về\" ở khối Thương mại — đây là nội dung bài viết, không phải card sản phẩm bán).",
  khac: "Khối tự do cho nội dung không khớp 7 khối cố định — chỉ còn ở bài cũ.",
};

type DestinationSection = DestinationArticle["sections"][number];
type Faq = DestinationArticle["faq"][number];

function emptySection(blockKey: DestinationBlockKey): DestinationSection {
  return {
    heading: DESTINATION_BLOCK_LABELS[blockKey],
    content: "",
    blockKey,
    items: DESTINATION_LIST_BLOCK_KEYS.includes(blockKey) ? [] : undefined,
  };
}

/** Sap xep + bu du 6 section co dinh theo dung thu tu — bai cu chua co blockKey se hien o dang trong. */
function toFixedSections(sections: DestinationSection[]): DestinationSection[] {
  return DESTINATION_SECTION_ORDER.map(
    (blockKey) => sections.find((s) => s.blockKey === blockKey) ?? emptySection(blockKey),
  );
}

/**
 * Editor field-based cho bai DIEM DEN (redesign luong viet bai §Phase 3) — thay the
 * textarea markdown tho: Tieu de/Mo bai -> 6 khoi co dinh -> Thong tin nhanh -> FAQ
 * -> Metadata SEO. Chi dung khi job.articleType === "guide-diem-den"; cac loai bai
 * khac (cam-nang...) van dung textarea nhu cu (khong bi anh huong boi component nay).
 */
export function DestinationArticleEditor({
  article,
  onChange,
  suggestions,
  suggestLoading,
  onRequestSuggestion,
  onApplySuggestion,
  applyingBlockKey,
  onDismissSuggestion,
}: {
  article: DestinationArticle;
  onChange: (next: DestinationArticle) => void;
  /** Goi y AI dang cho duyet cho tung block — pivot gop editor (AI ho tro doc lap). */
  suggestions?: Partial<Record<DestinationBlockKey, ContentSection>>;
  suggestLoading?: ReadonlySet<DestinationBlockKey>;
  onRequestSuggestion?: (blockKey: DestinationBlockKey) => void;
  /** Ap dung NGAY 1 goi y (luu luon, khong qua tick + nut gop) — nut bi disable
   * trong luc co request khac dang chay (applyingBlockKey) de tranh 2 PATCH
   * chay song song ghi de nhau. */
  onApplySuggestion?: (blockKey: DestinationBlockKey) => void;
  applyingBlockKey?: DestinationBlockKey | null;
  onDismissSuggestion?: (blockKey: DestinationBlockKey) => void;
}) {
  const update = (patch: Partial<DestinationArticle>) => onChange({ ...article, ...patch });
  const sections = toFixedSections(article.sections);
  // Bai cu (truoc redesign) co the co section KHONG khop blockKey nao trong 6 khoi co dinh —
  // giu nguyen cac section do khi luu, KHONG duoc lam mat noi dung that chi vi sua 1 o khac.
  const legacyUnmatchedSections = article.sections.filter(
    (s) => !s.blockKey || !DESTINATION_SECTION_ORDER.includes(s.blockKey as (typeof DESTINATION_SECTION_ORDER)[number]),
  );

  function updateSection(blockKey: DestinationBlockKey, patch: Partial<DestinationSection>) {
    const nextFixed = sections.map((s) => (s.blockKey === blockKey ? { ...s, ...patch } : s));
    onChange({ ...article, sections: [...nextFixed, ...legacyUnmatchedSections] });
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300">Tiêu đề (H1)</span>
          <Input value={article.title} onChange={(e) => update({ title: e.target.value })} className="w-full" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 flex items-center justify-between font-medium text-zinc-700 dark:text-zinc-300">
            Mở bài (dẫn nhập)
            <WordCount current={countWords(article.intro)} min={MIN_INTRO_WORDS} />
          </span>
          <p className="mb-1 text-xs text-zinc-500">{INTRO_HINT}</p>
          <Textarea
            value={article.intro}
            onChange={(e) => update({ intro: e.target.value })}
            rows={3}
            className="w-full"
          />
        </label>
      </section>

      {sections.map((section) => {
        const blockKey = section.blockKey as DestinationBlockKey;
        return (
          <SectionBlockEditor
            key={blockKey}
            section={section}
            onChange={(patch) => updateSection(blockKey, patch)}
            suggestion={suggestions?.[blockKey]}
            loading={suggestLoading?.has(blockKey) ?? false}
            onRequestSuggestion={onRequestSuggestion ? () => onRequestSuggestion(blockKey) : undefined}
            onApplySuggestion={onApplySuggestion ? () => onApplySuggestion(blockKey) : undefined}
            applying={applyingBlockKey === blockKey}
            applyDisabled={applyingBlockKey != null && applyingBlockKey !== blockKey}
            onDismissSuggestion={onDismissSuggestion ? () => onDismissSuggestion(blockKey) : undefined}
          />
        );
      })}

      <QuickFactsEditor quickFacts={article.quickFacts} onChange={(quickFacts) => update({ quickFacts })} />

      <FaqEditor faq={article.faq} onChange={(faq) => update({ faq })} />

      <MetadataEditor
        metadata={article.metadata}
        updateNotice={article.updateNotice}
        onChangeMetadata={(patch) => update({ metadata: { ...article.metadata, ...patch } })}
        onChangeUpdateNotice={(updateNotice) => update({ updateNotice })}
      />
    </div>
  );
}

function WordCount({ current, min }: { current: number; min: number }) {
  const short = current < min;
  return (
    <span className={short ? "text-xs font-normal text-amber-600 dark:text-amber-400" : "text-xs font-normal text-zinc-400"}>
      {current}/{min} từ
    </span>
  );
}

function CharCount({ current, max }: { current: number; max: number }) {
  const over = current > max;
  return (
    <span className={over ? "text-xs font-normal text-red-600 dark:text-red-400" : "text-xs font-normal text-zinc-400"}>
      {current}/{max} ký tự
    </span>
  );
}

function SectionBlockEditor({
  section,
  onChange,
  suggestion,
  loading,
  onRequestSuggestion,
  onApplySuggestion,
  applying,
  applyDisabled,
  onDismissSuggestion,
}: {
  section: DestinationSection;
  onChange: (patch: Partial<DestinationSection>) => void;
  suggestion?: ContentSection;
  loading?: boolean;
  onRequestSuggestion?: () => void;
  onApplySuggestion?: () => void;
  applying?: boolean;
  applyDisabled?: boolean;
  onDismissSuggestion?: () => void;
}) {
  const blockKey = (section.blockKey ?? "khac") as DestinationBlockKey;
  const isList = DESTINATION_LIST_BLOCK_KEYS.includes(blockKey);

  return (
    <section className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          {DESTINATION_BLOCK_LABELS[blockKey]}
        </span>
        <div className="flex items-center gap-2">
          {!isList && <WordCount current={countWords(section.content)} min={MIN_SECTION_WORDS} />}
          {onRequestSuggestion && (
            <Button
              size="sm"
              variant="secondary"
              className="px-2 py-1 text-xs"
              loading={loading}
              onClick={onRequestSuggestion}
            >
              {loading ? "Đang tạo..." : "🤖 Tạo lại bằng AI"}
            </Button>
          )}
        </div>
      </div>
      <p className="mb-2 text-xs text-zinc-500">{DESTINATION_BLOCK_HINTS[blockKey]}</p>
      <label className="mb-2 block text-xs text-zinc-500">
        Tiêu đề hiển thị (H2)
        <Input value={section.heading} onChange={(e) => onChange({ heading: e.target.value })} className="mt-1 w-full" />
      </label>
      {isList ? (
        <>
          <label className="mb-2 block text-xs text-zinc-500">
            Câu dẫn ngắn (tuỳ chọn)
            <Textarea
              value={section.content}
              onChange={(e) => onChange({ content: e.target.value })}
              rows={2}
              className="mt-1 w-full"
            />
          </label>
          <DestinationItemListEditor items={section.items ?? []} onChange={(items) => onChange({ items })} />
        </>
      ) : (
        <Textarea
          value={section.content}
          onChange={(e) => onChange({ content: e.target.value })}
          rows={5}
          className="w-full"
        />
      )}
      {suggestion && (
        <div className="mt-3 rounded border border-violet-300 bg-violet-50 p-3 dark:border-violet-800 dark:bg-violet-950/40">
          <p className="mb-2 text-xs font-semibold text-violet-700 dark:text-violet-300">🤖 Gợi ý AI</p>
          <p className="mb-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">{suggestion.heading}</p>
          {suggestion.items && suggestion.items.length > 0 ? (
            <ul className="mb-2 list-inside list-disc text-sm text-zinc-700 dark:text-zinc-300">
              {suggestion.items.map((item, i) => (
                <li key={i}>
                  <strong>{item.ten}</strong> — {item.moTa}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-2 whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">
              {suggestion.content}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="primary"
              className="px-2 py-1 text-xs"
              loading={applying}
              disabled={applyDisabled}
              onClick={onApplySuggestion}
            >
              {applying ? "Đang áp dụng..." : "Áp dụng"}
            </Button>
            <Button size="sm" variant="ghost" className="px-2 py-1 text-xs" disabled={applying} onClick={onDismissSuggestion}>
              Bỏ qua
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

const QUICK_FACT_FIELDS = [
  ["openingTime", "Giờ mở cửa"],
  ["ticketPrice", "Giá vé"],
  ["transport", "Di chuyển"],
  ["food", "Ăn uống"],
  ["hotel", "Lưu trú"],
  ["tip", "Mẹo & lưu ý"],
] as const;

function QuickFactsEditor({
  quickFacts,
  onChange,
}: {
  quickFacts: DestinationArticle["quickFacts"];
  onChange: (next: DestinationArticle["quickFacts"]) => void;
}) {
  return (
    <section className="rounded border-2 border-amber-300 p-3 dark:border-amber-700">
      <h3 className="mb-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
        ⚠️ Thông tin nhanh — kiểm tra tay trước khi duyệt (giá vé, giờ mở cửa dễ sai)
      </h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {QUICK_FACT_FIELDS.map(([key, label]) => (
          <label key={key} className="block text-xs text-zinc-500">
            {label}
            <Textarea
              value={quickFacts[key]}
              onChange={(e) => onChange({ ...quickFacts, [key]: e.target.value })}
              rows={2}
              className="mt-1 w-full"
            />
          </label>
        ))}
      </div>
    </section>
  );
}

function FaqEditor({ faq, onChange }: { faq: Faq[]; onChange: (next: Faq[]) => void }) {
  const update = (i: number, patch: Partial<Faq>) =>
    onChange(faq.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  return (
    <section className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
      <h3 className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Câu hỏi thường gặp (3-6 câu)</h3>
      <div className="space-y-2">
        {faq.map((item, i) => (
          <div key={i} className="rounded border border-zinc-300 p-2 dark:border-zinc-700">
            <Input
              value={item.question}
              onChange={(e) => update(i, { question: e.target.value })}
              placeholder="Câu hỏi"
              className="mb-1 w-full"
            />
            <Textarea
              value={item.answer}
              onChange={(e) => update(i, { answer: e.target.value })}
              placeholder="Câu trả lời"
              rows={2}
              className="w-full"
            />
            <div className="mt-1 flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                className="px-2 py-1 text-xs"
                disabled={faq.length <= 3}
                title={faq.length <= 3 ? "Cần tối thiểu 3 câu hỏi" : undefined}
                onClick={() => onChange(faq.filter((_, idx) => idx !== i))}
              >
                Xoá
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Button
        size="sm"
        variant="secondary"
        className="mt-2 px-2 py-1 text-xs"
        disabled={faq.length >= 6}
        title={faq.length >= 6 ? "Tối đa 6 câu hỏi" : undefined}
        onClick={() => onChange([...faq, { question: "", answer: "" }])}
      >
        + Thêm câu hỏi
      </Button>
    </section>
  );
}

function MetadataEditor({
  metadata,
  updateNotice,
  onChangeMetadata,
  onChangeUpdateNotice,
}: {
  metadata: DestinationArticle["metadata"];
  updateNotice: string;
  onChangeMetadata: (patch: Partial<DestinationArticle["metadata"]>) => void;
  onChangeUpdateNotice: (next: string) => void;
}) {
  return (
    <section className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
      <h3 className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Metadata SEO</h3>
      <div className="space-y-3">
        <label className="block text-xs text-zinc-500">
          Tên chuẩn điểm đến
          <Input value={metadata.name} onChange={(e) => onChangeMetadata({ name: e.target.value })} className="mt-1 w-full" />
        </label>
        <label className="block text-xs text-zinc-500">
          <span className="flex items-center justify-between">
            Meta title
            <CharCount current={metadata.metaTitle.length} max={DESTINATION_FIELD_LIMITS.metaTitle} />
          </span>
          <Input value={metadata.metaTitle} onChange={(e) => onChangeMetadata({ metaTitle: e.target.value })} className="mt-1 w-full" />
        </label>
        <label className="block text-xs text-zinc-500">
          <span className="flex items-center justify-between">
            Meta description
            <CharCount current={metadata.metaDescription.length} max={DESTINATION_FIELD_LIMITS.metaDescription} />
          </span>
          <Textarea
            value={metadata.metaDescription}
            onChange={(e) => onChangeMetadata({ metaDescription: e.target.value })}
            rows={2}
            className="mt-1 w-full"
          />
        </label>
        <label className="block text-xs text-zinc-500">
          <span className="flex items-center justify-between">
            Mô tả ngắn (hiển thị trên web)
            <CharCount current={metadata.description.length} max={DESTINATION_FIELD_LIMITS.description} />
          </span>
          <Textarea
            value={metadata.description}
            onChange={(e) => onChangeMetadata({ description: e.target.value })}
            rows={2}
            className="mt-1 w-full"
          />
        </label>
        <label className="block text-xs text-zinc-500">
          <span className="flex items-center justify-between">
            Từ khoá tìm kiếm
            <CharCount current={metadata.searchKeyword.length} max={DESTINATION_FIELD_LIMITS.searchKeyword} />
          </span>
          <Input
            value={metadata.searchKeyword}
            onChange={(e) => onChangeMetadata({ searchKeyword: e.target.value })}
            placeholder="Cách nhau dấu phẩy"
            className="mt-1 w-full"
          />
        </label>
        <label className="block text-xs text-zinc-500">
          Dòng cập nhật (vd: &quot;cập nhật tháng 6/2026&quot;)
          <Input value={updateNotice} onChange={(e) => onChangeUpdateNotice(e.target.value)} className="mt-1 w-full" />
        </label>
      </div>
    </section>
  );
}
