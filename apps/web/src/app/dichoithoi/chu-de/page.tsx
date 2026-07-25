"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  generateTagDescriptionResponseSchema,
  getTagKanbanBoardResponseSchema,
  listDestinationTagAssignmentsResponseSchema,
  previewPromptResponseSchema,
  previewTagDescriptionResponseSchema,
  reverseCheckTagAssignmentsResponseSchema,
  suggestTagAssignmentsResponseSchema,
  type GetTagKanbanBoardResponse,
  type ListDestinationTagAssignmentsResponse,
  type TagKanbanBoardDestination,
  type TagReverseCheckFinding,
  type TagSuggestion,
} from "@zinoflow/contracts";
import { apiSend, apiGet, ApiError } from "@/shared/api-client";
import { Badge, Button, buttonClasses, Checkbox, ErrorBox, FeatureIntro, Input, Modal, Select, Textarea } from "@/shared/ui";
import { AiInvocationBar } from "@/features/dichoithoi/ai-invocation-bar";

const QUERY_KEY = ["destination-tag-assignments"];

/** Cung constant voi apps/web/src/app/dichoithoi/[slug]/page.tsx — DiChoiThoi.Web
 * chay local qua `dotnet run` (profile http, Properties/launchSettings.json). */
const LOCAL_SITE_BASE_URL = "http://localhost:5176";
const SITE_BASE_URL = "https://dichoithoi.com";

/**
 * Man "Chủ đề" (destination-spec §2.4) — 3 buoc: (1) AI goi y gan tag hang loat
 * + nguoi dung duyet tung dong, (2) AI ra soat nguoc phat hien gan sai/tag duoi
 * nguong, (3) AI soan mo ta cho trang /chu-de/{slug}.
 */
export default function ChuDePage() {
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiGet("/destination-tags", listDestinationTagAssignmentsResponseSchema),
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Chủ đề điểm đến</h2>
        <p className="text-sm text-zinc-500">
          Gán chủ đề (tag) cho điểm đến bằng AI, duyệt trước khi ghi, rà soát lại các tag đã gán
          và soạn mô tả cho trang /chu-de/{"{slug}"}.
        </p>
      </div>

      <FeatureIntro
        summary={
          <>
            Mô tả chủ đề cần <strong>300-500 từ</strong> (không phải 2-3 câu như trang Loại/Tỉnh) —
            đây là điều kiện để trang /chu-de/&#123;slug&#125; được publish + lên Google.
          </>
        }
        details={
          <>
            Tag là góc nhìn cắt ngang do mình tự đặt (&quot;lãng mạn&quot;, &quot;chữa
            lành&quot;...) — cùng những điểm đến này đã có &quot;nhà&quot; ở trang Loại và trang
            Tỉnh rồi. Nếu chỉ có 2-3 câu, trang Chủ đề chẳng khác gì xếp lại đúng những card đã có
            sẵn nơi khác — đúng kiểu &quot;tag archive&quot; mà Google coi là nội dung trùng lặp
            nội bộ. Đoạn 300-500 từ buộc trang phải có lý do tồn tại riêng: giải thích tiêu chí
            chọn, gợi ý cách dùng danh sách — phần biên tập mà không trang nào khác trên site có.
            <br />
            Lưu ý: bấm &quot;mở trên site&quot; chỉ quyết định trang có 404 hay không — trang vẫn
            lên (200) ngay cả khi mô tả còn ngắn. Nhưng nếu <strong>chưa đủ mô tả dài + ≥5 điểm
            đến</strong>, trang tự động gắn <code>noindex</code> (Google không thu thập, người xem
            trực tiếp vẫn thấy bình thường) — nên mở site quá sớm khi mô tả còn ngắn không có hại,
            chỉ là chưa lên được Google.
            <br />
            <strong>Meta description</strong> là ô riêng bên dưới đoạn giới thiệu — dùng cho thẻ{" "}
            <code>&lt;meta description&gt;</code> Google hiển thị trên kết quả tìm kiếm, để trống
            thì web tự lấy từ đoạn giới thiệu. Khi lưu, tên điểm đến nhắc trong đoạn giới thiệu sẽ{" "}
            <strong>tự động thành link nội bộ</strong> tới trang điểm đến đó — không cần thao tác
            gì thêm, chỉ link tới điểm đến đã thực sự gán chủ đề này.
            <br />
            <strong>Định dạng hỗ trợ — Markdown đầy đủ</strong> (đồng bộ với ô Nội dung bài viết
            điểm đến): xuống dòng để tạo đoạn mới, <code>## Tiêu đề</code> cho heading,{" "}
            <code>- </code> cho gạch đầu dòng, <code>**chữ**</code> cho <strong>in đậm</strong>,{" "}
            <code>![alt](url)</code> cho ảnh, bảng Markdown. Không bắt buộc dùng hết — với đoạn
            300-500 từ thường chỉ cần đoạn văn + gạch đầu dòng là đủ, heading/ảnh/bảng nên cân
            nhắc kỹ (đoạn giới thiệu ngắn, thêm heading dễ rối cấu trúc H1→H2 thật của trang). Nên
            để tên điểm đến ở dạng chữ thường (không tự chèn link) để auto-link tự nhận diện đúng
            điểm đã gán chủ đề này. Bấm &quot;Xem preview&quot; để xem đúng bản dựng thật.
          </>
        }
      />

      {query.isLoading && <p className="text-sm text-zinc-500">Đang tải...</p>}
      {query.isError && <ErrorBox error={query.error} fallback="Lỗi tải danh sách chủ đề" />}

      {query.data && <ChuDeSections data={query.data} />}
    </div>
  );
}

function ChuDeSections({ data }: { data: ListDestinationTagAssignmentsResponse }) {
  return (
    <div className="space-y-8">
      <TagListSection data={data} />
      <SuggestSection assignedSlugs={new Set(data.assignments.filter((a) => a.tagSlugs.length > 0).map((a) => a.destinationSlug))} />
      <ReverseCheckSection />
      <TagKanbanSection />
      <CurrentAssignmentsSection />
    </div>
  );
}

/* --- 1. Danh sach tag + mo ta --- */

function TagListSection({ data }: { data: ListDestinationTagAssignmentsResponse }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          {data.tags.length} chủ đề đã tạo
        </h3>
        <p className="text-xs text-zinc-500">
          Tạo chủ đề mới, đổi tên, mở/đóng trang public hoặc xoá tại đây — không cần chạy SQL tay
          nữa. Trạng thái chỉ quyết định trang /chu-de/{"{slug}"} ngoài site: &quot;Đã mở trên
          site&quot; = trang public hoạt động; &quot;Chưa mở&quot; = ngoài site trả 404. AI gợi ý
          gán/rà soát vẫn dùng TẤT CẢ chủ đề kể cả chưa mở — đúng quy trình gán tag trước, đủ điểm
          rồi mới mở trang.
        </p>
      </div>
      <div className="divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {data.tags.map((tag) => (
          <TagDescriptionRow
            key={tag.id}
            slug={tag.slug}
            name={tag.name}
            status={tag.status}
            initialDescription={tag.description}
            initialMetaDescription={tag.metaDescription}
            assignedCount={data.assignments.filter((a) => a.tagSlugs.includes(tag.slug)).length}
          />
        ))}
      </div>
      <CreateTagForm />
    </section>
  );
}

function TagDescriptionRow({
  slug,
  name,
  status,
  initialDescription,
  initialMetaDescription,
  assignedCount,
}: {
  slug: string;
  name: string;
  status: number;
  initialDescription: string | null;
  initialMetaDescription: string | null;
  assignedCount: number;
}) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(initialDescription ?? "");
  const [metaValue, setMetaValue] = useState(initialMetaDescription ?? "");
  const [nameValue, setNameValue] = useState(name);

  const [previewOpen, setPreviewOpen] = useState(false);

  const generate = useMutation({
    mutationFn: async () =>
      generateTagDescriptionResponseSchema.parse(
        await apiSend("POST", `/destination-tags/${slug}/generate-description`, {}),
      ),
    onSuccess: (r) => setValue(r.description),
  });

  const preview = useMutation({
    mutationFn: async () =>
      previewTagDescriptionResponseSchema.parse(
        await apiSend("POST", `/destination-tags/${slug}/description/preview`, {
          description: value.trim() || null,
        }),
      ),
    onSuccess: () => setPreviewOpen(true),
  });

  const save = useMutation({
    mutationFn: () =>
      apiSend("PATCH", `/destination-tags/${slug}/description`, {
        description: value.trim() || null,
        metaDescription: metaValue.trim() || null,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const saveName = useMutation({
    mutationFn: () => apiSend("PATCH", `/destination-tags/${slug}`, { name: nameValue.trim() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const toggleStatus = useMutation({
    mutationFn: () =>
      apiSend("PATCH", `/destination-tags/${slug}`, { status: status === 1 ? 0 : 1 }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const remove = useMutation({
    mutationFn: () => apiSend("DELETE", `/destination-tags/${slug}`, undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const dirty = value !== (initialDescription ?? "") || metaValue !== (initialMetaDescription ?? "");
  const nameDirty = nameValue.trim() !== name && nameValue.trim().length > 0;

  return (
    <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-[200px_1fr_auto] sm:items-start">
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <Input
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            className="w-full text-sm font-medium"
          />
          {nameDirty && (
            <Button size="sm" onClick={() => saveName.mutate()} loading={saveName.isPending}>
              Lưu tên
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-xs text-zinc-500">/chu-de/{slug}</span>
          <a
            href={`${LOCAL_SITE_BASE_URL}/chu-de/${slug}`}
            target="_blank"
            rel="noreferrer"
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            Xem local ↗
          </a>
          <a
            href={`${SITE_BASE_URL}/chu-de/${slug}`}
            target="_blank"
            rel="noreferrer"
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            Xem production ↗
          </a>
        </div>
        <button
          type="button"
          onClick={() => toggleStatus.mutate()}
          disabled={toggleStatus.isPending}
          className="inline-block"
          title={
            status === 1
              ? "Bấm để đóng trang /chu-de ngoài site (trả 404) — AI vẫn dùng chủ đề này"
              : "Bấm để mở trang /chu-de ngoài site cho chủ đề này"
          }
        >
          <Badge tone={status === 1 ? "emerald" : "gray"}>
            {status === 1 ? "Đã mở trên site" : "Chưa mở (404)"}
          </Badge>
        </button>
        <button
          type="button"
          disabled={assignedCount > 0 || remove.isPending}
          title={
            assignedCount > 0
              ? `Đang gán cho ${assignedCount} điểm đến — gỡ gán hết trước khi xoá`
              : "Xoá chủ đề này (không thể hoàn tác)"
          }
          onClick={() => {
            if (window.confirm(`Xoá chủ đề "${name}"? Không thể hoàn tác.`)) remove.mutate();
          }}
          className="block text-xs text-red-600 hover:underline disabled:cursor-not-allowed disabled:text-zinc-400 disabled:no-underline dark:text-red-400"
        >
          Xoá
        </button>
      </div>
      <div className="space-y-1.5">
        <Textarea
          rows={6}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={
            "Đoạn giới thiệu 300-500 từ cho trang chủ đề này...\n\n" +
            "Cách 1 dòng trống để xuống đoạn mới. Gõ \"- \" để gạch đầu dòng, \"**chữ**\" để in đậm."
          }
          className="w-full"
        />
        <p className="text-xs text-indigo-600 dark:text-indigo-400">
          🔗 Tên điểm đến nhắc ở trên sẽ tự thành link nội bộ khi lưu. Hỗ trợ Markdown đầy đủ (đoạn
          văn, <code>##</code> heading, <code>- </code> gạch đầu dòng, <code>**chữ**</code> in đậm,
          ảnh, bảng) — xem chi tiết ở phần giới thiệu đầu trang.
        </p>
        <Input
          value={metaValue}
          onChange={(e) => setMetaValue(e.target.value)}
          placeholder="Meta description cho Google (để trống = tự lấy từ đoạn trên)..."
          maxLength={160}
          className="w-full text-xs"
        />
      </div>
      <div className="flex flex-col items-start gap-1 sm:items-end">
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={() => generate.mutate()} loading={generate.isPending}>
            AI soạn
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => preview.mutate()}
            disabled={!value.trim()}
            loading={preview.isPending}
          >
            Xem preview
          </Button>
          <Button size="sm" onClick={() => save.mutate()} disabled={!dirty} loading={save.isPending}>
            Lưu
          </Button>
        </div>
        {(generate.isError || preview.isError || save.isError || saveName.isError || toggleStatus.isError || remove.isError) && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {(generate.error ?? preview.error ?? save.error ?? saveName.error ?? toggleStatus.error ?? remove.error) instanceof
            ApiError
              ? (generate.error ?? preview.error ?? save.error ?? saveName.error ?? toggleStatus.error ?? remove.error)?.message
              : "Lỗi"}
          </span>
        )}
      </div>
      {previewOpen && (
        <Modal open onClose={() => setPreviewOpen(false)} title={`Xem trước — /chu-de/${slug}`}>
          <div className="space-y-2">
            <p className="text-xs text-zinc-500">
              Đây là bản dựng thật của đoạn giới thiệu sau khi auto-link (tên điểm đến nhắc tới sẽ
              là link nội bộ) — đúng như trên trang public, chưa lưu vào DB.
            </p>
            {preview.data?.html ? (
              <div
                className="max-w-3xl space-y-3 text-sm text-zinc-700 dark:text-zinc-300 [&_a]:text-sky-600 [&_a]:underline dark:[&_a]:text-sky-400 [&_strong]:font-semibold [&_strong]:text-zinc-900 dark:[&_strong]:text-zinc-100 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold [&_img]:max-w-full [&_img]:rounded [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-zinc-300 [&_th]:p-1.5 [&_td]:border [&_td]:border-zinc-300 [&_td]:p-1.5 dark:[&_th]:border-zinc-700 dark:[&_td]:border-zinc-700 [&_blockquote]:border-l-2 [&_blockquote]:border-zinc-300 [&_blockquote]:pl-3 [&_blockquote]:italic dark:[&_blockquote]:border-zinc-700"
                dangerouslySetInnerHTML={{ __html: preview.data.html }}
              />
            ) : (
              <p className="text-sm text-zinc-500">(Chưa có nội dung để xem trước.)</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function CreateTagForm() {
  const queryClient = useQueryClient();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: () => apiSend("POST", "/destination-tags", { slug: slug.trim(), name: name.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      setSlug("");
      setName("");
    },
  });

  return (
    <div className="flex flex-wrap items-end gap-2 rounded border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
      <div>
        <label className="mb-1 block text-xs text-zinc-500">
          Slug — chữ thường không dấu, nối gạch ngang (vd bien-dao)
        </label>
        <Input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="bien-dao"
          className="w-40"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-zinc-500">Tên hiển thị</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Biển đảo"
          className="w-52"
        />
      </div>
      <Button
        size="sm"
        onClick={() => create.mutate()}
        disabled={!slug.trim() || !name.trim()}
        loading={create.isPending}
      >
        + Thêm chủ đề
      </Button>
      {create.isError && (
        <ErrorBox error={create.error} fallback="Lỗi tạo chủ đề" />
      )}
    </div>
  );
}

/* --- 2. AI goi y gan tag hang loat + duyet --- */

function SuggestSection({ assignedSlugs }: { assignedSlugs: Set<string> }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Map<string, Set<string>>>(new Map());
  const [aiProvider, setAiProvider] = useState("");
  const [aiModel, setAiModel] = useState("");

  const suggest = useMutation({
    mutationFn: async () =>
      suggestTagAssignmentsResponseSchema.parse(
        await apiSend("POST", "/destination-tags/suggest", { aiProvider, aiModel }),
      ),
    onSuccess: (r) => {
      setSelected(new Map(r.suggestions.map((s) => [s.destinationSlug, new Set(s.tagSlugs)])));
    },
  });

  const apply = useMutation({
    mutationFn: () =>
      apiSend("POST", "/destination-tags/apply", {
        assignments: [...selected.entries()].map(([destinationSlug, tagSlugs]) => ({
          destinationSlug,
          tagSlugs: [...tagSlugs],
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      setSelected(new Map());
      suggest.reset();
    },
  });

  function toggleTag(destinationSlug: string, tagSlug: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      const tags = new Set(next.get(destinationSlug) ?? []);
      if (tags.has(tagSlug)) tags.delete(tagSlug);
      else tags.add(tagSlug);
      next.set(destinationSlug, tags);
      return next;
    });
  }

  const suggestions = suggest.data?.suggestions ?? [];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Gán tag hàng loạt (AI gợi ý)
          </h3>
          <p className="text-xs text-zinc-500">
            AI chỉ gợi ý cho điểm đến chưa có tag nào ({assignedSlugs.size} điểm đã gán, sẽ bỏ qua).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AiInvocationBar
            onSelectionChange={(p, m) => {
              setAiProvider(p);
              setAiModel(m);
            }}
            fetchPreview={async () =>
              previewPromptResponseSchema.parse(
                await apiSend("POST", "/destination-tags/suggest/preview", {}),
              ).sections
            }
          />
          <Button size="sm" onClick={() => suggest.mutate()} loading={suggest.isPending}>
            Gợi ý AI
          </Button>
        </div>
      </div>

      {suggest.isError && <ErrorBox error={suggest.error} fallback="Lỗi gợi ý tag" />}

      {suggestions.length === 0 && suggest.isSuccess && (
        <p className="text-sm text-zinc-500">Không có điểm đến nào cần gợi ý (đã gán tag hết).</p>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-2">
          <div className="divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {suggestions.map((s) => (
              <SuggestionRow
                key={s.destinationSlug}
                suggestion={s}
                selectedTags={selected.get(s.destinationSlug) ?? new Set()}
                onToggle={(tagSlug) => toggleTag(s.destinationSlug, tagSlug)}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => apply.mutate()} loading={apply.isPending}>
              Áp dụng lựa chọn ({suggestions.length} điểm)
            </Button>
            {apply.isError && <ErrorBox error={apply.error} fallback="Lỗi ghi tag" />}
          </div>
        </div>
      )}
    </section>
  );
}

function SuggestionRow({
  suggestion,
  selectedTags,
  onToggle,
}: {
  suggestion: TagSuggestion;
  selectedTags: Set<string>;
  onToggle: (tagSlug: string) => void;
}) {
  return (
    <div className="space-y-1.5 p-3">
      <div className="text-sm font-medium">{suggestion.destinationSlug}</div>
      <p className="text-xs text-zinc-500">{suggestion.reasoning}</p>
      <div className="flex flex-wrap gap-3">
        {suggestion.tagSlugs.map((tag) => (
          <Checkbox
            key={tag}
            label={tag}
            checked={selectedTags.has(tag)}
            onChange={() => onToggle(tag)}
          />
        ))}
      </div>
    </div>
  );
}

/* --- 3. Ra soat nguoc --- */

function ReverseCheckSection() {
  const check = useMutation({
    mutationFn: async () =>
      reverseCheckTagAssignmentsResponseSchema.parse(
        await apiSend("POST", "/destination-tags/reverse-check", {}),
      ),
  });

  const findings = check.data?.findings ?? [];

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Rà soát lại (AI + ngưỡng số lượng)
        </h3>
        <Button size="sm" onClick={() => check.mutate()} loading={check.isPending}>
          Chạy rà soát
        </Button>
      </div>

      {check.isError && <ErrorBox error={check.error} fallback="Lỗi rà soát" />}

      {check.isSuccess && findings.length === 0 && (
        <p className="text-sm text-zinc-500">Không phát hiện vấn đề nào.</p>
      )}

      {findings.length > 0 && (
        <div className="divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {findings.map((f, i) => (
            <FindingRow key={i} finding={f} />
          ))}
        </div>
      )}
    </section>
  );
}

function FindingRow({ finding }: { finding: TagReverseCheckFinding }) {
  return (
    <div className="flex items-start gap-3 p-3">
      <Badge tone={finding.issue === "likely-wrong" ? "red" : "amber"}>
        {finding.issue === "likely-wrong" ? "Có thể gán sai" : "Dưới ngưỡng"}
      </Badge>
      <div className="text-sm">
        <div className="font-medium">
          {finding.destinationSlug ? `${finding.destinationSlug} — ${finding.tagSlug}` : finding.tagSlug}
        </div>
        <div className="text-xs text-zinc-500">{finding.reasoning}</div>
      </div>
    </div>
  );
}

/* --- Kanban gan tay theo cum/tinh (giong /dichoithoi/phan-loai cua Type,
   phan hoi nguoi dung 24/07/2026) --- */

const TAG_KANBAN_QUERY_KEY = ["tag-kanban-board"];
const TAG_UNCLASSIFIED_COLUMN = "__unclassified__";

function TagKanbanSection() {
  const [clusterSlug, setClusterSlug] = useState("");
  const query = useQuery({
    queryKey: TAG_KANBAN_QUERY_KEY,
    queryFn: () => apiGet("/destination-tags/kanban-board", getTagKanbanBoardResponseSchema),
  });

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Gán tay theo cụm/tỉnh (Kanban)
        </h3>
        <p className="text-xs text-zinc-500">
          Chọn 1 cụm/tỉnh, mỗi cột là 1 chủ đề — bấm vào thẻ điểm đến để tick/bỏ tick tag, lưu ngay
          khi tick (không cần nút lưu riêng). Cùng trải nghiệm với trang &quot;Rà soát loại
          hình&quot; (Type) ở /dichoithoi/phan-loai.
        </p>
      </div>

      {query.isLoading && <p className="text-sm text-zinc-500">Đang tải...</p>}
      {query.isError && <ErrorBox error={query.error} fallback="Lỗi tải bảng Kanban" />}
      {query.data && (
        <TagKanbanBoard data={query.data} clusterSlug={clusterSlug} onClusterChange={setClusterSlug} />
      )}
    </section>
  );
}

function TagKanbanBoard({
  data,
  clusterSlug,
  onClusterChange,
}: {
  data: GetTagKanbanBoardResponse;
  clusterSlug: string;
  onClusterChange: (slug: string) => void;
}) {
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const [aiSuggestions, setAiSuggestions] = useState<Map<string, TagSuggestion>>(new Map());
  const [aiProvider, setAiProvider] = useState("");
  const [aiModel, setAiModel] = useState("");

  const destinationsInCluster = useMemo(
    () => data.destinations.filter((d) => d.parentSlug === clusterSlug),
    [data.destinations, clusterSlug],
  );

  const suggest = useMutation({
    mutationFn: async () => {
      const destinationSlugs = destinationsInCluster.map((d) => d.slug);
      return suggestTagAssignmentsResponseSchema.parse(
        await apiSend("POST", "/destination-tags/suggest", { destinationSlugs, aiProvider, aiModel }),
      );
    },
    onSuccess: (r) => {
      setAiSuggestions(new Map(r.suggestions.map((s) => [s.destinationSlug, s])));
    },
  });

  const classifiedCount = destinationsInCluster.filter((d) => d.tagSlugs.length > 0).length;

  const columns = useMemo(() => {
    const bySlug = new Map(data.tags.map((t) => [t.slug, t]));
    const groups = new Map<string, TagKanbanBoardDestination[]>();
    for (const d of destinationsInCluster) {
      if (d.tagSlugs.length === 0) {
        groups.set(TAG_UNCLASSIFIED_COLUMN, [...(groups.get(TAG_UNCLASSIFIED_COLUMN) ?? []), d]);
        continue;
      }
      for (const tagSlug of d.tagSlugs) {
        groups.set(tagSlug, [...(groups.get(tagSlug) ?? []), d]);
      }
    }
    const ordered = [...groups.entries()]
      .filter(([slug]) => slug !== TAG_UNCLASSIFIED_COLUMN)
      .sort(([a], [b]) => (bySlug.get(a)?.name ?? a).localeCompare(bySlug.get(b)?.name ?? b));
    const unclassified = groups.get(TAG_UNCLASSIFIED_COLUMN) ?? [];
    return { unclassified, tagColumns: ordered, tagBySlug: bySlug };
  }, [destinationsInCluster, data.tags]);

  const editingDestination = data.destinations.find((d) => d.slug === editingSlug) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={clusterSlug} onChange={(e) => onClusterChange(e.target.value)}>
          <option value="">Chọn cụm/tỉnh...</option>
          {data.clusters.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name} ({c.kind === "province" ? "Tỉnh" : "Cụm"})
            </option>
          ))}
        </Select>
        {clusterSlug && (
          <span className="text-sm text-zinc-500">
            {classifiedCount}/{destinationsInCluster.length} điểm trong cụm đã có tag
          </span>
        )}
      </div>

      {clusterSlug && (
        <div className="flex flex-wrap items-center gap-2">
          <AiInvocationBar
            onSelectionChange={(p, m) => {
              setAiProvider(p);
              setAiModel(m);
            }}
            fetchPreview={async () =>
              previewPromptResponseSchema.parse(
                await apiSend("POST", "/destination-tags/suggest/preview", {
                  destinationSlugs: destinationsInCluster.map((d) => d.slug),
                }),
              ).sections
            }
          />
          <Button size="sm" variant="secondary" onClick={() => suggest.mutate()} loading={suggest.isPending}>
            Gợi ý AI cho cụm này
          </Button>
        </div>
      )}

      {suggest.isError && <ErrorBox error={suggest.error} fallback="Lỗi gợi ý AI" />}
      {suggest.isSuccess && (
        <p className="text-sm text-zinc-500">
          AI đã đề xuất cho {aiSuggestions.size} điểm — mở từng thẻ để xem/duyệt.
        </p>
      )}

      {!clusterSlug && (
        <p className="text-sm text-zinc-500">Chọn 1 cụm/tỉnh ở trên để bắt đầu gán tay.</p>
      )}
      {clusterSlug && destinationsInCluster.length === 0 && (
        <p className="text-sm text-zinc-500">Cụm/tỉnh này chưa có điểm đến nào.</p>
      )}

      {clusterSlug && destinationsInCluster.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          <TagKanbanColumn
            title="Chưa gán tag"
            items={columns.unclassified}
            warn
            onCardClick={setEditingSlug}
          />
          {columns.tagColumns.map(([tagSlug, items]) => (
            <TagKanbanColumn
              key={tagSlug}
              title={columns.tagBySlug.get(tagSlug)?.name ?? tagSlug}
              items={items}
              onCardClick={setEditingSlug}
            />
          ))}
        </div>
      )}

      {editingDestination && (
        <EditTagsModal
          destination={editingDestination}
          allTags={data.tags}
          suggestion={aiSuggestions.get(editingDestination.slug) ?? null}
          onClose={() => setEditingSlug(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: TAG_KANBAN_QUERY_KEY })}
        />
      )}
    </div>
  );
}

function TagKanbanColumn({
  title,
  items,
  warn,
  onCardClick,
}: {
  title: string;
  items: TagKanbanBoardDestination[];
  warn?: boolean;
  onCardClick: (slug: string) => void;
}) {
  return (
    <div
      className={`w-64 shrink-0 rounded-lg border p-2 ${
        warn
          ? "border-orange-300 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30"
          : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40"
      }`}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{title}</span>
        <Badge tone={warn ? "amber" : "gray"}>{items.length}</Badge>
      </div>
      <div className="max-h-[70vh] space-y-1.5 overflow-y-auto">
        {items.map((d) => (
          <button
            key={d.slug}
            type="button"
            onClick={() => onCardClick(d.slug)}
            className="flex w-full items-center gap-2 rounded border border-zinc-200 bg-white p-1.5 text-left hover:border-primary dark:border-zinc-800 dark:bg-zinc-900"
          >
            {d.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.imageUrl} alt="" className="h-8 w-10 shrink-0 rounded object-cover" />
            ) : (
              <div className="h-8 w-10 shrink-0 rounded bg-zinc-200 dark:bg-zinc-800" />
            )}
            <span className="line-clamp-2 flex-1 text-xs">{d.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function EditTagsModal({
  destination,
  allTags,
  suggestion,
  onClose,
  onSaved,
}: {
  destination: TagKanbanBoardDestination;
  allTags: GetTagKanbanBoardResponse["tags"];
  suggestion: TagSuggestion | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  // "selected" luon phan anh trang thai HIEN TAI da luu (khong am tham tick san theo
  // AI) — nguoi dung phan hoi 24/07/2026: chinh chu yeu bang tay, muon xem popup
  // cu/moi ro rang truoc khi ap dung goi y AI, khong muon bi tick san "im lang".
  const [selected, setSelected] = useState<Set<string>>(new Set(destination.tagSlugs));
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  const suggestedTagSlugs = suggestion?.tagSlugs ?? [];
  const currentTagSlugsKey = [...destination.tagSlugs].sort().join(",");
  const suggestedTagSlugsKey = [...suggestedTagSlugs].sort().join(",");
  const hasSuggestion =
    !suggestionDismissed && suggestedTagSlugs.length > 0 && suggestedTagSlugsKey !== currentTagSlugsKey;

  const save = useMutation({
    mutationFn: (tagSlugs: string[]) =>
      apiSend("POST", "/destination-tags/apply", {
        assignments: [{ destinationSlug: destination.slug, tagSlugs }],
      }),
    onSuccess: onSaved,
  });

  function toggle(tagSlug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tagSlug)) next.delete(tagSlug);
      else next.add(tagSlug);
      save.mutate([...next]);
      return next;
    });
  }

  function applySuggestion() {
    setSelected(new Set(suggestedTagSlugs));
    save.mutate(suggestedTagSlugs);
  }

  function nameOf(slug: string): string {
    return allTags.find((t) => t.slug === slug)?.name ?? slug;
  }

  return (
    <Modal open onClose={onClose} title={destination.name}>
      <div className="space-y-4">
        {hasSuggestion && (
          <div className="space-y-2 rounded border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-200">
            <p className="font-semibold">🤖 AI gợi ý đổi tag — xem trước khi áp dụng</p>
            <div className="grid grid-cols-[auto_1fr] items-start gap-x-2 gap-y-1">
              <span className="text-zinc-500 dark:text-zinc-400">Hiện tại:</span>
              <span>
                {destination.tagSlugs.length === 0
                  ? "(chưa có tag)"
                  : destination.tagSlugs.map(nameOf).join(", ")}
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">AI gợi ý:</span>
              <span className="font-medium">{suggestedTagSlugs.map(nameOf).join(", ")}</span>
            </div>
            <p className="italic text-indigo-700 dark:text-indigo-300">
              Lý do: {suggestion?.reasoning}
            </p>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={applySuggestion} loading={save.isPending}>
                Áp dụng gợi ý AI
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setSuggestionDismissed(true)}>
                Bỏ qua, tự chọn tay
              </Button>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          {allTags.map((t) => (
            <Checkbox
              key={t.slug}
              label={t.name}
              checked={selected.has(t.slug)}
              onChange={() => toggle(t.slug)}
            />
          ))}
        </div>
        {save.isError && <ErrorBox error={save.error} fallback="Lỗi lưu tag" />}
      </div>
    </Modal>
  );
}

/* --- Bang gan tag hien tai (tham khao) --- */

function CurrentAssignmentsSection() {
  // Dung chung TAG_KANBAN_QUERY_KEY voi TagKanbanSection ben tren — cung 1 API
  // /destination-tags/kanban-board nen react-query chi goi mang 1 lan, khong
  // can them endpoint rieng cho filter cum + popup sua tag o day (phan hoi
  // nguoi dung 26/07/2026: list phang cung can filter theo cum + bam ten de sua).
  const [clusterSlug, setClusterSlug] = useState("");
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: TAG_KANBAN_QUERY_KEY,
    queryFn: () => apiGet("/destination-tags/kanban-board", getTagKanbanBoardResponseSchema),
  });

  const data = query.data;
  const tagBySlug = useMemo(() => new Map((data?.tags ?? []).map((t) => [t.slug, t.name])), [data]);
  const destinations = useMemo(() => {
    if (!data) return [];
    if (!clusterSlug) return data.destinations;
    return data.destinations.filter((d) => d.parentSlug === clusterSlug);
  }, [data, clusterSlug]);
  const editingDestination = data?.destinations.find((d) => d.slug === editingSlug) ?? null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Tag đang gán ({destinations.length} điểm đến)
        </h3>
        {data && (
          <Select value={clusterSlug} onChange={(e) => setClusterSlug(e.target.value)}>
            <option value="">Tất cả cụm/tỉnh</option>
            {data.clusters.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name} ({c.kind === "province" ? "Tỉnh" : "Cụm"})
              </option>
            ))}
          </Select>
        )}
      </div>

      {query.isLoading && <p className="text-sm text-zinc-500">Đang tải...</p>}
      {query.isError && <ErrorBox error={query.error} fallback="Lỗi tải danh sách tag đang gán" />}

      {data && (
        <div className="max-h-96 divide-y divide-zinc-200 overflow-y-auto rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {destinations.map((d) => (
            <div key={d.slug} className="flex flex-wrap items-center gap-2 p-2.5">
              <button
                type="button"
                onClick={() => setEditingSlug(d.slug)}
                className="w-48 shrink-0 text-left text-sm text-primary hover:underline"
              >
                {d.name}
              </button>
              {d.tagSlugs.length === 0 ? (
                <span className="text-xs text-zinc-400">Chưa gán tag</span>
              ) : (
                d.tagSlugs.map((tagSlug) => (
                  <Badge key={tagSlug} tone="indigo">
                    {tagBySlug.get(tagSlug) ?? tagSlug}
                  </Badge>
                ))
              )}
            </div>
          ))}
        </div>
      )}

      {data && editingDestination && (
        <EditTagsModal
          destination={editingDestination}
          allTags={data.tags}
          suggestion={null}
          onClose={() => setEditingSlug(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: TAG_KANBAN_QUERY_KEY })}
        />
      )}
    </section>
  );
}
