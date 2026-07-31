"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listDestinationsResponseSchema,
  transportSchema,
  type Transport,
  type TransportStop,
} from "@zinoflow/contracts";
import { z } from "zod/v4";
import { apiGet, apiSend, ApiError } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import { PageHeader } from "@/shared/ui/page-header";
import { FeatureIntro } from "@/shared/ui";
import { AffiliateUrlPreview } from "@/features/dichoithoi/affiliate-url-preview";
import { ImportTransportsModal } from "@/features/dichoithoi/import-transports-modal";

const LINK_STATUS_LABEL: Record<Transport["linkStatus"], string> = {
  converted: "Đã áp rule",
  "no-rule": "Chưa có rule khớp",
  "manual-override": "Sửa tay",
  "no-link": "Chỉ có SĐT",
};

const LINK_STATUS_TONE: Record<Transport["linkStatus"], BadgeTone> = {
  converted: "emerald",
  "no-rule": "amber",
  "manual-override": "gray",
  "no-link": "gray",
};

const EMPTY_FORM = {
  operatorName: "",
  phone: "",
  vehicleType: "",
  priceFrom: "",
  thumbnailUrl: "",
  provider: "",
  sourceUrl: "",
};

type StopPick = { slug: string; name: string };

/**
 * Man "Vận chuyển" — CRUD tuyen van chuyen (transport-plan §3 Giai đoạn 2).
 * Route/menu dat ten CHUNG (khong phai "xe-khach") vi bang `transports` da
 * thiet ke san cho nhieu phuong tien (mode) — hien tai CHI co UI cho Xe
 * khach (mode=bus); Ve may bay (mode=flight) va cac mode khac (tau hoa...)
 * se them sau ma khong can doi URL.
 */
export default function TransportsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [origin, setOrigin] = useState<StopPick | null>(null);
  const [destination, setDestination] = useState<StopPick | null>(null);
  const [waypoints, setWaypoints] = useState<StopPick[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const transportsQuery = useQuery({
    queryKey: ["transports", "bus"],
    queryFn: () => apiGet("/transports?mode=bus", z.array(transportSchema)),
  });

  const save = useMutation({
    mutationFn: async () => {
      const num = (s: string) => (s.trim() === "" ? null : Number(s));
      const stops: TransportStop[] = [
        { destinationSlug: origin!.slug, role: "origin", seqOrder: 0 },
        { destinationSlug: destination!.slug, role: "destination", seqOrder: 0 },
        ...waypoints.map((w, i) => ({
          destinationSlug: w.slug,
          role: "waypoint" as const,
          seqOrder: i + 1,
        })),
      ];
      const body = {
        mode: "bus" as const,
        operatorName: form.operatorName.trim(),
        phone: form.phone.trim() || null,
        vehicleType: form.vehicleType.trim() || null,
        priceFrom: num(form.priceFrom),
        thumbnailUrl: form.thumbnailUrl.trim() || null,
        provider: form.provider.trim() || null,
        sourceUrl: form.sourceUrl.trim() || null,
        stops,
      };
      if (editingId) {
        return transportSchema.parse(await apiSend("PATCH", `/transports/${editingId}`, body));
      }
      return transportSchema.parse(await apiSend("POST", "/transports", body));
    },
    onSuccess: () => {
      setError(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["transports"] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : String(e)),
  });

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setOrigin(null);
    setDestination(null);
    setWaypoints([]);
  }

  function startEdit(t: Transport) {
    setEditingId(t.id);
    setForm({
      operatorName: t.operatorName,
      phone: t.phone ?? "",
      vehicleType: t.vehicleType ?? "",
      priceFrom: t.priceFrom === null ? "" : String(t.priceFrom),
      thumbnailUrl: t.thumbnailUrl ?? "",
      provider: t.provider ?? "",
      sourceUrl: t.sourceUrl ?? "",
    });
    const o = t.stops.find((s) => s.role === "origin");
    const d = t.stops.find((s) => s.role === "destination");
    const w = t.stops
      .filter((s) => s.role === "waypoint")
      .sort((a, b) => a.seqOrder - b.seqOrder);
    setOrigin(o ? { slug: o.destinationSlug, name: o.destinationName ?? o.destinationSlug } : null);
    setDestination(
      d ? { slug: d.destinationSlug, name: d.destinationName ?? d.destinationSlug } : null,
    );
    setWaypoints(w.map((s) => ({ slug: s.destinationSlug, name: s.destinationName ?? s.destinationSlug })));
  }

  const canSave =
    form.operatorName.trim().length > 0 && origin !== null && destination !== null && !save.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vận chuyển"
        description="Quản lý các tuyến vận chuyển tới điểm đến (hiện có Xe khách; Vé máy bay/tàu hoả sẽ bổ sung sau cùng trang này) — gắn theo cụm/tỉnh (điểm đầu-cuối-trung gian), khác Vé tham quan (gắn theo 1 điểm cụ thể)."
        actions={
          <Button size="sm" className="whitespace-nowrap" onClick={() => setImportOpen(true)}>
            Nhập từ Sheet
          </Button>
        }
      />

      <ImportTransportsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => queryClient.invalidateQueries({ queryKey: ["transports"] })}
      />

      <FeatureIntro
        summary={
          <>
            Hiện tại trang này quản lý <strong>🚌 Xe khách</strong>. Xe khách không tới 1 điểm
            tham quan cụ thể — mỗi tuyến chọn{" "}
            <strong>Điểm đầu</strong>, <strong>Điểm cuối</strong> (cụm/tỉnh, bắt buộc) và{" "}
            <strong>Điểm trung gian</strong> (tuỳ chọn, tuyến đi ngang qua).
          </>
        }
        details={
          <>
            Điểm đầu/cuối sẽ hiện thẻ &quot;🚌 Vé xe khách&quot; trên đúng trang cụm/tỉnh đó (và
            mọi điểm tham quan con của cụm đó cũng tự thấy được). Điểm trung gian{" "}
            <strong>không hiện thẻ</strong> — chỉ lưu để biết lộ trình đầy đủ. Nhiều nhà xe nhỏ
            không có link đặt vé online, chỉ có SĐT — để trống ô &quot;Link gốc&quot; nếu vậy,
            trạng thái sẽ hiện &quot;Chỉ có SĐT&quot;. Lưu ở đây là <strong>lên website ngay</strong>
            , không qua bước duyệt.
          </>
        }
      />

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded border border-zinc-300 p-4 dark:border-zinc-700">
        <h3 className="mb-3 font-medium">{editingId ? "Sửa tuyến xe" : "Thêm tuyến xe"}</h3>

        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <StopPicker label="Điểm đầu *" value={origin} onChange={setOrigin} />
          <StopPicker label="Điểm cuối *" value={destination} onChange={setDestination} />
          <WaypointPicker waypoints={waypoints} onChange={setWaypoints} />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Input
            className="md:col-span-2"
            placeholder="Tên nhà xe *"
            value={form.operatorName}
            onChange={(e) => setForm((f) => ({ ...f, operatorName: e.target.value }))}
          />
          <Input
            placeholder="Số điện thoại"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <Input
            placeholder="Loại xe (giường nằm/ghế ngồi/limousine...)"
            value={form.vehicleType}
            onChange={(e) => setForm((f) => ({ ...f, vehicleType: e.target.value }))}
          />
          <Input
            placeholder="Giá từ (VND)"
            value={form.priceFrom}
            onChange={(e) => setForm((f) => ({ ...f, priceFrom: e.target.value }))}
          />
          <Input
            placeholder="Ảnh (thumbnail URL)"
            value={form.thumbnailUrl}
            onChange={(e) => setForm((f) => ({ ...f, thumbnailUrl: e.target.value }))}
          />
          <Input
            placeholder="Provider (đối tác affiliate, nếu có)"
            value={form.provider}
            onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
          />
          <Input
            className="md:col-span-2"
            placeholder="Link gốc (sourceUrl) — để trống nếu chỉ có SĐT"
            value={form.sourceUrl}
            onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))}
          />
        </div>
        {form.sourceUrl.trim() && (
          <div className="mt-2">
            <AffiliateUrlPreview sourceUrl={form.sourceUrl} provider={form.provider} />
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <Button variant="primary" loading={save.isPending} disabled={!canSave} onClick={() => save.mutate()}>
            {editingId ? "Lưu thay đổi" : "Tạo tuyến xe"}
          </Button>
          {editingId && (
            <Button variant="ghost" onClick={resetForm}>
              Huỷ sửa
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {transportsQuery.data?.map((t) => {
          const o = t.stops.find((s) => s.role === "origin");
          const d = t.stops.find((s) => s.role === "destination");
          const waypointCount = t.stops.filter((s) => s.role === "waypoint").length;
          return (
            <div
              key={t.id}
              className="flex items-center justify-between rounded border border-zinc-300 p-3 dark:border-zinc-700"
            >
              <div className="text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t.operatorName}</span>
                  <Badge tone={LINK_STATUS_TONE[t.linkStatus]}>{LINK_STATUS_LABEL[t.linkStatus]}</Badge>
                  {t.siteId === null && <Badge tone="red">Chưa publish</Badge>}
                </div>
                <div className="text-xs text-zinc-500">
                  {o?.destinationName ?? "—"} → {d?.destinationName ?? "—"}
                  {waypointCount > 0 && ` · đi qua ${waypointCount} điểm`} · Giá từ{" "}
                  {t.priceFrom ?? "—"} · {t.vehicleType ?? "—"} · {t.phone ?? "—"}
                </div>
              </div>
              <Button size="sm" onClick={() => startEdit(t)}>
                Sửa
              </Button>
            </div>
          );
        })}
        {transportsQuery.data?.length === 0 && (
          <p className="text-sm text-zinc-500">Chưa có tuyến xe nào.</p>
        )}
      </div>
    </div>
  );
}

/** Picker 1 diem duy nhat (dung cho Diem dau/Diem cuoi) — chi tim trong kind cluster/province */
function StopPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: StopPick | null;
  onChange: (v: StopPick | null) => void;
}) {
  const [q, setQ] = useState("");
  const pickerQuery = useQuery({
    queryKey: ["transport-stop-picker", q],
    queryFn: () => {
      const params = new URLSearchParams({ page: "1", limit: "8", sortBy: "name", sortDir: "asc", q });
      return apiGet(`/destinations?${params}`, listDestinationsResponseSchema);
    },
    enabled: q.trim().length >= 2,
  });
  const options = (pickerQuery.data?.items ?? []).filter((d) => d.kind !== "poi");

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</label>
      {value ? (
        <div className="flex items-center justify-between rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700">
          <span>{value.name}</span>
          <button
            type="button"
            className="text-xs text-red-600 hover:underline dark:text-red-400"
            onClick={() => onChange(null)}
          >
            Đổi
          </button>
        </div>
      ) : (
        <>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Gõ tên cụm/tỉnh (tối thiểu 2 ký tự)..."
          />
          {q.trim().length >= 2 && (
            <div className="mt-1 max-h-40 divide-y divide-zinc-100 overflow-y-auto rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {pickerQuery.isLoading && <p className="p-2 text-xs text-zinc-400">Đang tìm...</p>}
              {options.map((d) => (
                <button
                  key={d.slug}
                  type="button"
                  onClick={() => {
                    onChange({ slug: d.slug, name: d.name });
                    setQ("");
                  }}
                  className="flex w-full items-center justify-between gap-2 p-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <span>{d.name}</span>
                  <span className="text-xs text-zinc-400">{d.kind === "province" ? "Tỉnh" : "Cụm"}</span>
                </button>
              ))}
              {!pickerQuery.isLoading && options.length === 0 && (
                <p className="p-2 text-xs text-zinc-400">Không tìm thấy cụm/tỉnh nào.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Picker nhieu diem (0..N) cho diem trung gian — them/xoa tu do, thu tu theo luc them */
function WaypointPicker({
  waypoints,
  onChange,
}: {
  waypoints: StopPick[];
  onChange: (v: StopPick[]) => void;
}) {
  const [q, setQ] = useState("");
  const pickerQuery = useQuery({
    queryKey: ["transport-waypoint-picker", q],
    queryFn: () => {
      const params = new URLSearchParams({ page: "1", limit: "8", sortBy: "name", sortDir: "asc", q });
      return apiGet(`/destinations?${params}`, listDestinationsResponseSchema);
    },
    enabled: q.trim().length >= 2,
  });
  const options = (pickerQuery.data?.items ?? []).filter(
    (d) => d.kind !== "poi" && !waypoints.some((w) => w.slug === d.slug),
  );

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Điểm trung gian (đi ngang qua)
      </label>
      <div className="mb-1 flex flex-wrap gap-1">
        {waypoints.map((w) => (
          <Badge key={w.slug} tone="gray">
            {w.name}{" "}
            <button
              type="button"
              className="ml-1 text-red-600 dark:text-red-400"
              onClick={() => onChange(waypoints.filter((x) => x.slug !== w.slug))}
            >
              ×
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Gõ tên cụm/tỉnh để thêm..."
      />
      {q.trim().length >= 2 && (
        <div className="mt-1 max-h-40 divide-y divide-zinc-100 overflow-y-auto rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {pickerQuery.isLoading && <p className="p-2 text-xs text-zinc-400">Đang tìm...</p>}
          {options.map((d) => (
            <button
              key={d.slug}
              type="button"
              onClick={() => {
                onChange([...waypoints, { slug: d.slug, name: d.name }]);
                setQ("");
              }}
              className="flex w-full items-center justify-between gap-2 p-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <span>{d.name}</span>
              <span className="text-xs text-zinc-400">{d.kind === "province" ? "Tỉnh" : "Cụm"}</span>
            </button>
          ))}
          {!pickerQuery.isLoading && options.length === 0 && (
            <p className="p-2 text-xs text-zinc-400">Không tìm thấy cụm/tỉnh nào.</p>
          )}
        </div>
      )}
    </div>
  );
}
