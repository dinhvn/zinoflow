"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod/v4";
import {
  aiBatchSchema,
  checkAiBatchResponseSchema,
  contentJobSchema,
  createDestinationJobResponseSchema,
  destinationMirrorSchema,
  destinationTaxonomySchema,
  listAiProvidersResponseSchema,
  submitAiBatchResponseSchema,
  type AiBatch,
  type AiBatchTaskType,
} from "@zinoflow/contracts";
import { apiGet, apiSend, ApiError } from "@/shared/api-client";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Combobox } from "@/shared/ui/combobox";
import { DataTable } from "@/shared/ui/data-table";
import { FeatureIntro } from "@/shared/ui/feature-intro";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { Select } from "@/shared/ui/select";

const batchesListSchema = z.array(aiBatchSchema);
const jobsListSchema = z.array(contentJobSchema);
const destinationsListSchema = z.object({
  items: z.array(destinationMirrorSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

/** 1 dong trong dialog chon bài. needsJobCreation=true: entityId la slug diem
 * den CHUA co job — bam OK se tu tao job (che do Batch) truoc khi them vao
 * danh sach, KHONG can nguoi dung tu vao trang khac tao truoc. */
interface PickerItem {
  entityId: string;
  label: string;
  sublabel: string;
  needsJobCreation?: boolean;
}

/** 1 dong trong "danh sach da chon" — dung chung cho ca 4 taskType. */
interface StagedItem {
  entityId: string;
  label: string;
  sublabel: string;
  /** Chi cluster-poi-discovery dung — sua truc tiep trong bang, khong can mo lai dialog. */
  extraNotes?: string;
}

const TASK_TYPE_OPTIONS: { value: AiBatchTaskType; label: string; hint: string }[] = [
  {
    value: "content-outline",
    label: "Viết outline hàng loạt (bước 1)",
    hint: "Bấm \"+ Thêm bài\" — dialog gồm cả job đã tạo sẵn (chế độ Batch) lẫn điểm đến chưa có bài (chọn thì tự tạo job).",
  },
  {
    value: "content-article",
    label: "Viết nội dung hàng loạt (bước 2)",
    hint: "Chỉ chọn được job đã \"OutlineReady\" (đã gửi + kiểm tra xong batch outline).",
  },
  {
    value: "destination-gsg-extraction",
    label: "Trích xuất dữ liệu điểm đến hàng loạt",
    hint: "Kết quả ghi vào bảng staging, vào trang chi tiết điểm đến để duyệt như khi chạy đơn lẻ.",
  },
  {
    value: "cluster-poi-discovery",
    label: "Tìm điểm con hàng loạt",
    hint: "Chỉ áp dụng cho Cụm (Kind=cluster). Có thể ghi thêm \"Ghi chú\" riêng cho từng cụm.",
  },
];

const TASK_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  TASK_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

const BATCH_STATUS_TONES: Record<string, BadgeTone> = {
  submitted: "blue",
  succeeded: "emerald",
  failed: "red",
};

/** Giong het nhan dung o trang /dichoithoi — filter trong dialog dung chung nhan nay. */
const KIND_LABELS: Record<string, string> = {
  province: "Tỉnh/Thành",
  cluster: "Cụm",
  poi: "Điểm đến",
};
const CONTENT_STATE_LABELS: Record<string, string> = {
  "chua-co-bai": "Chưa có bài",
  "bai-tay": "Bài viết tay",
  "dang-soan": "Đang soạn / duyệt",
  "da-duyet": "Đã duyệt · chờ publish",
  "da-publish": "Đã publish (AI)",
};

/**
 * Dropdown chon chu ky tu dong lam moi toan bang (yeu cau nguoi dung 08/2026)
 * — moi lan het chu ky, kiem tra TAT CA batch dang "submitted" 1 luot; khong
 * co batch nao thoa thi khong goi API lan do.
 */
const AUTO_REFRESH_INTERVAL_OPTIONS = [
  { value: 15_000, label: "15 giây" },
  { value: 30_000, label: "30 giây" },
  { value: 60_000, label: "1 phút" },
  { value: 120_000, label: "2 phút" },
  { value: 300_000, label: "5 phút" },
];

/** Bo dau + lowercase — search khong dau (giong Combobox), dung trong dialog chon bài. */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
}

/**
 * Trang quản lý Batch AI (Gemini Batch API) — gửi nhiều item cùng lúc cho 1
 * loại tác vụ, rẻ hơn ~50% nhưng KHÔNG có kết quả ngay, phải tự bấm "Kiểm
 * tra" (không tự động chạy nền). Xem docs/specs/ai-batch-mode.md.
 */
export default function AiBatchesPage() {
  const queryClient = useQueryClient();
  const [taskType, setTaskType] = useState<AiBatchTaskType>("content-outline");
  const [staged, setStaged] = useState<StagedItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerChecked, setPickerChecked] = useState<Set<string>>(new Set());
  const [pickerAdding, setPickerAdding] = useState(false);
  const [pickerAddError, setPickerAddError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Rong = dung mac dinh (aiProvider/aiModel cua job voi viet bai, model co
  // dinh voi GSG/cluster-POI) — chon o day GHI DE cho CA batch nay, KHONG doi
  // aiModel luu tren job.
  const [modelOverrideKey, setModelOverrideKey] = useState("");
  // Filter trong dialog "+ Thêm bài" — giong het bo loc trang /dichoithoi (tinh
  // thanh/cum/cap do/trang thai), chi ap dung cho phan du lieu la "diem den".
  const [filterProvince, setFilterProvince] = useState("");
  const [filterParentSlug, setFilterParentSlug] = useState("");
  const [filterKind, setFilterKind] = useState("");
  const [filterContentState, setFilterContentState] = useState("");

  const providersQuery = useQuery({
    queryKey: ["ai-providers-for-batch"],
    queryFn: () => apiGet("/content/ai-providers", listAiProvidersResponseSchema),
  });
  const usableProviders = (providersQuery.data?.providers ?? []).filter(
    (p) => p.isConfigured && p.isEnabled && p.models.length > 0 && p.key === "gemini",
  );
  const modelOptions = usableProviders.flatMap((p) =>
    p.models.map((m) => ({ key: `${p.key}::${m.id}`, provider: p.key, model: m.id, label: m.id })),
  );
  const selectedModelOverride = modelOptions.find((o) => o.key === modelOverrideKey) ?? null;

  const isContentTask = taskType === "content-outline" || taskType === "content-article";
  const isClusterTask = taskType === "cluster-poi-discovery";
  const isDestinationTask = taskType === "destination-gsg-extraction" || isClusterTask;

  const jobsQuery = useQuery({
    queryKey: ["content-jobs-for-batch"],
    queryFn: () => apiGet("/content/jobs", jobsListSchema),
    enabled: isContentTask,
  });

  const taxonomyQuery = useQuery({
    queryKey: ["dichoithoi-taxonomy-for-batch"],
    queryFn: () => apiGet("/destinations/taxonomy", destinationTaxonomySchema),
    staleTime: 5 * 60 * 1000,
    enabled: isDestinationTask || taskType === "content-outline",
  });
  const clusterOptionsQuery = useQuery({
    queryKey: ["dichoithoi-clusters-for-batch"],
    // So cum co the vuot 200 (gioi han toi da 1 lan goi /destinations) — gop
    // nhieu trang lai cho toi khi du total, tranh dropdown thieu cum.
    queryFn: async () => {
      const all: z.infer<typeof destinationMirrorSchema>[] = [];
      let page = 1;
      for (;;) {
        const res = await apiGet(
          `/destinations?kind=cluster&limit=200&page=${page}`,
          destinationsListSchema,
        );
        all.push(...res.items);
        if (all.length >= res.total || res.items.length === 0 || page > 10) break;
        page += 1;
      }
      return all;
    },
    staleTime: 5 * 60 * 1000,
    enabled: isDestinationTask || taskType === "content-outline",
  });

  function destinationFilterQs(extra: string): string {
    const params = new URLSearchParams();
    if (filterProvince) params.set("provinceCode", filterProvince);
    if (filterParentSlug) params.set("parentSlug", filterParentSlug);
    if (filterKind) params.set("kind", filterKind);
    if (filterContentState) params.set("contentState", filterContentState);
    return `${extra}${extra.includes("?") ? "&" : "?"}${params.toString()}`;
  }

  const destinationsQuery = useQuery({
    queryKey: [
      "destinations-for-batch",
      isClusterTask ? "cluster" : "all",
      filterProvince,
      filterParentSlug,
      filterKind,
      filterContentState,
    ],
    queryFn: () =>
      apiGet(
        destinationFilterQs(`/destinations?limit=200${isClusterTask ? "&kind=cluster" : ""}`),
        destinationsListSchema,
      ),
    enabled: isDestinationTask,
  });
  // Chi content-outline can — cho phep chon thang diem den CHUA co job, dialog
  // se tu tao job (che do Batch) khi bam OK. contentState LUON co dinh
  // "chua-co-bai" (an toan — khong doc filterContentState) de tranh dung
  // vao diem da co job dang chay dang.
  const newDestinationsQuery = useQuery({
    queryKey: ["destinations-without-article", filterProvince, filterParentSlug, filterKind],
    queryFn: () =>
      apiGet(
        destinationFilterQs("/destinations?contentState=chua-co-bai&limit=200"),
        destinationsListSchema,
      ),
    enabled: taskType === "content-outline",
  });

  /** Nguon du lieu day du cho dialog chon bài — chua loc search/da-them. */
  const pickerSource: PickerItem[] = useMemo(() => {
    if (isContentTask) {
      const wantStatus = taskType === "content-outline" ? "Created" : "OutlineReady";
      const existingJobs = (jobsQuery.data ?? [])
        .filter((j) => j.generationMode === "batch" && j.status === wantStatus)
        .map((j) => ({
          entityId: j.id,
          label: j.topic,
          sublabel: `${j.siteCode} · ${j.aiProvider}/${j.aiModel}`,
        }));
      if (taskType !== "content-outline") return existingJobs;
      const newDestinations = (newDestinationsQuery.data?.items ?? []).map((d) => ({
        entityId: d.slug,
        label: d.name,
        sublabel: `🆕 ${d.kind} — chưa có job, sẽ tự tạo`,
        needsJobCreation: true,
      }));
      return [...existingJobs, ...newDestinations];
    }
    return (destinationsQuery.data?.items ?? []).map((d) => ({
      entityId: d.slug,
      label: d.name,
      sublabel: d.kind,
    }));
  }, [isContentTask, jobsQuery.data, destinationsQuery.data, newDestinationsQuery.data, taskType]);

  const pickerFiltered = useMemo(() => {
    const stagedIds = new Set(staged.map((s) => s.entityId));
    const remaining = pickerSource.filter((item) => !stagedIds.has(item.entityId));
    if (!pickerSearch.trim()) return remaining;
    const fq = fold(pickerSearch);
    return remaining.filter((item) => fold(item.label).includes(fq));
  }, [pickerSource, staged, pickerSearch]);

  const batchesQuery = useQuery({
    queryKey: ["ai-batches"],
    queryFn: () => apiGet("/ai-batches", batchesListSchema),
    refetchInterval: (query) =>
      query.state.data?.some((b) => b.status === "submitted") ? 5000 : false,
  });

  const submitBatch = useMutation({
    mutationFn: async () =>
      submitAiBatchResponseSchema.parse(
        await apiSend("POST", "/ai-batches", {
          taskType,
          items: staged.map((item) => ({
            entityId: item.entityId,
            params: isClusterTask && item.extraNotes?.trim() ? { extraNotes: item.extraNotes.trim() } : undefined,
          })),
          provider: selectedModelOverride?.provider,
          model: selectedModelOverride?.model,
        }),
      ),
    onSuccess: async () => {
      setStaged([]);
      setSubmitError(null);
      await queryClient.invalidateQueries({ queryKey: ["ai-batches"] });
      await queryClient.invalidateQueries({ queryKey: ["content-jobs-for-batch"] });
    },
    onError: (error) => {
      setSubmitError(error instanceof ApiError ? `${error.message}: ${error.details.join("; ")}` : String(error));
    },
  });

  const checkBatch = useMutation({
    mutationFn: async (batchId: string) =>
      checkAiBatchResponseSchema.parse(await apiSend("POST", `/ai-batches/${batchId}/check`, {})),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ai-batches"] });
      await queryClient.invalidateQueries({ queryKey: ["content-jobs-for-batch"] });
    },
  });

  // 1 tick chung o goc bang "Batch gần đây" — mac dinh KHONG bat (yeu cau
  // nguoi dung 08/2026). Bat len thi cu het moi chu ky se kiem tra TOAN BO
  // batch dang "submitted" 1 luot (khong co batch nao thoa thi khong goi gi).
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [autoRefreshIntervalMs, setAutoRefreshIntervalMs] = useState(AUTO_REFRESH_INTERVAL_OPTIONS[0]!.value);
  // Tranh chong lap khi 1 luot kiem tra chua xong ma da toi chu ky ke tiep.
  const autoRefreshTickRunning = useRef(false);

  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const timer = setInterval(() => {
      void (async () => {
        if (autoRefreshTickRunning.current) return;
        const batches = queryClient.getQueryData<AiBatch[]>(["ai-batches"]) ?? [];
        const pending = batches.filter((b) => b.status === "submitted");
        if (pending.length === 0) return;
        autoRefreshTickRunning.current = true;
        try {
          await Promise.all(
            pending.map((b) => apiSend("POST", `/ai-batches/${b.id}/check`, {}).catch(() => null)),
          );
          await queryClient.invalidateQueries({ queryKey: ["ai-batches"] });
          await queryClient.invalidateQueries({ queryKey: ["content-jobs-for-batch"] });
        } finally {
          autoRefreshTickRunning.current = false;
        }
      })();
    }, autoRefreshIntervalMs);
    return () => clearInterval(timer);
  }, [autoRefreshEnabled, autoRefreshIntervalMs, queryClient]);

  function togglePickerChecked(entityId: string) {
    setPickerChecked((prev) => {
      const next = new Set(prev);
      if (next.has(entityId)) next.delete(entityId);
      else next.add(entityId);
      return next;
    });
  }

  function closePicker() {
    setPickerOpen(false);
    setPickerSearch("");
    setPickerChecked(new Set());
    setPickerAddError(null);
  }

  /** Bam OK trong dialog — item thuong them thang, item needsJobCreation thi
   * tao job (che do Batch) truoc roi moi them, tat ca xong moi dong dialog. */
  async function confirmPicker() {
    const picked = pickerSource.filter((item) => pickerChecked.has(item.entityId));
    const needsCreation = picked.some((item) => item.needsJobCreation);
    if (needsCreation && !selectedModelOverride) {
      setPickerAddError('Chọn "Model" (Gemini) ở ngoài trước — cần model để tạo job cho điểm đến mới.');
      return;
    }
    setPickerAdding(true);
    setPickerAddError(null);
    try {
      const resolved: StagedItem[] = [];
      for (const item of picked) {
        if (item.needsJobCreation) {
          const created = createDestinationJobResponseSchema.parse(
            await apiSend("POST", `/destinations/${item.entityId}/jobs`, {
              mode: "create",
              generationMode: "batch",
              aiProvider: selectedModelOverride!.provider,
              aiModel: selectedModelOverride!.model,
            }),
          );
          resolved.push({ entityId: created.jobId, label: item.label, sublabel: "Điểm đến (job mới)" });
        } else {
          resolved.push(item);
        }
      }
      setStaged((prev) => [...prev, ...resolved]);
      await queryClient.invalidateQueries({ queryKey: ["destinations-without-article"] });
      await queryClient.invalidateQueries({ queryKey: ["content-jobs-for-batch"] });
      closePicker();
    } catch (error) {
      setPickerAddError(
        error instanceof ApiError ? `${error.message}: ${error.details.join("; ")}` : String(error),
      );
    } finally {
      setPickerAdding(false);
    }
  }

  function removeStaged(entityId: string) {
    setStaged((prev) => prev.filter((item) => item.entityId !== entityId));
  }

  function updateStagedNotes(entityId: string, notes: string) {
    setStaged((prev) => prev.map((item) => (item.entityId === entityId ? { ...item, extraNotes: notes } : item)));
  }

  return (
    <div className="max-w-5xl space-y-8">
      <h2 className="text-2xl font-semibold">Batch AI</h2>

      <FeatureIntro
        summary={
          <>
            Gửi <strong>nhiều item cùng lúc</strong> qua Gemini Batch API — rẻ hơn khoảng{" "}
            <strong>50%</strong> so với chạy từng cái, nhưng <strong>không có kết quả ngay</strong>{" "}
            (Google xử lý trong vài phút đến vài giờ). Thứ tự dùng: chọn{" "}
            <strong>Loại tác vụ</strong> → chọn <strong>Model</strong> (nếu cần) →{" "}
            <strong>&quot;+ Thêm bài&quot;</strong> (dialog có tìm kiếm) → bấm{" "}
            <strong>&quot;Chạy Batch AI&quot;</strong>. Sau khi gửi, tự bấm{" "}
            <strong>&quot;Kiểm tra&quot;</strong> ở bảng bên dưới khi muốn xem đã xong chưa — hệ
            thống không tự động chạy nền hay báo khi xong.
          </>
        }
        details={
          <>
            Chỉ Gemini hỗ trợ Batch API — job/điểm đến/cụm dùng AI provider khác sẽ bị từ chối lúc
            gửi. Viết bài cần 2 bước tách rời (outline trước, nội dung sau) vì bước 2 cần đọc kết quả
            bước 1 — gửi &quot;Viết outline hàng loạt&quot;, bấm Kiểm tra tới khi xong, rồi mới gửi
            &quot;Viết nội dung hàng loạt&quot; cho các job đó. Khi chọn &quot;Viết outline hàng
            loạt&quot;, dialog &quot;+ Thêm bài&quot; cho chọn cả điểm đến CHƯA có bài — hệ thống tự
            tạo job (chế độ Batch) ngay khi bấm chọn, không cần qua trang khác.
          </>
        }
      />

      {/* Chon tac vu + Model + xay danh sach (cart) */}
      <div className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-500">1. Loại tác vụ</span>
          <Select
            value={taskType}
            onChange={(e) => {
              setTaskType(e.target.value as AiBatchTaskType);
              setStaged([]);
              setPickerChecked(new Set());
              setFilterProvince("");
              setFilterParentSlug("");
              setFilterKind("");
              setFilterContentState("");
            }}
            className="w-full max-w-md"
          >
            {TASK_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-zinc-500">
            {TASK_TYPE_OPTIONS.find((o) => o.value === taskType)?.hint}
          </p>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-zinc-500">2. Model (tuỳ chọn — ghi đè cho cả batch này)</span>
          <Select
            value={modelOverrideKey}
            onChange={(e) => setModelOverrideKey(e.target.value)}
            className="w-full max-w-md"
          >
            <option value="">
              {isContentTask
                ? "Mặc định — dùng đúng model đã chọn lúc tạo từng job"
                : "Mặc định — gemini-3.6-flash (cố định như chạy đơn lẻ)"}
            </option>
            {modelOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-zinc-500">
            Chỉ liệt kê model Gemini — Batch API hiện chỉ Gemini hỗ trợ. Bắt buộc chọn nếu muốn thêm
            điểm đến chưa có job (dialog &quot;+ Thêm bài&quot; sẽ dùng model này để tạo job).
          </p>
        </label>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-zinc-500">3. Danh sách đã chọn ({staged.length})</span>
            <Button size="sm" variant="secondary" onClick={() => setPickerOpen(true)}>
              + Thêm bài
            </Button>
          </div>
          <DataTable
            columns={[
              { key: "label", header: "Tên", render: (item: StagedItem) => item.label },
              { key: "sublabel", header: "Ghi chú", render: (item) => item.sublabel },
              ...(isClusterTask
                ? [
                    {
                      key: "notes",
                      header: "Ghi chú thêm cho AI (tuỳ chọn)",
                      render: (item: StagedItem) => (
                        <Input
                          value={item.extraNotes ?? ""}
                          onChange={(e) => updateStagedNotes(item.entityId, e.target.value)}
                          placeholder="VD: chỉ tìm thêm điểm ẩn ít người biết"
                          className="w-full"
                        />
                      ),
                    },
                  ]
                : []),
              {
                key: "action",
                header: "",
                render: (item: StagedItem) => (
                  <Button size="sm" variant="ghost" onClick={() => removeStaged(item.entityId)}>
                    Xoá
                  </Button>
                ),
              },
            ]}
            items={staged}
            rowKey={(item) => item.entityId}
            emptyMessage='Chưa chọn bài nào — bấm "+ Thêm bài" để tìm và chọn.'
          />
        </div>

        {submitError && <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>}

        <Button
          variant="primary"
          loading={submitBatch.isPending}
          disabled={staged.length === 0}
          onClick={() => submitBatch.mutate()}
        >
          {submitBatch.isPending ? "Đang gửi..." : `4. Chạy Batch AI (${staged.length} item)`}
        </Button>
      </div>

      {/* Dialog tim + chon bài */}
      <Modal open={pickerOpen} onClose={closePicker} title={`Chọn bài — ${TASK_TYPE_LABELS[taskType]}`} width="max-w-3xl">
        <div className="space-y-3">
          <Input
            autoFocus
            value={pickerSearch}
            onChange={(e) => setPickerSearch(e.target.value)}
            placeholder="Tìm theo tên (gõ không dấu cũng được)..."
            className="w-full"
          />

          {(isDestinationTask || taskType === "content-outline") && (
            <div className="flex flex-wrap gap-2">
              <Combobox
                value={filterProvince}
                onChange={setFilterProvince}
                emptyLabel="Tất cả tỉnh/thành"
                placeholder="Tất cả tỉnh/thành"
                className="w-48"
                options={(taxonomyQuery.data?.provinces ?? []).map((p) => ({
                  value: p.provinceCode,
                  label: p.shortName,
                }))}
              />
              <Combobox
                value={filterParentSlug}
                onChange={setFilterParentSlug}
                emptyLabel="Tất cả cụm"
                placeholder="Tất cả cụm"
                className="w-56"
                options={(clusterOptionsQuery.data ?? []).map((c) => ({
                  value: c.slug,
                  label: c.name,
                }))}
              />
              {!isClusterTask && (
                <Select value={filterKind} onChange={(e) => setFilterKind(e.target.value)}>
                  <option value="">Mọi cấp độ</option>
                  {Object.entries(KIND_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
              {taskType !== "content-outline" && (
                <Select value={filterContentState} onChange={(e) => setFilterContentState(e.target.value)}>
                  <option value="">Mọi trạng thái bài</option>
                  {Object.entries(CONTENT_STATE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          )}
          {taskType === "content-outline" && (
            <p className="text-xs text-zinc-500">
              Mục điểm đến 🆕 luôn chỉ hiện loại &quot;Chưa có bài&quot; (an toàn) — không lọc được
              trạng thái ở đây.
            </p>
          )}
          <DataTable
            columns={[
              {
                key: "pick",
                header: "",
                render: (item: PickerItem) => (
                  <Checkbox
                    label=""
                    checked={pickerChecked.has(item.entityId)}
                    onChange={() => togglePickerChecked(item.entityId)}
                  />
                ),
              },
              { key: "label", header: "Tên", render: (item) => item.label },
              { key: "sublabel", header: "Ghi chú", render: (item) => item.sublabel },
            ]}
            items={pickerFiltered}
            rowKey={(item) => item.entityId}
            loading={
              isContentTask
                ? jobsQuery.isLoading || (taskType === "content-outline" && newDestinationsQuery.isLoading)
                : destinationsQuery.isLoading
            }
            emptyMessage="Không có bài nào khớp — hoặc tất cả đã được thêm vào danh sách."
          />
          {pickerAddError && <p className="text-sm text-red-600 dark:text-red-400">{pickerAddError}</p>}
          <div className="flex items-center justify-between border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <span className="text-xs text-zinc-500">Đã tick {pickerChecked.size} mục</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={closePicker}>
                Huỷ
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={pickerAdding}
                disabled={pickerChecked.size === 0}
                onClick={confirmPicker}
              >
                {pickerAdding ? "Đang thêm..." : `OK — thêm (${pickerChecked.size})`}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Danh sach batch */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 p-4 dark:border-zinc-800">
          <div>
            <h3 className="font-medium">Batch gần đây</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Bật <strong>&quot;Tự động làm mới&quot;</strong> để cứ hết mỗi chu kỳ hệ thống tự kiểm
              tra TẤT CẢ batch đang chờ (không có batch nào chờ thì không gọi gì). Mặc định KHÔNG bật.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              label="Tự động làm mới"
              checked={autoRefreshEnabled}
              onChange={() => setAutoRefreshEnabled((v) => !v)}
            />
            <Select
              value={autoRefreshIntervalMs}
              onChange={(e) => setAutoRefreshIntervalMs(Number(e.target.value))}
              disabled={!autoRefreshEnabled}
              className="w-32"
            >
              {AUTO_REFRESH_INTERVAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <DataTable
          columns={[
            { key: "taskType", header: "Loại tác vụ", render: (b: AiBatch) => TASK_TYPE_LABELS[b.taskType] ?? b.taskType },
            { key: "itemCount", header: "Số item", render: (b) => b.itemCount, align: "right" },
            {
              key: "status",
              header: "Trạng thái",
              render: (b) => <Badge tone={BATCH_STATUS_TONES[b.status] ?? "gray"}>{b.status}</Badge>,
            },
            { key: "createdAt", header: "Gửi lúc", render: (b) => new Date(b.createdAt).toLocaleString("vi-VN") },
            {
              key: "action",
              header: "",
              render: (b) =>
                b.status === "submitted" ? (
                  <Button
                    size="sm"
                    loading={checkBatch.isPending}
                    onClick={() => checkBatch.mutate(b.id)}
                  >
                    Kiểm tra
                  </Button>
                ) : null,
            },
          ]}
          items={batchesQuery.data ?? []}
          rowKey={(b) => b.id}
          loading={batchesQuery.isLoading}
          emptyMessage="Chưa gửi batch nào."
        />
      </div>
    </div>
  );
}
