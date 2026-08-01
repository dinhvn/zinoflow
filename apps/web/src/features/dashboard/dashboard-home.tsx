"use client";

import { useQuery } from "@tanstack/react-query";
import {
  dashboardSummaryResponseSchema,
  type ContentJobStatus,
  type DashboardSummaryResponse,
} from "@zinoflow/contracts";
import { apiGet } from "@/shared/api-client";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import { ErrorBox } from "@/shared/ui/error-box";
import { Card, ActionRow } from "@/shared/ui/card";

const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;
const num = (n: number) => n.toLocaleString("vi-VN");

const STATUS_META: Record<ContentJobStatus, { label: string; tone: BadgeTone }> = {
  Created: { label: "Mới tạo", tone: "gray" },
  GeneratingOutline: { label: "Đang sinh", tone: "blue" },
  OutlineReady: { label: "Chờ gửi batch nội dung", tone: "blue" },
  DraftReady: { label: "Có nháp", tone: "indigo" },
  InReview: { label: "Chờ duyệt", tone: "amber" },
  Approved: { label: "Đã duyệt", tone: "emerald" },
  Rejected: { label: "Từ chối", tone: "red" },
  Failed: { label: "Lỗi", tone: "red" },
};

const STATE_TONE: Record<string, BadgeTone> = {
  "chua-co-bai": "gray",
  "bai-tay": "blue",
  "dang-soan": "amber",
  "da-ghi-cms": "indigo",
  "da-publish": "emerald",
};

/** Dashboard trang chu — trung tam dieu hanh noi dung (1 endpoint /dashboard/summary). */
export function DashboardHome() {
  const query = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => apiGet("/dashboard/summary", dashboardSummaryResponseSchema),
    refetchInterval: 30_000,
  });
  const d = query.data;

  const published = d?.channels.reduce(
    (sum, c) => sum + (c.states.find((s) => s.key === "da-publish")?.count ?? 0),
    0,
  );
  const maxStatus = Math.max(1, ...(d?.jobs.byStatus.map((s) => s.count) ?? [1]));
  const maxDailyCost = Math.max(1e-9, ...(d?.cost.daily.map((x) => x.costUsd) ?? [0]));

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500">Trung tâm điều hành nội dung AI — laruki · dochoi3s · dichoithoi.</p>
        </div>
        {d && <span className="text-xs text-zinc-400">Cập nhật {new Date(d.generatedAt).toLocaleTimeString("vi-VN")}</span>}
      </div>

      {query.isLoading && <p className="text-sm text-zinc-500">Đang tải...</p>}
      {query.isError && <ErrorBox error={query.error} fallback="Không tải được dashboard" />}

      {d && (
        <>
          {/* KPI hang dau — con so hanh dong */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi href="/content" label="Chờ duyệt" value={num(d.actions.pendingReview)} tone="amber" />
            <Kpi href="/content" label="Đã duyệt, chờ đăng" value={num(d.actions.approved)} tone="emerald" />
            <Kpi href="/usage" label="Chi phí AI (30 ngày)" value={usd(d.cost.costUsd)} tone="indigo" />
            <Kpi label="Đã xuất bản" value={num(published ?? 0)} tone="gray" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Viec can lam */}
            <Card title="Việc cần làm">
              <div className="space-y-2">
                <ActionRow label="Bài chờ duyệt" count={d.actions.pendingReview} href="/content" tone="amber" />
                <ActionRow label="Bài lỗi (cần retry)" count={d.actions.failed} href="/content" tone="red" />
                <ActionRow label="Bài đã duyệt, sẵn sàng đăng" count={d.actions.approved} href="/content" tone="emerald" />
              </div>

              <h3 className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Bài gần đây</h3>
              {d.jobs.recent.length === 0 ? (
                <p className="text-sm text-zinc-500">Chưa có bài nào.</p>
              ) : (
                <ul className="space-y-1">
                  {d.jobs.recent.map((j) => (
                    <li key={j.id}>
                      <a
                        href={`/content/${j.id}`}
                        className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
                      >
                        <Badge tone={STATUS_META[j.status].tone}>{STATUS_META[j.status].label}</Badge>
                        <span className="flex-1 truncate text-zinc-700 dark:text-zinc-300">{j.topic}</span>
                        <span className="shrink-0 text-xs text-zinc-400">
                          {new Date(j.createdAt).toLocaleDateString("vi-VN")}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Pipeline trang thai bai */}
            <Card title={`Pipeline trạng thái bài (${num(d.jobs.total)})`}>
              {d.jobs.total === 0 ? (
                <p className="text-sm text-zinc-500">Chưa có job nào. Tạo bài ở mục AI Content.</p>
              ) : (
                <div className="space-y-2">
                  {d.jobs.byStatus.map((s) => (
                    <div key={s.status} className="flex items-center gap-2 text-sm">
                      <span className="w-28 shrink-0 text-zinc-500">{STATUS_META[s.status].label}</span>
                      <div className="h-4 flex-1 rounded bg-zinc-100 dark:bg-zinc-900">
                        <div
                          className="h-4 rounded bg-indigo-500/70"
                          style={{ width: `${Math.max(s.count === 0 ? 0 : 4, (s.count / maxStatus) * 100)}%` }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right font-medium">{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Theo kenh */}
          <div>
            <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Tiến độ theo kênh</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {d.channels.map((c) => (
                <ChannelCard key={c.key} channel={c} />
              ))}
            </div>
          </div>

          {/* Chi phi mini + he thong */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card title="Chi phí AI theo ngày">
                {d.cost.daily.length === 0 ? (
                  <p className="text-sm text-zinc-500">Chưa có dữ liệu chi phí.</p>
                ) : (
                  <div className="flex items-end gap-1" style={{ height: 80 }}>
                    {d.cost.daily.map((row) => (
                      <div
                        key={row.date}
                        title={`${row.date}: ${usd(row.costUsd)}`}
                        className="flex-1 rounded-t bg-indigo-500/60 hover:bg-indigo-500"
                        style={{ height: `${Math.max(3, (row.costUsd / maxDailyCost) * 100)}%` }}
                      />
                    ))}
                  </div>
                )}
                <div className="mt-2 flex justify-between text-xs text-zinc-400">
                  <span>{d.cost.from}</span>
                  <a href="/usage" className="text-indigo-600 hover:underline dark:text-indigo-400">
                    Xem chi tiết →
                  </a>
                  <span>{d.cost.to}</span>
                </div>
              </Card>
            </div>
            <Card title="Hệ thống">
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> API hoạt động
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Database: {d.system.database}
                </div>
                <div className="text-zinc-500">Tổng lượt gọi AI (30N): {num(d.cost.calls)}</div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, tone, href }: { label: string; value: string; tone: BadgeTone; href?: string }) {
  const ring: Record<BadgeTone, string> = {
    amber: "border-amber-200 dark:border-amber-500/30",
    emerald: "border-emerald-200 dark:border-emerald-500/30",
    indigo: "border-indigo-200 dark:border-indigo-500/30",
    gray: "border-zinc-200 dark:border-zinc-800",
    blue: "border-blue-200 dark:border-blue-500/30",
    red: "border-red-200 dark:border-red-500/30",
  };
  const inner = (
    <div className={`rounded-lg border p-4 ${ring[tone]} ${href ? "transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900" : ""}`}>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
  return href ? <a href={href}>{inner}</a> : inner;
}

function ChannelCard({ channel }: { channel: DashboardSummaryResponse["channels"][number] }) {
  const total = Math.max(1, channel.total);
  return (
    <a
      href={channel.href}
      className="block rounded-lg border border-zinc-200 p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
    >
      <div className="flex items-baseline justify-between">
        <span className="font-medium">{channel.label}</span>
        <span className="text-sm text-zinc-500">{num(channel.total)} bài</span>
      </div>
      {/* Thanh xep chong ti le trang thai */}
      <div className="mt-3 flex h-2 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-900">
        {channel.states.map((s) =>
          s.count > 0 ? (
            <div
              key={s.key}
              className={BAR_BG[STATE_TONE[s.key] ?? "gray"]}
              style={{ width: `${(s.count / total) * 100}%` }}
              title={`${s.label}: ${s.count}`}
            />
          ) : null,
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
        {channel.states.map((s) => (
          <span key={s.key}>
            {s.label}: <span className="font-medium text-zinc-700 dark:text-zinc-300">{s.count}</span>
          </span>
        ))}
      </div>
    </a>
  );
}

const BAR_BG: Record<BadgeTone, string> = {
  gray: "bg-zinc-400",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  indigo: "bg-indigo-500",
  emerald: "bg-emerald-500",
  red: "bg-red-500",
};
