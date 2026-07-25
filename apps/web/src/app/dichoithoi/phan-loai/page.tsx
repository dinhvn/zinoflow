"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getTaxonomyKanbanBoardResponseSchema,
  previewPromptResponseSchema,
  suggestTaxonomyTypesResponseSchema,
  type GetTaxonomyKanbanBoardResponse,
  type TaxonomyBoardDestination,
} from "@zinoflow/contracts";
import { apiGet, apiSend } from "@/shared/api-client";
import { Badge, Button, Checkbox, ErrorBox, Modal, PageHeader, Select } from "@/shared/ui";
import { AiInvocationBar } from "@/features/dichoithoi/ai-invocation-bar";

const QUERY_KEY = ["taxonomy-kanban-board"];
const UNCLASSIFIED_COLUMN = "__unclassified__";

/**
 * Bảng Kanban rà soát taxonomy Type (relations-plan §6.1-6.3, Giai đoạn B2-B3) —
 * chọn 1 cụm/tỉnh, mỗi cột là 1 loại hình (chỉ hiện cột có điểm trong cụm đang
 * chọn), thẻ = điểm đến. Cột "Chưa phân loại" luôn hiện đầu, viền cảnh báo.
 * Bấm "Gợi ý AI cho cụm này" để AI đánh giá lại toàn bộ điểm trong cụm dựa trên
 * tên + nội dung thật (không bịa) — kết quả CHỈ lưu vào bảng nháp chờ duyệt,
 * KHÔNG tự ghi. Thẻ có gợi ý AI hiện chip "AI" — bấm thẻ mở modal đã tick sẵn
 * theo gợi ý (nếu điểm đó chưa có Type nào) kèm lý do, người dùng tick/bỏ tick
 * rồi lưu — lưu ngay khi tick, không cần nút submit riêng.
 */
export default function PhanLoaiPage() {
  const [clusterSlug, setClusterSlug] = useState("");
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiGet("/destination-types/kanban-board", getTaxonomyKanbanBoardResponseSchema),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Rà soát loại hình điểm đến"
        description="Xem lại và sửa loại hình (Type) đã gán cho từng điểm đến, theo từng cụm/tỉnh một — dữ liệu cũ có thể thiếu hoặc sai (vd Vịnh Hạ Long từng bị gán nhầm 'Di tích lịch sử'). Chọn 1 cụm/tỉnh, bấm vào 1 thẻ điểm đến để tick/bỏ tick loại hình — lưu ngay khi tick, không cần nút lưu riêng. Cột 'Chưa phân loại' (viền cam) luôn hiện đầu tiên, đây là danh sách ưu tiên xử lý trước."
      />

      {query.isLoading && <p className="text-sm text-zinc-500">Đang tải...</p>}
      {query.isError && <ErrorBox error={query.error} fallback="Lỗi tải dữ liệu taxonomy" />}

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
  data: GetTaxonomyKanbanBoardResponse;
  clusterSlug: string;
  onClusterChange: (slug: string) => void;
}) {
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const [aiProvider, setAiProvider] = useState("");
  const [aiModel, setAiModel] = useState("");

  const suggest = useMutation({
    mutationFn: async () =>
      suggestTaxonomyTypesResponseSchema.parse(
        await apiSend("POST", "/destination-types/suggest", { clusterSlug, aiProvider, aiModel }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const destinationsInCluster = useMemo(
    () => data.destinations.filter((d) => d.parentSlug === clusterSlug),
    [data.destinations, clusterSlug],
  );

  const classifiedCount = destinationsInCluster.filter((d) => d.typeSlugs.length > 0).length;

  const columns = useMemo(() => {
    const bySlug = new Map(data.types.map((t) => [t.slug, t]));
    const groups = new Map<string, TaxonomyBoardDestination[]>();
    for (const d of destinationsInCluster) {
      if (d.typeSlugs.length === 0) {
        groups.set(UNCLASSIFIED_COLUMN, [...(groups.get(UNCLASSIFIED_COLUMN) ?? []), d]);
        continue;
      }
      for (const typeSlug of d.typeSlugs) {
        groups.set(typeSlug, [...(groups.get(typeSlug) ?? []), d]);
      }
    }
    const ordered = [...groups.entries()]
      .filter(([slug]) => slug !== UNCLASSIFIED_COLUMN)
      .sort(([a], [b]) => (bySlug.get(a)?.name ?? a).localeCompare(bySlug.get(b)?.name ?? b));
    const unclassified = groups.get(UNCLASSIFIED_COLUMN) ?? [];
    return { unclassified, typeColumns: ordered, typeBySlug: bySlug };
  }, [destinationsInCluster, data.types]);

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
            {classifiedCount}/{destinationsInCluster.length} điểm trong cụm đã phân loại
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
                await apiSend("POST", "/destination-types/suggest/preview", { clusterSlug }),
              ).sections
            }
          />
          <Button size="sm" variant="secondary" onClick={() => suggest.mutate()} loading={suggest.isPending}>
            Gợi ý AI cho cụm này
          </Button>
        </div>
      )}

      {suggest.isError && <ErrorBox error={suggest.error} fallback="Lỗi gợi ý AI" />}
      {suggest.isSuccess && (
        <p className="text-sm text-zinc-500">
          AI đã đề xuất cho {suggest.data.suggestions.length} điểm — mở từng thẻ để xem/duyệt.
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
            title="Chưa phân loại"
            items={columns.unclassified}
            warn
            onCardClick={setEditingSlug}
          />
          {columns.typeColumns.map(([typeSlug, items]) => (
            <KanbanColumn
              key={typeSlug}
              title={columns.typeBySlug.get(typeSlug)?.name ?? typeSlug}
              items={items}
              onCardClick={setEditingSlug}
            />
          ))}
        </div>
      )}

      {editingDestination && (
        <EditTypesModal
          destination={editingDestination}
          types={data.types}
          groups={data.groups}
          onClose={() => setEditingSlug(null)}
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
  items: TaxonomyBoardDestination[];
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
            {d.suggestionStatus === "pending" && (
              <Badge tone="indigo" className="shrink-0">
                AI
              </Badge>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function EditTypesModal({
  destination,
  types,
  groups,
  onClose,
}: {
  destination: TaxonomyBoardDestination;
  types: GetTaxonomyKanbanBoardResponse["types"];
  groups: GetTaxonomyKanbanBoardResponse["groups"];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  // "selected" luon phan anh trang thai HIEN TAI da luu (khong am tham tick san theo
  // AI) — nguoi dung phan hoi 24/07/2026: chinh chu yeu bang tay, muon xem popup
  // cu/moi ro rang truoc khi ap dung goi y AI, khong muon bi tick san "im lang".
  const [selected, setSelected] = useState<Set<string>>(new Set(destination.typeSlugs));
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  const suggestedTypeSlugs = destination.suggestedTypeSlugs ?? [];
  const currentTypeSlugsKey = [...destination.typeSlugs].sort().join(",");
  const suggestedTypeSlugsKey = [...suggestedTypeSlugs].sort().join(",");
  const hasSuggestion =
    !suggestionDismissed &&
    destination.suggestionStatus === "pending" &&
    suggestedTypeSlugs.length > 0 &&
    suggestedTypeSlugsKey !== currentTypeSlugsKey;

  const save = useMutation({
    mutationFn: (typeSlugs: string[]) =>
      apiSend("PATCH", `/destination-types/${destination.slug}/types`, { typeSlugs }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  function toggle(typeSlug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(typeSlug)) next.delete(typeSlug);
      else next.add(typeSlug);
      save.mutate([...next]);
      return next;
    });
  }

  function applySuggestion() {
    setSelected(new Set(suggestedTypeSlugs));
    save.mutate(suggestedTypeSlugs);
  }

  function nameOf(slug: string): string {
    return types.find((t) => t.slug === slug)?.name ?? slug;
  }

  return (
    <Modal open onClose={onClose} title={destination.name}>
      <div className="space-y-4">
        {hasSuggestion && (
          <div className="space-y-2 rounded border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-200">
            <p className="font-semibold">🤖 AI gợi ý đổi loại hình — xem trước khi áp dụng</p>
            <div className="grid grid-cols-[auto_1fr] items-start gap-x-2 gap-y-1">
              <span className="text-zinc-500 dark:text-zinc-400">Hiện tại:</span>
              <span>
                {destination.typeSlugs.length === 0
                  ? "(chưa có loại hình)"
                  : destination.typeSlugs.map(nameOf).join(", ")}
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">AI gợi ý:</span>
              <span className="font-medium">{suggestedTypeSlugs.map(nameOf).join(", ")}</span>
            </div>
            <p className="italic text-indigo-700 dark:text-indigo-300">
              Lý do: {destination.suggestionReason}
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
        {groups.map((g) => (
          <div key={g.slug}>
            <div className="mb-1.5 text-xs font-semibold text-zinc-500">{g.name}</div>
            <div className="flex flex-wrap gap-3">
              {types
                .filter((t) => t.groupSlug === g.slug)
                .map((t) => (
                  <Checkbox
                    key={t.slug}
                    label={t.name}
                    checked={selected.has(t.slug)}
                    onChange={() => toggle(t.slug)}
                  />
                ))}
            </div>
          </div>
        ))}
        {save.isError && <ErrorBox error={save.error} fallback="Lỗi lưu loại hình" />}
      </div>
    </Modal>
  );
}
