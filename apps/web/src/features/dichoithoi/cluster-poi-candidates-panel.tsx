"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getClusterPoiCandidatesResponseSchema,
  previewClusterPoiPromptResponseSchema,
  type ClusterPoiCandidateItem,
  type ClusterPoiCandidateMatchType,
  type PreviewClusterPoiPromptResponse,
} from "@zinoflow/contracts";
import { apiGet, apiSend, ApiError } from "@/shared/api-client";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { ErrorBox } from "@/shared/ui/error-box";
import { Modal } from "@/shared/ui/modal";
import { Textarea } from "@/shared/ui/textarea";

const MATCH_TYPE_BADGE: Record<ClusterPoiCandidateMatchType, { label: string; tone: "emerald" | "amber" | "gray" }> = {
  new: { label: "Mới", tone: "emerald" },
  "orphan-match": { label: "Có thể trùng điểm chưa gán cụm → gán lại", tone: "amber" },
  "existing-in-cluster": { label: "Đã có trong cụm — bỏ qua", tone: "gray" },
};

/**
 * Tim diem con (POI) trong 1 cum DA CO SAN bang Gemini + Google Search Grounding
 * (dichoithoi-cluster-poi-discovery-plan.md) — chi hien cho Kind=cluster. Ket qua
 * hien bang duyet, Chap nhan roi moi ghi DB that (tab "🔗 Quan hệ" tu cap nhat).
 */
export function ClusterPoiCandidatesPanel({
  clusterSlug,
  onAccepted,
}: {
  clusterSlug: string;
  onAccepted: () => void;
}) {
  const queryClient = useQueryClient();
  const [extraNotes, setExtraNotes] = useState("");
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [previewData, setPreviewData] = useState<PreviewClusterPoiPromptResponse | null>(null);
  const [error, setError] = useState<unknown>(null);

  const queryKey = ["cluster-poi-candidates", clusterSlug];
  const candidateQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await apiGet(
        `/destinations/${clusterSlug}/cluster-poi-candidates`,
        getClusterPoiCandidatesResponseSchema,
      );
      return res.candidate;
    },
  });
  const candidates = candidateQuery.data?.candidates ?? [];

  const preview = useMutation({
    mutationFn: async () =>
      previewClusterPoiPromptResponseSchema.parse(
        await apiSend("POST", `/destinations/${clusterSlug}/cluster-poi-candidates/preview`, {
          extraNotes: extraNotes.trim() || null,
        }),
      ),
    onSuccess: (data) => setPreviewData(data),
    onError: (e) => setError(e),
  });

  const find = useMutation({
    mutationFn: () =>
      apiSend("POST", `/destinations/${clusterSlug}/cluster-poi-candidates`, {
        extraNotes: extraNotes.trim() || null,
      }),
    onSuccess: () => {
      setError(null);
      setChecked(new Set());
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (e) => setError(e),
  });

  const accept = useMutation({
    mutationFn: (acceptedIndexes: number[]) =>
      apiSend("POST", `/destinations/${clusterSlug}/cluster-poi-candidates/accept`, { acceptedIndexes }),
    onSuccess: () => {
      setError(null);
      setChecked(new Set());
      void queryClient.invalidateQueries({ queryKey });
      onAccepted();
    },
    onError: (e) => setError(e),
  });

  function toggle(i: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  if (candidateQuery.isLoading) {
    return <p className="text-sm text-zinc-500">Đang tải...</p>;
  }

  return (
    <div className="space-y-3">
      <div className="rounded bg-zinc-50 p-3 text-xs text-zinc-500 dark:bg-zinc-900">
        <p>
          Gemini + Google Search Grounding tự quét toàn bộ điểm tham quan thuộc cụm này (kể cả hidden
          gems), phân loại độ ưu tiên 1-5 — KHÔNG tự ghi DB, chỉ hiện bảng bên dưới để bạn duyệt từng
          dòng. Dòng đánh dấu &quot;có thể trùng&quot; nên tự kiểm tra kỹ trước khi tick.
        </p>
      </div>

      {error !== null && <ErrorBox error={error instanceof ApiError ? error : new ApiError(0, String(error), [])} />}
      {candidateQuery.isError && <ErrorBox error={candidateQuery.error} />}

      <Textarea
        placeholder="Mô tả bổ sung cho AI (không bắt buộc) — ví dụ phạm vi cụ thể, lưu ý ưu tiên loại điểm nào..."
        rows={2}
        value={extraNotes}
        onChange={(e) => setExtraNotes(e.target.value)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" loading={preview.isPending} onClick={() => preview.mutate()}>
          👁️ Xem trước prompt
        </Button>
        <Button size="sm" loading={find.isPending} onClick={() => find.mutate()}>
          {find.isPending ? "Đang tìm..." : "🔎 Tìm điểm con bằng AI"}
        </Button>
      </div>

      {previewData && <PreviewModal data={previewData} onClose={() => setPreviewData(null)} />}

      {candidates.length > 0 && (
        <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
              <tr>
                <th className="p-2 text-center">Chọn</th>
                <th className="p-2">Tên</th>
                <th className="p-2">Ưu tiên</th>
                <th className="p-2">Mô tả</th>
                <th className="p-2">Địa chỉ</th>
                <th className="p-2">Trạng thái khớp</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c: ClusterPoiCandidateItem, i) => {
                const badge = MATCH_TYPE_BADGE[c.matchType];
                const actionable = c.matchType !== "existing-in-cluster" && c.status === "pending";
                return (
                  <tr key={i} className="border-t border-zinc-200 align-top dark:border-zinc-800">
                    <td className="p-2 text-center">
                      {actionable ? (
                        <Checkbox label="" checked={checked.has(i)} onChange={() => toggle(i)} />
                      ) : (
                        c.status !== "pending" && (
                          <Badge tone={c.status === "accepted" ? "emerald" : "gray"}>
                            {c.status === "accepted" ? "Đã chấp nhận" : "Đã bỏ qua"}
                          </Badge>
                        )
                      )}
                    </td>
                    <td className="p-2 font-medium">{c.name}</td>
                    <td className="p-2">{c.priorityLevel}</td>
                    <td className="max-w-xs p-2 text-zinc-500">{c.shortDescription ?? "—"}</td>
                    <td className="p-2 text-zinc-500">{c.address ?? "—"}</td>
                    <td className="p-2">
                      <div className="flex flex-col gap-1">
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                        {c.matchedName && (
                          <span className="text-xs text-zinc-500">Khớp với: {c.matchedName}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {candidates.length > 0 && (
        <Button
          variant="primary"
          size="sm"
          loading={accept.isPending}
          disabled={checked.size === 0}
          onClick={() => accept.mutate([...checked])}
        >
          {accept.isPending ? "Đang ghi..." : `Chấp nhận ${checked.size} mục đã tick`}
        </Button>
      )}
    </div>
  );
}

function PreviewModal({
  data,
  onClose,
}: {
  data: PreviewClusterPoiPromptResponse;
  onClose: () => void;
}) {
  return (
    <Modal open onClose={onClose} title="👁️ Xem trước prompt gửi AI" width="max-w-3xl">
      <div className="space-y-3">
        <div className="rounded border border-zinc-200 bg-zinc-50 p-2 text-xs dark:border-zinc-800 dark:bg-zinc-900">
          <p>
            Model: <strong>{data.config.model}</strong> · Google Search Grounding:{" "}
            <strong>{data.config.useGoogleSearch ? "BẬT" : "TẮT"}</strong> · Temperature:{" "}
            <strong>{data.config.temperature}</strong>
          </p>
        </div>
        <details open className="rounded border border-zinc-200 dark:border-zinc-800">
          <summary className="cursor-pointer select-none bg-zinc-50 px-3 py-2 text-sm font-medium dark:bg-zinc-900">
            Prompt gửi AI (cụm + ghi chú bổ sung)
          </summary>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300">
            {data.userPrompt}
          </pre>
        </details>
        <details className="rounded border border-zinc-200 dark:border-zinc-800">
          <summary className="cursor-pointer select-none bg-zinc-50 px-3 py-2 text-sm font-medium dark:bg-zinc-900">
            System prompt
          </summary>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300">
            {data.systemPrompt}
          </pre>
        </details>
        <Button variant="secondary" onClick={onClose}>
          Đóng
        </Button>
      </div>
    </Modal>
  );
}
