"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getTagKanbanBoardResponseSchema,
  previewPromptResponseSchema,
  suggestTagAssignmentsResponseSchema,
  type GetTagKanbanBoardResponse,
  type TagKanbanBoardDestination,
  type TagSuggestion,
} from "@zinoflow/contracts";
import { apiGet, apiSend } from "@/shared/api-client";
import { Badge, Button, Checkbox, ErrorBox, FeatureIntro, Modal, PageHeader, Select } from "@/shared/ui";
import { AiInvocationBar } from "@/features/dichoithoi/ai-invocation-bar";

const QUERY_KEY = ["tag-kanban-board"];
const UNCLASSIFIED_COLUMN = "__unclassified__";

/**
 * Bảng Kanban rà soát Chủ đề (tag) — cùng trải nghiệm với "Rà soát loại hình"
 * (/dichoithoi/phan-loai, phản hồi người dùng 24/07/2026): chọn 1 cụm/tỉnh, mỗi
 * cột là 1 chủ đề (chỉ hiện cột có điểm trong cụm đang chọn), thẻ = điểm đến.
 * Cột "Chưa gán" luôn hiện đầu, viền cảnh báo. Bấm "Gợi ý AI cho cụm này" để AI
 * đề xuất tag cho toàn bộ điểm trong cụm — gợi ý CHỈ tồn tại tạm trên máy (không
 * lưu DB, khác Type), mất khi rời trang/đổi cụm. Bấm thẻ mở modal xem/duyệt
 * từng điểm, hoặc dùng "Xem trước & áp dụng" để duyệt hàng loạt qua bảng so
 * sánh cũ/mới — không tự động ghi khi chưa xác nhận.
 *
 * Tách riêng khỏi /dichoithoi/chu-de (trang đó quản lý danh sách chủ đề, mô tả
 * 300-500 từ cho trang public, gán hàng loạt cho điểm CHƯA có tag nào, và rà
 * soát ngược) — trang này là nơi rà/sửa tag THEO TỪNG CỤM, kể cả điểm đã có tag.
 */
export default function PhanLoaiChuDePage() {
  const [clusterSlug, setClusterSlug] = useState("");
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiGet("/destination-tags/kanban-board", getTagKanbanBoardResponseSchema),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Rà soát chủ đề"
        description="Xem lại và sửa chủ đề (tag) đã gán cho từng điểm đến, theo từng cụm/tỉnh một — quản lý danh sách chủ đề và mô tả trang public ở /dichoithoi/chu-de."
      />

      <FeatureIntro
        summary={
          <>
            Chọn 1 cụm/tỉnh, bấm vào 1 thẻ điểm đến để tick/bỏ tick chủ đề — lưu ngay khi tick,
            không cần nút lưu riêng. Cột <strong>&quot;Chưa gán&quot;</strong> (viền cam) luôn hiện
            đầu tiên — đây là danh sách ưu tiên xử lý trước.
          </>
        }
        details={
          <>
            Bấm <strong>&quot;Gợi ý AI cho cụm này&quot;</strong> để AI đề xuất tag cho toàn bộ điểm
            trong cụm dựa trên tên + nội dung thật (không bịa) — gợi ý chỉ tồn tại tạm trên máy
            (KHÔNG lưu DB, khác trang &quot;Rà soát loại hình&quot;), mất khi rời trang hoặc đổi
            cụm khác. Bấm vào thẻ để mở popup đã tick sẵn theo gợi ý (nếu điểm đó chưa có tag nào)
            kèm lý do, tự quyết định tick/bỏ tick rồi lưu. Muốn nhanh hơn khi cả cụm có nhiều gợi ý:
            bấm <strong>&quot;Xem trước &amp; áp dụng&quot;</strong> để mở bảng so sánh cũ/mới + lý
            do cho TẤT CẢ điểm đang có gợi ý, bỏ tick điểm nào không đồng ý rồi áp dụng hàng loạt 1
            lần — vẫn phải xem qua trước, không tự động ghi khi chưa xác nhận.
          </>
        }
      />

      {query.isLoading && <p className="text-sm text-zinc-500">Đang tải...</p>}
      {query.isError && <ErrorBox error={query.error} fallback="Lỗi tải dữ liệu chủ đề" />}

      {query.data && (
        <KanbanBoard data={query.data} clusterSlug={clusterSlug} onClusterChange={setClusterSlug} />
      )}
    </div>
  );
}

function KanbanBoard({
  data,
  clusterSlug,
  onClusterChange,
}: {
  data: GetTagKanbanBoardResponse;
  clusterSlug: string;
  onClusterChange: (slug: string) => void;
}) {
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const queryClient = useQueryClient();
  const [aiSuggestions, setAiSuggestions] = useState<Map<string, TagSuggestion>>(new Map());
  const [aiProvider, setAiProvider] = useState("");
  const [aiModel, setAiModel] = useState("");

  const destinationsInCluster = useMemo(
    () => data.destinations.filter((d) => d.parentSlug === clusterSlug),
    [data.destinations, clusterSlug],
  );

  const suggest = useMutation({
    mutationFn: async () => {
      const destinationSlugs = destinationsInCluster.map((d) => d.slug);
      return suggestTagAssignmentsResponseSchema.parse(
        await apiSend("POST", "/destination-tags/suggest", { destinationSlugs, aiProvider, aiModel }),
      );
    },
    onSuccess: (r) => {
      setAiSuggestions(new Map(r.suggestions.map((s) => [s.destinationSlug, s])));
    },
  });

  const classifiedCount = destinationsInCluster.filter((d) => d.tagSlugs.length > 0).length;

  const pendingSuggestions = useMemo(
    () =>
      destinationsInCluster.filter((d) => {
        const s = aiSuggestions.get(d.slug);
        if (!s || s.tagSlugs.length === 0) return false;
        return [...s.tagSlugs].sort().join(",") !== [...d.tagSlugs].sort().join(",");
      }),
    [destinationsInCluster, aiSuggestions],
  );

  const columns = useMemo(() => {
    const bySlug = new Map(data.tags.map((t) => [t.slug, t]));
    const groups = new Map<string, TagKanbanBoardDestination[]>();
    for (const d of destinationsInCluster) {
      if (d.tagSlugs.length === 0) {
        groups.set(UNCLASSIFIED_COLUMN, [...(groups.get(UNCLASSIFIED_COLUMN) ?? []), d]);
        continue;
      }
      for (const tagSlug of d.tagSlugs) {
        groups.set(tagSlug, [...(groups.get(tagSlug) ?? []), d]);
      }
    }
    const ordered = [...groups.entries()]
      .filter(([slug]) => slug !== UNCLASSIFIED_COLUMN)
      .sort(([a], [b]) => (bySlug.get(a)?.name ?? a).localeCompare(bySlug.get(b)?.name ?? b));
    const unclassified = groups.get(UNCLASSIFIED_COLUMN) ?? [];
    return { unclassified, tagColumns: ordered, tagBySlug: bySlug };
  }, [destinationsInCluster, data.tags]);

  const editingDestination = data.destinations.find((d) => d.slug === editingSlug) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={clusterSlug} onChange={(e) => onClusterChange(e.target.value)}>
          <option value="">Chọn cụm/tỉnh...</option>
          {data.clusters.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name} ({c.kind === "province" ? "Tỉnh" : "Cụm"})
            </option>
          ))}
        </Select>
        {clusterSlug && (
          <span className="text-sm text-zinc-500">
            {classifiedCount}/{destinationsInCluster.length} điểm trong cụm đã có tag
          </span>
        )}
      </div>

      {clusterSlug && (
        <div className="flex flex-wrap items-center gap-2">
          <AiInvocationBar
            onSelectionChange={(p, m) => {
              setAiProvider(p);
              setAiModel(m);
            }}
            fetchPreview={async () =>
              previewPromptResponseSchema.parse(
                await apiSend("POST", "/destination-tags/suggest/preview", {
                  destinationSlugs: destinationsInCluster.map((d) => d.slug),
                }),
              ).sections
            }
          />
          <Button size="sm" variant="secondary" onClick={() => suggest.mutate()} loading={suggest.isPending}>
            Gợi ý AI cho cụm này
          </Button>
          {pendingSuggestions.length > 0 && (
            <Button size="sm" onClick={() => setReviewOpen(true)}>
              Xem trước & áp dụng ({pendingSuggestions.length})
            </Button>
          )}
        </div>
      )}

      {suggest.isError && <ErrorBox error={suggest.error} fallback="Lỗi gợi ý AI" />}
      {suggest.isSuccess && (
        <p className="text-sm text-zinc-500">
          AI đã đề xuất cho {aiSuggestions.size} điểm — mở từng thẻ để xem/duyệt.
        </p>
      )}

      {!clusterSlug && (
        <p className="text-sm text-zinc-500">Chọn 1 cụm/tỉnh ở trên để bắt đầu rà soát.</p>
      )}

      {clusterSlug && destinationsInCluster.length === 0 && (
        <p className="text-sm text-zinc-500">Cụm/tỉnh này chưa có điểm đến nào.</p>
      )}

      {clusterSlug && destinationsInCluster.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          <KanbanColumn
            title="Chưa gán"
            items={columns.unclassified}
            warn
            onCardClick={setEditingSlug}
          />
          {columns.tagColumns.map(([tagSlug, items]) => (
            <KanbanColumn
              key={tagSlug}
              title={columns.tagBySlug.get(tagSlug)?.name ?? tagSlug}
              items={items}
              onCardClick={setEditingSlug}
            />
          ))}
        </div>
      )}

      {editingDestination && (
        <EditTagsModal
          destination={editingDestination}
          allTags={data.tags}
          suggestion={aiSuggestions.get(editingDestination.slug) ?? null}
          onClose={() => setEditingSlug(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: QUERY_KEY })}
        />
      )}

      {reviewOpen && (
        <BulkReviewModal
          suggestions={pendingSuggestions.map((d) => ({
            destination: d,
            suggestion: aiSuggestions.get(d.slug)!,
          }))}
          allTags={data.tags}
          onClose={() => setReviewOpen(false)}
        />
      )}
    </div>
  );
}

function KanbanColumn({
  title,
  items,
  warn,
  onCardClick,
}: {
  title: string;
  items: TagKanbanBoardDestination[];
  warn?: boolean;
  onCardClick: (slug: string) => void;
}) {
  return (
    <div
      className={`w-64 shrink-0 rounded-lg border p-2 ${
        warn
          ? "border-orange-300 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30"
          : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40"
      }`}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{title}</span>
        <Badge tone={warn ? "amber" : "gray"}>{items.length}</Badge>
      </div>
      <div className="max-h-[70vh] space-y-1.5 overflow-y-auto">
        {items.map((d) => (
          <button
            key={d.slug}
            type="button"
            onClick={() => onCardClick(d.slug)}
            className="flex w-full items-center gap-2 rounded border border-zinc-200 bg-white p-1.5 text-left hover:border-primary dark:border-zinc-800 dark:bg-zinc-900"
          >
            {d.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.imageUrl} alt="" className="h-8 w-10 shrink-0 rounded object-cover" />
            ) : (
              <div className="h-8 w-10 shrink-0 rounded bg-zinc-200 dark:bg-zinc-800" />
            )}
            <span className="line-clamp-2 flex-1 text-xs">{d.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function EditTagsModal({
  destination,
  allTags,
  suggestion,
  onClose,
  onSaved,
}: {
  destination: TagKanbanBoardDestination;
  allTags: GetTagKanbanBoardResponse["tags"];
  suggestion: TagSuggestion | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  // "selected" luon phan anh trang thai HIEN TAI da luu (khong am tham tick san theo
  // AI) — nguoi dung phan hoi 24/07/2026: chinh chu yeu bang tay, muon xem popup
  // cu/moi ro rang truoc khi ap dung goi y AI, khong muon bi tick san "im lang".
  const [selected, setSelected] = useState<Set<string>>(new Set(destination.tagSlugs));
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  const suggestedTagSlugs = suggestion?.tagSlugs ?? [];
  const currentTagSlugsKey = [...destination.tagSlugs].sort().join(",");
  const suggestedTagSlugsKey = [...suggestedTagSlugs].sort().join(",");
  const hasSuggestion =
    !suggestionDismissed && suggestedTagSlugs.length > 0 && suggestedTagSlugsKey !== currentTagSlugsKey;

  const save = useMutation({
    mutationFn: (tagSlugs: string[]) =>
      apiSend("POST", "/destination-tags/apply", {
        assignments: [{ destinationSlug: destination.slug, tagSlugs }],
      }),
    onSuccess: onSaved,
  });

  function toggle(tagSlug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tagSlug)) next.delete(tagSlug);
      else next.add(tagSlug);
      save.mutate([...next]);
      return next;
    });
  }

  function applySuggestion() {
    setSelected(new Set(suggestedTagSlugs));
    save.mutate(suggestedTagSlugs);
  }

  function nameOf(slug: string): string {
    return allTags.find((t) => t.slug === slug)?.name ?? slug;
  }

  return (
    <Modal open onClose={onClose} title={destination.name}>
      <div className="space-y-4">
        {hasSuggestion && (
          <div className="space-y-2 rounded border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-200">
            <p className="font-semibold">🤖 AI gợi ý đổi tag — xem trước khi áp dụng</p>
            <div className="grid grid-cols-[auto_1fr] items-start gap-x-2 gap-y-1">
              <span className="text-zinc-500 dark:text-zinc-400">Hiện tại:</span>
              <span>
                {destination.tagSlugs.length === 0
                  ? "(chưa có tag)"
                  : destination.tagSlugs.map(nameOf).join(", ")}
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">AI gợi ý:</span>
              <span className="font-medium">{suggestedTagSlugs.map(nameOf).join(", ")}</span>
            </div>
            <p className="italic text-indigo-700 dark:text-indigo-300">
              Lý do: {suggestion?.reasoning}
            </p>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={applySuggestion} loading={save.isPending}>
                Áp dụng gợi ý AI
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setSuggestionDismissed(true)}>
                Bỏ qua, tự chọn tay
              </Button>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          {allTags.map((t) => (
            <Checkbox
              key={t.slug}
              label={t.name}
              checked={selected.has(t.slug)}
              onChange={() => toggle(t.slug)}
            />
          ))}
        </div>
        {save.isError && <ErrorBox error={save.error} fallback="Lỗi lưu tag" />}
      </div>
    </Modal>
  );
}

function BulkReviewModal({
  suggestions,
  allTags,
  onClose,
}: {
  suggestions: { destination: TagKanbanBoardDestination; suggestion: TagSuggestion }[];
  allTags: GetTagKanbanBoardResponse["tags"];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [checked, setChecked] = useState<Set<string>>(
    new Set(suggestions.map((s) => s.destination.slug)),
  );

  const apply = useMutation({
    mutationFn: () =>
      apiSend("POST", "/destination-tags/apply", {
        assignments: suggestions
          .filter((s) => checked.has(s.destination.slug))
          .map((s) => ({ destinationSlug: s.destination.slug, tagSlugs: s.suggestion.tagSlugs })),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  function toggle(slug: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function nameOf(slug: string): string {
    return allTags.find((t) => t.slug === slug)?.name ?? slug;
  }

  return (
    <Modal open onClose={onClose} title={`Xem trước gợi ý AI (${suggestions.length} điểm)`}>
      <div className="space-y-4">
        <p className="text-xs text-zinc-500">
          Xem lại từng dòng trước khi áp dụng — bỏ tick điểm nào bạn không đồng ý với gợi ý AI.
          Áp dụng sẽ ghi đè toàn bộ tag của các điểm được tick bằng đúng gợi ý AI.
        </p>

        <div className="max-h-[55vh] space-y-2 overflow-y-auto">
          {suggestions.map(({ destination: d, suggestion: s }) => (
            <div
              key={d.slug}
              className="rounded border border-zinc-200 p-2.5 text-xs dark:border-zinc-800"
            >
              <div className="flex items-start gap-2">
                <Checkbox
                  label={d.name}
                  checked={checked.has(d.slug)}
                  onChange={() => toggle(d.slug)}
                  className="mt-0.5"
                />
                <div className="flex-1 space-y-1">
                  <div className="grid grid-cols-[auto_1fr] items-start gap-x-2 gap-y-0.5">
                    <span className="text-zinc-500 dark:text-zinc-400">Hiện tại:</span>
                    <span>
                      {d.tagSlugs.length === 0 ? "(chưa có tag)" : d.tagSlugs.map(nameOf).join(", ")}
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400">AI gợi ý:</span>
                    <span className="font-medium">{s.tagSlugs.map(nameOf).join(", ")}</span>
                  </div>
                  <p className="italic text-zinc-500 dark:text-zinc-400">Lý do: {s.reasoning}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {apply.isError && <ErrorBox error={apply.error} fallback="Lỗi áp dụng hàng loạt" />}
        {apply.isSuccess && <p className="text-sm text-zinc-500">Đã áp dụng {checked.size} điểm.</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="secondary" onClick={onClose}>
            Đóng
          </Button>
          <Button
            size="sm"
            disabled={checked.size === 0}
            loading={apply.isPending}
            onClick={() => apply.mutate()}
          >
            Áp dụng đã chọn ({checked.size})
          </Button>
        </div>
      </div>
    </Modal>
  );
}
