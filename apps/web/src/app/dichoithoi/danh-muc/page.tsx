"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { taxonomyContentSchema, type TaxonomyContent } from "@zinoflow/contracts";
import { apiGet, apiSend, ApiError } from "@/shared/api-client";
import { Button, ErrorBox, Textarea } from "@/shared/ui";

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
}: {
  target: "group" | "type" | "province";
  id: number;
  name: string;
  path: string;
  initialDescription: string | null;
}) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(initialDescription ?? "");

  useEffect(() => {
    setValue(initialDescription ?? "");
  }, [initialDescription]);

  const mutation = useMutation({
    mutationFn: () =>
      apiSend("PATCH", "/destinations/taxonomy-content", {
        target,
        id,
        description: value.trim() || null,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["taxonomy-content"] }),
  });

  const dirty = value !== (initialDescription ?? "");

  return (
    <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-[200px_1fr_auto] sm:items-start">
      <div>
        <div className="text-sm font-medium">{name}</div>
        <div className="text-xs text-zinc-500">{path}</div>
      </div>
      <Textarea
        rows={2}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Đoạn giới thiệu ngắn (2-4 câu) hiển thị đầu trang..."
        className="w-full"
      />
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
