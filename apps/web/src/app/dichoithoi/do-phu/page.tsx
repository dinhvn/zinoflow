"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listCoverageScoresResponseSchema, type DestinationCoverageScore } from "@zinoflow/contracts";
import { apiGet } from "@/shared/api-client";
import { Badge, ErrorBox } from "@/shared/ui";
import type { BadgeTone } from "@/shared/ui";

function toneForScore(score: number): BadgeTone {
  if (score >= 80) return "emerald";
  if (score >= 50) return "amber";
  return "red";
}

/**
 * Man "Độ phủ nội dung" (destination-spec §2.2.2) — chi hien NOI BO, khong
 * phoi ra website. Diem thap hien truoc de uu tien bo sung.
 */
export default function DoPhuPage() {
  const query = useQuery({
    queryKey: ["coverage-scores"],
    queryFn: () => apiGet("/destinations/coverage-scores", listCoverageScoresResponseSchema),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Độ phủ nội dung</h2>
        <p className="text-sm text-zinc-500">
          Tự tính từ dữ liệu đã có (không AI, không nhập tay) — điểm nào &quot;mỏng&quot; và
          thiếu đúng mục gì để bổ sung. Điểm thấp hiện trước.
        </p>
      </div>

      {query.isLoading && <p className="text-sm text-zinc-500">Đang tải...</p>}
      {query.isError && <ErrorBox error={query.error} fallback="Lỗi tải độ phủ nội dung" />}

      {query.data && (
        <div className="divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {query.data.items.map((item) => (
            <CoverageRow key={item.destinationSlug} item={item} />
          ))}
          {query.data.items.length === 0 && (
            <p className="p-3 text-sm text-zinc-500">Chưa có điểm đến nào published.</p>
          )}
        </div>
      )}
    </div>
  );
}

function CoverageRow({ item }: { item: DestinationCoverageScore }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="p-3">
      <button
        type="button"
        className="flex w-full flex-wrap items-center gap-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <Badge tone={toneForScore(item.scorePercent)}>{item.scorePercent}%</Badge>
        <span className="text-sm font-medium">{item.destinationName}</span>
        <Badge tone="gray">{item.tier === "flagship" ? "Flagship" : "POI"}</Badge>
        <span className="ml-auto text-xs text-zinc-400">{expanded ? "Thu gọn ▲" : "Xem chi tiết ▼"}</span>
      </button>
      {expanded && (
        <ul className="mt-2 grid grid-cols-1 gap-1 pl-1 text-xs sm:grid-cols-2">
          {item.items.map((i) => (
            <li key={i.key} className={i.done ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400"}>
              {i.done ? "✅" : "⚠️"} {i.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
