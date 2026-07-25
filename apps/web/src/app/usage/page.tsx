"use client";

import { useState } from "react";
import { AiUsageDashboard } from "@/features/usage/ai-usage-dashboard";
import { AiUsageHistory } from "@/features/usage/ai-usage-history";

const TABS = [
  { id: "summary", label: "Tổng hợp" },
  { id: "history", label: "Lịch sử" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function UsagePage() {
  const [tab, setTab] = useState<TabId>("summary");

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Chi phí AI</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Tổng hợp token + chi phí mỗi lần gọi AI (ai_usage_logs), hoặc xem lại từng lượt gọi kèm
          prompt/response đầy đủ.
        </p>
      </div>

      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium ${
              tab === t.id
                ? "border-b-2 border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "summary" ? <AiUsageDashboard /> : <AiUsageHistory />}
    </div>
  );
}
