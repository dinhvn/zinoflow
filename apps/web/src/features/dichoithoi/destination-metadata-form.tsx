"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  checkImageResponseSchema,
  destinationMetaSuggestionSchema,
  destinationTaxonomySchema,
  type DestinationKind,
  type UpsertDestinationRequest,
} from "@zinoflow/contracts";
import { apiGet, apiSend, ApiError } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { Select } from "@/shared/ui/select";

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
  lat: string;
  lng: string;
  addressNew: string;
  addressOld: string;
  contactPhone: string;
  contactWebsite: string;
  bookingUrl: string;
  hotelGroupId: string;
  isFeatured: boolean;
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
  addressNew: "",
  addressOld: "",
  contactPhone: "",
  contactWebsite: "",
  bookingUrl: "",
  hotelGroupId: "",
  isFeatured: false,
};

function toRequest(v: DestinationMetaValues): UpsertDestinationRequest {
  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  const str = (s: string) => (s.trim() === "" ? null : s.trim());
  return {
    slug: v.slug.trim(),
    name: v.name.trim(),
    kind: v.kind,
    parentSlug: str(v.parentSlug),
    provinceCode: str(v.provinceCode),
    shortDescription: str(v.shortDescription),
    thumbnail: str(v.thumbnail),
    lat: num(v.lat),
    lng: num(v.lng),
    addressNew: str(v.addressNew),
    addressOld: str(v.addressOld),
    contactPhone: str(v.contactPhone),
    contactWebsite: str(v.contactWebsite),
    bookingUrl: str(v.bookingUrl),
    hotelGroupId: str(v.hotelGroupId),
    isFeatured: v.isFeatured,
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
  const [imageCheck, setImageCheck] = useState<{ exists: boolean } | null>(null);
  const [error, setError] = useState<{ message: string; details: string[] } | null>(null);
  // Khi tao moi: tu sinh slug tu ten cho toi khi nguoi dung tu sua slug
  const [slugTouched, setSlugTouched] = useState(!isNew);

  const taxonomyQuery = useQuery({
    queryKey: ["dichoithoi-taxonomy"],
    queryFn: () => apiGet("/destinations/taxonomy", destinationTaxonomySchema),
    staleTime: 5 * 60 * 1000,
  });

  const set = <K extends keyof DestinationMetaValues>(k: K, val: DestinationMetaValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  const checkImage = useMutation({
    mutationFn: async () =>
      checkImageResponseSchema.parse(
        await apiSend("POST", "/destinations/check-image", { path: v.thumbnail.trim() }),
      ),
    onSuccess: (r) => setImageCheck({ exists: r.exists }),
  });

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
          <Select
            value={v.provinceCode}
            onChange={(e) => set("provinceCode", e.target.value)}
            className="w-full"
          >
            <option value="">— Chọn tỉnh —</option>
            {taxonomyQuery.data?.provinces.map((p) => (
              <option key={p.provinceCode} value={p.provinceCode}>
                {p.shortName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Điểm cha (slug) — để trống nếu không có">
          <input
            value={v.parentSlug}
            onChange={(e) => set("parentSlug", e.target.value)}
            placeholder="vd: sapa"
            className={`${inputCls} font-mono`}
          />
        </Field>
        <Field label="Nổi bật">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={v.isFeatured}
              onChange={(e) => set("isFeatured", e.target.checked)}
            />
            Hiển thị ở khu nổi bật
          </label>
        </Field>
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

      <Field label="Ảnh đại diện (đường dẫn tương đối)">
        <div className="flex gap-2">
          <input
            value={v.thumbnail}
            onChange={(e) => {
              set("thumbnail", e.target.value);
              setImageCheck(null);
            }}
            placeholder="vd: slug.webp hoặc diem-den/slug/thumb.webp"
            className={inputCls}
          />
          <Button
            className="whitespace-nowrap"
            loading={checkImage.isPending}
            disabled={!v.thumbnail.trim()}
            onClick={() => v.thumbnail.trim() && checkImage.mutate()}
          >
            Kiểm tra
          </Button>
        </div>
        {imageCheck && (
          <p
            className={`mt-1 text-xs ${imageCheck.exists ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
          >
            {imageCheck.exists ? "✅ Ảnh tồn tại" : "⚠️ Chưa tìm thấy ảnh"}
          </p>
        )}
      </Field>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Vĩ độ (lat)">
          <input value={v.lat} onChange={(e) => set("lat", e.target.value)} placeholder="vd: 22.3364" className={inputCls} />
        </Field>
        <Field label="Kinh độ (lng)">
          <input value={v.lng} onChange={(e) => set("lng", e.target.value)} placeholder="vd: 103.8438" className={inputCls} />
        </Field>
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
        <Field label="Link đặt vé/phòng (booking)">
          <input value={v.bookingUrl} onChange={(e) => set("bookingUrl", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Nhóm khách sạn (hotelGroupId)">
          <input value={v.hotelGroupId} onChange={(e) => set("hotelGroupId", e.target.value)} className={inputCls} />
        </Field>
      </div>

      <Button
        variant="primary"
        loading={save.isPending}
        disabled={!v.name.trim() || !v.slug.trim()}
        onClick={() => save.mutate()}
      >
        {save.isPending ? "Đang lưu..." : isNew ? "Tạo điểm đến" : "Lưu thay đổi"}
      </Button>
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
