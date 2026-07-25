"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { taxonomyContentSchema, type TaxonomyContent } from "@zinoflow/contracts";
import { apiGet, apiSend, ApiError } from "@/shared/api-client";
import { Button, buttonClasses, ErrorBox, FeatureIntro, Input, Textarea } from "@/shared/ui";

/** Cung constant voi apps/web/src/app/dichoithoi/[slug]/page.tsx — DiChoiThoi.Web
 * chay local qua `dotnet run` (profile http, Properties/launchSettings.json). */
const LOCAL_SITE_BASE_URL = "http://localhost:5176";
const SITE_BASE_URL = "https://dichoithoi.com";

/**
 * Sua doan gioi thieu (Description) cho group/type/province — hien thi tren
 * trang danh muc /loai, /tinh cua website (Phase 18.2, content-seo-ux-plan §10.3,
 * tranh thin content). Danh sach tinh (34 tinh, ~7 nhom, ~18 loai) — khong can
 * phan trang/tim kiem, hien het 1 lan la du.
 */
export default function DanhMucPage() {
  const query = useQuery({
    queryKey: ["taxonomy-content"],
    queryFn: () => apiGet("/destinations/taxonomy-content", taxonomyContentSchema),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Nội dung danh mục</h2>
        <p className="text-sm text-zinc-500">
          Đoạn giới thiệu riêng cho từng trang /loại và /tỉnh trên dichoithoi.com — bắt buộc để
          tránh thin content (mỗi trang danh mục cần văn bản riêng, không chỉ là lưới card).
        </p>
      </div>

      <FeatureIntro
        summary={
          <>
            Chỉ cần <strong>2-4 câu</strong> là đủ — trang này khác trang &quot;Chủ đề&quot; (cần
            300-500 từ).
          </>
        }
        details={
          <>
            Nhóm/Loại/Tỉnh là <strong>trục phân loại khách quan</strong> — bản thân lưới điểm đến
            hiển thị bên dưới đã trả lời đúng ý người tìm (&quot;thác nước đẹp&quot;, &quot;du lịch
            Ninh Bình&quot;). Đoạn giới thiệu chỉ cần nêu ngữ cảnh + vài ví dụ nổi bật, không cần
            dài. Ngược lại, trang &quot;Chủ đề&quot; (/chu-de/&#123;slug&#125;) là góc nhìn cắt
            ngang do mình tự đặt — cùng điểm đến đã có ở trang Loại/Tỉnh rồi, nên nếu mô tả ngắn
            thì trang không còn giá trị riêng, dễ bị Google coi là nội dung trùng lặp nội bộ. Vì
            vậy chỉ trang Chủ đề mới cần đoạn dài 300-500 từ để có lý do tồn tại độc lập.
            <br />
            <strong>Meta description</strong> là ô riêng bên dưới — dùng cho thẻ{" "}
            <code>&lt;meta description&gt;</code> Google hiển thị trên kết quả tìm kiếm, để trống
            thì web tự lấy từ đoạn giới thiệu. Riêng dòng &quot;Loại&quot;: khi lưu, tên điểm đến
            nhắc trong đoạn giới thiệu sẽ <strong>tự động thành link nội bộ</strong> tới trang điểm
            đến đó (không cần thao tác gì thêm) — Nhóm/Tỉnh chưa có tính năng này. Dòng &quot;Loại&quot;
            cũng hỗ trợ Markdown đầy đủ (đồng bộ với ô Nội dung bài viết điểm đến): <code>- </code>{" "}
            gạch đầu dòng, <code>**chữ**</code> in đậm, <code>## Tiêu đề</code>... — thường không
            cần cho đoạn ngắn 2-4 câu, nhưng dùng được nếu cần.
          </>
        }
      />

      {query.isLoading && <p className="text-sm text-zinc-500">Đang tải...</p>}
      {query.isError && <ErrorBox error={query.error} fallback="Lỗi tải danh mục" />}

      {query.data && <TaxonomySections data={query.data} />}
    </div>
  );
}

function TaxonomySections({ data }: { data: TaxonomyContent }) {
  return (
    <div className="space-y-8">
      <Section title="Nhóm loại điểm đến (/loại/{group})">
        {data.groups.map((g) => (
          <DescriptionRow
            key={`group-${g.id}`}
            target="group"
            id={g.id}
            name={g.name}
            path={`/loai/${g.slug}`}
            initialDescription={g.description}
            initialMetaDescription={g.metaDescription}
          />
        ))}
      </Section>

      <Section title="Loại điểm đến (/loại/{group}/{type})">
        {data.types.map((t) => {
          const group = data.groups.find((g) => g.id === t.groupId);
          return (
            <DescriptionRow
              key={`type-${t.id}`}
              target="type"
              id={t.id}
              name={t.name}
              path={`/loai/${group?.slug ?? "?"}/${t.slug}`}
              initialDescription={t.description}
              initialMetaDescription={t.metaDescription}
              autoLink
            />
          );
        })}
      </Section>

      <Section title="Tỉnh/thành (/tỉnh/{slug})">
        {data.provinces.map((p) => (
          <DescriptionRow
            key={`province-${p.id}`}
            target="province"
            id={p.id}
            name={p.name}
            path={`/tinh/${p.slug}`}
            initialDescription={p.description}
            initialMetaDescription={p.metaDescription}
          />
        ))}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{title}</h3>
      <div className="divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {children}
      </div>
    </section>
  );
}

function DescriptionRow({
  target,
  id,
  name,
  path,
  initialDescription,
  initialMetaDescription,
  autoLink = false,
}: {
  target: "group" | "type" | "province";
  id: number;
  name: string;
  path: string;
  initialDescription: string | null;
  initialMetaDescription: string | null;
  /** Type co auto-link (tu link ten diem den khi luu) — hien 1 dong ghi chu nho. */
  autoLink?: boolean;
}) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(initialDescription ?? "");
  const [metaValue, setMetaValue] = useState(initialMetaDescription ?? "");

  useEffect(() => {
    setValue(initialDescription ?? "");
  }, [initialDescription]);
  useEffect(() => {
    setMetaValue(initialMetaDescription ?? "");
  }, [initialMetaDescription]);

  const mutation = useMutation({
    mutationFn: () =>
      apiSend("PATCH", "/destinations/taxonomy-content", {
        target,
        id,
        description: value.trim() || null,
        metaDescription: metaValue.trim() || null,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["taxonomy-content"] }),
  });

  const dirty = value !== (initialDescription ?? "") || metaValue !== (initialMetaDescription ?? "");

  return (
    <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-[200px_1fr_auto] sm:items-start">
      <div>
        <div className="text-sm font-medium">{name}</div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-xs text-zinc-500">{path}</span>
          <a
            href={`${LOCAL_SITE_BASE_URL}${path}`}
            target="_blank"
            rel="noreferrer"
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            Xem local ↗
          </a>
          <a
            href={`${SITE_BASE_URL}${path}`}
            target="_blank"
            rel="noreferrer"
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            Xem production ↗
          </a>
        </div>
      </div>
      <div className="space-y-1.5">
        <Textarea
          rows={2}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Đoạn giới thiệu ngắn (2-4 câu) hiển thị đầu trang..."
          className="w-full"
        />
        {autoLink && (
          <p className="text-xs text-indigo-600 dark:text-indigo-400">
            🔗 Tên điểm đến nhắc ở trên sẽ tự thành link nội bộ khi lưu.
          </p>
        )}
        <Input
          value={metaValue}
          onChange={(e) => setMetaValue(e.target.value)}
          placeholder="Meta description cho Google (để trống = tự lấy từ đoạn trên)..."
          maxLength={160}
          className="w-full text-xs"
        />
      </div>
      <div className="flex flex-col items-start gap-1 sm:items-end">
        <Button
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={!dirty}
          loading={mutation.isPending}
        >
          Lưu
        </Button>
        {mutation.isError && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {mutation.error instanceof ApiError ? mutation.error.message : "Lỗi lưu"}
          </span>
        )}
      </div>
    </div>
  );
}
