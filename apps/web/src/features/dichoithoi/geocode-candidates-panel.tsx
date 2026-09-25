"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listGeocodeCandidatesResponseSchema,
  type DestinationGeocodeCandidateRecord,
} from "@zinoflow/contracts";
import { apiGet, apiSend, ApiError } from "@/shared/api-client";
import { Badge } from "@/shared/ui/badge";
import { Button, buttonClasses } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { ErrorBox } from "@/shared/ui/error-box";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { Select } from "@/shared/ui/select";
import { Slider } from "@/shared/ui/slider";

/** Qua nguong nay (met) tinh tu cum cha thi to mau do canh bao — de nghi ngo khop nham (yeu cau 08/08/2026) */
const FAR_FROM_PARENT_METERS = 50_000;

/** So sanh ten "giong het" — bo qua khoang trang thua/hoa thuong, GIU dau (yeu cau 09/08/2026: loc nhanh cac diem ten tren map trung ten diem den, an toan duyet nhanh khong can nhin ky). */
function normalizeForNameMatch(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

function findExactNameMatch(
  r: DestinationGeocodeCandidateRecord,
): DestinationGeocodeCandidateRecord["candidates"][number] | undefined {
  if (!r.destinationName) return undefined;
  const target = normalizeForNameMatch(r.destinationName);
  return r.candidates.find((c) => normalizeForNameMatch(c.displayNameAtDiscovery) === target);
}

/**
 * Bang duyet hang loat ket qua tim toa do (Giai doan 1b,
 * dichoithoi-destination-geocode-audit-plan.md) — hien danh sach dong staging
 * con "pending" (moi dong 1 diem den, toi da 5 ung vien). Toan bo thong tin
 * hien trong bang (toa do/dia chi/SDT/website/rating/link web tham khao) la
 * DU LIEU DA QUET SAN — bam "Chap nhan" ghi thang vao destination, KHONG goi
 * lai Google (quyet dinh 06/08/2026, xem AcceptGeocodeCandidatesUseCase).
 */
export function GeocodeCandidatesPanel({
  open,
  onClose,
  onAccepted,
  slugFilter,
}: {
  open: boolean;
  onClose: () => void;
  onAccepted: () => void;
  /** Chi xem/duyet ket qua cua 1 diem den (khung "Tim Google Maps" trong tab AI ho tro) — bo trong = xem het (trang danh sach). */
  slugFilter?: string;
}) {
  const queryClient = useQueryClient();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [selectedPlaceId, setSelectedPlaceId] = useState<Record<string, string>>({});
  // Loc theo % do tin cay CAO NHAT trong cac ung vien cua 1 diem — 0 = hien het.
  const [minConfidence, setMinConfidence] = useState(0);
  // Loc theo tinh/cum — huu ich khi bang danh sach co hang tram dong (bang xem het,
  // slugFilter rong) va nguoi dung chi muon duyet 1 khu vuc cu the truoc.
  const [provinceFilter, setProvinceFilter] = useState("");
  const [parentFilter, setParentFilter] = useState("");
  // Chi hien diem co it nhat 1 ung vien ten GIONG HET ten diem den hien co — duyet
  // nhanh khong can doi chieu bang mat (yeu cau 09/08/2026: duyet tay ton thoi gian).
  const [exactNameOnly, setExactNameOnly] = useState(false);
  // 3 bo loc "duyet nhanh" bo sung (yeu cau 09/08/2026), ap dung cho ung vien
  // DANG DUOC CHON (pickedCandidate) cua moi dong — khoang cach toi cum cha,
  // co "Ket qua tren web" hay khong, va chi con dung 1 ung vien (khong mo ho).
  const [maxDistanceKm, setMaxDistanceKm] = useState("");
  const [requireWebResults, setRequireWebResults] = useState(false);
  const [onlyOneCandidate, setOnlyOneCandidate] = useState(false);

  const queryKey = ["geocode-candidates", slugFilter ?? null];
  const query = useQuery({
    queryKey,
    enabled: open,
    queryFn: () =>
      apiGet(
        `/destinations/geocode-candidates${slugFilter ? `?slug=${encodeURIComponent(slugFilter)}` : ""}`,
        listGeocodeCandidatesResponseSchema,
      ),
  });
  const allRecords = query.data?.records ?? [];
  const provinceOptions = [...new Set(allRecords.map((r) => r.provinceName).filter((v): v is string => !!v))].sort();
  const parentOptions = [
    ...new Set(
      allRecords
        .filter((r) => !provinceFilter || r.provinceName === provinceFilter)
        .map((r) => r.parentName)
        .filter((v): v is string => !!v),
    ),
  ].sort();
  const records = allRecords.filter(
    (r) =>
      (!provinceFilter || r.provinceName === provinceFilter) &&
      (!parentFilter || r.parentName === parentFilter),
  );
  // "not-found" (Google quét xong nhưng không ra kết quả) và "ambiguous" (nhiều
  // kết quả, tạm bỏ qua để ưu tiên điểm ra ngay 1 kết quả — xem quickOnly) đều
  // không có gì để chọn/chấp nhận — tách riêng khỏi bảng chọn ứng viên.
  const foundRecords = records.filter((r) => r.status === "pending");
  const notFoundRecords = records.filter((r) => r.status === "not-found");
  const ambiguousRecords = records.filter((r) => r.status === "ambiguous");

  function bestConfidence(r: DestinationGeocodeCandidateRecord): number {
    return Math.max(...r.candidates.map((c) => c.confidenceScore));
  }

  function pickedPlaceId(r: DestinationGeocodeCandidateRecord): string | undefined {
    return selectedPlaceId[r.destinationSlug] ?? findExactNameMatch(r)?.placeId ?? r.candidates[0]?.placeId;
  }

  function pickedCandidate(r: DestinationGeocodeCandidateRecord) {
    const id = pickedPlaceId(r);
    return r.candidates.find((c) => c.placeId === id);
  }

  const maxDistanceKmNum = maxDistanceKm.trim() === "" ? null : Number(maxDistanceKm);
  const visibleRecords = foundRecords
    .filter((r) => bestConfidence(r) * 100 >= minConfidence)
    .filter((r) => !exactNameOnly || findExactNameMatch(r) !== undefined)
    .filter((r) => !onlyOneCandidate || r.candidates.length === 1)
    .filter((r) => {
      if (maxDistanceKmNum === null || Number.isNaN(maxDistanceKmNum)) return true;
      const meters = pickedCandidate(r)?.distanceToParentMetersAtDiscovery;
      return meters !== null && meters !== undefined && meters / 1000 <= maxDistanceKmNum;
    })
    .filter((r) => {
      if (!requireWebResults) return true;
      const results = pickedCandidate(r)?.webResultUrlsAtDiscovery;
      return !!results && results.length > 0;
    });

  function toggle(slug: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  const allChecked = visibleRecords.length > 0 && visibleRecords.every((r) => checked.has(r.destinationSlug));
  function toggleAll() {
    setChecked(allChecked ? new Set() : new Set(visibleRecords.map((r) => r.destinationSlug)));
  }

  const accept = useMutation({
    mutationFn: (slugs: string[]) =>
      apiSend("POST", "/destinations/geocode-candidates/accept", {
        selections: slugs.map((slug) => {
          const r = foundRecords.find((rec) => rec.destinationSlug === slug)!;
          return { destinationSlug: slug, placeId: pickedPlaceId(r)! };
        }),
      }),
    onSuccess: (_data, slugs) => {
      setChecked((prev) => {
        const next = new Set(prev);
        for (const s of slugs) next.delete(s);
        return next;
      });
      void queryClient.invalidateQueries({ queryKey });
      onAccepted();
    },
  });
  const acceptingSlug =
    accept.isPending && accept.variables?.length === 1 ? accept.variables[0] : null;

  // "Bo qua" (yeu cau 08/08/2026): danh dau "rejected" thay vi ghi du lieu vao
  // destination — nguoi dung tu kiem tra tay rieng sau, KHONG hien lai trong
  // bang duyet/khong bi batch quet lai (xem SkipGeocodeCandidatesUseCase).
  const skip = useMutation({
    mutationFn: (slugs: string[]) => apiSend("POST", "/destinations/geocode-candidates/skip", { slugs }),
    onSuccess: (_data, slugs) => {
      setChecked((prev) => {
        const next = new Set(prev);
        for (const s of slugs) next.delete(s);
        return next;
      });
      void queryClient.invalidateQueries({ queryKey });
    },
  });
  const skippingSlug = skip.isPending && skip.variables?.length === 1 ? skip.variables[0] : null;

  const rescanAmbiguous = useMutation({
    mutationFn: () =>
      apiSend("POST", "/destinations/geocode-batch", {
        slugs: ambiguousRecords.map((r) => r.destinationSlug),
        quickOnly: false,
        acceptCostBeyondFreeTier: true,
      }),
  });

  // Vet lai "Ket qua tren web" cho diem DA duyet truoc khi bug quet rong duoc
  // sua 08/08/2026 (yeu cau 09/08/2026) — mo thang googleMapsUrl da co san,
  // khong tim kiem lai (xem RefreshWebResultsBatchUseCase).
  const refreshWebResults = useMutation({
    mutationFn: () => apiSend("POST", "/destinations/geocode-candidates/refresh-web-results", {}),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        slugFilter
          ? `Duyệt kết quả tìm toạ độ cho "${slugFilter}"`
          : `Duyệt kết quả tìm toạ độ (${visibleRecords.length} chờ duyệt${visibleRecords.length !== foundRecords.length ? `/${foundRecords.length}` : ""})`
      }
      width="max-w-5xl"
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3 rounded bg-zinc-50 p-3 text-xs text-zinc-500 dark:bg-zinc-900">
          <p>
            Toàn bộ thông tin dưới đây (toạ độ/địa chỉ/SĐT/website/đánh giá/link web tham khảo) là dữ
            liệu đã quét sẵn — bấm "Chấp nhận" ghi thẳng vào điểm đến, không cần chờ quét lại. Các link
            "Kết quả trên web" sẽ được gộp thêm vào "Website nguồn để AI đọc thêm" của điểm đến đó.
            Danh sách chỉ tải lúc mở popup — nếu có job quét nền đang chạy, bấm "Làm mới" để thấy kết
            quả mới nhất.
          </p>
          <Button
            variant="secondary"
            size="sm"
            loading={query.isFetching}
            onClick={() => query.refetch()}
            className="shrink-0"
          >
            Làm mới
          </Button>
        </div>

        {!slugFilter && (
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/40">
            <p className="mb-2 text-amber-800 dark:text-amber-300">
              Các điểm đã "Chấp nhận" trước 08/08/2026 có thể thiếu "Kết quả trên web" do lỗi quét (đã
              sửa) — bấm để vét lại, chỉ mở thẳng link Google Maps đã có sẵn, không tìm kiếm lại.
            </p>
            {refreshWebResults.isError && (
              <ErrorBox
                error={
                  refreshWebResults.error instanceof ApiError
                    ? refreshWebResults.error
                    : new ApiError(0, String(refreshWebResults.error), [])
                }
              />
            )}
            {refreshWebResults.isSuccess ? (
              <p className="text-emerald-700 dark:text-emerald-400">
                Đã gửi job vét lại — chạy nền, quay lại sau ít phút.
              </p>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                loading={refreshWebResults.isPending}
                onClick={() => refreshWebResults.mutate()}
              >
                Vét lại "Kết quả trên web" cho các điểm đã duyệt
              </Button>
            )}
          </div>
        )}

        {query.isError && <ErrorBox error={query.error} />}
        {accept.isError && (
          <ErrorBox error={accept.error instanceof ApiError ? accept.error : new ApiError(0, String(accept.error), [])} />
        )}
        {skip.isError && (
          <ErrorBox error={skip.error instanceof ApiError ? skip.error : new ApiError(0, String(skip.error), [])} />
        )}
        {query.isLoading && <p className="text-sm text-zinc-500">Đang tải...</p>}
        {!query.isLoading && records.length === 0 && (
          <p className="text-sm text-zinc-500">Không có kết quả nào đang chờ duyệt.</p>
        )}

        {(foundRecords.length > 0 || !slugFilter) && (provinceOptions.length > 0 || parentOptions.length > 0 || foundRecords.length > 0) && (
          <div className="flex flex-wrap items-end gap-3">
            {!slugFilter && provinceOptions.length > 0 && (
              <label className="flex flex-col gap-1 text-xs text-zinc-500">
                Tỉnh
                <Select
                  value={provinceFilter}
                  onChange={(e) => {
                    setProvinceFilter(e.target.value);
                    setParentFilter("");
                  }}
                >
                  <option value="">Tất cả</option>
                  {provinceOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            {!slugFilter && parentOptions.length > 0 && (
              <label className="flex flex-col gap-1 text-xs text-zinc-500">
                Cụm
                <Select value={parentFilter} onChange={(e) => setParentFilter(e.target.value)}>
                  <option value="">Tất cả</option>
                  {parentOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            {!slugFilter && (provinceFilter || parentFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setProvinceFilter("");
                  setParentFilter("");
                }}
              >
                Xoá lọc
              </Button>
            )}
            {foundRecords.length > 0 && (
              <div className="max-w-xs">
                <Slider
                  label="Độ tin cậy tối thiểu (ứng viên tốt nhất mỗi điểm)"
                  display={`${minConfidence}%`}
                  min={0}
                  max={100}
                  step={5}
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(Number(e.target.value))}
                />
              </div>
            )}
            {foundRecords.length > 0 && (
              <Checkbox
                label="Chỉ hiện tên khớp y hệt trên map (duyệt nhanh)"
                checked={exactNameOnly}
                onChange={(e) => setExactNameOnly(e.target.checked)}
              />
            )}
            {foundRecords.length > 0 && (
              <label className="flex flex-col gap-1 text-xs text-zinc-500">
                Cách cụm cha tối đa (km)
                <Input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="Không giới hạn"
                  className="w-32"
                  value={maxDistanceKm}
                  onChange={(e) => setMaxDistanceKm(e.target.value)}
                />
              </label>
            )}
            {foundRecords.length > 0 && (
              <Checkbox
                label="Có Kết quả trên web"
                checked={requireWebResults}
                onChange={(e) => setRequireWebResults(e.target.checked)}
              />
            )}
            {foundRecords.length > 0 && (
              <Checkbox
                label="Chỉ 1 kết quả (không mơ hồ)"
                checked={onlyOneCandidate}
                onChange={(e) => setOnlyOneCandidate(e.target.checked)}
              />
            )}
          </div>
        )}

        {foundRecords.length > 0 && (
          <>
            {visibleRecords.length === 0 && (
              <p className="text-sm text-zinc-500">
                Không có điểm nào đạt ngưỡng {minConfidence}% — hạ thanh trượt để xem thêm.
              </p>
            )}
            {visibleRecords.length > 0 && (
            <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
                  <tr>
                    <th className="p-2 text-center">
                      <Checkbox label="" checked={allChecked} onChange={toggleAll} />
                    </th>
                    <th className="p-2">Điểm đến</th>
                    <th className="p-2">Ứng viên</th>
                    <th className="sticky right-0 z-10 bg-zinc-50 p-2 shadow-[-4px_0_4px_-4px_rgba(0,0,0,0.2)] dark:bg-zinc-900"></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRecords.map((r) => (
                    <tr key={r.destinationSlug} className="border-t border-zinc-200 align-top dark:border-zinc-800">
                      <td className="p-2 text-center">
                        <Checkbox label="" checked={checked.has(r.destinationSlug)} onChange={() => toggle(r.destinationSlug)} />
                      </td>
                      <td className="p-2 text-xs">
                        <a
                          href={`/dichoithoi/${r.destinationSlug}?tab=ai-tools`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {r.destinationName ?? r.destinationSlug}
                        </a>
                        <div className="font-mono text-zinc-400">{r.destinationSlug}</div>
                        {(r.parentName || r.provinceName) && (
                          <div className="text-zinc-500 dark:text-zinc-400">
                            {[r.parentName, r.provinceName].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </td>
                      <td className="p-2">
                        <div className="space-y-2">
                          {r.candidates.map((c) => (
                            <label
                              key={c.placeId}
                              className="block rounded border border-zinc-200 p-2 text-xs dark:border-zinc-800"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  type="radio"
                                  name={`candidate-${r.destinationSlug}`}
                                  checked={pickedPlaceId(r) === c.placeId}
                                  onChange={() =>
                                    setSelectedPlaceId((prev) => ({ ...prev, [r.destinationSlug]: c.placeId }))
                                  }
                                />
                                <span className="font-medium">{c.displayNameAtDiscovery}</span>
                                {r.destinationName &&
                                  normalizeForNameMatch(c.displayNameAtDiscovery) === normalizeForNameMatch(r.destinationName) && (
                                    <Badge tone="emerald">✓ tên khớp</Badge>
                                  )}
                                <Badge tone={c.confidenceScore >= 0.7 ? "emerald" : c.confidenceScore >= 0.4 ? "amber" : "gray"}>
                                  {Math.round(c.confidenceScore * 100)}%
                                </Badge>
                                {c.ratingAtDiscovery !== null && c.ratingAtDiscovery !== undefined && (
                                  <span className="text-zinc-400">
                                    ⭐ {c.ratingAtDiscovery}
                                    {c.userRatingCountAtDiscovery ? ` (${c.userRatingCountAtDiscovery})` : ""}
                                  </span>
                                )}
                                {c.distanceToParentMetersAtDiscovery !== null && (
                                  <span
                                    className={
                                      c.distanceToParentMetersAtDiscovery > FAR_FROM_PARENT_METERS
                                        ? "font-semibold text-red-600 dark:text-red-400"
                                        : "text-zinc-400"
                                    }
                                  >
                                    {c.distanceToParentMetersAtDiscovery > FAR_FROM_PARENT_METERS ? "⚠️ " : ""}
                                    {(c.distanceToParentMetersAtDiscovery / 1000).toFixed(1)}km tới cụm cha
                                  </span>
                                )}
                                {c.businessStatusAtDiscovery === "CLOSED_PERMANENTLY" && (
                                  <Badge tone="red">đã đóng cửa vĩnh viễn</Badge>
                                )}
                                {c.businessStatusAtDiscovery === "CLOSED_TEMPORARILY" && (
                                  <Badge tone="amber">đang đóng cửa tạm thời</Badge>
                                )}
                                <a
                                  // Ket qua quet TRUOC khi them googleMapsUrlAtDiscovery (06/08/2026) chua co field
                                  // nay — placeId luon la URL Google Maps that (xem PlaywrightGoogleMapsProvider) nen
                                  // dung lam fallback, khong can quet lai cac dong cu.
                                  href={c.googleMapsUrlAtDiscovery ?? c.placeId}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={buttonClasses({ variant: "secondary", size: "sm" })}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  🗺️ Xem trên bản đồ
                                </a>
                              </div>
                              <div className="mt-1 space-y-0.5 pl-5 text-zinc-500 dark:text-zinc-400">
                                {c.formattedAddressAtDiscovery && <div>📍 {c.formattedAddressAtDiscovery}</div>}
                                {c.nationalPhoneNumberAtDiscovery && <div>📞 {c.nationalPhoneNumberAtDiscovery}</div>}
                                {c.websiteUriAtDiscovery && (
                                  <div>
                                    🌐{" "}
                                    <a
                                      href={c.websiteUriAtDiscovery}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-blue-600 hover:underline dark:text-blue-400"
                                    >
                                      {c.websiteUriAtDiscovery}
                                    </a>
                                  </div>
                                )}
                                {c.webResultUrlsAtDiscovery && c.webResultUrlsAtDiscovery.length > 0 && (
                                  <div>
                                    <span>Kết quả trên web:</span>
                                    <ul className="ml-4 list-disc">
                                      {c.webResultUrlsAtDiscovery.map((w) => (
                                        <li key={w.url}>
                                          <a
                                            href={w.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-blue-600 hover:underline dark:text-blue-400"
                                          >
                                            {w.label || w.url}
                                          </a>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </label>
                          ))}
                        </div>
                      </td>
                      <td className="sticky right-0 z-10 space-y-1 bg-white p-2 text-center shadow-[-4px_0_4px_-4px_rgba(0,0,0,0.2)] dark:bg-zinc-900">
                        <Button
                          variant="primary"
                          size="sm"
                          loading={acceptingSlug === r.destinationSlug}
                          disabled={accept.isPending || skip.isPending}
                          onClick={() => accept.mutate([r.destinationSlug])}
                        >
                          Duyệt
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={skippingSlug === r.destinationSlug}
                          disabled={accept.isPending || skip.isPending}
                          onClick={() => skip.mutate([r.destinationSlug])}
                        >
                          Bỏ qua
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                loading={accept.isPending && acceptingSlug === null}
                disabled={checked.size === 0 || accept.isPending || skip.isPending}
                onClick={() => accept.mutate([...checked])}
              >
                {accept.isPending && acceptingSlug === null
                  ? "Đang ghi..."
                  : `Chấp nhận ${checked.size} mục đã tick`}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                loading={skip.isPending && skippingSlug === null}
                disabled={checked.size === 0 || accept.isPending || skip.isPending}
                onClick={() => skip.mutate([...checked])}
              >
                {skip.isPending && skippingSlug === null
                  ? "Đang đánh dấu..."
                  : `Bỏ qua ${checked.size} mục đã tick`}
              </Button>
            </div>
          </>
        )}

        {notFoundRecords.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-medium">
              Google không tìm thấy ({notFoundRecords.length}) — cần tự tìm tay:
            </p>
            <ul className="space-y-1">
              {notFoundRecords.map((r) => (
                <li key={r.destinationSlug} className="flex items-center gap-2 text-xs">
                  <span>{r.destinationName ?? r.destinationSlug}</span>
                  <span className="font-mono text-zinc-400">{r.destinationSlug}</span>
                  <a
                    href={`/dichoithoi/${r.destinationSlug}?tab=ai-tools`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    mở trang điểm này để tự tìm tay ↗
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {ambiguousRecords.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-medium">
              Nhiều kết quả, tạm gác lại ({ambiguousRecords.length}) — ưu tiên điểm ra ngay 1 kết quả trước:
            </p>
            <ul className="mb-2 space-y-1">
              {ambiguousRecords.map((r) => (
                <li key={r.destinationSlug} className="flex items-center gap-2 text-xs">
                  <span>{r.destinationName ?? r.destinationSlug}</span>
                  <span className="font-mono text-zinc-400">{r.destinationSlug}</span>
                </li>
              ))}
            </ul>
            {rescanAmbiguous.isError && (
              <ErrorBox
                error={rescanAmbiguous.error instanceof ApiError ? rescanAmbiguous.error : new ApiError(0, String(rescanAmbiguous.error), [])}
              />
            )}
            {rescanAmbiguous.isSuccess ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                Đã gửi quét kỹ lại {ambiguousRecords.length} điểm — quay lại đây sau ít phút để duyệt.
              </p>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                loading={rescanAmbiguous.isPending}
                onClick={() => rescanAmbiguous.mutate()}
              >
                Quét kỹ toàn bộ {ambiguousRecords.length} điểm này (chậm hơn)
              </Button>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </div>
    </Modal>
  );
}
