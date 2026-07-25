"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { use, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod/v4";
import {
  contentJobSchema,
  createDestinationJobResponseSchema,
  // NOTE: createContentJobResponseSchema (job manual) khong con dung — Viet tay gio la
  // go thang vao editor phia duoi, khong con tao ContentJob rieng.
  destinationArticleSchema,
  destinationDetailSchema,
  destinationDraftQualityChecksResponseSchema,
  previewDestinationPublishHtmlResponseSchema,
  listAiProvidersResponseSchema,
  publishDestinationResultSchema,
  renameDestinationSlugResponseSchema,
  recomputeNearbyDistancesReportSchema,
  DESTINATION_BLOCK_LABELS,
  DESTINATION_LIST_BLOCK_KEYS,
  DESTINATION_SECTION_ORDER,
  type ContentSection,
  type DestinationArticle,
  type DestinationArticleFrame,
  type DestinationBlockKey,
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
import { DestinationPasteContentModal } from "@/features/dichoithoi/destination-paste-content-modal";
import { DestinationPromptPreviewModal } from "@/features/dichoithoi/destination-prompt-preview-modal";
import { DestinationArticleEditor } from "@/features/dichoithoi/destination-article-editor/destination-article-editor";
import { DestinationImageUploader } from "@/features/dichoithoi/destination-image-uploader";
import { DestinationGalleryEditor } from "@/features/dichoithoi/destination-gallery-editor";
import { DestinationPriceBreakdownEditor } from "@/features/dichoithoi/destination-price-breakdown-editor";
import { DestinationPracticalNotesEditor } from "@/features/dichoithoi/destination-practical-notes-editor";
import { DestinationEditorialReviewEditor } from "@/features/dichoithoi/destination-editorial-review-editor";
import { DestinationMetaTitleEditor } from "@/features/dichoithoi/destination-meta-title-editor";
import { DestinationExternalReviewUrlsEditor } from "@/features/dichoithoi/destination-external-review-urls-editor";
import { DestinationAiExtractionPanel } from "@/features/dichoithoi/destination-ai-extraction-panel";
import {
  DestinationJobSuggestionsModal,
  countAppliedFrameGroups,
  countAppliedJobSuggestions,
  mergeFrameGroup,
  FRAME_GROUP_KEYS,
  type FrameGroupKey,
} from "@/features/dichoithoi/destination-job-suggestions-modal";
import { DestinationHotelPanel } from "@/features/dichoithoi/destination-hotel-panel";
import { DestinationTourPanel } from "@/features/dichoithoi/destination-tour-panel";
import { Button, buttonClasses } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";

/** Draft response tu GET /content/jobs/:id/draft — article de lay goi y AI toan bai, id de tu choi job khi "Lam lai tu dau". */
const jobDraftSchema = z.object({
  id: z.string(),
  article: destinationArticleSchema.nullable().catch(null),
});

/** Skeleton rong cho diem den chua co draft_article nao — nguoi dung go thang vao day. */
function emptyDraftArticle(name: string): DestinationArticle {
  return {
    title: name,
    intro: "",
    quickFacts: { openingTime: "", ticketPrice: "", transport: "", food: "", hotel: "", tip: "" },
    faq: [],
    updateNotice: "",
    metadata: {
      name,
      slugSuggestion: "",
      metaTitle: "",
      metaDescription: "",
      description: "",
      searchKeyword: "",
    },
    sections: DESTINATION_SECTION_ORDER.map((blockKey) => ({
      heading: DESTINATION_BLOCK_LABELS[blockKey],
      content: "",
      blockKey,
      items: DESTINATION_LIST_BLOCK_KEYS.includes(blockKey) ? [] : undefined,
    })),
  };
}

/**
 * draft_article luu RAW o BE (co the dang soan dat do — thieu field, section rong).
 * Merge vao khung skeleton day du de editor KHONG crash khi doc field undefined
 * (vd countWords(article.intro) khi intro chua ton tai).
 */
function normalizeDraftArticle(raw: unknown, name: string): DestinationArticle {
  const empty = emptyDraftArticle(name);
  if (!raw || typeof raw !== "object") return empty;
  const r = raw as Partial<DestinationArticle>;

  const rawSections: unknown[] = Array.isArray(r.sections) ? (r.sections as unknown[]) : [];
  const isRecord = (s: unknown): s is Record<string, unknown> =>
    Boolean(s) && typeof s === "object";
  // Bai cu (truoc pivot blockKey) khong gan blockKey cho section nao — neu match
  // theo blockKey thi TOAN BO noi dung that se "bien mat" khoi editor (hien 6 o
  // rong) du van con nguyen o BE, rat de bi ghi de mat khi bam Luu. Fallback:
  // khong section nao co blockKey -> gan theo THU TU vi tri (index) thay vi bo trong.
  const hasAnyBlockKey = rawSections.some((s) => isRecord(s) && typeof s.blockKey === "string");
  const sections = DESTINATION_SECTION_ORDER.map((blockKey, index) => {
    const existing = hasAnyBlockKey
      ? rawSections.find((s): s is Record<string, unknown> => isRecord(s) && s.blockKey === blockKey)
      : (rawSections[index] as Record<string, unknown> | undefined);
    const fallback = empty.sections.find((s) => s.blockKey === blockKey)!;
    if (!existing || !isRecord(existing)) return fallback;
    return {
      heading: typeof existing.heading === "string" ? existing.heading : fallback.heading,
      content: typeof existing.content === "string" ? existing.content : "",
      blockKey,
      items: DESTINATION_LIST_BLOCK_KEYS.includes(blockKey)
        ? Array.isArray(existing.items)
          ? (existing.items as DestinationArticle["sections"][number]["items"])
          : []
        : undefined,
    };
  });

  return {
    title: typeof r.title === "string" ? r.title : empty.title,
    intro: typeof r.intro === "string" ? r.intro : empty.intro,
    quickFacts: {
      ...empty.quickFacts,
      ...(r.quickFacts && typeof r.quickFacts === "object" ? r.quickFacts : {}),
    },
    faq: Array.isArray(r.faq)
      ? r.faq.map((f) => ({
          question: typeof f?.question === "string" ? f.question : "",
          answer: typeof f?.answer === "string" ? f.answer : "",
        }))
      : empty.faq,
    updateNotice: typeof r.updateNotice === "string" ? r.updateNotice : empty.updateNotice,
    metadata: {
      ...empty.metadata,
      ...(r.metadata && typeof r.metadata === "object" ? r.metadata : {}),
    },
    sections,
  };
}

const KIND_LABELS: Record<DestinationKind, string> = {
  province: "Tỉnh/Thành",
  cluster: "Cụm",
  poi: "Điểm đến",
};

const CONTENT_STATE_LABELS: Record<DestinationContentState, string> = {
  "chua-co-bai": "Chưa có bài",
  "bai-tay": "Bài viết tay",
  "dang-soan": "Đang soạn / duyệt",
  "da-duyet": "Đã duyệt · chờ publish",
  "da-publish": "Đã publish (AI)",
};

const CONTENT_STATE_STYLES: Record<DestinationContentState, string> = {
  "chua-co-bai": "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  "bai-tay": "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  "dang-soan": "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "da-duyet": "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  "da-publish": "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

/**
 * "Status bai viet" (CONTENT_STATE_LABELS) va "Status AI" la 2 truc khac nhau,
 * nguoi dung yeu cau tach rieng (07/2026) thay vi ghep chung 1 dong nhu truoc
 * ("Đang soạn / duyệt · DraftReady" gay kho hieu). Status bai viet = vong doi
 * publish (it doi). Status AI = tien do rieng cua job AI dang chay, gom ca
 * "duyet 1 phan" — thong tin MOI, tinh tu so khoi da ap dung goi y AI qua popup
 * (destination-job-suggestions-modal.tsx) chu KHONG co san trong ContentJobStatus.
 */
type AiStatusInfo = { label: string; tone: string };

function aiStatusInfo(
  jobStatus: string | null,
  jobSuggestions: Partial<Record<DestinationBlockKey, ContentSection>>,
  frameSuggestion: DestinationArticleFrame | null,
  draftArticle: DestinationArticle | null,
): AiStatusInfo | null {
  if (!jobStatus) return null;
  if (jobStatus === "Created" || jobStatus === "GeneratingOutline") {
    return { label: "🤖 AI: Đang soạn", tone: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" };
  }
  if (jobStatus === "Failed") {
    return { label: "🤖 AI: Lỗi, cần tạo lại", tone: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" };
  }
  if (jobStatus === "Approved") {
    return { label: "🤖 AI: Đã duyệt", tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" };
  }
  // DraftReady / InReview / Rejected — tinh theo so muc (khoi + nhom thong tin
  // chung) da ap dung goi y thuc te, chinh xac hon la doan theo status tho cua job.
  const sectionProgress = draftArticle
    ? countAppliedJobSuggestions(jobSuggestions, draftArticle)
    : { total: 0, applied: 0 };
  const frameProgress = draftArticle
    ? countAppliedFrameGroups(frameSuggestion, draftArticle)
    : { total: 0, applied: 0 };
  const total = sectionProgress.total + frameProgress.total;
  const applied = sectionProgress.applied + frameProgress.applied;
  if (total === 0 || applied === 0) {
    return { label: "🤖 AI: Chờ duyệt", tone: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" };
  }
  if (applied < total) {
    return {
      label: `🤖 AI: Duyệt 1 phần (${applied}/${total} mục)`,
      tone: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
    };
  }
  return { label: "🤖 AI: Đã duyệt", tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" };
}

const SITE_BASE_URL = "https://dichoithoi.com";
/** DiChoiThoi.Web chay local qua `dotnet run` (profile http/https) — Properties/launchSettings.json */
const LOCAL_SITE_BASE_URL = "http://localhost:5176";

const GATE_LABELS: Record<string, string> = {
  structure: "Cấu trúc bài viết",
  seo: "SEO",
  policy: "Chính sách nội dung",
  data: "Dữ liệu thực tế",
  originality: "Trùng lặp nội dung (cảnh báo)",
};

/**
 * Trang co 16 khoi — thay vi cuon 1 trang dai (cu, gay roi/kho dung — phan hoi
 * nguoi dung 07/2026), gom thanh 6 tab + menu doc CO DINH ben phai. Bam 1 muc
 * chi hien DUNG panel do (cac panel khac an bang CSS "hidden", KHONG unmount,
 * de khong mat state form khi chuyen qua lai). Chi toi uu desktop — khong lam
 * fallback mobile (nguoi dung xac nhan chi dung man hinh rong).
 */
const TABS = [
  { id: "images", label: "Hình ảnh", icon: "🖼️" },
  { id: "ai-tools", label: "AI hỗ trợ", icon: "🤖" },
  { id: "content", label: "Nội dung", icon: "📝" },
  { id: "basic-info", label: "Thông tin cơ bản", icon: "ℹ️" },
  { id: "commerce", label: "Thương mại & bổ trợ", icon: "💰" },
  { id: "recommendations", label: "Gợi ý liên quan", icon: "🔗" },
  { id: "relations", label: "Quan hệ & đồng bộ", icon: "🧭" },
] as const;
type TabId = (typeof TABS)[number]["id"];

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
    googleMapsUrl: d.googleMapsUrl ?? "",
    addressNew: d.addressNew ?? "",
    addressOld: d.addressOld ?? "",
    contactPhone: d.contactPhone ?? "",
    contactWebsite: d.contactWebsite ?? "",
    hotelGroupId: d.hotelGroupId ?? "",
    priority: d.priority,
    contentTier: d.contentTier ?? "",
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

  // Tab dang mo — menu doc ben phai (thay scrollspy cu, xem ghi chu o TABS).
  // Dong bo voi query param ?tab= de reload trang KHONG bi nhay ve tab mac dinh
  // "Hinh anh" (bug nguoi dung phat hien 07/2026 — truoc day chi la useState thuan,
  // mat het khi F5).
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const activeTab: TabId = TABS.some((t) => t.id === tabFromUrl) ? (tabFromUrl as TabId) : TABS[0].id;
  function setActiveTab(next: TabId) {
    const qs = new URLSearchParams(searchParams.toString());
    qs.set("tab", next);
    router.replace(`${pathname}?${qs.toString()}`, { scroll: false });
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

  // Tao job AI (pivot gop editor): KHONG con dieu huong sang /content/{jobId} —
  // poll trang thai ngay tai day, goi y tra ve hien inline trong tung block.
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
    onSuccess: () => {
      setActionError(null);
      setLoadedSuggestionsForJob(null);
      setJobSuggestions({});
      setJobFrameSuggestion(null);
      invalidate();
    },
    onError: (e) => setActionError(toActionError(e)),
  });
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [promptPreviewOpen, setPromptPreviewOpen] = useState(false);

  // --- Ban nhap bai viet (draft_article) — pivot gop editor vao trang detail ---
  const [draftArticle, setDraftArticle] = useState<DestinationArticle | null>(null);
  const [savedDraftJson, setSavedDraftJson] = useState<string | null>(null);
  useEffect(() => {
    if (!d) return;
    const initial = normalizeDraftArticle(d.draftArticle, d.name);
    setDraftArticle(initial);
    setSavedDraftJson(JSON.stringify(initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.slug]);
  const isDraftDirty = draftArticle !== null && JSON.stringify(draftArticle) !== savedDraftJson;

  const saveDraftArticle = useMutation({
    mutationFn: async (article: DestinationArticle) => {
      await apiSend("PATCH", `/destinations/${slug}/draft-article`, { draftArticle: article });
      return article;
    },
    onSuccess: (article) => {
      setActionError(null);
      setSavedDraftJson(JSON.stringify(article));
      void qualityQuery.refetch();
    },
    onError: (e) => setActionError(toActionError(e)),
  });

  // --- "Lam lai tu dau" (yeu cau nguoi dung 07/2026): tu choi job dang do (neu co,
  // qua submit-review -> InReview -> Reject) de mo khoa "Tao bai AI", roi xoa sach
  // ban nhap ve skeleton rong. Tai dung nguyen endpoint review/submit-review da co,
  // khong them use-case BE moi.
  const resetDraft = useMutation({
    mutationFn: async () => {
      if (!d) throw new Error("Chưa tải xong dữ liệu điểm đến");
      if (d.activeContentJobId && jobStatus && ["Created", "GeneratingOutline"].includes(jobStatus)) {
        throw new Error("AI đang xử lý bài — đợi xong (hoặc Failed) rồi mới làm lại được");
      }
      if (d.activeContentJobId && jobStatus && !["Failed", "Rejected"].includes(jobStatus)) {
        if (jobStatus === "DraftReady" || jobStatus === "Approved") {
          await apiSend("POST", `/content/jobs/${d.activeContentJobId}/submit-review`, {});
        }
        const draft = await apiGet(`/content/jobs/${d.activeContentJobId}/draft`, jobDraftSchema);
        await apiSend("POST", `/content/drafts/${draft.id}/review`, {
          action: "Reject",
          note: "Người dùng chọn Làm lại từ đầu",
        });
      }
      const empty = emptyDraftArticle(d.name);
      await apiSend("PATCH", `/destinations/${slug}/draft-article`, { draftArticle: empty });
      return empty;
    },
    onSuccess: (empty) => {
      setActionError(null);
      setDraftArticle(empty);
      setSavedDraftJson(JSON.stringify(empty));
      setSuggestions({});
      setJobSuggestions({});
      setJobFrameSuggestion(null);
      invalidate();
      void jobStatusQuery.refetch();
      void qualityQuery.refetch();
    },
    onError: (e) => setActionError(toActionError(e)),
  });

  // --- Goi y AI theo tung block (pivot: AI ho tro doc lap, khong tu ghi de) ---
  const [suggestions, setSuggestions] = useState<Partial<Record<DestinationBlockKey, ContentSection>>>({});
  const [suggestLoading, setSuggestLoading] = useState<Set<DestinationBlockKey>>(new Set());
  // Khoi dang duoc ap dung (PATCH dang chay) — chi 1 khoi tai 1 thoi diem, cac
  // nut "Ap dung" khac bi disable trong luc nay de dam bao luon merge tren
  // draftArticle moi nhat, tranh 2 PATCH song song ghi de nhau (bug 07/2026:
  // duyet xong reload lai mat du lieu — nguyen nhan that la schema AI sai, da
  // fix o destinationSectionSchema, day chi la chot an toan them).
  const [applyingBlockKey, setApplyingBlockKey] = useState<DestinationBlockKey | null>(null);

  async function requestBlockSuggestion(blockKey: DestinationBlockKey) {
    setSuggestLoading((prev) => new Set(prev).add(blockKey));
    try {
      const section = await apiSend("POST", `/destinations/${slug}/blocks/${blockKey}/suggest`, {
        aiProvider: selectedProvider?.key,
        aiModel: selectedModel?.id,
      });
      setSuggestions((prev) => ({ ...prev, [blockKey]: section as ContentSection }));
      setActionError(null);
    } catch (e) {
      setActionError(toActionError(e));
    } finally {
      setSuggestLoading((prev) => {
        const next = new Set(prev);
        next.delete(blockKey);
        return next;
      });
    }
  }

  // Ap dung NGAY 1 goi y — merge vao draftArticle HIEN TAI roi PATCH luon (khong
  // qua buoc tick + nut gop nua, nguoi dung muon duyet xong la luu ngay tai cho).
  // applyingBlockKey chan cac nut "Ap dung" khac trong luc request nay dang chay
  // de dam bao tuan tu, khong bao gio 2 PATCH bay song song ghi de nhau.
  async function applySuggestion(blockKey: DestinationBlockKey) {
    if (applyingBlockKey !== null || !draftArticle) return;
    const suggestion = suggestions[blockKey];
    if (!suggestion) return;
    const nextSections = draftArticle.sections.map((s) =>
      s.blockKey === blockKey ? { ...s, ...suggestion, blockKey } : s,
    );
    const next = { ...draftArticle, sections: nextSections };
    setDraftArticle(next);
    setApplyingBlockKey(blockKey);
    try {
      await saveDraftArticle.mutateAsync(next);
      setSuggestions((prev) => {
        const rest = { ...prev };
        delete rest[blockKey];
        return rest;
      });
    } finally {
      setApplyingBlockKey(null);
    }
  }

  function dismissBlockSuggestion(blockKey: DestinationBlockKey) {
    setSuggestions((prev) => {
      const rest = { ...prev };
      delete rest[blockKey];
      return rest;
    });
  }

  // --- Goi y AI toan bai (6 khoi) tu job vua tao — xem/ap dung qua popup, giong
  // co che "Xem thong tin AI trich xuat": khong tu dong hien inline, khong tu an
  // sau khi ap dung, ap dung lai duoc bat ky luc nao ke ca sau khi reload trang
  // (fix bug 07/2026: truoc day hien inline va nap lai moi lan reload). ---
  const [jobSuggestions, setJobSuggestions] = useState<Partial<Record<DestinationBlockKey, ContentSection>>>({});
  // Phan "frame" (tieu de/mo bai/quickFacts/faq/metadata) AI cung sinh ra cung luc
  // voi 7 khoi noi dung nhung truoc day bi bo qua hoan toan trong popup — nguoi
  // dung phai go tay lai tu dau du AI da viet san (phat hien 07/2026).
  const [jobFrameSuggestion, setJobFrameSuggestion] = useState<DestinationArticleFrame | null>(null);
  const [applyingAllJobSuggestions, setApplyingAllJobSuggestions] = useState(false);
  const [applyingFrameGroup, setApplyingFrameGroup] = useState<FrameGroupKey | null>(null);
  const anyJobSuggestionBusy = applyingBlockKey !== null || applyingAllJobSuggestions || applyingFrameGroup !== null;

  async function applyJobSuggestion(blockKey: DestinationBlockKey) {
    if (anyJobSuggestionBusy || !draftArticle) return;
    const suggestion = jobSuggestions[blockKey];
    if (!suggestion) return;
    const nextSections = draftArticle.sections.map((s) =>
      s.blockKey === blockKey ? { ...s, ...suggestion, blockKey } : s,
    );
    const next = { ...draftArticle, sections: nextSections };
    setDraftArticle(next);
    setApplyingBlockKey(blockKey);
    try {
      await saveDraftArticle.mutateAsync(next);
    } finally {
      setApplyingBlockKey(null);
    }
  }

  async function applyJobFrameGroup(group: FrameGroupKey) {
    if (anyJobSuggestionBusy || !draftArticle || !jobFrameSuggestion) return;
    const next = mergeFrameGroup(draftArticle, group, jobFrameSuggestion);
    setDraftArticle(next);
    setApplyingFrameGroup(group);
    try {
      await saveDraftArticle.mutateAsync(next);
    } finally {
      setApplyingFrameGroup(null);
    }
  }

  // Ap dung 1 luot TOAN BO goi y AI dang co — ca 7 khoi noi dung LAN 4 nhom thong
  // tin chung (khong chi rieng phan chua ap dung — bam lai van ghi de ve dung ban
  // AI goc cho ca phan da ap dung truoc do) — gop thanh 1 PATCH duy nhat thay vi
  // tung muc mot de tranh nhieu request roi rac.
  async function applyAllJobSuggestions() {
    if (anyJobSuggestionBusy || !draftArticle) return;
    const nextSections = draftArticle.sections.map((s) => {
      const blockKey = s.blockKey as DestinationBlockKey;
      const suggestion = jobSuggestions[blockKey];
      return suggestion ? { ...s, ...suggestion, blockKey } : s;
    });
    let next = { ...draftArticle, sections: nextSections };
    if (jobFrameSuggestion) {
      for (const group of FRAME_GROUP_KEYS) {
        next = mergeFrameGroup(next, group, jobFrameSuggestion);
      }
    }
    setDraftArticle(next);
    setApplyingAllJobSuggestions(true);
    try {
      await saveDraftArticle.mutateAsync(next);
    } finally {
      setApplyingAllJobSuggestions(false);
    }
  }

  // --- Theo doi job AI toan bai (neu dang chay) de lay goi y cho ca 6 block ---
  // Dung latestContentJobId (KHONG phai activeContentJobId): publish clear
  // activeContentJobId, nhung job cu van co the duoc Retry lai tu trang /content
  // chung sau do — neu chi theo activeContentJobId thi goi y/status AI cua lan
  // chay do bien mat vinh vien (bug 07/2026). Gate "dang co job dang chay" (tao
  // job moi/lam lai tu dau) van dung activeContentJobId rieng, khong doi.
  const jobId = d?.latestContentJobId ?? d?.activeContentJobId ?? null;
  const jobStatusQuery = useQuery({
    queryKey: ["destination-content-job-status", jobId],
    queryFn: () => apiGet(`/content/jobs/${jobId}`, contentJobSchema),
    enabled: Boolean(jobId),
    refetchInterval: (q) =>
      q.state.data && ["Created", "GeneratingOutline"].includes(q.state.data.status) ? 3000 : false,
  });
  const jobStatus = jobStatusQuery.data?.status ?? null;
  // Key theo jobId + status: job co the CHAY LAI (giu nguyen jobId, tao draft version moi) —
  // neu chi gate theo jobId thi lan chay thu 2/3 tro di se KHONG bao gio fetch lai goi y moi,
  // nut Ap dung/status AI bien mat sau khi chay lai (bug 07/2026, phat hien qua lan chay 3).
  const [loadedSuggestionsForJob, setLoadedSuggestionsForJob] = useState<string | null>(null);
  useEffect(() => {
    if (!jobId || !jobStatus) return;
    if (jobStatus === "Created" || jobStatus === "GeneratingOutline") {
      // Job dang chay lai (co the la lan 2/3...) — reset gate de khi xong se fetch lai goi y moi.
      if (loadedSuggestionsForJob !== null) setLoadedSuggestionsForJob(null);
      return;
    }
    if (jobStatus === "Failed") return;
    const loadKey = `${jobId}:${jobStatus}`;
    if (loadedSuggestionsForJob === loadKey) return;
    setLoadedSuggestionsForJob(loadKey);
    void (async () => {
      try {
        const draft = await apiGet(`/content/jobs/${jobId}/draft`, jobDraftSchema);
        if (!draft.article) return;
        const next: Partial<Record<DestinationBlockKey, ContentSection>> = {};
        // Canh bao neu bai AI co blockKey khong hop le (khoi cu "meo-luu-y"/"khac")
        // hoac trung lap — truoc day AM THAM mat noi dung (ghi de/loc bo) khien
        // nguoi dung tuong nham la loi luu du lieu (bug 07/2026). Da chan tu goc o
        // schema output AI (destinationSectionSchema), day chi la luoi an toan cho
        // job cu tao truoc khi sua.
        const invalidHeadings: string[] = [];
        const duplicateHeadings: string[] = [];
        for (const s of draft.article.sections) {
          if (!s.blockKey || !(DESTINATION_SECTION_ORDER as readonly string[]).includes(s.blockKey)) {
            invalidHeadings.push(s.heading);
            continue;
          }
          if (next[s.blockKey as DestinationBlockKey]) {
            duplicateHeadings.push(s.heading);
          }
          next[s.blockKey as DestinationBlockKey] = s;
        }
        if (invalidHeadings.length > 0 || duplicateHeadings.length > 0) {
          const parts = [];
          if (invalidHeadings.length > 0) {
            parts.push(`không gán đúng khối chuẩn: ${invalidHeadings.join(", ")}`);
          }
          if (duplicateHeadings.length > 0) {
            parts.push(`trùng khối với mục khác (chỉ giữ bản sau): ${duplicateHeadings.join(", ")}`);
          }
          setActionError({
            message: "AI tạo bài nhưng một số khối không hiển thị được để duyệt — bấm \"🤖 Tạo lại bằng AI\" riêng cho khối đó.",
            details: parts,
          });
        }
        setJobSuggestions(next);
        setJobFrameSuggestion({
          title: draft.article.title,
          intro: draft.article.intro,
          quickFacts: draft.article.quickFacts,
          faq: draft.article.faq,
          updateNotice: draft.article.updateNotice,
          metadata: draft.article.metadata,
        });
      } catch {
        // Job co the chua co draft (vd Failed truoc do) — bo qua, khong chan UI
      }
    })();
  }, [jobId, jobStatus, loadedSuggestionsForJob]);

  // --- Gate check doc lap tren draft_article hien tai (pivot — thay Approve rieng) ---
  const qualityQuery = useQuery({
    queryKey: ["destination-draft-quality", slug],
    queryFn: () =>
      apiSend("POST", `/destinations/${slug}/draft-article/quality-checks`, {}).then((r) =>
        destinationDraftQualityChecksResponseSchema.parse(r),
      ),
    enabled: Boolean(d),
  });

  // --- Xem truoc HTML se dang (dry-run, khong ghi DB) ---
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewPublish = useMutation({
    mutationFn: async () =>
      previewDestinationPublishHtmlResponseSchema.parse(
        await apiSend("POST", `/destinations/${slug}/draft-article/preview-publish-html`, {}),
      ),
    onSuccess: () => {
      setActionError(null);
      setPreviewOpen(true);
    },
    onError: (e) => setActionError(toActionError(e)),
  });

  // --- Publish (chay gate ngay tai buoc nay, khong con Approve rieng) ---
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

  // --- Doi slug (Phase 24 chieu ghi) — thao tac RIENG, canh bao ro, tach khoi form sua thuong ---
  const [renameOpen, setRenameOpen] = useState(false);
  const [newSlugInput, setNewSlugInput] = useState("");
  const renameSlug = useMutation({
    mutationFn: async () =>
      renameDestinationSlugResponseSchema.parse(
        await apiSend("POST", `/destinations/${slug}/rename-slug`, {
          newSlug: newSlugInput.trim(),
        }),
      ),
    onSuccess: (r) => {
      window.location.href = `/dichoithoi/${r.newSlug}`;
    },
    onError: (e) => setActionError(toActionError(e)),
  });

  // --- Tinh khoang cach duong bo that toi cac diem gan (dichoithoi-poi-distance-plan.md
  // Giai doan 3) — tu lam moi RelatedJson cua chinh diem nay ngay sau khi tinh xong ---
  const recomputeNearbyDistances = useMutation({
    mutationFn: async () =>
      recomputeNearbyDistancesReportSchema.parse(
        await apiSend("POST", `/destinations/${slug}/recompute-nearby-distances`, {}),
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

  const missingThumbnail = !d.thumbnail?.trim();
  const qualityChecks = qualityQuery.data?.checks ?? [];
  const gatePassed = qualityQuery.data?.allPassed ?? false;
  const canPublish = !missingThumbnail && gatePassed && !isDraftDirty;

  return (
    <div className="max-w-6xl space-y-4">
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
              </span>
              {(() => {
                const ai = aiStatusInfo(jobStatus, jobSuggestions, jobFrameSuggestion, draftArticle);
                return ai ? <span className={`rounded px-2 py-0.5 ${ai.tone}`}>{ai.label}</span> : null;
              })()}
              <span className="font-mono text-zinc-400">{d.slug}</span>
            </div>
            {/* Nhóm/Type/Tag — chỉ-đọc, sửa ở /dichoithoi/phan-loai (Type) và
                /dichoithoi/chu-de (Tag) (phản hồi người dùng 24/07/2026: trang này
                trước đây không hiện thông tin phân loại gì cả). */}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
              {d.assignedTypes.length === 0 && d.assignedTags.length === 0 ? (
                <span className="text-zinc-400">
                  Chưa phân loại — gán ở{" "}
                  <a href="/dichoithoi/phan-loai" className="underline hover:text-zinc-600">
                    Loại hình
                  </a>{" "}
                  /{" "}
                  <a href="/dichoithoi/chu-de" className="underline hover:text-zinc-600">
                    Chủ đề
                  </a>
                </span>
              ) : (
                <>
                  {d.assignedTypes.map((t) => (
                    <span
                      key={t.slug}
                      title={t.groupName}
                      className="rounded bg-indigo-100 px-2 py-0.5 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                    >
                      {t.name}
                    </span>
                  ))}
                  {d.assignedTags.map((t) => (
                    <span
                      key={t.slug}
                      className="rounded bg-teal-100 px-2 py-0.5 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
                    >
                      #{t.name}
                    </span>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`${LOCAL_SITE_BASE_URL}/diem-den/${d.slug}`}
            target="_blank"
            rel="noreferrer"
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            Xem local ↗
          </a>
          <a
            href={`${SITE_BASE_URL}/diem-den/${d.slug}`}
            target="_blank"
            rel="noreferrer"
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            Xem production ↗
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

      {/* Trang thai xuat ban — dua len day (thay vi nam trong tab "Noi dung & xuat
          ban") vi gate + nut Dang la thao tac nguoi dung can thay/bam DU DANG O
          TAB NAO (phan hoi nguoi dung 07/2026), khong chi khi dang xem noi dung. */}
      <Group title="Trạng thái xuất bản">
        <div className="space-y-1 text-sm">
          {qualityQuery.isFetching ? (
            <p className="text-zinc-400">Đang kiểm tra...</p>
          ) : qualityQuery.isError ? (
            <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              <p className="font-medium">
                {qualityQuery.error instanceof ApiError
                  ? qualityQuery.error.message
                  : "Chưa kiểm tra được — nội dung chưa đủ để phân tích"}
              </p>
              {qualityQuery.error instanceof ApiError && qualityQuery.error.details.length > 0 && (
                <ul className="mt-1 list-inside list-disc">
                  {qualityQuery.error.details.map((detail, i) => (
                    <li key={i}>{detail}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : qualityChecks.length === 0 ? (
            <p className="text-zinc-400">Chưa chạy kiểm tra.</p>
          ) : (
            qualityChecks.map((check) => {
              const isWarning = !check.passed && check.severity === "warning";
              return (
                <div key={check.gateName} className="flex items-start justify-between gap-3">
                  <span>{GATE_LABELS[check.gateName] ?? check.gateName}</span>
                  {check.passed ? (
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      Đạt
                    </span>
                  ) : isWarning ? (
                    <span
                      className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      title={check.details.join("; ")}
                    >
                      ⚠️ Cảnh báo ({check.details.length})
                    </span>
                  ) : (
                    <span
                      className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300"
                      title={check.details.join("; ")}
                    >
                      Chưa đạt ({check.details.length})
                    </span>
                  )}
                </div>
              );
            })
          )}
          {qualityChecks.some((c) => !c.passed && c.severity !== "warning") && (
            <ul className="mt-2 list-inside list-disc rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {qualityChecks
                .filter((c) => !c.passed && c.severity !== "warning")
                .flatMap((c) => c.details)
                .map((detail, i) => (
                  <li key={i}>{detail}</li>
                ))}
            </ul>
          )}
          {qualityChecks.some((c) => !c.passed && c.severity === "warning") && (
            <ul className="mt-2 list-inside list-disc rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
              {qualityChecks
                .filter((c) => !c.passed && c.severity === "warning")
                .flatMap((c) => c.details)
                .map((detail, i) => (
                  <li key={i}>{detail}</li>
                ))}
            </ul>
          )}
        </div>

        {missingThumbnail && (
          <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
            ⚠️ Chưa có <strong>ảnh đại diện</strong> — bắt buộc phải có ảnh mới đăng lên web được.
            Thêm ảnh ở tab &quot;🖼️ Hình ảnh&quot; bên phải.
          </div>
        )}
        {isDraftDirty && (
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
            Có thay đổi chưa lưu — bấm &quot;Lưu bản nháp&quot; (tab &quot;📝 Nội dung&quot;) trước
            khi kiểm tra/đăng.
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" loading={qualityQuery.isFetching} onClick={() => qualityQuery.refetch()}>
            Chạy kiểm tra
          </Button>
          <Button
            size="sm"
            variant="secondary"
            loading={previewPublish.isPending}
            onClick={() => previewPublish.mutate()}
          >
            👁️ Xem trước bản sẽ đăng
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 text-white hover:bg-blue-700"
            loading={publish.isPending}
            disabled={!canPublish}
            title={
              isDraftDirty
                ? "Lưu bản nháp trước khi đăng"
                : missingThumbnail
                  ? "Chưa có ảnh đại diện"
                  : !gatePassed
                    ? "Chưa qua hết các gate kiểm tra ở trên"
                    : undefined
            }
            onClick={() => publish.mutate()}
          >
            {publish.isPending ? "Đang đăng..." : "Đăng lên dichoithoi"}
          </Button>
        </div>

        {publish.data && (
          <div className="mt-3 rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
            ✅ Đã đăng lên dichoithoi ({(publish.data.durationMs / 1000).toFixed(1)}s) — cập nhật khối
            liên quan cho {publish.data.relatedRecomputed} điểm.
            {publish.data.addedLinks.length > 0 &&
              ` Link nội bộ: ${publish.data.addedLinks.map((l) => l.targetName).join(", ")}.`}
          </div>
        )}
      </Group>

      {/* Layout tab: noi dung ben trai, menu doc CO DINH ben phai (redesign 07/2026 —
          trang cu 1 mach dai 16 khoi gay roi, xem TABS). Panel an bang "hidden"
          (khong unmount) de giu nguyen state form khi chuyen qua lai. */}
      <div className="grid grid-cols-[1fr_190px] items-start gap-5">
        <div className="min-w-0 space-y-4">
          <div className={activeTab === "images" ? "space-y-4" : "hidden"}>
            <PanelHead title="🖼️ Hình ảnh" hint="Ảnh đại diện dùng cho card/thumbnail và thư viện ảnh hiển thị ở hero + dải ảnh vuốt trên web." />
            <DestinationImageUploader
              slug={d.slug}
              imageUrl={d.imageUrl}
              thumbnailPath={d.thumbnail}
              heroImageMeta={d.heroImageMeta}
              onUploaded={invalidate}
            />
            <DestinationGalleryEditor
              slug={d.slug}
              gallery={d.gallery}
              imageUrls={d.galleryImageUrls}
              onSaved={invalidate}
            />
          </div>

          <div className={activeTab === "ai-tools" ? "space-y-4" : "hidden"}>
            <PanelHead title="🤖 AI hỗ trợ" hint="Trích xuất dữ liệu điểm đến từ Google Maps/web tham khảo, và nhập thông tin để AI viết bài — kết quả dùng ở tab &quot;📝 Nội dung&quot; và &quot;ℹ️ Thông tin cơ bản&quot;/&quot;💰 Thương mại & bổ trợ&quot;." />

      {/* Trich xuat AI tu Google Maps + web tham khao (dichoithoi-destination-ai-extraction-plan
          §2.3) — tach tab rieng (07/2026, theo yeu cau nguoi dung): ket qua trich xuat ghi
          vao CA 3 tab (Thong tin co ban: ten/dia chi/SDT/website/mo ta/meta title; Thuong mai:
          gio mo cua/gia/danh gia bien tap/link review; va aiReferenceSummary lam ngu canh nen
          cho AI viet bai ngay duoi day) — khong thuoc rieng 1 tab do nen gom chung voi phan
          nhap thong tin AI vao 1 tab "AI ho tro". */}
      <Group title="🔎 Trích xuất AI (Google Maps + web tham khảo)">
        <DestinationAiExtractionPanel slug={d.slug} onAccepted={() => invalidate()} />
      </Group>

      <Group title="✍️ Viết bài bằng AI">
        {!d.hasDistanceData && (
          <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">
            ⚠️ Điểm này chưa có dữ liệu khoảng cách thực tế (chưa bấm nút &quot;Tính khoảng
            cách&quot; ở tab bản đồ) — AI sẽ chỉ nhắc TÊN các điểm liên quan, không kèm số km. Bấm
            tính khoảng cách trước nếu muốn bài viết có số km chính xác.
          </p>
        )}
        {/* Trang thai job AI toan bai (neu co) — TACH RIENG khoi form nhap ben duoi:
            truoc day form nay bi AN HOAN TOAN mien co activeContentJobId (ke ca job
            da xong DraftReady), khien nguoi dung khong con thay lai ghi chu/link
            nguon da nhap (bug phat hien 07/2026, khong lien quan redesign tab). Gio
            form nhap LUON hien, chi disable rieng nut "Tao bai AI" khi co job dang chay. */}
        {d.activeContentJobId && (
          <div className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
            <p className="flex items-center gap-2">
              {(jobStatus === "Created" || jobStatus === "GeneratingOutline") && (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
              )}
              🤖 AI đang xử lý bài cho điểm này — trạng thái:{" "}
              <span className="font-medium">{jobStatus ?? d.activeJobStatus ?? "..."}</span>
            </p>
            {jobStatus && !["Created", "GeneratingOutline"].includes(jobStatus) && (
              <p className="mt-1 text-emerald-700 dark:text-emerald-400">
                ✅ Đã có gợi ý AI cho các khối nội dung — qua tab &quot;📝 Nội dung&quot;, mở từng khối
                bấm &quot;Áp dụng&quot; để lưu ngay khối đó, hoặc Bỏ qua.
              </p>
            )}
          </div>
        )}
        {(() => {
          const jobBlocking =
            Boolean(d.activeContentJobId) && jobStatus !== "Failed" && jobStatus !== "Rejected";
          return (
          <div className="space-y-4">
            <p className="rounded bg-zinc-50 p-3 text-xs text-zinc-500 dark:bg-zinc-900">
              AI tự dùng dữ liệu điểm đến ở tab &quot;ℹ️ Thông tin cơ bản&quot; (tên, địa chỉ, tọa độ, điểm
              lân cận) làm nền.
              Phần dưới đây là nơi bạn <strong>bổ sung thông tin chính xác</strong> và{" "}
              <strong>website để AI đọc thêm</strong> — AI không bịa giá vé / giờ mở cửa, sẽ ưu tiên
              dữ liệu bạn cung cấp.
            </p>

            {d.aiReferenceSummary && (
              <div className="rounded border border-violet-200 bg-violet-50 p-3 dark:border-violet-900 dark:bg-violet-950/40">
                <p className="mb-1 text-sm font-medium text-violet-700 dark:text-violet-300">
                  Tóm tắt nguồn tham khảo (từ khung &quot;Trích xuất AI&quot; phía trên)
                </p>
                <p className="mb-1 text-xs text-zinc-500">
                  Tự động đưa vào ngữ cảnh khi tạo bài, KHÔNG cần nhập lại ở ô bên dưới. Muốn sửa/làm
                  mới, chạy lại skill trích xuất rồi chấp nhận lại ở khung &quot;Trích xuất AI&quot; phía trên.
                  {d.aiReferenceSummaryUpdatedAt &&
                    ` Cập nhật lúc ${new Date(d.aiReferenceSummaryUpdatedAt).toLocaleString("vi-VN")}.`}
                </p>
                <p className="whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">
                  {d.aiReferenceSummary}
                </p>
              </div>
            )}

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
                    <Input
                      value={row.label}
                      onChange={(e) =>
                        setRefUrls((rows) =>
                          rows.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)),
                        )
                      }
                      placeholder="Nhãn (vd Giá vé)"
                      className="w-36"
                    />
                    <Input
                      value={row.url}
                      onChange={(e) =>
                        setRefUrls((rows) =>
                          rows.map((r, j) => (j === i ? { ...r, url: e.target.value } : r)),
                        )
                      }
                      placeholder="https://trang-nguon.vn/..."
                      className="flex-1"
                    />
                    {refUrls.length > 1 && (
                      <Button onClick={() => setRefUrls((rows) => rows.filter((_, j) => j !== i))}>
                        ✕
                      </Button>
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
                  <Select
                    value={selectedProvider?.key ?? ""}
                    onChange={(e) => {
                      setProvider(e.target.value);
                      setModel(""); // reset model khi doi provider
                    }}
                  >
                    {usableProviders.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.displayName}
                      </option>
                    ))}
                  </Select>
                  <Select value={selectedModel?.id ?? ""} onChange={(e) => setModel(e.target.value)}>
                    {(selectedProvider?.models ?? []).map((m) => (
                      <option key={m.id} value={m.id} title={m.costNote}>
                        {m.displayName}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              {selectedModel?.costNote && (
                <span className="mt-1 block text-xs text-zinc-400">{selectedModel.costNote}</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                loading={createJob.isPending}
                disabled={!selectedProvider || !selectedModel || jobBlocking}
                title={jobBlocking ? "Đang có bài soạn/duyệt dở — hoàn tất hoặc từ chối job hiện tại trước" : undefined}
                onClick={() => createJob.mutate()}
              >
                {createJob.isPending
                  ? "Đang tạo bài..."
                  : d.contentState === "chua-co-bai"
                    ? "Tạo bài AI"
                    : "Viết lại / cập nhật bài"}
              </Button>
              <Button loading={saveInputs.isPending} onClick={() => saveInputs.mutate()}>
                {saveInputs.isPending ? "Đang lưu..." : "Lưu thông tin (chưa tạo bài)"}
              </Button>
              <Button variant="secondary" onClick={() => setPromptPreviewOpen(true)}>
                👁️ Xem trước prompt
              </Button>
              {inputsSaved && !saveInputs.isPending && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  ✅ Đã lưu — sẽ tự điền lại lần sau
                </span>
              )}
            </div>
            {jobBlocking && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                ⚠️ Đang có bài soạn/duyệt dở nên chưa tạo job AI mới được — vẫn có thể sửa/lưu ghi
                chú ở đây, và dùng &quot;🤖 Tạo lại bằng AI&quot; ở từng khối trong tab &quot;📝 Nội
                dung&quot;. Hoặc bấm &quot;Làm lại từ đầu&quot; bên dưới để bỏ hẳn job/bài cũ.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <Button
                size="sm"
                variant="secondary"
                className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                loading={resetDraft.isPending}
                disabled={
                  Boolean(d.activeContentJobId) &&
                  Boolean(jobStatus) &&
                  ["Created", "GeneratingOutline"].includes(jobStatus ?? "")
                }
                title={
                  Boolean(d.activeContentJobId) &&
                  ["Created", "GeneratingOutline"].includes(jobStatus ?? "")
                    ? "AI đang xử lý — đợi xong rồi mới làm lại được"
                    : undefined
                }
                onClick={() => {
                  if (
                    window.confirm(
                      "Làm lại từ đầu: từ chối job AI đang dở (nếu có) và XOÁ SẠCH bản nháp bài viết hiện tại (không thể hoàn tác). Tiếp tục?",
                    )
                  ) {
                    resetDraft.mutate();
                  }
                }}
              >
                {resetDraft.isPending ? "Đang làm lại..." : "🗑️ Làm lại từ đầu"}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <span className="text-xs text-zinc-500">
                Đã có sẵn nội dung viết ở nơi khác (ChatGPT/Gemini...)?
              </span>
              <Button variant="secondary" onClick={() => setPasteModalOpen(true)}>
                📋 Dán bài có sẵn
              </Button>
            </div>
          </div>
          );
        })()}
      </Group>

      {promptPreviewOpen && (
        <DestinationPromptPreviewModal
          slug={slug}
          requestBody={{
            mode: d?.contentState === "chua-co-bai" ? "create" : "update",
            userNotes: aiInputsBody().userNotes,
            referenceUrls: aiInputsBody().referenceUrls.length
              ? aiInputsBody().referenceUrls
              : undefined,
            aiProvider: selectedProvider?.key,
            aiModel: selectedModel?.id,
          }}
          onClose={() => setPromptPreviewOpen(false)}
        />
      )}

      {pasteModalOpen && (
        <DestinationPasteContentModal
          name={d.name}
          onClose={() => setPasteModalOpen(false)}
          onApplied={(article) => {
            setDraftArticle(article);
            setActionError(null);
          }}
        />
      )}
          </div>

          <div className={activeTab === "content" ? "space-y-4" : "hidden"}>
            <PanelHead title="📝 Nội dung" hint="Soạn/duyệt từng khối nội dung bài viết. Trích xuất AI + nhập thông tin cho AI viết bài xem ở tab &quot;🤖 AI hỗ trợ&quot;. Trạng thái gate/nút đăng bài xem ở khung phía trên đầu trang." />

      {/* Noi dung bai viet — sua truc tiep tai day (pivot gop editor vao trang detail).
          KHONG boc trong <Group> (card lien nhau se thanh 3 cap long nhau: panel >
          card > tung block ben trong editor) — o day chi can 1 cap: tung block cua
          editor tu la 1 khoi ro rang, khong can them 1 lop card ngoai nua. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">Nội dung bài viết</h3>
        {draftArticle && (
          <DestinationJobSuggestionsModal
            jobSuggestions={jobSuggestions}
            frameSuggestion={jobFrameSuggestion}
            currentArticle={draftArticle}
            applyingBlockKey={applyingBlockKey}
            applyingFrameGroup={applyingFrameGroup}
            applyingAll={applyingAllJobSuggestions}
            onApply={(blockKey) => void applyJobSuggestion(blockKey)}
            onApplyFrameGroup={(group) => void applyJobFrameGroup(group)}
            onApplyAll={() => void applyAllJobSuggestions()}
          />
        )}
      </div>
      {draftArticle && (
        <DestinationArticleEditor
          article={draftArticle}
          onChange={setDraftArticle}
          suggestions={suggestions}
          suggestLoading={suggestLoading}
          onRequestSuggestion={requestBlockSuggestion}
          onApplySuggestion={(blockKey) => void applySuggestion(blockKey)}
          applyingBlockKey={applyingBlockKey}
          onDismissSuggestion={dismissBlockSuggestion}
        />
      )}
      <div className="flex items-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <Button
          variant="primary"
          loading={saveDraftArticle.isPending}
          disabled={!isDraftDirty}
          onClick={() => draftArticle && saveDraftArticle.mutate(draftArticle)}
        >
          {saveDraftArticle.isPending ? "Đang lưu..." : "Lưu bản nháp"}
        </Button>
        {!isDraftDirty && !saveDraftArticle.isPending && (
          <span className="text-xs text-zinc-400">Đã lưu</span>
        )}
      </div>
          </div>

          <div className={activeTab === "basic-info" ? "space-y-4" : "hidden"}>
            <PanelHead title="ℹ️ Thông tin cơ bản" hint="Metadata điểm đến (tên, toạ độ, địa chỉ, liên hệ...), Meta Title SEO, và thao tác đổi slug. Trích xuất AI từ Google Maps/web tham khảo xem ở khung phía trên đầu trang." />

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

      {/* Meta title thu cong — them cach cho bulk-edit CSV. Ghi thang len site (nhu
          DestinationMetadataForm o tren), khong lien quan "Thuong mai" nen chuyen ve
          day (07/2026). */}
      <Group title="Meta Title (thẻ <title> SEO)">
        <DestinationMetaTitleEditor
          slug={d.slug}
          metaTitle={d.metaTitle}
          onSaved={() => invalidate()}
        />
      </Group>

      {/* Doi slug — thao tac RIENG, tach khoi form sua thuong (Phase 24 chieu ghi) */}
      <Group title="⚠️ Đổi slug (nâng cao)">
        {!renameOpen ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-zinc-500">
              Đổi URL <code className="font-mono">/{d.slug}</code> — chỉ dùng khi thật cần (vd sai
              chính tả). Con cháu + link nội bộ sẽ tự cập nhật, URL cũ tự chuyển hướng.
            </p>
            <Button size="sm" variant="secondary" onClick={() => setRenameOpen(true)}>
              Đổi slug
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
              <p className="font-medium">Đọc kỹ trước khi đổi:</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                <li>URL cũ tự động chuyển hướng (301) sang URL mới — không lo mất khách/SEO.</li>
                <li>Toàn bộ điểm con, link nội bộ trong bài khác tự cập nhật theo.</li>
                <li>
                  Ảnh trên hosting <strong>không</strong> tự đổi tên thư mục — vẫn hiển thị đúng,
                  chỉ là path không còn khớp slug mới (không phải lỗi).
                </li>
              </ul>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-zinc-400">/diem-den/</span>
              <Input
                value={newSlugInput}
                onChange={(e) => setNewSlugInput(e.target.value)}
                placeholder="slug-moi"
                className="flex-1"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="bg-amber-600 text-white hover:bg-amber-700"
                loading={renameSlug.isPending}
                disabled={!newSlugInput.trim() || newSlugInput.trim() === d.slug}
                onClick={() => {
                  if (
                    window.confirm(
                      `Đổi slug "${d.slug}" → "${newSlugInput.trim()}"? Không thể tự hoàn tác.`,
                    )
                  ) {
                    renameSlug.mutate();
                  }
                }}
              >
                {renameSlug.isPending ? "Đang đổi..." : "Xác nhận đổi"}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setRenameOpen(false);
                  setNewSlugInput("");
                }}
              >
                Huỷ
              </Button>
            </div>
          </div>
        )}
      </Group>
          </div>

          <div className={activeTab === "commerce" ? "space-y-4" : "hidden"}>
            <PanelHead title="💰 Thương mại & bổ trợ" hint="Vé/giá, lưu ý thực tế, đánh giá biên tập và link đánh giá ngoài đi kèm bài viết." />

      {/* Link mua ve (affiliate-link-conversion-spec §5) — sua tap trung o
          /dichoithoi/ve (07/2026, thay the editor nhung ngay tai day). */}
      <Group title="Link mua vé">
        {d.ticketLinks.length > 0 ? (
          <div className="space-y-2">
            <ul className="space-y-1 text-sm">
              {d.ticketLinks.map((link, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{link.label || link.provider}</span>
                  {link.price != null && (
                    <span className="text-xs text-zinc-500">{link.price.toLocaleString("vi-VN")}đ</span>
                  )}
                  <a
                    href={link.affiliateUrl}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="max-w-xs truncate text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {link.affiliateUrl}
                  </a>
                </li>
              ))}
            </ul>
            <Link
              href={`/dichoithoi/ve?q=${encodeURIComponent(d.name)}`}
              className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Quản lý vé cho {d.name} →
            </Link>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">
            Chưa có link mua vé nào — thêm link để bắt đầu nhận hoa hồng khi khách mua online.{" "}
            <Link
              href={`/dichoithoi/ve?q=${encodeURIComponent(d.name)}`}
              className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Thêm link vé cho {d.name} →
            </Link>
          </p>
        )}
      </Group>

      {/* Gia ve theo doi tuong (content-seo-ux-plan §5.5a, Phase 12) */}
      <Group title="Giá vé theo đối tượng">
        <DestinationPriceBreakdownEditor
          slug={d.slug}
          priceBreakdown={d.priceBreakdown}
          ticketPriceText={d.content?.ticketPrice ?? d.ticketPrice}
          onSaved={() => invalidate()}
        />
      </Group>

      {/* Luu y thuc te (content-seo-ux-plan §5.7, Phase 12) */}
      <Group title="Lưu ý thực tế">
        <DestinationPracticalNotesEditor
          slug={d.slug}
          practicalNotes={d.practicalNotes}
          onSaved={() => invalidate()}
        />
      </Group>

      {/* Danh gia bien tap (content-seo-ux-plan §10.6.2, Phase 28.0) */}
      <Group title="Đánh giá biên tập">
        <DestinationEditorialReviewEditor
          slug={d.slug}
          editorialReview={d.editorialReview}
          onSaved={() => invalidate()}
        />
      </Group>

      {/* Link "Xem them tren" (destination-spec §2.2 khoi #10/#15, Phase 28.0) */}
      <Group title="Xem thêm trên (TripAdvisor/Facebook...)">
        <DestinationExternalReviewUrlsEditor
          slug={d.slug}
          externalReviewUrls={d.externalReviewUrls}
          onSaved={() => invalidate()}
        />
      </Group>
          </div>

          <div className={activeTab === "recommendations" ? "space-y-4" : "hidden"}>
            <PanelHead title="🔗 Gợi ý liên quan" hint="Khách sạn và tour gợi ý gắn với điểm đến này." />

      {/* Khach san goi y (hotel-spec §6) */}
      <Group title="Khách sạn gợi ý">
        <DestinationHotelPanel slug={d.slug} />
      </Group>

      {/* Tour goi y (tour-spec §6) */}
      <Group title="Tour gợi ý">
        <DestinationTourPanel slug={d.slug} />
      </Group>
          </div>

          <div className={activeTab === "relations" ? "space-y-4" : "hidden"}>
            <PanelHead title="🧭 Quan hệ & đồng bộ" hint="Liên kết với điểm đến khác và trạng thái đồng bộ mirror ↔ site." />

      {/* Quan he (spec §7.3 tab 3) */}
      <Group title="Quan hệ">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Khoảng cách &quot;Gần đây&quot; mặc định tính theo đường chim bay (Haversine — nhanh, ước
          lượng). Bấm nút để tính khoảng cách đường bộ thật (OpenRouteService) tới các điểm gần đó
          — sau khi tính, cả khối &quot;Gần đây&quot; dưới đây lẫn gợi ý &quot;điểm đến liên
          quan&quot; trên website đều tự đổi sang số đường bộ thật.
        </p>
        <Button
          size="sm"
          loading={recomputeNearbyDistances.isPending}
          onClick={() => recomputeNearbyDistances.mutate()}
        >
          {recomputeNearbyDistances.isPending
            ? "Đang tính..."
            : "Tính khoảng cách đường bộ tới điểm gần đó"}
        </Button>
        {recomputeNearbyDistances.data && (
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            ✅ Đã tính {recomputeNearbyDistances.data.candidates} điểm gần đó
            {recomputeNearbyDistances.data.relatedUpdated
              ? " — gợi ý điểm liên quan đã cập nhật."
              : " — gợi ý điểm liên quan không đổi."}
          </p>
        )}
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
        </div>

        <nav className="sticky top-4 flex flex-col gap-0.5 rounded-lg border border-zinc-200 p-1.5 dark:border-zinc-800">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-selected={activeTab === tab.id}
              className={
                activeTab === tab.id
                  ? "flex items-center gap-2 rounded-md bg-blue-50 px-2.5 py-2 text-left text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                  : "flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
              }
            >
              <span className="text-sm">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {previewOpen && previewPublish.data && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">👁️ Xem trước bản sẽ đăng</h3>
              <Button size="sm" variant="ghost" onClick={() => setPreviewOpen(false)}>
                Đóng
              </Button>
            </div>
            {previewPublish.data.addedLinks.length > 0 && (
              <p className="mb-3 rounded border border-violet-200 bg-violet-50 p-2 text-xs text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300">
                Link nội bộ sẽ được tự động chèn:{" "}
                {previewPublish.data.addedLinks.map((l) => l.targetName).join(", ")}
              </p>
            )}
            <div
              className="prose prose-zinc dark:prose-invert max-w-none text-sm
                [&_a]:text-blue-600 [&_a]:underline [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold
                [&_h3]:mt-3 [&_h3]:font-semibold [&_img]:rounded [&_li]:ml-4 [&_ol]:list-decimal [&_p]:my-2 [&_ul]:list-disc"
              dangerouslySetInnerHTML={{ __html: previewPublish.data.html }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function PanelHead({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
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

const REF_LIST_PREVIEW_COUNT = 8;

function RefList({
  title,
  refs,
  showDistance,
}: {
  title: string;
  refs: RelatedDestinationRef[];
  showDistance?: boolean;
}) {
  // Diem lon (vd Đà Lạt) co the truc thuoc 40-50+ con — liet ke het lam trang
  // qua dai, kho quet mat. Mac dinh chi hien vai dong dau, bam moi xem het.
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? refs : refs.slice(0, REF_LIST_PREVIEW_COUNT);
  const hiddenCount = refs.length - visible.length;

  return (
    <div>
      <p className="mb-1 font-medium">{title}</p>
      {refs.length === 0 ? (
        <p className="text-zinc-400">—</p>
      ) : (
        <>
          <ul className="space-y-1">
            {visible.map((r) => (
              <li key={r.slug}>
                <RefLink r={r} />
                {showDistance && r.distanceMeters !== null && (
                  <span className="text-zinc-400"> · cách {formatDistance(r.distanceMeters)}</span>
                )}
              </li>
            ))}
          </ul>
          {hiddenCount > 0 && (
            <button
              onClick={() => setExpanded(true)}
              className="mt-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              + Xem thêm {hiddenCount}
            </button>
          )}
          {expanded && refs.length > REF_LIST_PREVIEW_COUNT && (
            <button
              onClick={() => setExpanded(false)}
              className="mt-1 text-xs text-zinc-500 hover:underline"
            >
              Thu gọn
            </button>
          )}
        </>
      )}
    </div>
  );
}
