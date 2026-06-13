"use client";

import { use, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDestinationJobResponseSchema,
  destinationDetailSchema,
  listAiProvidersResponseSchema,
  publishDestinationResultSchema,
  type DestinationContentState,
  type DestinationDetail,
  type DestinationKind,
  type RelatedDestinationRef,
} from "@zinoflow/contracts";
import { apiGet, apiSend, ApiError } from "@/shared/api-client";
import {
  DestinationMetadataForm,
  type DestinationMetaValues,
} from "@/features/dichoithoi/destination-metadata-form";

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

const SITE_BASE_URL = "https://dichoithoi.com";

function formatDistance(meters: number | null): string {
  if (meters === null) return "";
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

/** Detail (API) -> gia tri khoi tao form metadata (string hoa, null -> "") */
function detailToFormValues(d: DestinationDetail): DestinationMetaValues {
  return {
    slug: d.slug,
    name: d.name,
    kind: d.kind,
    parentSlug: d.parentSlug ?? "",
    provinceCode: d.provinceCode ?? "",
    shortDescription: d.shortDescription ?? "",
    thumbnail: d.thumbnail ?? "",
    lat: d.lat === null ? "" : String(d.lat),
    lng: d.lng === null ? "" : String(d.lng),
    addressNew: d.addressNew ?? "",
    addressOld: d.addressOld ?? "",
    contactPhone: d.contactPhone ?? "",
    contactWebsite: d.contactWebsite ?? "",
    bookingUrl: d.bookingUrl ?? "",
    hotelGroupId: d.hotelGroupId ?? "",
    isFeatured: d.isFeatured,
  };
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

  // --- Chon AI provider / model (spec §7.4 "chon provider/model nhu form job") ---
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const providersQuery = useQuery({
    queryKey: ["ai-providers"],
    queryFn: () => apiGet("/content/ai-providers", listAiProvidersResponseSchema),
  });
  // Provider kha dung: co key + dang bat + co model. Provider dau tien lam default.
  const usableProviders = (providersQuery.data?.providers ?? []).filter(
    (p) => p.isConfigured && p.isEnabled && p.models.length > 0,
  );
  const selectedProvider =
    usableProviders.find((p) => p.key === provider) ?? usableProviders[0] ?? null;
  const selectedModel =
    selectedProvider?.models.find((m) => m.id === model) ?? selectedProvider?.models[0] ?? null;

  // --- Tao / cap nhat bai AI (spec §7.4) ---
  const [userNotes, setUserNotes] = useState("");
  const [refUrls, setRefUrls] = useState<Array<{ label: string; url: string }>>([
    { label: "Giá vé", url: "" },
    { label: "Giờ mở cửa", url: "" },
  ]);
  const [inputsSaved, setInputsSaved] = useState(false);
  // Tu dien lai thong tin AI da luu khi mo trang (chay 1 lan khi co data)
  useEffect(() => {
    if (!d) return;
    setUserNotes(d.aiNotes ?? "");
    setRefUrls(
      d.aiReferenceUrls.length > 0
        ? d.aiReferenceUrls
        : [
            { label: "Giá vé", url: "" },
            { label: "Giờ mở cửa", url: "" },
          ],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.slug]);

  const aiInputsBody = () => ({
    userNotes: userNotes.trim() || undefined,
    referenceUrls: refUrls.filter((r) => r.url.trim() && r.label.trim()),
  });

  // Luu thong tin cho AI ma chua tao bai
  const saveInputs = useMutation({
    mutationFn: () => apiSend("POST", `/destinations/${slug}/ai-inputs`, aiInputsBody()),
    onSuccess: () => {
      setActionError(null);
      setInputsSaved(true);
      invalidate();
    },
    onError: (e) => setActionError(toActionError(e)),
  });

  const createJob = useMutation({
    mutationFn: async () => {
      const body = aiInputsBody();
      return createDestinationJobResponseSchema.parse(
        await apiSend("POST", `/destinations/${slug}/jobs`, {
          mode: d?.contentState === "chua-co-bai" ? "create" : "update",
          userNotes: body.userNotes,
          referenceUrls: body.referenceUrls.length ? body.referenceUrls : undefined,
          aiProvider: selectedProvider?.key,
          aiModel: selectedModel?.id,
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

      {/* Cung cap thong tin cho AI viet bai (spec §7.4 / §3.5-3.6) */}
      <Group title="✍️ Viết bài bằng AI">
        {d.activeContentJobId ? (
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            <p>
              Đang có 1 bài {d.activeJobStatus ? `(${d.activeJobStatus})` : ""} cho điểm này.{" "}
              <a
                href={`/content/${d.activeContentJobId}`}
                className="font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Mở bài để xem / duyệt →
              </a>
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Muốn viết lại với thông tin mới? Hãy hoàn tất (hoặc từ chối) bài hiện tại trước.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="rounded bg-zinc-50 p-3 text-xs text-zinc-500 dark:bg-zinc-900">
              AI tự dùng dữ liệu điểm đến phía trên (tên, địa chỉ, tọa độ, điểm lân cận) làm nền.
              Phần dưới đây là nơi bạn <strong>bổ sung thông tin chính xác</strong> và{" "}
              <strong>website để AI đọc thêm</strong> — AI không bịa giá vé / giờ mở cửa, sẽ ưu tiên
              dữ liệu bạn cung cấp.
            </p>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Thông tin bạn cung cấp thêm cho AI
              </label>
              <p className="mb-1 text-xs text-zinc-500">
                Ví dụ: giá vé người lớn 70.000đ / trẻ em 30.000đ, mở cửa 6h–18h, đặc sản gần đó,
                điểm nên nhấn mạnh, lưu ý mùa cao điểm...
              </p>
              <textarea
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                rows={4}
                placeholder="Nhập thông tin chính xác bạn muốn AI dùng trong bài..."
                className="w-full rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Website nguồn để AI đọc thêm
              </label>
              <p className="mb-2 text-xs text-zinc-500">
                Dán link trang chính thức (giá vé, giờ mở cửa, giới thiệu...). AI sẽ đọc nội dung
                trang và dùng làm dữ liệu, ghi chú nguồn. Tối đa 5 nguồn.
              </p>
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
                      placeholder="Nhãn (vd Giá vé)"
                      className="w-36 rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
                    />
                    <input
                      value={row.url}
                      onChange={(e) =>
                        setRefUrls((rows) =>
                          rows.map((r, j) => (j === i ? { ...r, url: e.target.value } : r)),
                        )
                      }
                      placeholder="https://trang-nguon.vn/..."
                      className="flex-1 rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
                    />
                    {refUrls.length > 1 && (
                      <button
                        onClick={() => setRefUrls((rows) => rows.filter((_, j) => j !== i))}
                        className="rounded border border-zinc-300 px-2 text-sm text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      >
                        ✕
                      </button>
                    )}
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

            <div>
              <label className="mb-1 block text-sm font-medium">AI Provider / Model</label>
              {usableProviders.length === 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Chưa có AI provider khả dụng — kiểm tra API key và bật provider trong trang
                  Settings.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <select
                    value={selectedProvider?.key ?? ""}
                    onChange={(e) => {
                      setProvider(e.target.value);
                      setModel(""); // reset model khi doi provider
                    }}
                    className="rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
                  >
                    {usableProviders.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.displayName}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedModel?.id ?? ""}
                    onChange={(e) => setModel(e.target.value)}
                    className="rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
                  >
                    {(selectedProvider?.models ?? []).map((m) => (
                      <option key={m.id} value={m.id} title={m.costNote}>
                        {m.displayName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {selectedModel?.costNote && (
                <span className="mt-1 block text-xs text-zinc-400">{selectedModel.costNote}</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => createJob.mutate()}
                disabled={createJob.isPending || !selectedProvider || !selectedModel}
                className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {createJob.isPending
                  ? "Đang tạo bài..."
                  : d.contentState === "chua-co-bai"
                    ? "Tạo bài AI"
                    : "Viết lại / cập nhật bài"}
              </button>
              <button
                onClick={() => saveInputs.mutate()}
                disabled={saveInputs.isPending}
                className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                {saveInputs.isPending ? "Đang lưu..." : "Lưu thông tin (chưa tạo bài)"}
              </button>
              {inputsSaved && !saveInputs.isPending && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  ✅ Đã lưu — sẽ tự điền lại lần sau
                </span>
              )}
            </div>
          </div>
        )}
      </Group>

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

      {/* Thong tin diem den — form sua truc tiep (spec §7.3 tab Thong tin) */}
      <Group title="Thông tin điểm đến">
        <p className="mb-3 text-xs text-zinc-500">
          {d.siteId === null
            ? "Điểm tạo trong AI tool, chưa có trên web — sửa tại đây, sẽ ghi lên website khi publish bài."
            : "Sửa và lưu sẽ cập nhật thẳng lên website (metadata, không cần publish lại bài)."}
        </p>
        <DestinationMetadataForm
          initial={detailToFormValues(d)}
          isNew={false}
          onSaved={() => invalidate()}
        />
      </Group>

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
