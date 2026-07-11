"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod/v4";
import { productSchema, PRODUCT_CATEGORIES, type Product } from "@zinoflow/contracts";
import { apiGet, apiSend, ApiError } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Badge } from "@/shared/ui/badge";
import { AffiliateUrlPreview } from "@/features/dichoithoi/affiliate-url-preview";

const EMPTY_FORM = {
  name: "",
  category: "" as "" | (typeof PRODUCT_CATEGORIES)[number],
  tags: "",
  thumbnailUrl: "",
  price: "",
  sourceUrl: "",
};

/**
 * Man "Sản phẩm" (product-spec §6) — affiliate dung chung, ghep vao bai viet
 * qua tag (KHONG gan theo dia ly nhu Hotel/Tour, khong co panel gan diem den).
 */
export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: () => apiGet("/products", z.array(productSchema)),
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name.trim(),
        category: form.category,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0),
        thumbnailUrl: form.thumbnailUrl.trim() || null,
        price: form.price.trim() === "" ? null : Number(form.price),
        sourceUrl: form.sourceUrl.trim(),
      };
      if (editingId) {
        return productSchema.parse(await apiSend("PATCH", `/products/${editingId}`, body));
      }
      return productSchema.parse(await apiSend("POST", "/products", body));
    },
    onSuccess: () => {
      setError(null);
      setForm(EMPTY_FORM);
      setEditingId(null);
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : String(e)),
  });

  function startEdit(p: Product) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      category: p.category,
      tags: p.tags.join(", "),
      thumbnailUrl: p.thumbnailUrl ?? "",
      price: p.price === null ? "" : String(p.price),
      sourceUrl: p.sourceUrl,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Sản phẩm</h2>
          <p className="text-sm text-zinc-500">
            Affiliate dùng chung, chèn vào bài viết qua tag — KHÔNG gắn theo điểm đến/tỉnh
            (product-spec §1). Chèn bằng <code>[[block:products tag=...]]</code> hoặc{" "}
            <code>[[block:product id=...]]</code> trong bài cẩm nang.
          </p>
        </div>
        <a href="/dichoithoi/san-pham/nhap" className="whitespace-nowrap text-sm text-blue-600 hover:underline dark:text-blue-400">
          Nhập từ Sheet →
        </a>
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded border border-zinc-300 p-4 dark:border-zinc-700">
        <h3 className="mb-3 font-medium">{editingId ? "Sửa sản phẩm" : "Thêm sản phẩm"}</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Input
            className="md:col-span-2"
            placeholder="Tên sản phẩm *"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Select
            value={form.category}
            onChange={(e) =>
              setForm((f) => ({ ...f, category: e.target.value as (typeof PRODUCT_CATEGORIES)[number] }))
            }
          >
            <option value="">Chọn category *</option>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Input
            className="md:col-span-3"
            placeholder="Tags, cách nhau dấu phẩy (vd: phuot, leo-nui)"
            value={form.tags}
            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
          />
          <Input
            placeholder="Giá (VND)"
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
          />
          <Input
            placeholder="Ảnh (thumbnail URL)"
            value={form.thumbnailUrl}
            onChange={(e) => setForm((f) => ({ ...f, thumbnailUrl: e.target.value }))}
          />
          <Input
            placeholder="Link gốc (sourceUrl) *"
            value={form.sourceUrl}
            onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))}
          />
        </div>
        <div className="mt-2">
          <AffiliateUrlPreview sourceUrl={form.sourceUrl} />
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={!form.name.trim() || !form.category.trim() || !form.sourceUrl.trim()}
            onClick={() => save.mutate()}
          >
            {editingId ? "Lưu thay đổi" : "Tạo sản phẩm"}
          </Button>
          {editingId && (
            <Button
              variant="ghost"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY_FORM);
              }}
            >
              Huỷ sửa
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {productsQuery.data?.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded border border-zinc-300 p-3 dark:border-zinc-700"
          >
            <div className="text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{p.name}</span>
                <Badge tone="gray">{p.category}</Badge>
                <Badge
                  tone={
                    p.linkStatus === "converted"
                      ? "emerald"
                      : p.linkStatus === "no-rule"
                        ? "amber"
                        : "gray"
                  }
                >
                  {p.linkStatus}
                </Badge>
              </div>
              <div className="text-xs text-zinc-500">
                {p.tags.length > 0 ? p.tags.join(", ") : "— chưa có tag"} · Giá{" "}
                {p.price !== null ? `${p.price.toLocaleString("vi-VN")}đ` : "—"}
              </div>
            </div>
            <Button size="sm" onClick={() => startEdit(p)}>
              Sửa
            </Button>
          </div>
        ))}
        {productsQuery.data?.length === 0 && (
          <p className="text-sm text-zinc-500">Chưa có sản phẩm nào.</p>
        )}
      </div>
    </div>
  );
}
