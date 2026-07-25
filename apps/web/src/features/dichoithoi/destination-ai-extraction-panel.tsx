"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getDestinationAiExtractionResponseSchema,
  destinationAiExtractionSchema,
  type DestinationAiExtraction,
  type DestinationAiExtractionFieldItem,
  type DestinationAiExtractionFieldKey,
  type DestinationAiExtractionSource,
  type DestinationOpeningHours,
  type PriceBreakdownItem,
} from "@zinoflow/contracts";
import { apiGet, apiSend } from "@/shared/api-client";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { ErrorBox } from "@/shared/ui/error-box";
import { Modal } from "@/shared/ui/modal";

const FIELD_LABELS: Record<DestinationAiExtractionFieldKey, string> = {
  name: "Tên",
  addressNew: "Địa chỉ mới (sau sáp nhập)",
  contactPhone: "Điện thoại",
  contactWebsite: "Website chính thức",
  shortDescription: "Mô tả ngắn",
  metaTitle: "Meta Title",
  openingHours: "Giờ mở cửa",
  aiReferenceSummary: "Tóm tắt cho AI viết bài",
  externalReviewUrl: "Link đánh giá ngoài",
  priceBreakdown: "Giá vé theo đối tượng",
  editorialReview: "Đánh giá biên tập",
};

const SOURCE_LABELS: Record<DestinationAiExtractionSource, string> = {
  skill: "Skill (Claude đọc thủ công)",
  gsg: "Google Search Grounding (tự động)",
};

function isOpeningHours(v: unknown): v is DestinationOpeningHours {
  return Boolean(v) && typeof v === "object" && "note" in (v as object);
}
function isReviewUrl(v: unknown): v is { label: string; url: string } {
  return Boolean(v) && typeof v === "object" && "url" in (v as object);
}
function isPriceBreakdown(v: unknown): v is PriceBreakdownItem[] {
  return Array.isArray(v) && v.every((i) => i && typeof i === "object" && "audience" in i);
}
function labelOf(v: unknown): string | null {
  return isReviewUrl(v) ? v.label.trim().toLowerCase() : null;
}

/** Hien thi 1 gia tri field (string/openingHours/externalReviewUrl/priceBreakdown) — "—" khi rong. */
function formatFieldValue(v: unknown): string {
  if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) return "—";
  if (isOpeningHours(v)) {
    if (v.periods.length <= 1) return v.note;
    const periods = v.periods.map((p) => `${p.days.join(",")} ${p.opens}-${p.closes}`).join("; ");
    return `${v.note} (${periods})`;
  }
  if (isReviewUrl(v)) return `${v.label}: ${v.url}`;
  if (isPriceBreakdown(v)) {
    return v
      .map((p) => `${p.audience}: ${p.price.toLocaleString("vi-VN")}đ${p.note ? ` (${p.note})` : ""}`)
      .join("\n");
  }
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

const ORDERED_SINGLE_KEYS: DestinationAiExtractionFieldKey[] = [
  "name",
  "addressNew",
  "contactPhone",
  "contactWebsite",
  "shortDescription",
  "metaTitle",
  "openingHours",
  "aiReferenceSummary",
  "priceBreakdown",
  "editorialReview",
];

interface CompareRow {
  rowId: string;
  key: DestinationAiExtractionFieldKey;
  label: string;
  currentValue: unknown;
  isMultiInstance: boolean;
  skillIndex: number | null;
  skillValue: unknown;
  skillFound: boolean;
  gsgIndex: number | null;
  gsgValue: unknown;
  gsgFound: boolean;
}

/** Ghep field cua 2 nguon theo key (rieng externalReviewUrl ghep theo label vi co the lap nhieu lan). */
function buildCompareRows(
  skillFields: DestinationAiExtractionFieldItem[],
  gsgFields: DestinationAiExtractionFieldItem[],
): CompareRow[] {
  const rows: CompareRow[] = [];

  for (const key of ORDERED_SINGLE_KEYS) {
    const si = skillFields.findIndex((f) => f.key === key);
    const gi = gsgFields.findIndex((f) => f.key === key);
    if (si === -1 && gi === -1) continue;
    rows.push({
      rowId: key,
      key,
      label: FIELD_LABELS[key],
      currentValue: si >= 0 ? skillFields[si]!.currentValue : gi >= 0 ? gsgFields[gi]!.currentValue : null,
      isMultiInstance: false,
      skillIndex: si >= 0 ? si : null,
      skillValue: si >= 0 ? skillFields[si]!.newValue : null,
      skillFound: si >= 0 ? skillFields[si]!.found : false,
      gsgIndex: gi >= 0 ? gi : null,
      gsgValue: gi >= 0 ? gsgFields[gi]!.newValue : null,
      gsgFound: gi >= 0 ? gsgFields[gi]!.found : false,
    });
  }

  const skillReviews = skillFields.map((f, i) => ({ f, i })).filter((x) => x.f.key === "externalReviewUrl");
  const gsgReviews = gsgFields.map((f, i) => ({ f, i })).filter((x) => x.f.key === "externalReviewUrl");
  const usedGsg = new Set<number>();

  for (const { f: sf, i: si } of skillReviews) {
    const label = labelOf(sf.newValue);
    const match = gsgReviews.find((x) => !usedGsg.has(x.i) && labelOf(x.f.newValue) === label);
    if (match) usedGsg.add(match.i);
    rows.push({
      rowId: `externalReviewUrl-${si}`,
      key: "externalReviewUrl",
      label: `${FIELD_LABELS.externalReviewUrl} (${label ?? "?"})`,
      currentValue: null,
      isMultiInstance: true,
      skillIndex: si,
      skillValue: sf.newValue,
      skillFound: sf.found,
      gsgIndex: match ? match.i : null,
      gsgValue: match ? match.f.newValue : null,
      gsgFound: match ? match.f.found : false,
    });
  }
  for (const { f: gf, i: gi } of gsgReviews) {
    if (usedGsg.has(gi)) continue;
    rows.push({
      rowId: `externalReviewUrl-gsg-${gi}`,
      key: "externalReviewUrl",
      label: `${FIELD_LABELS.externalReviewUrl} (${labelOf(gf.newValue) ?? "?"})`,
      currentValue: null,
      isMultiInstance: true,
      skillIndex: null,
      skillValue: null,
      skillFound: false,
      gsgIndex: gi,
      gsgValue: gf.newValue,
      gsgFound: gf.found,
    });
  }

  return rows;
}

/**
 * Trich xuat AI cho diem den — 2 nguon SONG SONG: Skill (Claude doc thu cong qua
 * VS Code) va GSG (Gemini + Google Search Grounding, chay tu dong ngay trong app).
 * 3 nut: xem rieng tung nguon, hoac so sanh ca 2 trong 1 bang 4 cot de chon nguon
 * nao ghi cho tung truong (dichoithoi-destination-ai-extraction-plan.md §6 C2).
 *
 * Nguon GSG CHUA xac minh duoc theo tung URL cu the (gioi han ky thuat cua Google
 * Search Grounding ket hop structured output) — do tin cay THAP HON Skill, luon
 * hien canh bao rieng, KHONG doi xu ngang hang.
 */
export function DestinationAiExtractionPanel({
  slug,
  onAccepted,
}: {
  slug: string;
  onAccepted: () => void;
}) {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<"skill" | "gsg" | "compare" | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [compareSelection, setCompareSelection] = useState<Map<string, "current" | "skill" | "gsg">>(new Map());
  const [error, setError] = useState<unknown>(null);

  const queryKey = ["destination-ai-extraction", slug];
  const extractionQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await apiGet(
        `/destinations/${slug}/ai-extraction`,
        getDestinationAiExtractionResponseSchema,
      );
      return res.extractions;
    },
  });
  const extractions = extractionQuery.data ?? [];
  const skillExtraction = extractions.find((e) => e.source === "skill") ?? null;
  const gsgExtraction = extractions.find((e) => e.source === "gsg") ?? null;

  const runGsg = useMutation({
    mutationFn: () => apiSend("POST", `/destinations/${slug}/ai-extraction/gsg`, {}),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (e) => setError(e),
  });

  const accept = useMutation({
    mutationFn: ({ source, acceptedIndexes }: { source: DestinationAiExtractionSource; acceptedIndexes: number[] }) =>
      apiSend("POST", `/destinations/${slug}/ai-extraction/accept`, { source, acceptedIndexes }),
  });

  function openSingle(mode: "skill" | "gsg") {
    const extraction = mode === "skill" ? skillExtraction : gsgExtraction;
    if (!extraction) return;
    setChecked(
      new Set(
        extraction.fields
          .map((f, i) => ({ f, i }))
          .filter(({ f }) => f.found && f.status === "pending")
          .map(({ i }) => i),
      ),
    );
    setViewMode(mode);
  }

  function openCompare() {
    setCompareSelection(new Map());
    setViewMode("compare");
  }

  function toggle(i: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function submitSingle(source: "skill" | "gsg") {
    try {
      const data = await accept.mutateAsync({ source, acceptedIndexes: [...checked] });
      setError(null);
      const parsed = destinationAiExtractionSchema.parse(data);
      queryClient.setQueryData<DestinationAiExtraction[]>(queryKey, (prev) => {
        const others = (prev ?? []).filter((e) => e.source !== source);
        return [...others, parsed];
      });
      setChecked(new Set());
      onAccepted();
    } catch (e) {
      setError(e);
    }
  }

  async function submitCompare(rows: CompareRow[]) {
    const skillIndexes: number[] = [];
    const gsgIndexes: number[] = [];
    for (const row of rows) {
      const pick = compareSelection.get(row.rowId);
      if (pick === "skill" && row.skillIndex !== null) skillIndexes.push(row.skillIndex);
      if (pick === "gsg" && row.gsgIndex !== null) gsgIndexes.push(row.gsgIndex);
    }
    try {
      if (skillIndexes.length > 0) await accept.mutateAsync({ source: "skill", acceptedIndexes: skillIndexes });
      if (gsgIndexes.length > 0) await accept.mutateAsync({ source: "gsg", acceptedIndexes: gsgIndexes });
      setError(null);
      void queryClient.invalidateQueries({ queryKey });
      setViewMode(null);
      onAccepted();
    } catch (e) {
      setError(e);
    }
  }

  if (extractionQuery.isLoading) {
    return <p className="text-sm text-zinc-500">Đang tải...</p>;
  }

  return (
    <div className="space-y-3">
      <div className="rounded bg-zinc-50 p-3 text-xs text-zinc-500 dark:bg-zinc-900">
        <p className="mb-1">
          2 nguồn trích xuất SONG SONG, không thay thế nhau: <strong>Skill</strong> — Claude đọc kỹ Google
          Maps/web tham khảo qua VS Code (chính xác hơn, cần chạy tay); <strong>Google Search Grounding</strong> —
          Gemini tự tìm nguồn ngay trong app (nhanh, không cần link có sẵn, nhưng CHƯA xác minh theo từng URL
          cụ thể). Chạy Skill: mở Claude Code, yêu cầu "Trích xuất thông tin cho điểm đến {"<tên>"}".
        </p>
      </div>

      {error !== null && <ErrorBox error={error} />}
      {extractionQuery.isError && <ErrorBox error={extractionQuery.error} />}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" disabled={!skillExtraction} onClick={() => openSingle("skill")}>
          Xem trích xuất Skill{skillExtraction ? "" : " (chưa có)"}
        </Button>
        <Button size="sm" variant="secondary" disabled={!gsgExtraction} onClick={() => openSingle("gsg")}>
          Xem trích xuất Google Search{gsgExtraction ? "" : " (chưa có)"}
        </Button>
        <Button size="sm" loading={runGsg.isPending} onClick={() => runGsg.mutate()}>
          {runGsg.isPending ? "Đang chạy trích xuất GSG..." : "🔎 Chạy trích xuất GSG"}
        </Button>
        {skillExtraction && gsgExtraction && (
          <Button size="sm" variant="secondary" onClick={openCompare}>
            So sánh 2 nguồn
          </Button>
        )}
      </div>

      {(viewMode === "skill" || viewMode === "gsg") && (
        <SingleSourceModal
          extraction={viewMode === "skill" ? skillExtraction! : gsgExtraction!}
          checked={checked}
          onToggle={toggle}
          onClose={() => setViewMode(null)}
          onSubmit={() => submitSingle(viewMode)}
          submitting={accept.isPending}
        />
      )}

      {viewMode === "compare" && skillExtraction && gsgExtraction && (
        <CompareModal
          skill={skillExtraction}
          gsg={gsgExtraction}
          selection={compareSelection}
          onSelect={(rowId, pick) =>
            setCompareSelection((prev) => {
              const next = new Map(prev);
              next.set(rowId, pick);
              return next;
            })
          }
          onClose={() => setViewMode(null)}
          onSubmit={submitCompare}
          submitting={accept.isPending}
        />
      )}
    </div>
  );
}

function SingleSourceModal({
  extraction,
  checked,
  onToggle,
  onClose,
  onSubmit,
  submitting,
}: {
  extraction: DestinationAiExtraction;
  checked: Set<number>;
  onToggle: (i: number) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <Modal
      open
      onClose={onClose}
      title={`So sánh dữ liệu AI trích xuất — ${SOURCE_LABELS[extraction.source]}`}
      width="max-w-5xl"
    >
      <div className="space-y-3">
        {extraction.source === "gsg" && (
          <p className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400">
            ⚠️ Nguồn tự động (Google Search Grounding) — CHƯA xác minh được theo từng URL cụ thể (giới hạn kỹ
            thuật). Kiểm tra kỹ hơn bình thường trước khi Chấp nhận, đặc biệt SĐT/giờ mở cửa/giá vé.
          </p>
        )}
        <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
              <tr>
                <th className="p-2">Trường</th>
                <th className="p-2">Hiện tại</th>
                <th className="p-2">AI trích xuất</th>
                <th className="p-2 text-center">Áp dụng</th>
                <th className="p-2">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {extraction.fields.map((field: DestinationAiExtractionFieldItem, i) => (
                <tr key={i} className="border-t border-zinc-200 align-top dark:border-zinc-800">
                  <td className="p-2 font-medium">{FIELD_LABELS[field.key]}</td>
                  <td className="whitespace-pre-line p-2 text-zinc-500">{formatFieldValue(field.currentValue)}</td>
                  <td className="whitespace-pre-line p-2">{formatFieldValue(field.newValue)}</td>
                  <td className="p-2 text-center">
                    {field.found ? (
                      <div className="flex flex-col items-center gap-1">
                        <Checkbox label="" checked={checked.has(i)} onChange={() => onToggle(i)} />
                        {field.status !== "pending" && (
                          <Badge tone={field.status === "accepted" ? "emerald" : "gray"}>
                            {field.status === "accepted" ? "Đã chấp nhận" : "Đã bỏ qua"}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <Badge tone="gray">Không tìm thấy</Badge>
                    )}
                  </td>
                  <td className="p-2 text-xs text-zinc-500">{field.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            loading={submitting}
            disabled={checked.size === 0}
            onClick={onSubmit}
          >
            {submitting ? "Đang chấp nhận..." : `Chấp nhận / áp dụng lại ${checked.size} mục đã tick`}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CompareModal({
  skill,
  gsg,
  selection,
  onSelect,
  onClose,
  onSubmit,
  submitting,
}: {
  skill: DestinationAiExtraction;
  gsg: DestinationAiExtraction;
  selection: Map<string, "current" | "skill" | "gsg">;
  onSelect: (rowId: string, pick: "current" | "skill" | "gsg") => void;
  onClose: () => void;
  onSubmit: (rows: CompareRow[]) => void;
  submitting: boolean;
}) {
  const rows = useMemo(() => buildCompareRows(skill.fields, gsg.fields), [skill, gsg]);
  const pickedCount = [...selection.values()].filter((v) => v !== "current").length;

  return (
    <Modal open onClose={onClose} title="So sánh 2 nguồn trích xuất" width="max-w-6xl">
      <div className="space-y-3">
        <p className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400">
          ⚠️ Cột "Google Search" CHƯA xác minh theo từng URL cụ thể — nếu 2 nguồn lệch nhau, ưu tiên Skill
          trừ khi bạn tự kiểm tra lại thấy Google Search đúng hơn.
        </p>
        <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
              <tr>
                <th className="p-2">Trường</th>
                <th className="p-2">Hiện tại</th>
                <th className="p-2">Skill</th>
                <th className="p-2">Google Search</th>
                <th className="p-2 text-center">Chọn nguồn để ghi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.rowId} className="border-t border-zinc-200 align-top dark:border-zinc-800">
                  <td className="p-2 font-medium">{row.label}</td>
                  <td className="whitespace-pre-line p-2 text-zinc-500">{formatFieldValue(row.currentValue)}</td>
                  <td className="whitespace-pre-line p-2">
                    {row.skillIndex === null ? "—" : row.skillFound ? formatFieldValue(row.skillValue) : "(không tìm thấy)"}
                  </td>
                  <td className="whitespace-pre-line p-2">
                    {row.gsgIndex === null ? "—" : row.gsgFound ? formatFieldValue(row.gsgValue) : "(không tìm thấy)"}
                  </td>
                  <td className="p-2">
                    <div className="flex flex-col items-start gap-1 text-xs">
                      <label className="flex items-center gap-1">
                        <input
                          type="radio"
                          name={`pick-${row.rowId}`}
                          checked={(selection.get(row.rowId) ?? "current") === "current"}
                          onChange={() => onSelect(row.rowId, "current")}
                        />
                        Giữ hiện tại
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="radio"
                          name={`pick-${row.rowId}`}
                          disabled={row.skillIndex === null || !row.skillFound}
                          checked={selection.get(row.rowId) === "skill"}
                          onChange={() => onSelect(row.rowId, "skill")}
                        />
                        Dùng Skill
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="radio"
                          name={`pick-${row.rowId}`}
                          disabled={row.gsgIndex === null || !row.gsgFound}
                          checked={selection.get(row.rowId) === "gsg"}
                          onChange={() => onSelect(row.rowId, "gsg")}
                        />
                        Dùng Google Search
                      </label>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            loading={submitting}
            disabled={pickedCount === 0}
            onClick={() => onSubmit(rows)}
          >
            {submitting ? "Đang ghi..." : `Ghi ${pickedCount} trường đã chọn`}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </div>
    </Modal>
  );
}
