"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listAiUsageLogsResponseSchema, type AiUsageLogRow } from "@zinoflow/contracts";
import { apiGet } from "@/shared/api-client";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import { DataTable, type DataTableColumn } from "@/shared/ui/data-table";
import { ErrorBox } from "@/shared/ui/error-box";
import { Modal } from "@/shared/ui/modal";
import { Pagination } from "@/shared/ui/pagination";
import { Select } from "@/shared/ui/select";

const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;

const PROVIDER_TONE: Record<string, BadgeTone> = {
  anthropic: "indigo",
  gemini: "emerald",
  openai: "amber",
  stub: "gray",
};

/**
 * Lịch sử TỪNG lượt gọi AI toàn hệ thống (không chỉ theo 1 content job) — bấm 1
 * dòng xem lại đầy đủ prompt/response đã gửi/nhận. Yêu cầu người dùng 24/07/2026:
 * trước đây chỉ có tổng hợp chi phí (tab "Tổng hợp"), không xem lại được từng lượt
 * cho các tác vụ không gắn job (vd gợi ý Type/Tag taxonomy dichoithoi).
 */
export function AiUsageHistory() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [provider, setProvider] = useState("");
  const [operation, setOperation] = useState("");
  const [viewing, setViewing] = useState<AiUsageLogRow | null>(null);

  const query = useQuery({
    queryKey: ["ai-usage-logs", page, pageSize, provider, operation],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      if (provider) params.set("provider", provider);
      if (operation) params.set("operation", operation);
      return apiGet(`/content/ai-usage/logs?${params.toString()}`, listAiUsageLogsResponseSchema);
    },
  });
  const d = query.data;

  const columns: DataTableColumn<AiUsageLogRow>[] = [
    {
      key: "createdAt",
      header: "Thời gian",
      render: (r) => (
        <span className="whitespace-nowrap text-xs text-zinc-500">
          {new Date(r.createdAt).toLocaleString("vi-VN")}
        </span>
      ),
    },
    {
      key: "provider",
      header: "Provider",
      render: (r) => <Badge tone={PROVIDER_TONE[r.provider] ?? "gray"}>{r.provider}</Badge>,
    },
    { key: "model", header: "Model", render: (r) => <span className="font-mono text-xs">{r.model}</span> },
    { key: "operation", header: "Tác vụ", render: (r) => <span className="font-mono text-xs">{r.operation}</span> },
    {
      key: "tokens",
      header: "Token vào/ra",
      align: "right",
      render: (r) => (
        <span className="text-xs">
          {r.inputTokens.toLocaleString("vi-VN")} / {r.outputTokens.toLocaleString("vi-VN")}
        </span>
      ),
    },
    { key: "cost", header: "Chi phí", align: "right", render: (r) => usd(r.costUsd) },
    {
      key: "jobId",
      header: "Job",
      render: (r) =>
        r.jobId ? (
          <a href={`/content/${r.jobId}`} className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">
            xem job ↗
          </a>
        ) : (
          <span className="text-xs text-zinc-400">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Provider</span>
          <Select
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả</option>
            {["anthropic", "gemini", "openai", "stub"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Tác vụ</span>
          <Select
            value={operation}
            onChange={(e) => {
              setOperation(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả</option>
            {(d?.operations ?? []).map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </Select>
        </label>
        {d && <span className="ml-auto text-xs text-zinc-500">{d.total} lượt gọi</span>}
      </div>

      {query.isError && <ErrorBox error={query.error} fallback="Lỗi tải lịch sử gọi AI" />}

      {d && (
        <>
          <DataTable
            columns={columns}
            items={d.rows}
            rowKey={(r) => r.id}
            loading={query.isFetching}
            onRowClick={(r) => setViewing(r)}
            emptyMessage="Chưa có lượt gọi AI nào khớp bộ lọc."
          />
          <Pagination
            page={page}
            pageSize={pageSize}
            total={d.total}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </>
      )}

      {viewing && <AiUsageLogDetailModal log={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function AiUsageLogDetailModal({ log, onClose }: { log: AiUsageLogRow; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title={`${log.provider} · ${log.model} · ${log.operation}`}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-500 sm:grid-cols-4">
          <span>Thời gian: {new Date(log.createdAt).toLocaleString("vi-VN")}</span>
          <span>
            Token: {log.inputTokens.toLocaleString("vi-VN")} vào / {log.outputTokens.toLocaleString("vi-VN")} ra
          </span>
          <span>Chi phí: {usd(log.costUsd)}</span>
          <span>Độ trễ: {log.latencyMs.toLocaleString("vi-VN")} ms</span>
        </div>
        <PromptBlock title="Prompt đã gửi" text={log.promptText} defaultOpen />
        <PromptBlock title="Response AI trả về" text={log.responseText} defaultOpen />
      </div>
    </Modal>
  );
}

function PromptBlock({ title, text, defaultOpen }: { title: string; text: string | null; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="rounded border border-zinc-200 dark:border-zinc-800">
      <summary className="cursor-pointer select-none bg-zinc-50 px-3 py-2 text-sm font-medium dark:bg-zinc-900">
        {title}
      </summary>
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300">
        {text ?? "(không có)"}
      </pre>
    </details>
  );
}
