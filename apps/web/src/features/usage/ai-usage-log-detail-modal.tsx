"use client";

import type { AiUsageLogRow } from "@zinoflow/contracts";
import { usd } from "@/shared/format-usage";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import { Modal } from "@/shared/ui/modal";

const VIA_LABEL: Record<string, string> = { sync: "Đơn lẻ", batch: "Batch AI" };
const VIA_TONE: Record<string, BadgeTone> = { sync: "gray", batch: "blue" };

/**
 * Xem lại đầy đủ prompt/response đã gửi/nhận cho 1 lượt gọi AI — dùng chung
 * cho tab "Lịch sử" ở /usage và nút "Xem đã gửi/nhận" trong dialog chi tiết
 * batch ở /ai-batches (bấm vào 1 item batch mở đúng dòng log này, yêu cầu
 * người dùng 08/2026).
 */
export function AiUsageLogDetailModal({ log, onClose }: { log: AiUsageLogRow; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title={`${log.provider} · ${log.model} · ${log.operation}`}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-500 sm:grid-cols-4">
          <span>Thời gian: {new Date(log.createdAt).toLocaleString("vi-VN")}</span>
          <span>
            Nguồn: <Badge tone={VIA_TONE[log.via] ?? "gray"}>{VIA_LABEL[log.via] ?? log.via}</Badge>
          </span>
          <span>
            Token: {log.inputTokens.toLocaleString("vi-VN")} vào / {log.outputTokens.toLocaleString("vi-VN")} ra
            (chi phí {usd(log.costUsd)})
          </span>
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
