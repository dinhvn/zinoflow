"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  promptTemplateDetailSchema,
  promptTemplateListResponseSchema,
  type PromptTemplateDetail,
  type PromptTemplateSummary,
} from "@zinoflow/contracts";
import { apiGet, apiSend, ApiError } from "@/shared/api-client";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { FeatureIntro } from "@/shared/ui/feature-intro";
import { Textarea } from "@/shared/ui/textarea";
import {
  formatPromptVersion,
  isLatestPromptVersion,
} from "@/shared/prompt-version";

const ARTICLE_GROUP_LABELS: Record<string, string> = {
  "": "Hệ thống (dùng chung)",
  toplist: "Top-list",
  review: "Review",
  "guide-diem-den": "Điểm đến (dichoithoi)",
};
const GROUP_ORDER = ["", "toplist", "review", "guide-diem-den"];

const OPERATION_SHORT: Record<string, string> = {
  system: "System",
  outline: "Outline",
  section: "Section",
  frame: "Frame",
};

export default function PromptsPage() {
  const queryClient = useQueryClient();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["prompt-templates"],
    queryFn: () =>
      apiGet("/content/prompt-templates", promptTemplateListResponseSchema),
  });

  // Chon template dau tien khi tai xong
  useEffect(() => {
    if (!selectedKey && listQuery.data?.templates[0]) {
      setSelectedKey(listQuery.data.templates[0].key);
    }
  }, [listQuery.data, selectedKey]);

  const grouped = useMemo(
    () => groupByArticleType(listQuery.data?.templates ?? []),
    [listQuery.data],
  );

  return (
    <div className="max-w-6xl space-y-4">
      <FeatureIntro summary="Soạn candidate, so sánh với prompt đang dùng rồi kích hoạt có kiểm soát. Việc lưu không tự thay đổi prompt vận hành; mọi bài vẫn cần người duyệt trước khi xuất bản." />
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Cot trai: danh sach template */}
        <div className="w-full shrink-0 space-y-4 lg:w-72">
          <div>
            <h2 className="text-2xl font-semibold">Prompt mẫu</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Sửa prompt sinh bài. Mỗi lần lưu tạo 1 version mới, có thể khôi
              phục version cũ.
            </p>
          </div>
          {listQuery.isLoading && (
            <p className="text-sm text-zinc-500">Đang tải...</p>
          )}
          {GROUP_ORDER.filter((g) => grouped[g]?.length).map((group) => (
            <div key={group}>
              <div className="mb-1 px-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                {ARTICLE_GROUP_LABELS[group]}
              </div>
              <ul className="space-y-0.5">
                {grouped[group]!.map((t) => (
                  <li key={t.key}>
                    <button
                      onClick={() => setSelectedKey(t.key)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                        selectedKey === t.key
                          ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                      }`}
                    >
                      <span>{OPERATION_SHORT[t.operation] ?? t.operation}</span>
                      <SourceBadge summary={t} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Cot phai: editor */}
        <div className="min-w-0 flex-1">
          {selectedKey ? (
            <PromptEditor
              key={selectedKey}
              templateKey={selectedKey}
              onChanged={() => {
                void queryClient.invalidateQueries({
                  queryKey: ["prompt-templates"],
                });
                void queryClient.invalidateQueries({
                  queryKey: ["prompt-template", selectedKey],
                });
              }}
            />
          ) : (
            <p className="text-sm text-zinc-500">
              Chọn một template bên trái để xem / sửa.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SourceBadge({ summary }: { summary: PromptTemplateSummary }) {
  if (summary.source === "db") {
    return (
      <span className="flex flex-wrap justify-end gap-1">
        <Badge tone="emerald">
          {formatPromptVersion(summary.source, summary.activeVersion)}
        </Badge>
        {isLatestPromptVersion(
          summary.source,
          summary.activeVersion,
          summary.latestVersion,
        ) && <Badge tone="blue">latest</Badge>}
      </span>
    );
  }
  return <Badge tone="gray">Mặc định</Badge>;
}

function PromptEditor({
  templateKey,
  onChanged,
}: {
  templateKey: string;
  onChanged: () => void;
}) {
  const [content, setContent] = useState("");
  const [warning, setWarning] = useState<string[] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ["prompt-template", templateKey],
    queryFn: () =>
      apiGet(
        `/content/prompt-templates/${templateKey}`,
        promptTemplateDetailSchema,
      ),
  });
  const d = detailQuery.data;

  // Prefill textarea bang noi dung dang dung khi tai xong / doi key
  useEffect(() => {
    if (d) setContent(d.activeContent);
  }, [d]);

  const saveVersion = useMutation({
    mutationFn: async () => {
      const res = (await apiSend(
        "POST",
        `/content/prompt-templates/${templateKey}/versions`,
        {
          content,
        },
      )) as {
        version: number;
        contentHash: string;
        isActive: false;
        unknownPlaceholders: string[];
      };
      return res;
    },
    onSuccess: (res) => {
      setActionError(null);
      setWarning(
        res.unknownPlaceholders.length ? res.unknownPlaceholders : null,
      );
      setSavedNote(
        `Đã lưu candidate v${res.version} (${res.contentHash.slice(0, 8)})`,
      );
      onChanged();
    },
    onError: (e) => setActionError(toMsg(e)),
  });

  const activateVersion = useMutation({
    mutationFn: (version: number) =>
      apiSend("POST", `/content/prompt-templates/${templateKey}/activate`, {
        version,
        expectedActiveVersion: d?.activeVersion ?? null,
      }),
    onSuccess: () => {
      setActionError(null);
      setSavedNote(null);
      onChanged();
    },
    onError: (e) => setActionError(toMsg(e)),
  });

  if (detailQuery.isLoading || !d) {
    return <p className="text-sm text-zinc-500">Đang tải template...</p>;
  }

  const isDirty = content !== d.activeContent;
  const diff = isDirty ? buildLineDiff(d.activeContent, content) : [];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{d.label}</h3>
        <p className="font-mono text-xs text-zinc-400">{d.key}</p>
      </div>

      {d.operation === "system" && (
        <p className="rounded bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          ⚠️ Đây là system prompt dùng chung cho MỌI loại bài — sửa sẽ ảnh hưởng
          tất cả.
        </p>
      )}

      {/* Bien kha dung */}
      {d.variables.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-zinc-500">
            Biến chèn được (giữ nguyên cú pháp <code>{"{{ten}}"}</code>):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {d.variables.map((v) => (
              <code
                key={v}
                className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              >{`{{${v}}}`}</code>
            ))}
          </div>
        </div>
      )}

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={18}
        spellCheck={false}
        className="w-full rounded border border-zinc-300 bg-transparent p-3 font-mono text-sm leading-relaxed dark:border-zinc-700"
      />

      {diff.length > 0 && (
        <details
          className="rounded border border-zinc-200 p-3 dark:border-zinc-800"
          open
        >
          <summary className="cursor-pointer text-sm font-medium">
            Diff với version đang dùng
          </summary>
          <div className="mt-2 max-h-72 overflow-auto rounded bg-zinc-950 p-2 font-mono text-xs leading-5">
            {diff.map((line, index) => (
              <div
                key={`${index}-${line.text}`}
                className={
                  line.kind === "add"
                    ? "bg-emerald-950/70 text-emerald-200"
                    : line.kind === "remove"
                      ? "bg-red-950/70 text-red-200"
                      : "text-zinc-400"
                }
              >
                {line.kind === "add"
                  ? "+ "
                  : line.kind === "remove"
                    ? "- "
                    : "  "}
                {line.text || " "}
              </div>
            ))}
          </div>
        </details>
      )}

      {warning && (
        <p className="rounded bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          ⚠️ Có biến không hợp lệ (sẽ giữ nguyên trong prompt, không được thay
          giá trị): {warning.map((w) => `{{${w}}}`).join(", ")}
        </p>
      )}
      {actionError && (
        <p className="rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {actionError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          loading={saveVersion.isPending}
          disabled={!isDirty || !content.trim()}
          onClick={() => saveVersion.mutate()}
        >
          {saveVersion.isPending ? "Đang lưu..." : "Lưu candidate"}
        </Button>
        <Button
          disabled={content === d.defaultContent}
          onClick={() => setContent(d.defaultContent)}
        >
          Khôi phục nội dung mặc định
        </Button>
        {isDirty && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            ● chưa lưu
          </span>
        )}
        {savedNote && !isDirty && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">
            ✅ {savedNote}
          </span>
        )}
      </div>

      {/* Lich su version */}
      {d.versions.length > 0 && (
        <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <h4 className="mb-2 text-sm font-medium">Lịch sử version</h4>
          <ul className="space-y-1.5">
            {d.versions.map((v) => (
              <li
                key={v.version}
                className="flex flex-col items-stretch gap-2 rounded border border-zinc-200 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3 dark:border-zinc-800"
              >
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="font-medium">v{v.version}</span>
                  {v.isActive && <Badge tone="emerald">đang dùng</Badge>}
                  {!v.isActive && <Badge tone="amber">candidate</Badge>}
                  {v.version === d.latestVersion && (
                    <Badge tone="blue">latest</Badge>
                  )}
                  <code className="text-xs text-zinc-400">
                    {v.contentHash.slice(0, 8)}
                  </code>
                  <span className="text-xs text-zinc-400">
                    {new Date(v.createdAt).toLocaleString("vi-VN")}
                  </span>
                </span>
                <span className="flex flex-wrap gap-2 sm:justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setContent(v.content)}
                  >
                    Xem vào ô soạn
                  </Button>
                  {!v.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => activateVersion.mutate(v.version)}
                      disabled={activateVersion.isPending}
                    >
                      Kích hoạt
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function groupByArticleType(
  templates: PromptTemplateSummary[],
): Record<string, PromptTemplateSummary[]> {
  const groups: Record<string, PromptTemplateSummary[]> = {};
  for (const t of templates) {
    const g = t.articleType ?? "";
    (groups[g] ??= []).push(t);
  }
  return groups;
}

function toMsg(e: unknown): string {
  return e instanceof ApiError
    ? `${e.message}${e.details.length ? `: ${e.details.join("; ")}` : ""}`
    : String(e);
}

type DiffLine = { kind: "same" | "add" | "remove"; text: string };

/** Line diff LCS cho prompt ngan/vua; chi chay khi editor dirty. */
function buildLineDiff(before: string, after: string): DiffLine[] {
  const left = before.split("\n");
  const right = after.split("\n");
  const lengths = Array.from({ length: left.length + 1 }, () =>
    Array<number>(right.length + 1).fill(0),
  );
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      lengths[i]![j] =
        left[i] === right[j]
          ? lengths[i + 1]![j + 1]! + 1
          : Math.max(lengths[i + 1]![j]!, lengths[i]![j + 1]!);
    }
  }
  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length || j < right.length) {
    if (i < left.length && j < right.length && left[i] === right[j]) {
      result.push({ kind: "same", text: left[i]! });
      i += 1;
      j += 1;
    } else if (
      j < right.length &&
      (i === left.length || lengths[i]![j + 1]! >= lengths[i + 1]![j]!)
    ) {
      result.push({ kind: "add", text: right[j]! });
      j += 1;
    } else {
      result.push({ kind: "remove", text: left[i]! });
      i += 1;
    }
  }
  return result;
}
