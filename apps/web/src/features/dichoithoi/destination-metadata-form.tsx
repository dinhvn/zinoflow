"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  destinationMetaSuggestionSchema,
  destinationTaxonomySchema,
  getGeocodeSuggestionsResponseSchema,
  type DestinationKind,
  type PlaceGeocodeCandidate,
  type UpsertDestinationRequest,
} from "@zinoflow/contracts";
import { apiGet, apiSend, ApiError } from "@/shared/api-client";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Combobox } from "@/shared/ui/combobox";
import { FeatureIntro } from "@/shared/ui/feature-intro";
import { Modal } from "@/shared/ui/modal";
import { Select } from "@/shared/ui/select";

/** Nguong canh bao free-tier Enterprise SKU cua Google Places (chot 05/08/2026) */
const PLACES_API_WARN_THRESHOLD = 800;

/** Sinh slug tu ten: bo dau tieng Viet, d->d, ky tu khac -> gach ngang. */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

const KIND_OPTIONS: Array<{ value: DestinationKind; label: string }> = [
  { value: "poi", label: "Điểm đến" },
  { value: "cluster", label: "Cụm" },
  { value: "province", label: "Tỉnh/Thành" },
];

/** Gia tri khoi tao form (tu detail khi sua, hoac rong khi tao moi) */
export interface DestinationMetaValues {
  slug: string;
  name: string;
  kind: DestinationKind;
  parentSlug: string;
  provinceCode: string;
  shortDescription: string;
  thumbnail: string;
  /** Toa do — CHI HIEN THI (read-only), server tu tinh lai tu googleMapsUrl luc luu */
  lat: string;
  lng: string;
  googleMapsUrl: string;
  addressNew: string;
  addressOld: string;
  contactPhone: string;
  contactWebsite: string;
  hotelGroupId: string;
  /** Do uu tien tay 1-5, 1=cao nhat, mac dinh 3 — thay isFeatured cu (relations-plan §1.1) */
  priority: number;
  /** "" = chua gan (mac dinh nhu Standard) — chi y nghia voi kind province/cluster */
  contentTier: "" | "flagship" | "standard";
}

export const EMPTY_META: DestinationMetaValues = {
  slug: "",
  name: "",
  kind: "poi",
  parentSlug: "",
  provinceCode: "",
  shortDescription: "",
  thumbnail: "",
  lat: "",
  lng: "",
  googleMapsUrl: "",
  addressNew: "",
  addressOld: "",
  contactPhone: "",
  contactWebsite: "",
  hotelGroupId: "",
  priority: 3,
  contentTier: "",
};

function toRequest(v: DestinationMetaValues): UpsertDestinationRequest {
  const str = (s: string) => (s.trim() === "" ? null : s.trim());
  return {
    slug: v.slug.trim(),
    name: v.name.trim(),
    kind: v.kind,
    parentSlug: str(v.parentSlug),
    provinceCode: str(v.provinceCode),
    shortDescription: str(v.shortDescription),
    thumbnail: str(v.thumbnail),
    googleMapsUrl: str(v.googleMapsUrl),
    addressNew: str(v.addressNew),
    addressOld: str(v.addressOld),
    contactPhone: str(v.contactPhone),
    contactWebsite: str(v.contactWebsite),
    hotelGroupId: str(v.hotelGroupId),
    priority: v.priority,
    contentTier: v.contentTier === "" ? null : v.contentTier,
  };
}

/**
 * Form metadata diem den (spec §7.3 tab Thong tin) — dung chung cho tao moi va sua.
 * isNew=true: slug nhap duoc, POST /destinations. isNew=false: slug khoa, PATCH /:slug.
 */
export function DestinationMetadataForm({
  initial,
  isNew,
  onSaved,
}: {
  initial: DestinationMetaValues;
  isNew: boolean;
  onSaved: (slug: string) => void;
}) {
  const [v, setV] = useState<DestinationMetaValues>(initial);
  const [error, setError] = useState<{ message: string; details: string[] } | null>(null);
  // Khi tao moi: tu sinh slug tu ten cho toi khi nguoi dung tu sua slug
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [geocodeModalOpen, setGeocodeModalOpen] = useState(false);

  const taxonomyQuery = useQuery({
    queryKey: ["dichoithoi-taxonomy"],
    queryFn: () => apiGet("/destinations/taxonomy", destinationTaxonomySchema),
    staleTime: 5 * 60 * 1000,
  });

  const [justSaved, setJustSaved] = useState(false);

  const set = <K extends keyof DestinationMetaValues>(k: K, val: DestinationMetaValues[K]) => {
    setJustSaved(false);
    setV((prev) => ({ ...prev, [k]: val }));
  };

  // AI goi y mo ta + phan loai (mem) — KHONG dung lat/lng/dia chi (spec §3.5)
  const suggest = useMutation({
    mutationFn: async () => {
      const provinceName =
        taxonomyQuery.data?.provinces.find((p) => p.provinceCode === v.provinceCode)?.shortName ??
        null;
      return destinationMetaSuggestionSchema.parse(
        await apiSend("POST", "/destinations/suggest-meta", { name: v.name.trim(), provinceName }),
      );
    },
    onSuccess: (s) => {
      setV((prev) => ({ ...prev, shortDescription: s.shortDescription, kind: s.suggestedKind }));
    },
  });

  // Giai doan 1a (che do tung diem) — dichoithoi-destination-geocode-audit-plan.md.
  // LUON goi live, khong cache — chi de nguoi dung xem/chon roi tu dien vao form,
  // KHONG tu ghi DB (van phai bam "Luu" nhu binh thuong).
  const geocodeSuggest = useMutation({
    mutationFn: () =>
      apiGet(`/destinations/${initial.slug}/geocode-suggestions`, getGeocodeSuggestionsResponseSchema),
    onSuccess: () => setGeocodeModalOpen(true),
  });

  const applyGeocodeCandidate = (c: PlaceGeocodeCandidate) => {
    setV((prev) => ({
      ...prev,
      googleMapsUrl: c.googleMapsUri ?? prev.googleMapsUrl,
      addressNew: c.formattedAddress ?? prev.addressNew,
      contactPhone: c.nationalPhoneNumber ?? prev.contactPhone,
      contactWebsite: c.websiteUri ?? prev.contactWebsite,
    }));
    setGeocodeModalOpen(false);
  };

  const save = useMutation({
    mutationFn: async () => {
      const body = toRequest(v);
      if (isNew) {
        await apiSend("POST", "/destinations", body);
      } else {
        await apiSend("PATCH", `/destinations/${initial.slug}`, body);
      }
      return body.slug;
    },
    onSuccess: (slug) => {
      setError(null);
      setJustSaved(true);
      onSaved(slug);
    },
    onError: (e) =>
      setError(
        e instanceof ApiError
          ? { message: e.message, details: e.details }
          : { message: String(e), details: [] },
      ),
  });

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <p className="font-medium">{error.message}</p>
          {error.details.length > 0 && (
            <ul className="mt-1 list-inside list-disc">
              {error.details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Tên điểm đến *">
          <input
            value={v.name}
            onChange={(e) => {
              const name = e.target.value;
              // Tu sinh slug tu ten neu nguoi dung chua tu go slug (chi khi tao moi)
              setV((prev) => ({
                ...prev,
                name,
                slug: slugTouched ? prev.slug : slugify(name),
              }));
            }}
            className={inputCls}
          />
        </Field>
        <Field label={isNew ? "Slug * (không sửa được sau khi tạo)" : "Slug (cố định)"}>
          <input
            value={v.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set("slug", slugify(e.target.value));
            }}
            disabled={!isNew}
            placeholder="vd: nui-ham-rong-sapa"
            className={`${inputCls} ${!isNew ? "opacity-60" : ""} font-mono`}
          />
        </Field>
        <div className="md:col-span-2">
          <FeatureIntro
            summary={
              <>
                3 field dưới đây (Cấp / Độ ưu tiên / Độ ưu tiên nội dung) là 3 khái
                niệm ĐỘC LẬP nhau, không thay thế nhau được — dễ nhầm vì tên gần
                giống nhau.
              </>
            }
            details={
              <div className="space-y-1.5">
                <p>
                  <strong>Cấp</strong> = vị trí trong cây (điểm lẻ / cụm / tỉnh) —
                  gần như cố định, quyết định bố cục trang và bộ prompt AI dùng để
                  viết bài.
                </p>
                <p>
                  <strong>Độ ưu tiên (1-5)</strong> = thứ hạng SO VỚI ANH EM cùng
                  cha (ai nổi bật hơn trong 1 cụm) — điểm ưu tiên 1-2 sẽ hiện ở khu
                  "Nổi bật" trên trang cụm cha. KHÔNG liên quan tới việc điểm này có
                  nhiều/ít dữ liệu hay không.
                </p>
                <p>
                  <strong>Độ ưu tiên nội dung (Flagship/Standard)</strong> = chỉ áp
                  cho tỉnh/cụm — có đầu tư viết bài tầm cả vùng (lịch trình nhiều
                  ngày, layout 2 lớp điểm tham quan) hay không. Chỉ nên chọn Flagship
                  cho vài chục tên tuổi lớn (Đà Lạt, Hội An, Phú Quốc...), KHÔNG phải
                  cứ tỉnh/cụm lớn là chọn.
                </p>
                <p className="text-zinc-400">
                  Ví dụ: Đà Lạt = cụm + flagship. Đạ Tẻh = cụm + standard. Thác Triệu
                  Hải = điểm lẻ (không có field Độ ưu tiên nội dung).
                </p>
              </div>
            }
          />
        </div>
        <Field label="Cấp">
          <Select value={v.kind} onChange={(e) => set("kind", e.target.value as DestinationKind)} className="w-full">
            {KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tỉnh/Thành">
          <Combobox
            value={v.provinceCode}
            onChange={(value) => set("provinceCode", value)}
            emptyLabel="— Chọn tỉnh —"
            placeholder="— Chọn tỉnh —"
            className="w-full"
            options={(taxonomyQuery.data?.provinces ?? []).map((p) => ({
              value: p.provinceCode,
              label: p.shortName,
            }))}
          />
        </Field>
        <Field
          label={
            v.kind === "cluster"
              ? "Cụm/Tỉnh cha — để trống thì tự gán vào tỉnh đã chọn ở trên"
              : "Cụm/Tỉnh cha — để trống nếu không có"
          }
        >
          <Combobox
            value={v.parentSlug}
            onChange={(value) => set("parentSlug", value)}
            emptyLabel="— Không có —"
            placeholder="— Không có —"
            className="w-full"
            options={(taxonomyQuery.data?.clusters ?? [])
              .filter((c) => c.slug !== v.slug)
              .map((c) => ({
                value: c.slug,
                label: `${c.name} (${c.kind === "province" ? "Tỉnh" : "Cụm"})`,
              }))}
          />
        </Field>
        <Field label="Độ ưu tiên (1 = cao nhất, 5 = thấp nhất) — điểm ưu tiên 1-2 hiện ở khu nổi bật">
          <Select
            value={String(v.priority)}
            onChange={(e) => set("priority", Number(e.target.value))}
            className={inputCls}
          >
            {[1, 2, 3, 4, 5].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
        {(v.kind === "province" || v.kind === "cluster") && (
          <Field label="Độ ưu tiên nội dung">
            <Select
              value={v.contentTier}
              onChange={(e) =>
                set("contentTier", e.target.value as DestinationMetaValues["contentTier"])
              }
              className="w-full"
            >
              <option value="">— Thường (Standard) —</option>
              <option value="flagship">Chủ lực (Flagship)</option>
              <option value="standard">Thường (Standard)</option>
            </Select>
          </Field>
        )}
      </div>

      <Field label="Mô tả ngắn (card danh sách / SEO)">
        <div className="mb-1 flex items-center gap-2">
          <Button
            size="sm"
            className="px-2 py-1 text-xs"
            loading={suggest.isPending}
            disabled={!v.name.trim()}
            onClick={() => v.name.trim() && suggest.mutate()}
          >
            {suggest.isPending ? "Đang gợi ý..." : "✨ AI gợi ý mô tả + phân loại"}
          </Button>
          {suggest.isError && (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              Không gợi ý được (kiểm tra API key / quota)
            </span>
          )}
          {suggest.isSuccess && (
            <span className="text-xs text-zinc-400">Đã điền — kiểm tra lại trước khi lưu</span>
          )}
        </div>
        <textarea
          value={v.shortDescription}
          onChange={(e) => set("shortDescription", e.target.value)}
          rows={2}
          className={inputCls}
        />
      </Field>

      <Field label="Link Google Maps">
        <div className="flex items-center gap-2">
          <input
            value={v.googleMapsUrl}
            onChange={(e) => set("googleMapsUrl", e.target.value)}
            placeholder="vd: https://www.google.com/maps/place/...@10.87,106.81,17z"
            className={inputCls}
          />
          {!isNew && (
            <Button
              size="sm"
              className="shrink-0 px-2 py-1 text-xs"
              loading={geocodeSuggest.isPending}
              onClick={() => geocodeSuggest.mutate()}
            >
              🔍 Tìm bằng Google Places
            </Button>
          )}
        </div>
        {geocodeSuggest.isError && (
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            Không tìm được (kiểm tra GOOGLE_MAPS_API_KEY / quota) —{" "}
            {geocodeSuggest.error instanceof ApiError ? geocodeSuggest.error.message : String(geocodeSuggest.error)}
          </p>
        )}
        <p className="mt-1 text-xs text-zinc-400">
          Toạ độ (tự tính khi lưu):{" "}
          {initial.lat && initial.lng ? `${initial.lat}, ${initial.lng}` : "chưa có"}
        </p>
      </Field>

      <Modal
        open={geocodeModalOpen}
        onClose={() => setGeocodeModalOpen(false)}
        title="Kết quả tìm bằng Google Places"
        width="max-w-3xl"
      >
        <div className="space-y-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Kết quả gọi trực tiếp Google Maps (không lưu ở máy chủ) — chọn đúng địa
            điểm để tự điền vào form, sau đó bạn vẫn phải bấm "Lưu thay đổi" như
            bình thường để ghi lại.
          </p>
          {geocodeSuggest.data && geocodeSuggest.data.usageThisMonth >= PLACES_API_WARN_THRESHOLD && (
            <div className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
              Đã dùng {geocodeSuggest.data.usageThisMonth}/1000 lượt gọi Google Places
              miễn phí tháng này — sắp hết hạn mức miễn phí.
            </div>
          )}
          {geocodeSuggest.data?.candidates.length === 0 && (
            <p className="text-sm text-zinc-500">Không tìm thấy kết quả nào phù hợp.</p>
          )}
          <div className="space-y-2">
            {geocodeSuggest.data?.candidates.map((c) => (
              <div
                key={c.placeId}
                className="rounded border border-zinc-300 p-3 text-sm dark:border-zinc-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{c.displayName}</p>
                    {c.formattedAddress && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{c.formattedAddress}</p>
                    )}
                  </div>
                  <Badge tone={c.confidenceScore >= 0.7 ? "emerald" : c.confidenceScore >= 0.4 ? "amber" : "gray"}>
                    độ khớp {Math.round(c.confidenceScore * 100)}%
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {c.distanceToParentMeters !== null && (
                    <span>cách cụm cha {(c.distanceToParentMeters / 1000).toFixed(1)}km</span>
                  )}
                  {c.nationalPhoneNumber && <span>· {c.nationalPhoneNumber}</span>}
                  {c.businessStatus === "CLOSED_PERMANENTLY" && (
                    <Badge tone="red">Google báo đã đóng cửa vĩnh viễn</Badge>
                  )}
                  {c.businessStatus === "CLOSED_TEMPORARILY" && <Badge tone="amber">Đang đóng cửa tạm thời</Badge>}
                </div>
                <div className="mt-2">
                  <Button size="sm" className="px-2 py-1 text-xs" onClick={() => applyGeocodeCandidate(c)}>
                    Dùng kết quả này
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Địa chỉ mới (sau sáp nhập)">
          <input value={v.addressNew} onChange={(e) => set("addressNew", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Địa chỉ cũ (trước sáp nhập)">
          <input value={v.addressOld} onChange={(e) => set("addressOld", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Điện thoại liên hệ">
          <input value={v.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Website chính thức">
          <input value={v.contactWebsite} onChange={(e) => set("contactWebsite", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Nhóm khách sạn (hotelGroupId)">
          <input value={v.hotelGroupId} onChange={(e) => set("hotelGroupId", e.target.value)} className={inputCls} />
        </Field>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          loading={save.isPending}
          disabled={!v.name.trim() || !v.slug.trim()}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Đang lưu..." : isNew ? "Tạo điểm đến" : "Lưu thay đổi"}
        </Button>
        {justSaved && !save.isPending && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">✅ Đã lưu</span>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
