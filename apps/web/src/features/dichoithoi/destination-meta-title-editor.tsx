"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod/v4";
import { DESTINATION_FIELD_LIMITS } from "@zinoflow/contracts";
import { apiSend, ApiError } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

/**
 * Sua metaTitle thu cong tu trang chi tiet — them cach cho bulk-edit CSV
 * (xem ExportDestinationsModal/ImportDestinationFieldsModal). KHAC voi
 * metadata.metaTitle trong editor bai viet (AI soan) — o day ghi thang len
 * site, se bi ghi de neu publish lai bai AI cho diem nay.
 */
export function DestinationMetaTitleEditor({
  slug,
  metaTitle,
  onSaved,
}: {
  slug: string;
  metaTitle: string | null;
  onSaved: () => void;
}) {
  const [text, setText] = useState(metaTitle ?? "");
  const [error, setError] = useState<{ message: string; details: string[] } | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const body = { metaTitle: text.trim() || null };
      return z
        .string()
        .nullable()
        .parse(await apiSend("POST", `/destinations/${slug}/meta-title`, body));
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
        Ghi thẳng thẻ <code>&lt;title&gt;</code> lên web, không đi qua bản nháp bài viết AI — nếu
        sau này bấm &quot;Viết lại / cập nhật bài&quot; rồi publish, giá trị này sẽ bị ghi đè bằng
        metaTitle trong bài AI.
      </p>
      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <p className="font-medium">{error.message}</p>
        </div>
      )}

      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={DESTINATION_FIELD_LIMITS.metaTitle}
        placeholder="VD: Đồi Cù Đà Lạt: Giá vé, giờ mở cửa & kinh nghiệm check-in"
        className="w-full"
      />
      <p className="text-right text-xs text-zinc-400">
        {text.length}/{DESTINATION_FIELD_LIMITS.metaTitle}
      </p>

      <Button variant="primary" size="sm" loading={save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? "Đang lưu..." : "Lưu meta title"}
      </Button>
    </div>
  );
}
