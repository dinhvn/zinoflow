"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod/v4";
import { tourSchema } from "@zinoflow/contracts";
import { apiGet, apiSend, ApiError } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { Select } from "@/shared/ui/select";

/** Panel "Tour gợi ý" tren trang chi tiet diem den (tour-spec §6) */
export function DestinationTourPanel({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const [selectedTourId, setSelectedTourId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const assignedQuery = useQuery({
    queryKey: ["tours-by-destination", slug],
    queryFn: () => apiGet(`/tours/by-destination/${slug}`, z.array(tourSchema)),
  });
  const allToursQuery = useQuery({
    queryKey: ["tours"],
    queryFn: () => apiGet("/tours", z.array(tourSchema)),
  });

  const assign = useMutation({
    mutationFn: (tourId: string) =>
      apiSend("POST", `/tours/${tourId}/assign`, { destinationSlug: slug }),
    onSuccess: () => {
      setError(null);
      setSelectedTourId("");
      queryClient.invalidateQueries({ queryKey: ["tours-by-destination", slug] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : String(e)),
  });

  const unassign = useMutation({
    mutationFn: (tourId: string) => apiSend("DELETE", `/tours/${tourId}/assign/${slug}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tours-by-destination", slug] }),
  });

  const assignedIds = new Set(assignedQuery.data?.map((t) => t.id));
  const candidates = (allToursQuery.data ?? []).filter((t) => !assignedIds.has(t.id));

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="space-y-2">
        {assignedQuery.data?.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded border border-zinc-300 p-2 text-sm dark:border-zinc-700"
          >
            <span>
              {t.name} — {t.durationDays ?? "—"}N{t.durationNights ?? "—"}Đ, giá từ{" "}
              {t.priceFrom ?? "—"}
            </span>
            <Button
              size="sm"
              variant="ghost"
              loading={unassign.isPending}
              onClick={() => unassign.mutate(t.id)}
            >
              Gỡ
            </Button>
          </div>
        ))}
        {assignedQuery.data?.length === 0 && (
          <p className="text-sm text-zinc-500">Chưa có tour nào gợi ý cho điểm này.</p>
        )}
      </div>
      <div className="flex gap-2">
        <Select value={selectedTourId} onChange={(e) => setSelectedTourId(e.target.value)}>
          <option value="">— Chọn tour để thêm —</option>
          {candidates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Button
          disabled={!selectedTourId}
          loading={assign.isPending}
          onClick={() => selectedTourId && assign.mutate(selectedTourId)}
        >
          Thêm
        </Button>
      </div>
    </div>
  );
}
