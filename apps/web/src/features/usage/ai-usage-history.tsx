"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listAiUsageLogsResponseSchema, type AiUsageLogRow } from "@zinoflow/contracts";
import { apiGet } from "@/shared/api-client";
import { formatTokensAndCost } from "@/shared/format-usage";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import { DataTable, type DataTableColumn } from "@/shared/ui/data-table";
import { ErrorBox } from "@/shared/ui/error-box";
import { Pagination } from "@/shared/ui/pagination";
import { Select } from "@/shared/ui/select";
import { AiUsageLogDetailModal } from "./ai-usage-log-detail-modal";

const PROVIDER_TONE: Record<string, BadgeTone> = {
  anthropic: "indigo",
  gemini: "emerald",
  openai: "amber",
  stub: "gray",
};

const VIA_LABEL: Record<string, string> = { sync: "Đơn lẻ", batch: "Batch AI" };
const VIA_TONE: Record<string, BadgeTone> = { sync: "gray", batch: "blue" };

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
  const [via, setVia] = useState("");
  const [viewing, setViewing] = useState<AiUsageLogRow | null>(null);

  const query = useQuery({
    queryKey: ["ai-usage-logs", page, pageSize, provider, operation, via],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      if (provider) params.set("provider", provider);
      if (operation) params.set("operation", operation);
      if (via) params.set("via", via);
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
      key: "via",
      header: "Nguồn",
      render: (r) => <Badge tone={VIA_TONE[r.via] ?? "gray"}>{VIA_LABEL[r.via] ?? r.via}</Badge>,
    },
    {
      key: "tokensAndCost",
      header: "Tokens (chi phí)",
      align: "right",
      render: (r) => (
        <span className="text-xs">
          {formatTokensAndCost(r.inputTokens + r.outputTokens, r.costUsd)}
        </span>
      ),
    },
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
        <label className="text-sm">
          <span className="mb-1 block font-medium">Nguồn</span>
          <Select
            value={via}
            onChange={(e) => {
              setVia(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả</option>
            <option value="sync">Đơn lẻ</option>
            <option value="batch">Batch AI</option>
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
