"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listGeocodeCandidatesResponseSchema,
  type DestinationGeocodeCandidateRecord,
} from "@zinoflow/contracts";
import { apiGet, apiSend, ApiError } from "@/shared/api-client";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { ErrorBox } from "@/shared/ui/error-box";
import { Modal } from "@/shared/ui/modal";

/**
 * Bang duyet hang loat ket qua tim toa do qua Google Places (Giai doan 1b,
 * dichoithoi-destination-geocode-audit-plan.md) — hien danh sach dong staging
 * con "pending" (moi dong 1 diem den, toi da 5 ung vien). Ten/dia chi hien
 * trong bang la nhan TAI THOI DIEM TIM (co the khong con dung 100%) — luc
 * bam "Chap nhan" he thong tu goi lai Google Places de lay ban tuoi truoc
 * khi ghi that vao destination (khong bao gio ghi thang du lieu cu trong bang).
 */
export function GeocodeCandidatesPanel({
  open,
  onClose,
  onAccepted,
}: {
  open: boolean;
  onClose: () => void;
  onAccepted: () => void;
}) {
  const queryClient = useQueryClient();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [selectedPlaceId, setSelectedPlaceId] = useState<Record<string, string>>({});

  const queryKey = ["geocode-candidates"];
  const query = useQuery({
    queryKey,
    enabled: open,
    queryFn: () => apiGet("/destinations/geocode-candidates", listGeocodeCandidatesResponseSchema),
  });
  const records = query.data?.records ?? [];

  function pickedPlaceId(r: DestinationGeocodeCandidateRecord): string | undefined {
    return selectedPlaceId[r.destinationSlug] ?? r.candidates[0]?.placeId;
  }

  function toggle(slug: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  const allChecked = records.length > 0 && records.every((r) => checked.has(r.destinationSlug));
  function toggleAll() {
    setChecked(allChecked ? new Set() : new Set(records.map((r) => r.destinationSlug)));
  }

  const accept = useMutation({
    mutationFn: () =>
      apiSend("POST", "/destinations/geocode-candidates/accept", {
        selections: records
          .filter((r) => checked.has(r.destinationSlug))
          .map((r) => ({ destinationSlug: r.destinationSlug, placeId: pickedPlaceId(r)! })),
      }),
    onSuccess: () => {
      setChecked(new Set());
      void queryClient.invalidateQueries({ queryKey });
      onAccepted();
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={`Duyệt kết quả tìm toạ độ (${records.length})`} width="max-w-5xl">
      <div className="space-y-3">
        <div className="rounded bg-zinc-50 p-3 text-xs text-zinc-500 dark:bg-zinc-900">
          <p>
            Tên/khoảng cách hiển thị dưới đây là nhãn TẠI THỜI ĐIỂM tìm (có thể không còn đúng 100%)
            — khi bấm "Chấp nhận", hệ thống tự gọi lại Google Places để lấy bản mới nhất trước khi
            ghi vào điểm đến, không bao giờ ghi thẳng dữ liệu cũ trong bảng này.
          </p>
        </div>

        {query.isError && <ErrorBox error={query.error} />}
        {accept.isError && (
          <ErrorBox error={accept.error instanceof ApiError ? accept.error : new ApiError(0, String(accept.error), [])} />
        )}
        {query.isLoading && <p className="text-sm text-zinc-500">Đang tải...</p>}
        {!query.isLoading && records.length === 0 && (
          <p className="text-sm text-zinc-500">Không có kết quả nào đang chờ duyệt.</p>
        )}

        {records.length > 0 && (
          <>
            <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
                  <tr>
                    <th className="p-2 text-center">
                      <Checkbox label="" checked={allChecked} onChange={toggleAll} />
                    </th>
                    <th className="p-2">Điểm đến (slug)</th>
                    <th className="p-2">Ứng viên</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.destinationSlug} className="border-t border-zinc-200 align-top dark:border-zinc-800">
                      <td className="p-2 text-center">
                        <Checkbox label="" checked={checked.has(r.destinationSlug)} onChange={() => toggle(r.destinationSlug)} />
                      </td>
                      <td className="p-2 font-mono text-xs">{r.destinationSlug}</td>
                      <td className="p-2">
                        <div className="space-y-1">
                          {r.candidates.map((c) => (
                            <label key={c.placeId} className="flex items-center gap-2 text-xs">
                              <input
                                type="radio"
                                name={`candidate-${r.destinationSlug}`}
                                checked={pickedPlaceId(r) === c.placeId}
                                onChange={() =>
                                  setSelectedPlaceId((prev) => ({ ...prev, [r.destinationSlug]: c.placeId }))
                                }
                              />
                              <span>{c.displayNameAtDiscovery}</span>
                              <Badge tone={c.confidenceScore >= 0.7 ? "emerald" : c.confidenceScore >= 0.4 ? "amber" : "gray"}>
                                {Math.round(c.confidenceScore * 100)}%
                              </Badge>
                              {c.distanceToParentMetersAtDiscovery !== null && (
                                <span className="text-zinc-400">
                                  {(c.distanceToParentMetersAtDiscovery / 1000).toFixed(1)}km
                                </span>
                              )}
                            </label>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                loading={accept.isPending}
                disabled={checked.size === 0}
                onClick={() => accept.mutate()}
              >
                {accept.isPending ? "Đang ghi..." : `Chấp nhận ${checked.size} mục đã tick`}
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Đóng
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
