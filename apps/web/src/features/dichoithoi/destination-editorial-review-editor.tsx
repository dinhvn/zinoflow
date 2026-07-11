"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod/v4";
import { suggestEditorialReviewResponseSchema } from "@zinoflow/contracts";
import { apiGet, apiSend, ApiError } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";

/**
 * Sua "Đánh giá biên tập" — nhận định ngắn của đội biên tập về điểm đến
 * (KHÔNG phải AggregateRating chấm điểm khách hàng — content-seo-ux-plan
 * §10.6.2, Phase 28.0). AI chỉ gợi ý qua nút "Gợi ý", KHÔNG bao giờ tự lưu —
 * người dùng bắt buộc xem/sửa trước khi bấm Lưu.
 */
export function DestinationEditorialReviewEditor({
  slug,
  editorialReview,
  onSaved,
}: {
  slug: string;
  editorialReview: string | null;
  onSaved: () => void;
}) {
  const [text, setText] = useState(editorialReview ?? "");
  const [error, setError] = useState<{ message: string; details: string[] } | null>(null);

  const suggest = useMutation({
    mutationFn: async () =>
      apiGet(`/destinations/${slug}/editorial-review/suggest`, suggestEditorialReviewResponseSchema),
    onSuccess: (result) => {
      setError(null);
      setText(result.suggestion);
    },
    onError: (e) =>
      setError(
        e instanceof ApiError
          ? { message: e.message, details: e.details }
          : { message: String(e), details: [] },
      ),
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = { editorialReview: text.trim() || null };
      return z
        .string()
        .nullable()
        .parse(await apiSend("POST", `/destinations/${slug}/editorial-review`, body));
    },
    onSuccess: (saved) => {
      setError(null);
      setText(saved ?? "");
      onSaved();
    },
    onError: (e) =>
      setError(
        e instanceof ApiError
          ? { message: e.message, details: e.details }
          : { message: String(e), details: [] },
      ),
  });

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        Nút &quot;Gợi ý&quot; chỉ tạo bản nháp dựa trên nội dung đã có — bắt buộc bạn xem/sửa trước
        khi bấm Lưu. Đây là nhận định của đội biên tập, không phải điểm đánh giá của khách.
      </p>
      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <p className="font-medium">{error.message}</p>
        </div>
      )}

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        maxLength={500}
        placeholder="Nhận định ngắn của đội biên tập về điểm đến này..."
        className="w-full"
      />

      <div className="flex gap-2">
        <Button size="sm" loading={suggest.isPending} onClick={() => suggest.mutate()}>
          {suggest.isPending ? "Đang gợi ý..." : "Gợi ý (chưa lưu)"}
        </Button>
        <Button variant="primary" size="sm" loading={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Đang lưu..." : "Lưu đánh giá biên tập"}
        </Button>
      </div>
    </div>
  );
}
