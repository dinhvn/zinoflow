"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  generateTagDescriptionResponseSchema,
  listDestinationTagAssignmentsResponseSchema,
  reverseCheckTagAssignmentsResponseSchema,
  suggestTagAssignmentsResponseSchema,
  type ListDestinationTagAssignmentsResponse,
  type TagReverseCheckFinding,
  type TagSuggestion,
} from "@zinoflow/contracts";
import { apiSend, apiGet, ApiError } from "@/shared/api-client";
import { Badge, Button, Checkbox, ErrorBox, Textarea } from "@/shared/ui";

const QUERY_KEY = ["destination-tag-assignments"];

/**
 * Man "Chủ đề" (destination-spec §2.4) — 3 buoc: (1) AI goi y gan tag hang loat
 * + nguoi dung duyet tung dong, (2) AI ra soat nguoc phat hien gan sai/tag duoi
 * nguong, (3) AI soan mo ta cho trang /chu-de/{slug}.
 */
export default function ChuDePage() {
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiGet("/destination-tags", listDestinationTagAssignmentsResponseSchema),
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Chủ đề điểm đến</h2>
        <p className="text-sm text-zinc-500">
          Gán chủ đề (tag) cho điểm đến bằng AI, duyệt trước khi ghi, rà soát lại các tag đã gán
          và soạn mô tả cho trang /chu-de/{"{slug}"}.
        </p>
      </div>

      {query.isLoading && <p className="text-sm text-zinc-500">Đang tải...</p>}
      {query.isError && <ErrorBox error={query.error} fallback="Lỗi tải danh sách chủ đề" />}

      {query.data && <ChuDeSections data={query.data} />}
    </div>
  );
}

function ChuDeSections({ data }: { data: ListDestinationTagAssignmentsResponse }) {
  return (
    <div className="space-y-8">
      <TagListSection data={data} />
      <SuggestSection assignedSlugs={new Set(data.assignments.filter((a) => a.tagSlugs.length > 0).map((a) => a.destinationSlug))} />
      <ReverseCheckSection />
      <CurrentAssignmentsSection data={data} />
    </div>
  );
}

/* --- 1. Danh sach tag + mo ta --- */

function TagListSection({ data }: { data: ListDestinationTagAssignmentsResponse }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        7 tag đã duyệt
      </h3>
      <div className="divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {data.tags.map((tag) => (
          <TagDescriptionRow key={tag.id} slug={tag.slug} name={tag.name} initialDescription={tag.description} />
        ))}
      </div>
    </section>
  );
}

function TagDescriptionRow({
  slug,
  name,
  initialDescription,
}: {
  slug: string;
  name: string;
  initialDescription: string | null;
}) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(initialDescription ?? "");

  const generate = useMutation({
    mutationFn: async () =>
      generateTagDescriptionResponseSchema.parse(
        await apiSend("POST", `/destination-tags/${slug}/generate-description`, {}),
      ),
    onSuccess: (r) => setValue(r.description),
  });

  const save = useMutation({
    mutationFn: () =>
      apiSend("PATCH", `/destination-tags/${slug}/description`, {
        description: value.trim() || null,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const dirty = value !== (initialDescription ?? "");

  return (
    <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-[180px_1fr_auto] sm:items-start">
      <div>
        <div className="text-sm font-medium">{name}</div>
        <div className="text-xs text-zinc-500">/chu-de/{slug}</div>
      </div>
      <Textarea
        rows={2}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Đoạn giới thiệu cho trang chủ đề này..."
        className="w-full"
      />
      <div className="flex flex-col items-start gap-1 sm:items-end">
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => generate.mutate()} loading={generate.isPending}>
            AI soạn
          </Button>
          <Button size="sm" onClick={() => save.mutate()} disabled={!dirty} loading={save.isPending}>
            Lưu
          </Button>
        </div>
        {(generate.isError || save.isError) && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {(generate.error ?? save.error) instanceof ApiError
              ? (generate.error ?? save.error)?.message
              : "Lỗi"}
          </span>
        )}
      </div>
    </div>
  );
}

/* --- 2. AI goi y gan tag hang loat + duyet --- */

function SuggestSection({ assignedSlugs }: { assignedSlugs: Set<string> }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Map<string, Set<string>>>(new Map());

  const suggest = useMutation({
    mutationFn: async () =>
      suggestTagAssignmentsResponseSchema.parse(
        await apiSend("POST", "/destination-tags/suggest", {}),
      ),
    onSuccess: (r) => {
      setSelected(new Map(r.suggestions.map((s) => [s.destinationSlug, new Set(s.tagSlugs)])));
    },
  });

  const apply = useMutation({
    mutationFn: () =>
      apiSend("POST", "/destination-tags/apply", {
        assignments: [...selected.entries()].map(([destinationSlug, tagSlugs]) => ({
          destinationSlug,
          tagSlugs: [...tagSlugs],
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      setSelected(new Map());
      suggest.reset();
    },
  });

  function toggleTag(destinationSlug: string, tagSlug: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      const tags = new Set(next.get(destinationSlug) ?? []);
      if (tags.has(tagSlug)) tags.delete(tagSlug);
      else tags.add(tagSlug);
      next.set(destinationSlug, tags);
      return next;
    });
  }

  const suggestions = suggest.data?.suggestions ?? [];

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Gán tag hàng loạt (AI gợi ý)
          </h3>
          <p className="text-xs text-zinc-500">
            AI chỉ gợi ý cho điểm đến chưa có tag nào ({assignedSlugs.size} điểm đã gán, sẽ bỏ qua).
          </p>
        </div>
        <Button size="sm" onClick={() => suggest.mutate()} loading={suggest.isPending}>
          Gợi ý AI
        </Button>
      </div>

      {suggest.isError && <ErrorBox error={suggest.error} fallback="Lỗi gợi ý tag" />}

      {suggestions.length === 0 && suggest.isSuccess && (
        <p className="text-sm text-zinc-500">Không có điểm đến nào cần gợi ý (đã gán tag hết).</p>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-2">
          <div className="divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {suggestions.map((s) => (
              <SuggestionRow
                key={s.destinationSlug}
                suggestion={s}
                selectedTags={selected.get(s.destinationSlug) ?? new Set()}
                onToggle={(tagSlug) => toggleTag(s.destinationSlug, tagSlug)}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => apply.mutate()} loading={apply.isPending}>
              Áp dụng lựa chọn ({suggestions.length} điểm)
            </Button>
            {apply.isError && <ErrorBox error={apply.error} fallback="Lỗi ghi tag" />}
          </div>
        </div>
      )}
    </section>
  );
}

function SuggestionRow({
  suggestion,
  selectedTags,
  onToggle,
}: {
  suggestion: TagSuggestion;
  selectedTags: Set<string>;
  onToggle: (tagSlug: string) => void;
}) {
  return (
    <div className="space-y-1.5 p-3">
      <div className="text-sm font-medium">{suggestion.destinationSlug}</div>
      <p className="text-xs text-zinc-500">{suggestion.reasoning}</p>
      <div className="flex flex-wrap gap-3">
        {suggestion.tagSlugs.map((tag) => (
          <Checkbox
            key={tag}
            label={tag}
            checked={selectedTags.has(tag)}
            onChange={() => onToggle(tag)}
          />
        ))}
      </div>
    </div>
  );
}

/* --- 3. Ra soat nguoc --- */

function ReverseCheckSection() {
  const check = useMutation({
    mutationFn: async () =>
      reverseCheckTagAssignmentsResponseSchema.parse(
        await apiSend("POST", "/destination-tags/reverse-check", {}),
      ),
  });

  const findings = check.data?.findings ?? [];

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Rà soát lại (AI + ngưỡng số lượng)
        </h3>
        <Button size="sm" onClick={() => check.mutate()} loading={check.isPending}>
          Chạy rà soát
        </Button>
      </div>

      {check.isError && <ErrorBox error={check.error} fallback="Lỗi rà soát" />}

      {check.isSuccess && findings.length === 0 && (
        <p className="text-sm text-zinc-500">Không phát hiện vấn đề nào.</p>
      )}

      {findings.length > 0 && (
        <div className="divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {findings.map((f, i) => (
            <FindingRow key={i} finding={f} />
          ))}
        </div>
      )}
    </section>
  );
}

function FindingRow({ finding }: { finding: TagReverseCheckFinding }) {
  return (
    <div className="flex items-start gap-3 p-3">
      <Badge tone={finding.issue === "likely-wrong" ? "red" : "amber"}>
        {finding.issue === "likely-wrong" ? "Có thể gán sai" : "Dưới ngưỡng"}
      </Badge>
      <div className="text-sm">
        <div className="font-medium">
          {finding.destinationSlug ? `${finding.destinationSlug} — ${finding.tagSlug}` : finding.tagSlug}
        </div>
        <div className="text-xs text-zinc-500">{finding.reasoning}</div>
      </div>
    </div>
  );
}

/* --- Bang gan tag hien tai (tham khao) --- */

function CurrentAssignmentsSection({ data }: { data: ListDestinationTagAssignmentsResponse }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        Tag đang gán ({data.assignments.length} điểm đến)
      </h3>
      <div className="max-h-96 divide-y divide-zinc-200 overflow-y-auto rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {data.assignments.map((a) => (
          <div key={a.destinationSlug} className="flex flex-wrap items-center gap-2 p-2.5">
            <span className="w-48 shrink-0 text-sm">{a.destinationName}</span>
            {a.tagSlugs.length === 0 ? (
              <span className="text-xs text-zinc-400">Chưa gán tag</span>
            ) : (
              a.tagSlugs.map((tag) => (
                <Badge key={tag} tone="indigo">
                  {tag}
                </Badge>
              ))
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
