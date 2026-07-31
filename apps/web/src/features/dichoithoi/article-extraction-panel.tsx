"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listArticleAiExtractionsResponseSchema,
  type ArticleAiExtractionSource,
} from "@zinoflow/contracts";
import { apiGet, apiSend } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";

const SOURCE_LABELS: Record<ArticleAiExtractionSource, string> = {
  "claude-skill": "Claude Code (thủ công)",
  "gemini-gsg": "Google Search Grounding (tự động)",
};

/**
 * Trich xuat thong tin nguon TRUOC khi AI viet bai cam nang
 * (article-ai-extraction-plan.md GĐ2-GĐ4) — CHI hien khi job dang "Created"
 * (chua tu queue generate luc tao, xem create-content-job.usecase.ts).
 * 2 nguon trich xuat (skill Claude Code / Google Search Grounding) chi ghi
 * vao bang staging, nguoi dung tu doc/sua roi bam "Lưu vào ngữ cảnh nguồn"
 * (PATCH sourceContext) truoc khi bam "Bắt đầu sinh nội dung" (POST retry).
 */
export function ArticleExtractionPanel({
  jobId,
  currentSourceContext,
  referenceUrls,
}: {
  jobId: string;
  currentSourceContext: string | null;
  referenceUrls: string[] | null;
}) {
  const queryClient = useQueryClient();
  const [sourceContext, setSourceContext] = useState(currentSourceContext ?? "");
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const extractionQuery = useQuery({
    queryKey: ["article-ai-extraction", jobId],
    queryFn: () =>
      apiGet(`/articles/${jobId}/ai-extraction`, listArticleAiExtractionsResponseSchema),
  });

  const runGsg = useMutation({
    mutationFn: () => apiSend("POST", `/articles/${jobId}/ai-extraction/gsg`, {}),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["article-ai-extraction", jobId] }),
  });

  const saveSourceContext = useMutation({
    mutationFn: () =>
      apiSend("PATCH", `/content/jobs/${jobId}`, {
        sourceContext: sourceContext.trim() || null,
      }),
    onSuccess: () => {
      setSavedAt(Date.now());
      queryClient.invalidateQueries({ queryKey: ["content-job", jobId] });
    },
  });

  const startGenerate = useMutation({
    mutationFn: () => apiSend("POST", `/content/jobs/${jobId}/retry`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["content-job", jobId] }),
  });

  function fillFromExtractions() {
    const items = extractionQuery.data?.items ?? [];
    const merged = items
      .map((i) => `[${SOURCE_LABELS[i.source]}]\n${i.extractedSummary}`)
      .join("\n\n");
    setSourceContext((prev) => (prev.trim() ? `${prev}\n\n${merged}` : merged));
  }

  return (
    <div className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="mb-2 font-medium">Trích xuất thông tin nguồn (trước khi sinh nội dung)</h3>
      <p className="mb-3 text-sm text-zinc-500">
        Đọc website tham khảo để AI viết bám sát thực tế, không bịa. Có 2 cách: nhờ Claude Code
        chạy skill <code>dichoithoi-extract-article-info</code>, hoặc bấm nút bên dưới để tự động
        qua Google Search Grounding. Cả 2 đều chỉ ghi vào danh sách bên dưới — bạn đọc/sửa rồi tự
        lưu vào ngữ cảnh nguồn.
      </p>

      {referenceUrls && referenceUrls.length > 0 && (
        <div className="mb-3 text-xs text-zinc-500">
          Website tham khảo:{" "}
          {referenceUrls.map((u, i) => (
            <a
              key={i}
              href={u}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-blue-600 hover:underline dark:text-blue-400"
            >
              {u}
            </a>
          ))}
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          loading={runGsg.isPending}
          onClick={() => runGsg.mutate()}
        >
          {runGsg.isPending ? "Đang chạy..." : "🔍 Chạy Google Search Grounding"}
        </Button>
        {(extractionQuery.data?.items.length ?? 0) > 0 && (
          <Button size="sm" variant="secondary" onClick={fillFromExtractions}>
            Điền từ kết quả trích xuất vào ô bên dưới
          </Button>
        )}
      </div>

      {extractionQuery.data && extractionQuery.data.items.length > 0 && (
        <div className="mb-3 space-y-2">
          {extractionQuery.data.items.map((item) => (
            <div
              key={item.source}
              className="rounded border border-zinc-200 p-2 text-xs dark:border-zinc-800"
            >
              <div className="mb-1 font-medium text-zinc-700 dark:text-zinc-300">
                {SOURCE_LABELS[item.source]} — {new Date(item.extractedAt).toLocaleString("vi-VN")}
              </div>
              <p className="whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">
                {item.extractedSummary}
              </p>
            </div>
          ))}
        </div>
      )}

      <label className="mb-2 block text-sm">
        <span className="mb-1 block text-zinc-500">
          Ngữ cảnh nguồn (sourceContext) — AI CHỈ dùng thông tin trong đây, không tự bịa thêm
        </span>
        <Textarea
          value={sourceContext}
          onChange={(e) => setSourceContext(e.target.value)}
          rows={8}
          className="w-full"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant="secondary"
          loading={saveSourceContext.isPending}
          onClick={() => saveSourceContext.mutate()}
        >
          {saveSourceContext.isPending ? "Đang lưu..." : "Lưu vào ngữ cảnh nguồn"}
        </Button>
        {savedAt && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">Đã lưu</span>
        )}
        <Button variant="primary" loading={startGenerate.isPending} onClick={() => startGenerate.mutate()}>
          {startGenerate.isPending ? "Đang bắt đầu..." : "🚀 Bắt đầu sinh nội dung"}
        </Button>
      </div>
    </div>
  );
}
