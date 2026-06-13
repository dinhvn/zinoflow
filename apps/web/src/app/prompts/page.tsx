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
    queryFn: () => apiGet("/content/prompt-templates", promptTemplateListResponseSchema),
  });

  // Chon template dau tien khi tai xong
  useEffect(() => {
    if (!selectedKey && listQuery.data?.templates[0]) {
      setSelectedKey(listQuery.data.templates[0].key);
    }
  }, [listQuery.data, selectedKey]);

  const grouped = useMemo(() => groupByArticleType(listQuery.data?.templates ?? []), [listQuery.data]);

  return (
    <div className="flex max-w-6xl gap-6">
      {/* Cot trai: danh sach template */}
      <div className="w-72 shrink-0 space-y-4">
        <div>
          <h2 className="text-2xl font-semibold">Prompt mẫu</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Sửa prompt sinh bài. Mỗi lần lưu tạo 1 version mới, có thể khôi phục version cũ.
          </p>
        </div>
        {listQuery.isLoading && <p className="text-sm text-zinc-500">Đang tải...</p>}
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
              void queryClient.invalidateQueries({ queryKey: ["prompt-templates"] });
              void queryClient.invalidateQueries({ queryKey: ["prompt-template", selectedKey] });
            }}
          />
        ) : (
          <p className="text-sm text-zinc-500">Chọn một template bên trái để xem / sửa.</p>
        )}
      </div>
    </div>
  );
}

function SourceBadge({ summary }: { summary: PromptTemplateSummary }) {
  if (summary.source === "db") {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        DB v{summary.activeVersion}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800">
      Mặc định
    </span>
  );
}

function PromptEditor({ templateKey, onChanged }: { templateKey: string; onChanged: () => void }) {
  const [content, setContent] = useState("");
  const [warning, setWarning] = useState<string[] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ["prompt-template", templateKey],
    queryFn: () =>
      apiGet(`/content/prompt-templates/${templateKey}`, promptTemplateDetailSchema),
  });
  const d = detailQuery.data;

  // Prefill textarea bang noi dung dang dung khi tai xong / doi key
  useEffect(() => {
    if (d) setContent(d.activeContent);
  }, [d]);

  const saveVersion = useMutation({
    mutationFn: async () => {
      const res = (await apiSend("POST", `/content/prompt-templates/${templateKey}/versions`, {
        content,
      })) as { version: number; unknownPlaceholders: string[] };
      return res;
    },
    onSuccess: (res) => {
      setActionError(null);
      setWarning(res.unknownPlaceholders.length ? res.unknownPlaceholders : null);
      setSavedNote(`Đã lưu version ${res.version}`);
      onChanged();
    },
    onError: (e) => setActionError(toMsg(e)),
  });

  const activateVersion = useMutation({
    mutationFn: (version: number) =>
      apiSend("POST", `/content/prompt-templates/${templateKey}/activate`, { version }),
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

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{d.label}</h3>
        <p className="font-mono text-xs text-zinc-400">{d.key}</p>
      </div>

      {d.operation === "system" && (
        <p className="rounded bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          ⚠️ Đây là system prompt dùng chung cho MỌI loại bài — sửa sẽ ảnh hưởng tất cả.
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

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={18}
        spellCheck={false}
        className="w-full rounded border border-zinc-300 bg-transparent p-3 font-mono text-sm leading-relaxed dark:border-zinc-700"
      />

      {warning && (
        <p className="rounded bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          ⚠️ Có biến không hợp lệ (sẽ giữ nguyên trong prompt, không được thay giá trị):{" "}
          {warning.map((w) => `{{${w}}}`).join(", ")}
        </p>
      )}
      {actionError && (
        <p className="rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {actionError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => saveVersion.mutate()}
          disabled={saveVersion.isPending || !isDirty || !content.trim()}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {saveVersion.isPending ? "Đang lưu..." : "Lưu version mới"}
        </button>
        <button
          onClick={() => setContent(d.defaultContent)}
          disabled={content === d.defaultContent}
          className="rounded border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Khôi phục nội dung mặc định
        </button>
        {isDirty && <span className="text-xs text-amber-600 dark:text-amber-400">● chưa lưu</span>}
        {savedNote && !isDirty && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">✅ {savedNote}</span>
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
                className="flex items-center justify-between gap-3 rounded border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
              >
                <span className="flex items-center gap-2">
                  <span className="font-medium">v{v.version}</span>
                  {v.isActive && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      đang dùng
                    </span>
                  )}
                  <span className="text-xs text-zinc-400">
                    {new Date(v.createdAt).toLocaleString("vi-VN")}
                  </span>
                </span>
                <span className="flex gap-2">
                  <button
                    onClick={() => setContent(v.content)}
                    className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Xem vào ô soạn
                  </button>
                  {!v.isActive && (
                    <button
                      onClick={() => activateVersion.mutate(v.version)}
                      disabled={activateVersion.isPending}
                      className="text-xs text-indigo-600 hover:underline disabled:opacity-50 dark:text-indigo-400"
                    >
                      Dùng lại
                    </button>
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
  return e instanceof ApiError ? `${e.message}${e.details.length ? `: ${e.details.join("; ")}` : ""}` : String(e);
}
