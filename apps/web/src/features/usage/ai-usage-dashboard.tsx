"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  aiUsageSummaryResponseSchema,
  type AiUsageModelStat,
  type AiUsageOperationStat,
} from "@zinoflow/contracts";
import { apiGet } from "@/shared/api-client";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { DataTable, type DataTableColumn } from "@/shared/ui/data-table";
import { ErrorBox } from "@/shared/ui/error-box";
import { Input } from "@/shared/ui/input";

const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;
const num = (n: number) => n.toLocaleString("vi-VN");

const PROVIDER_TONE: Record<string, BadgeTone> = {
  anthropic: "indigo",
  gemini: "emerald",
  openai: "amber",
  stub: "gray",
};

/** Dashboard chi phi AI — tong hop ai_usage_logs theo khoang ngay (spec §13). */
export function AiUsageDashboard() {
  // Khoang ngay dang ap dung (rong = de server tu chon 30 ngay gan nhat)
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState<{ from: string; to: string }>({ from: "", to: "" });

  const query = useQuery({
    queryKey: ["ai-usage", applied.from, applied.to],
    queryFn: () => {
      const params = new URLSearchParams();
      if (applied.from) params.set("from", applied.from);
      if (applied.to) params.set("to", applied.to);
      const qs = params.toString();
      return apiGet(`/content/ai-usage/summary${qs ? `?${qs}` : ""}`, aiUsageSummaryResponseSchema);
    },
  });
  const d = query.data;

  const modelColumns: DataTableColumn<AiUsageModelStat>[] = [
    {
      key: "provider",
      header: "Provider",
      render: (r) => <Badge tone={PROVIDER_TONE[r.provider] ?? "gray"}>{r.provider}</Badge>,
    },
    { key: "model", header: "Model", render: (r) => <span className="font-mono text-xs">{r.model}</span> },
    { key: "calls", header: "Lượt gọi", align: "right", render: (r) => num(r.calls) },
    { key: "in", header: "Token vào", align: "right", render: (r) => num(r.inputTokens) },
    { key: "out", header: "Token ra", align: "right", render: (r) => num(r.outputTokens) },
    {
      key: "cost",
      header: "Chi phí",
      align: "right",
      render: (r) => <span className="font-medium">{usd(r.costUsd)}</span>,
    },
  ];

  const opColumns: DataTableColumn<AiUsageOperationStat>[] = [
    { key: "operation", header: "Tác vụ", render: (r) => <span className="font-mono text-xs">{r.operation}</span> },
    { key: "calls", header: "Lượt gọi", align: "right", render: (r) => num(r.calls) },
    {
      key: "cost",
      header: "Chi phí",
      align: "right",
      render: (r) => <span className="font-medium">{usd(r.costUsd)}</span>,
    },
  ];

  const maxDailyCost = Math.max(1e-9, ...(d?.daily ?? []).map((x) => x.costUsd));

  return (
    <div className="space-y-6">
      {/* Bo loc ngay */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Từ ngày</span>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Đến ngày</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <Button variant="primary" onClick={() => setApplied({ from, to })} loading={query.isFetching}>
          Áp dụng
        </Button>
        {(from || to) && (
          <Button
            onClick={() => {
              setFrom("");
              setTo("");
              setApplied({ from: "", to: "" });
            }}
          >
            Xóa lọc
          </Button>
        )}
        {d && (
          <span className="ml-auto text-xs text-zinc-500">
            Khoảng: {d.range.from} → {d.range.to}
          </span>
        )}
      </div>

      {query.isError && <ErrorBox error={query.error} fallback="Lỗi tải dữ liệu chi phí" />}

      {d && (
        <>
          {/* The tong */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Tổng chi phí" value={usd(d.totals.costUsd)} highlight />
            <StatCard label="Lượt gọi AI" value={num(d.totals.calls)} />
            <StatCard label="Token vào / ra" value={`${num(d.totals.inputTokens)} / ${num(d.totals.outputTokens)}`} />
            <StatCard label="Độ trễ TB" value={`${num(d.totals.avgLatencyMs)} ms`} />
          </div>

          {d.totals.calls === 0 && (
            <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
              Chưa có lượt gọi AI nào trong khoảng này. (Stub provider cũng được ghi log — chạy thử sinh bài để thấy số liệu.)
            </p>
          )}

          {d.totals.calls > 0 && (
            <>
              <Section title="Theo Provider × Model">
                <DataTable columns={modelColumns} items={d.byModel} rowKey={(r) => `${r.provider}-${r.model}`} />
              </Section>

              <div className="grid gap-6 lg:grid-cols-2">
                <Section title="Theo tác vụ">
                  <DataTable columns={opColumns} items={d.byOperation} rowKey={(r) => r.operation} />
                </Section>

                <Section title="Theo ngày">
                  <div className="space-y-1.5 rounded border border-zinc-200 p-3 dark:border-zinc-800">
                    {d.daily.map((row) => (
                      <div key={row.date} className="flex items-center gap-2 text-xs">
                        <span className="w-20 shrink-0 text-zinc-500">{row.date}</span>
                        <div className="h-3 flex-1 rounded bg-zinc-100 dark:bg-zinc-900">
                          <div
                            className="h-3 rounded bg-indigo-500/70"
                            style={{ width: `${Math.max(2, (row.costUsd / maxDailyCost) * 100)}%` }}
                          />
                        </div>
                        <span className="w-16 shrink-0 text-right font-medium">{usd(row.costUsd)}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight
          ? "border-indigo-200 bg-indigo-50/50 dark:border-indigo-500/30 dark:bg-indigo-500/10"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${highlight ? "text-indigo-700 dark:text-indigo-300" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{title}</h2>
      {children}
    </div>
  );
}
