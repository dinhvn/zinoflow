"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod/v4";
import { hotelSchema } from "@zinoflow/contracts";
import { apiGet, apiSend, ApiError } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { Select } from "@/shared/ui/select";

/** Panel "Khách sạn gợi ý" tren trang chi tiet diem den (hotel-spec §6) */
export function DestinationHotelPanel({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const [selectedHotelId, setSelectedHotelId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const assignedQuery = useQuery({
    queryKey: ["hotels-by-destination", slug],
    queryFn: () => apiGet(`/hotels/by-destination/${slug}`, z.array(hotelSchema)),
  });
  const allHotelsQuery = useQuery({
    queryKey: ["hotels"],
    queryFn: () => apiGet("/hotels", z.array(hotelSchema)),
  });

  const assign = useMutation({
    mutationFn: (hotelId: string) =>
      apiSend("POST", `/hotels/${hotelId}/assign`, { destinationSlug: slug }),
    onSuccess: () => {
      setError(null);
      setSelectedHotelId("");
      queryClient.invalidateQueries({ queryKey: ["hotels-by-destination", slug] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : String(e)),
  });

  const unassign = useMutation({
    mutationFn: (hotelId: string) => apiSend("DELETE", `/hotels/${hotelId}/assign/${slug}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hotels-by-destination", slug] }),
  });

  const assignedIds = new Set(assignedQuery.data?.map((h) => h.id));
  const candidates = (allHotelsQuery.data ?? []).filter((h) => !assignedIds.has(h.id));

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="space-y-2">
        {assignedQuery.data?.map((h) => (
          <div
            key={h.id}
            className="flex items-center justify-between rounded border border-zinc-300 p-2 text-sm dark:border-zinc-700"
          >
            <span>
              {h.name} — giá từ {h.priceFrom ?? "—"}, rating {h.rating ?? "—"}
            </span>
            <Button
              size="sm"
              variant="ghost"
              loading={unassign.isPending}
              onClick={() => unassign.mutate(h.id)}
            >
              Gỡ
            </Button>
          </div>
        ))}
        {assignedQuery.data?.length === 0 && (
          <p className="text-sm text-zinc-500">Chưa có khách sạn nào gợi ý cho điểm này.</p>
        )}
      </div>
      <div className="flex gap-2">
        <Select value={selectedHotelId} onChange={(e) => setSelectedHotelId(e.target.value)}>
          <option value="">— Chọn khách sạn để thêm —</option>
          {candidates.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </Select>
        <Button
          disabled={!selectedHotelId}
          loading={assign.isPending}
          onClick={() => selectedHotelId && assign.mutate(selectedHotelId)}
        >
          Thêm
        </Button>
      </div>
    </div>
  );
}
