"use client";

import { useState } from "react";
import {
  DESTINATION_BLOCK_LABELS,
  DESTINATION_LIST_BLOCK_KEYS,
  DESTINATION_SECTION_ORDER,
  type ContentSection,
  type DestinationArticle,
  type DestinationArticleFrame,
  type DestinationBlockKey,
} from "@zinoflow/contracts";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Modal } from "@/shared/ui/modal";

/**
 * So sanh "da ap dung chua" — CHI so items voi khoi dang la list-block. Cac khoi
 * khong phai list (vd tong-quan/lich-trinh/di-chuyen) bi normalizeDraftArticle
 * (trang page.tsx) xoa sach items moi lan tai lai trang (editor khong hien/sua
 * items cho khoi nay), trong khi goi y AI cho cac khoi do van co the kem theo
 * items — neu so ca items thi sau khi ap dung + reload se BAO SAI la "chua ap
 * dung" du heading/content da luu dung (bug 07/2026).
 */
function sameSection(a: ContentSection, b: ContentSection | undefined, blockKey: DestinationBlockKey): boolean {
  if (!b) return false;
  if (a.heading !== b.heading || a.content !== b.content) return false;
  if (!DESTINATION_LIST_BLOCK_KEYS.includes(blockKey)) return true;
  return JSON.stringify(a.items ?? []) === JSON.stringify(b.items ?? []);
}

/**
 * Dung chung cho popup nay VA badge "Status AI" o header trang chi tiet — 1 nguon
 * su that duy nhat cho "bao nhieu khoi da ap dung goi y AI", tranh 2 noi tu tinh
 * lai roi lech nhau.
 */
export function countAppliedJobSuggestions(
  jobSuggestions: Partial<Record<DestinationBlockKey, ContentSection>>,
  currentArticle: DestinationArticle,
): { total: number; applied: number } {
  const blockKeys = DESTINATION_SECTION_ORDER.filter((k) => jobSuggestions[k]);
  const applied = blockKeys.filter((blockKey) => {
    const current = currentArticle.sections.find((s) => s.blockKey === blockKey);
    return current ? sameSection(current, jobSuggestions[blockKey], blockKey) : false;
  }).length;
  return { total: blockKeys.length, applied };
}

/**
 * Phan "frame" (moi thu TRU 7 khoi noi dung) ma AI cung sinh ra khi tao bai —
 * truoc day bi BO QUA hoan toan trong luong "gop editor" (chi lay sections vao
 * popup), khien quickFacts/intro/faq/metadata AI da viet mat trang, nguoi dung
 * phai go tay lai tu dau (phat hien 07/2026). Gom theo nhom khop voi cach
 * DestinationArticleEditor hien thi (titleIntro/quickFacts/faq/metadata) thay vi
 * tung field le — do FAQ la mang, quickFacts/metadata la object nhieu field, ap
 * dung tung field mot se qua vun.
 */
export type FrameGroupKey = "titleIntro" | "quickFacts" | "faq" | "metadata";
export const FRAME_GROUP_KEYS: readonly FrameGroupKey[] = ["titleIntro", "quickFacts", "faq", "metadata"];
export const FRAME_GROUP_LABELS: Record<FrameGroupKey, string> = {
  titleIntro: "Tiêu đề + Mở bài",
  quickFacts: "Thông tin nhanh",
  faq: "Câu hỏi thường gặp (FAQ)",
  metadata: "Metadata SEO + dòng cập nhật",
};

export function mergeFrameGroup(
  article: DestinationArticle,
  group: FrameGroupKey,
  suggestion: DestinationArticleFrame,
): DestinationArticle {
  switch (group) {
    case "titleIntro":
      return { ...article, title: suggestion.title, intro: suggestion.intro };
    case "quickFacts":
      return { ...article, quickFacts: suggestion.quickFacts };
    case "faq":
      return { ...article, faq: suggestion.faq };
    case "metadata":
      return { ...article, metadata: suggestion.metadata, updateNotice: suggestion.updateNotice };
  }
}

function isFrameGroupApplied(
  group: FrameGroupKey,
  current: DestinationArticle,
  suggestion: DestinationArticleFrame,
): boolean {
  switch (group) {
    case "titleIntro":
      return current.title === suggestion.title && current.intro === suggestion.intro;
    case "quickFacts":
      return JSON.stringify(current.quickFacts) === JSON.stringify(suggestion.quickFacts);
    case "faq":
      return JSON.stringify(current.faq) === JSON.stringify(suggestion.faq);
    case "metadata":
      return (
        JSON.stringify(current.metadata) === JSON.stringify(suggestion.metadata) &&
        current.updateNotice === suggestion.updateNotice
      );
  }
}

/** Cung 1 nguon su that cho badge "Status AI" o header — xem countAppliedJobSuggestions. */
export function countAppliedFrameGroups(
  frameSuggestion: DestinationArticleFrame | null,
  currentArticle: DestinationArticle,
): { total: number; applied: number } {
  if (!frameSuggestion) return { total: 0, applied: 0 };
  const applied = FRAME_GROUP_KEYS.filter((g) => isFrameGroupApplied(g, currentArticle, frameSuggestion)).length;
  return { total: FRAME_GROUP_KEYS.length, applied };
}

/**
 * Popup goi y AI toan bai (7 khoi noi dung + 4 nhom thong tin chung) tu job vua
 * tao — cung 1 co che voi "Xem thong tin AI trich xuat": chi hien khi nguoi dung
 * bam nut mo, ap dung xong KHONG bi an/mat di, van ap dung lai duoc bat ky luc
 * nao (vd da sua tay roi doi y muon quay ve ban AI goc). Fix bug 07/2026: truoc
 * day goi y hien INLINE tu dong duoi tung khoi va bi nap lai moi lan reload
 * trang du da ap dung roi; rieng phan "frame" (quickFacts/intro/faq/metadata) bi
 * bo qua hoan toan, khong co cach nao xem/ap dung.
 */
export function DestinationJobSuggestionsModal({
  jobSuggestions,
  frameSuggestion,
  currentArticle,
  applyingBlockKey,
  applyingFrameGroup,
  applyingAll,
  onApply,
  onApplyFrameGroup,
  onApplyAll,
}: {
  jobSuggestions: Partial<Record<DestinationBlockKey, ContentSection>>;
  frameSuggestion: DestinationArticleFrame | null;
  currentArticle: DestinationArticle;
  applyingBlockKey: DestinationBlockKey | null;
  applyingFrameGroup: FrameGroupKey | null;
  applyingAll: boolean;
  onApply: (blockKey: DestinationBlockKey) => void;
  onApplyFrameGroup: (group: FrameGroupKey) => void;
  onApplyAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const blockKeys = DESTINATION_SECTION_ORDER.filter((k) => jobSuggestions[k]);
  const frameGroupKeys = frameSuggestion ? FRAME_GROUP_KEYS : [];
  const totalCount = blockKeys.length + frameGroupKeys.length;
  if (totalCount === 0) return null;

  function isBlockApplied(blockKey: DestinationBlockKey): boolean {
    const current = currentArticle.sections.find((s) => s.blockKey === blockKey);
    return current ? sameSection(current, jobSuggestions[blockKey], blockKey) : false;
  }

  const anyBusy = applyingBlockKey !== null || applyingFrameGroup !== null || applyingAll;
  const pendingCount =
    blockKeys.length -
    countAppliedJobSuggestions(jobSuggestions, currentArticle).applied +
    frameGroupKeys.length -
    countAppliedFrameGroups(frameSuggestion, currentArticle).applied;

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        🤖 Xem gợi ý AI từ bài vừa tạo{pendingCount > 0 ? ` (${pendingCount} mục chưa áp dụng)` : ""}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Gợi ý AI từ bài vừa tạo" width="max-w-4xl">
        <div className="space-y-3">
          <p className="text-xs text-zinc-500">
            Nội dung AI tạo khi bấm &quot;Tạo bài AI&quot; — bấm &quot;Áp dụng&quot; để ghi vào bài (ghi
            đè mục tương ứng). Áp dụng rồi vẫn xem và áp dụng lại được bất kỳ lúc nào, kể cả sau khi
            tải lại trang — không tự ẩn đi.
          </p>
          <div className="flex justify-end">
            <Button size="sm" variant="primary" loading={applyingAll} disabled={anyBusy && !applyingAll} onClick={onApplyAll}>
              {applyingAll ? "Đang áp dụng tất cả..." : `Áp dụng tất cả (${totalCount} mục)`}
            </Button>
          </div>

          {frameSuggestion && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Thông tin chung (áp dụng theo nhóm)
              </h4>
              {FRAME_GROUP_KEYS.map((group) => {
                const applied = isFrameGroupApplied(group, currentArticle, frameSuggestion);
                return (
                  <div key={group} className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                        {FRAME_GROUP_LABELS[group]}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge tone={applied ? "emerald" : "gray"}>{applied ? "Đã áp dụng" : "Chưa áp dụng"}</Badge>
                        <Button
                          size="sm"
                          variant="primary"
                          className="px-2 py-1 text-xs"
                          loading={applyingFrameGroup === group}
                          disabled={anyBusy && applyingFrameGroup !== group}
                          onClick={() => onApplyFrameGroup(group)}
                        >
                          {applyingFrameGroup === group ? "Đang áp dụng..." : applied ? "Áp dụng lại" : "Áp dụng"}
                        </Button>
                      </div>
                    </div>
                    <FrameGroupPreview group={group} frame={frameSuggestion} />
                  </div>
                );
              })}
            </div>
          )}

          {blockKeys.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Khối nội dung</h4>
              {blockKeys.map((blockKey) => {
                const suggestion = jobSuggestions[blockKey]!;
                const applied = isBlockApplied(blockKey);
                return (
                  <div key={blockKey} className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                        {DESTINATION_BLOCK_LABELS[blockKey]}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge tone={applied ? "emerald" : "gray"}>
                          {applied ? "Đã áp dụng" : "Chưa áp dụng"}
                        </Badge>
                        <Button
                          size="sm"
                          variant="primary"
                          className="px-2 py-1 text-xs"
                          loading={applyingBlockKey === blockKey}
                          disabled={anyBusy && applyingBlockKey !== blockKey}
                          onClick={() => onApply(blockKey)}
                        >
                          {applyingBlockKey === blockKey
                            ? "Đang áp dụng..."
                            : applied
                              ? "Áp dụng lại"
                              : "Áp dụng"}
                        </Button>
                      </div>
                    </div>
                    <p className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">{suggestion.heading}</p>
                    {suggestion.items && suggestion.items.length > 0 ? (
                      <ul className="list-inside list-disc text-sm text-zinc-700 dark:text-zinc-300">
                        {suggestion.items.map((item, i) => (
                          <li key={i}>
                            <strong>{item.ten}</strong> — {item.moTa}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">
                        {suggestion.content}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Đóng
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function FrameGroupPreview({ group, frame }: { group: FrameGroupKey; frame: DestinationArticleFrame }) {
  if (group === "titleIntro") {
    return (
      <div className="text-sm text-zinc-700 dark:text-zinc-300">
        <p className="mb-1 font-medium">{frame.title}</p>
        <p className="whitespace-pre-line">{frame.intro}</p>
      </div>
    );
  }
  if (group === "quickFacts") {
    const fields: [string, string][] = [
      ["Giờ mở cửa", frame.quickFacts.openingTime],
      ["Giá vé", frame.quickFacts.ticketPrice],
      ["Di chuyển", frame.quickFacts.transport],
      ["Ăn uống", frame.quickFacts.food],
      ["Lưu trú", frame.quickFacts.hotel],
      ["Mẹo & lưu ý", frame.quickFacts.tip],
    ];
    return (
      <ul className="text-sm text-zinc-700 dark:text-zinc-300">
        {fields.map(([label, value]) => (
          <li key={label}>
            <strong>{label}:</strong> {value}
          </li>
        ))}
      </ul>
    );
  }
  if (group === "faq") {
    return (
      <ul className="list-inside list-disc text-sm text-zinc-700 dark:text-zinc-300">
        {frame.faq.map((f, i) => (
          <li key={i}>
            <strong>{f.question}</strong> — {f.answer}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="text-sm text-zinc-700 dark:text-zinc-300">
      <p>
        <strong>Meta title:</strong> {frame.metadata.metaTitle}
      </p>
      <p>
        <strong>Meta description:</strong> {frame.metadata.metaDescription}
      </p>
      <p>
        <strong>Mô tả ngắn:</strong> {frame.metadata.description}
      </p>
      <p>
        <strong>Từ khoá:</strong> {frame.metadata.searchKeyword}
      </p>
      <p>
        <strong>Dòng cập nhật:</strong> {frame.updateNotice}
      </p>
    </div>
  );
}
