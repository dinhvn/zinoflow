"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod/v4";
import { externalReviewUrlItemSchema, type ExternalReviewUrlItem } from "@zinoflow/contracts";
import { apiSend, ApiError } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

interface Row {
  label: string;
  url: string;
}

function toRows(items: readonly ExternalReviewUrlItem[]): Row[] {
  return items.map((i) => ({ label: i.label, url: i.url }));
}

/**
 * Sua link "Xem thêm trên" (Google Maps/TripAdvisor...) — nhap tay hoan toan,
 * website render rel="nofollow" (destination-spec §2.2 khoi #10/#15, Phase 28.0).
 */
export function DestinationExternalReviewUrlsEditor({
  slug,
  externalReviewUrls,
  onSaved,
}: {
  slug: string;
  externalReviewUrls: ExternalReviewUrlItem[];
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(toRows(externalReviewUrls));
  const [error, setError] = useState<{ message: string; details: string[] } | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        externalReviewUrls: rows
          .filter((r) => r.label.trim() && r.url.trim())
          .map((r) => ({ label: r.label.trim(), url: r.url.trim() })),
      };
      return z
        .array(externalReviewUrlItemSchema)
        .parse(await apiSend("POST", `/destinations/${slug}/external-review-urls`, body));
    },
    onSuccess: (saved) => {
      setError(null);
      setRows(toRows(saved));
      onSaved();
    },
    onError: (e) =>
      setError(
        e instanceof ApiError
          ? { message: e.message, details: e.details }
          : { message: String(e), details: [] },
      ),
  });

  const update = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        Link Google Maps/TripAdvisor... nhập tay — website gắn rel=&quot;nofollow&quot;.
      </p>
      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <p className="font-medium">{error.message}</p>
        </div>
      )}

      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="rounded border border-zinc-300 p-2 dark:border-zinc-700">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_2fr]">
              <Input
                value={row.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="Nhãn (vd: Google Maps)"
              />
              <Input
                value={row.url}
                onChange={(e) => update(i, { url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                className="px-2 py-1 text-xs"
                onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
              >
                Xoá
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          className="px-2 py-1 text-xs"
          onClick={() => setRows((prev) => [...prev, { label: "", url: "" }])}
        >
          + Thêm dòng
        </Button>
        <Button variant="primary" size="sm" loading={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Đang lưu..." : "Lưu link"}
        </Button>
      </div>
    </div>
  );
}
