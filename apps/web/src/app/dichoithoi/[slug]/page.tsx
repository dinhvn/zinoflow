"use client";

import { use, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  checkImageResponseSchema,
  createDestinationJobResponseSchema,
  destinationDetailSchema,
  publishDestinationResultSchema,
  type DestinationContentState,
  type DestinationDetail,
  type DestinationKind,
  type RelatedDestinationRef,
} from "@zinoflow/contracts";
import { apiGet, apiSend, ApiError } from "@/shared/api-client";

const KIND_LABELS: Record<DestinationKind, string> = {
  province: "Tỉnh/Thành",
  cluster: "Cụm",
  poi: "Điểm đến",
};

const CONTENT_STATE_LABELS: Record<DestinationContentState, string> = {
  "chua-co-bai": "Chưa có bài",
  "bai-tay": "Bài viết tay",
  "dang-soan": "Đang soạn / duyệt",
  "da-publish": "Đã publish (AI)",
};

const CONTENT_STATE_STYLES: Record<DestinationContentState, string> = {
  "chua-co-bai": "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  "bai-tay": "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  "dang-soan": "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "da-publish": "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

const SITE_STATUS_LABELS: Record<number, string> = {
  0: "Nháp",
  1: "Đang hiển thị",
  2: "Đã ẩn",
};

const SITE_BASE_URL = "https://dichoithoi.com";

function formatDistance(meters: number | null): string {
  if (meters === null) return "";
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

/** Trang chi tiet diem den (spec §7.3) — moi diem (moi/cu) deu mo duoc, gom theo nhom. */
export default function DestinationDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<{ message: string; details: string[] } | null>(
    null,
  );

  const detailQuery = useQuery({
    queryKey: ["destination-detail", slug],
    queryFn: () => apiGet(`/destinations/${slug}`, destinationDetailSchema),
  });
  const d = detailQuery.data;

  function toActionError(error: unknown) {
    return error instanceof ApiError
      ? { message: error.message, details: error.details }
      : { message: String(error), details: [] };
  }
  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["destination-detail", slug] });
  }

  // --- Anh dai dien (spec §14.3) ---
  const [thumbnail, setThumbnail] = useState("");
  const [imageCheck, setImageCheck] = useState<{ exists: boolean; url: string } | null>(null);
  useEffect(() => {
    if (d) setThumbnail(d.thumbnail ?? "");
  }, [d?.thumbnail]);

  const checkImage = useMutation({
    mutationFn: async (path: string) =>
      checkImageResponseSchema.parse(await apiSend("POST", "/destinations/check-image", { path })),
    onSuccess: (r) => setImageCheck({ exists: r.exists, url: r.url }),
  });
  const saveThumbnail = useMutation({
    mutationFn: () =>
      apiSend("POST", `/destinations/${slug}/thumbnail`, { thumbnail: thumbnail.trim() || null }),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: (e) => setActionError(toActionError(e)),
  });

  // --- Tao / cap nhat bai AI (spec §7.4) ---
  const [showJobForm, setShowJobForm] = useState(false);
  const [userNotes, setUserNotes] = useState("");
  const [refUrls, setRefUrls] = useState<Array<{ label: string; url: string }>>([
    { label: "Giá vé", url: "" },
    { label: "Giờ mở cửa", url: "" },
  ]);
  const createJob = useMutation({
    mutationFn: async () => {
      if (thumbnail.trim() && thumbnail.trim() !== (d?.thumbnail ?? "")) {
        await apiSend("POST", `/destinations/${slug}/thumbnail`, { thumbnail: thumbnail.trim() });
      }
      const refs = refUrls.filter((r) => r.url.trim() && r.label.trim());
      return createDestinationJobResponseSchema.parse(
        await apiSend("POST", `/destinations/${slug}/jobs`, {
          mode: d?.contentState === "chua-co-bai" ? "create" : "update",
          userNotes: userNotes.trim() || undefined,
          referenceUrls: refs.length ? refs : undefined,
        }),
      );
    },
    onSuccess: (r) => {
      window.location.href = `/content/${r.jobId}`;
    },
    onError: (e) => setActionError(toActionError(e)),
  });

  // --- Publish (gate tay thu 2) ---
  const publish = useMutation({
    mutationFn: async () =>
      publishDestinationResultSchema.parse(
        await apiSend("POST", `/destinations/${slug}/publish`, {}),
      ),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: (e) => setActionError(toActionError(e)),
  });

  if (detailQuery.isLoading) {
    return <p className="text-sm text-zinc-500">Đang tải...</p>;
  }
  if (detailQuery.isError || !d) {
    return (
      <div className="space-y-3">
        <a href="/dichoithoi" className="text-sm text-zinc-500 hover:underline">
          ← Quay lại danh sách
        </a>
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {detailQuery.error instanceof Error ? detailQuery.error.message : "Lỗi tải điểm đến"}
        </div>
      </div>
    );
  }

  const canPublish = d.activeJobStatus === "Approved";

  return (
    <div className="max-w-5xl space-y-5">
      <a href="/dichoithoi" className="text-sm text-zinc-500 hover:underline">
        ← Quay lại danh sách
      </a>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex gap-4">
          {d.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={d.imageUrl}
              alt={d.name}
              className="h-20 w-28 rounded object-cover"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          )}
          <div>
            <h2 className="text-xl font-semibold">{d.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                {KIND_LABELS[d.kind]}
              </span>
              <span className={`rounded px-2 py-0.5 ${CONTENT_STATE_STYLES[d.contentState]}`}>
                {CONTENT_STATE_LABELS[d.contentState]}
                {d.activeJobStatus ? ` · ${d.activeJobStatus}` : ""}
              </span>
              <span className="font-mono text-zinc-400">{d.slug}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {d.activeContentJobId && (
            <a
              href={`/content/${d.activeContentJobId}`}
              className="rounded bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300"
            >
              Xem bài đang soạn
            </a>
          )}
          {!d.activeContentJobId && (
            <button
              onClick={() => setShowJobForm((v) => !v)}
              className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {d.contentState === "chua-co-bai" ? "Tạo bài AI" : "Cập nhật bài"}
            </button>
          )}
          {canPublish && (
            <button
              onClick={() => publish.mutate()}
              disabled={publish.isPending}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {publish.isPending ? "Đang đăng..." : "Đăng lên dichoithoi"}
            </button>
          )}
          <a
            href={`${SITE_BASE_URL}/diem-den/${d.slug}`}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Mở web ↗
          </a>
        </div>
      </div>

      {actionError && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <p className="font-medium">{actionError.message}</p>
          {actionError.details.length > 0 && (
            <ul className="mt-1 list-inside list-disc">
              {actionError.details.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {publish.data && (
        <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          ✅ Đã đăng lên dichoithoi ({(publish.data.durationMs / 1000).toFixed(1)}s) — cập nhật khối
          liên quan cho {publish.data.relatedRecomputed} điểm.
          {publish.data.addedLinks.length > 0 &&
            ` Link nội bộ: ${publish.data.addedLinks.map((l) => l.targetName).join(", ")}.`}
        </div>
      )}

      {/* Form tao/cap nhat bai (spec §7.4) */}
      {showJobForm && !d.activeContentJobId && (
        <Group title="Tạo bài AI">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Ghi chú cho AI — tùy chọn</label>
              <textarea
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                rows={3}
                placeholder="Giá vé, giờ mở cửa, điểm cần nhấn mạnh..."
                className="w-full rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">URL nguồn theo trường — tùy chọn</label>
              <div className="space-y-2">
                {refUrls.map((row, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={row.label}
                      onChange={(e) =>
                        setRefUrls((rows) =>
                          rows.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)),
                        )
                      }
                      placeholder="Trường"
                      className="w-32 rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
                    />
                    <input
                      value={row.url}
                      onChange={(e) =>
                        setRefUrls((rows) =>
                          rows.map((r, j) => (j === i ? { ...r, url: e.target.value } : r)),
                        )
                      }
                      placeholder="https://..."
                      className="flex-1 rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
                    />
                  </div>
                ))}
              </div>
              {refUrls.length < 5 && (
                <button
                  onClick={() => setRefUrls((rows) => [...rows, { label: "", url: "" }])}
                  className="mt-2 text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  + Thêm nguồn
                </button>
              )}
            </div>
            <button
              onClick={() => createJob.mutate()}
              disabled={createJob.isPending}
              className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {createJob.isPending ? "Đang tạo job..." : "Tạo bài"}
            </button>
          </div>
        </Group>
      )}

      {/* Noi dung bai viet hien tai tren web (spec §7.3 tab Noi dung) */}
      <Group title="Nội dung bài viết (đang hiển thị trên web)">
        {d.content ? (
          <div className="space-y-3">
            {(d.content.openingTime ||
              d.content.ticketPrice ||
              d.content.transport ||
              d.content.food ||
              d.content.hotel ||
              d.content.tip) && (
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded border border-zinc-200 p-3 text-sm md:grid-cols-2 dark:border-zinc-800">
                {(
                  [
                    ["Giờ mở cửa", d.content.openingTime],
                    ["Giá vé", d.content.ticketPrice],
                    ["Di chuyển", d.content.transport],
                    ["Ăn uống", d.content.food],
                    ["Lưu trú", d.content.hotel],
                    ["Mẹo & lưu ý", d.content.tip],
                  ] as const
                )
                  .filter(([, v]) => v)
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt className="font-medium text-zinc-500">{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
              </dl>
            )}
            <div
              className="prose prose-zinc dark:prose-invert max-w-none text-sm
                [&_a]:text-blue-600 [&_a]:underline [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold
                [&_h3]:mt-3 [&_h3]:font-semibold [&_img]:rounded [&_li]:ml-4 [&_ol]:list-decimal [&_p]:my-2 [&_ul]:list-disc"
              // Noi dung tu DB website (bai AI da publish hoac bai viet tay) — preview admin
              dangerouslySetInnerHTML={{ __html: d.content.contentHtml }}
            />
          </div>
        ) : d.contentState === "dang-soan" && d.activeContentJobId ? (
          <p className="text-sm text-zinc-500">
            Bài đang soạn/duyệt, chưa publish.{" "}
            <a
              href={`/content/${d.activeContentJobId}`}
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Xem bản nháp →
            </a>
          </p>
        ) : (
          <p className="text-sm text-zinc-500">
            Chưa có nội dung trên web.{" "}
            {d.siteId === null
              ? "Điểm này chưa tồn tại trên website."
              : "Tạo bài AI để thêm nội dung."}
          </p>
        )}
      </Group>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Group title="Thông tin cơ bản">
          <Field label="Tên">{d.name}</Field>
          <Field label="Slug" mono>
            {d.slug}
          </Field>
          <Field label="Cấp">{KIND_LABELS[d.kind]}</Field>
          <Field label="Tỉnh/Thành">{d.provinceName ?? "—"}</Field>
          <Field label="Trạng thái trên web">
            {d.siteStatus === null ? "—" : (SITE_STATUS_LABELS[d.siteStatus] ?? d.siteStatus)}
          </Field>
          <Field label="Nổi bật">{d.isFeatured ? "Có" : "Không"}</Field>
          <Field label="Mô tả ngắn">{d.shortDescription ?? "—"}</Field>
        </Group>

        <Group title="Vị trí & địa chỉ">
          <Field label="Địa chỉ mới (sau sáp nhập)">{d.addressNew ?? "—"}</Field>
          <Field label="Địa chỉ cũ (trước sáp nhập)">{d.addressOld ?? "—"}</Field>
          <Field label="Tọa độ">
            {d.lat !== null && d.lng !== null ? (
              <a
                href={`https://www.google.com/maps?q=${d.lat},${d.lng}`}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                {d.lat}, {d.lng} ↗
              </a>
            ) : (
              "—"
            )}
          </Field>
          <Field label="Thuộc">
            {d.parent ? <RefLink r={d.parent} /> : "—"}
          </Field>
        </Group>

        <Group title="Liên hệ & đặt chỗ">
          <Field label="Điện thoại">{d.contactPhone ?? "—"}</Field>
          <Field label="Website chính thức">
            {d.contactWebsite ? (
              <a
                href={d.contactWebsite}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                {d.contactWebsite} ↗
              </a>
            ) : (
              "—"
            )}
          </Field>
          <Field label="Link đặt vé/phòng">
            {d.bookingUrl ? (
              <a
                href={d.bookingUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                {d.bookingUrl} ↗
              </a>
            ) : (
              "—"
            )}
          </Field>
          <Field label="Nhóm khách sạn">{d.hotelGroupId ?? "—"}</Field>
        </Group>

        <Group title="Ảnh đại diện">
          {d.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={d.imageUrl}
              alt={d.name}
              className="mb-2 h-32 w-full rounded object-cover"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          )}
          <div className="flex gap-2">
            <input
              value={thumbnail}
              onChange={(e) => {
                setThumbnail(e.target.value);
                setImageCheck(null);
              }}
              placeholder="vd: slug.webp hoặc diem-den/slug/thumb.webp"
              className="flex-1 rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
            />
            <button
              onClick={() => thumbnail.trim() && checkImage.mutate(thumbnail.trim())}
              disabled={!thumbnail.trim() || checkImage.isPending}
              className="whitespace-nowrap rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Kiểm tra
            </button>
            <button
              onClick={() => saveThumbnail.mutate()}
              disabled={saveThumbnail.isPending || thumbnail.trim() === (d.thumbnail ?? "")}
              className="whitespace-nowrap rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Lưu
            </button>
          </div>
          {imageCheck && (
            <p
              className={`mt-1 text-xs ${imageCheck.exists ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
            >
              {imageCheck.exists ? "✅ Ảnh tồn tại" : "⚠️ Chưa tìm thấy ảnh"}
            </p>
          )}
        </Group>
      </div>

      {/* Quan he (spec §7.3 tab 3) */}
      <Group title="Quan hệ">
        <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
          <RefList title={`Trực thuộc (${d.children.length})`} refs={d.children} />
          <RefList title={`Gần đây (${d.nearby.length})`} refs={d.nearby} showDistance />
          <RefList title={`Liên quan (curated, ${d.relatedCurated.length})`} refs={d.relatedCurated} />
          <RefList title={`Được nhắc trong bài (${d.mentionedBy.length})`} refs={d.mentionedBy} />
        </div>
      </Group>

      {/* Dong bo */}
      <Group title="Đồng bộ">
        <Field label="Cảnh báo">
          {d.syncFlags.length === 0 ? "Không" : d.syncFlags.join(", ")}
        </Field>
        <Field label="Web cập nhật lúc">
          {d.siteUpdatedAt ? new Date(d.siteUpdatedAt).toLocaleString("vi-VN") : "—"}
        </Field>
        <Field label="Đồng bộ mirror lúc">
          {d.syncedAt ? new Date(d.syncedAt).toLocaleString("vi-VN") : "—"}
        </Field>
        <Field label="Site ID">{d.siteId ?? "— (chưa có trên web)"}</Field>
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="mb-3 font-medium">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  mono,
  children,
}: {
  label: string;
  mono?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="text-sm">
      <span className="text-zinc-500">{label}: </span>
      <span className={mono ? "font-mono" : ""}>{children}</span>
    </div>
  );
}

function RefLink({ r }: { r: RelatedDestinationRef }) {
  return (
    <a href={`/dichoithoi/${r.slug}`} className="text-blue-600 hover:underline dark:text-blue-400">
      {r.name}
    </a>
  );
}

function RefList({
  title,
  refs,
  showDistance,
}: {
  title: string;
  refs: RelatedDestinationRef[];
  showDistance?: boolean;
}) {
  return (
    <div>
      <p className="mb-1 font-medium">{title}</p>
      {refs.length === 0 ? (
        <p className="text-zinc-400">—</p>
      ) : (
        <ul className="space-y-1">
          {refs.map((r) => (
            <li key={r.slug}>
              <RefLink r={r} />
              {showDistance && r.distanceMeters !== null && (
                <span className="text-zinc-400"> · cách {formatDistance(r.distanceMeters)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
