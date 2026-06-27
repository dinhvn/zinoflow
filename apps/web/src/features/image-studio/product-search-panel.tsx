"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  productSearchResultSchema,
  supplierOptionsSchema,
  categoryOptionsSchema,
  formatPriceVnd,
  type ProductCell,
} from "@zinoflow/contracts";
import { apiGet } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { ErrorBox } from "@/shared/ui/error-box";
import { Input } from "@/shared/ui/input";
import { Pagination } from "@/shared/ui/pagination";
import { Combobox } from "@/shared/ui/combobox";
import { Select } from "@/shared/ui/select";

// Filter options doi rat it -> cache lau, khong refetch lien tuc.
const OPTIONS_STALE_MS = 10 * 60 * 1000;

type SortKey = "default" | "price-asc" | "price-desc" | "discount-desc" | "name";
const SORT_LABELS: Record<SortKey, string> = {
  default: "Mặc định (CMS)",
  "price-asc": "Giá thấp → cao",
  "price-desc": "Giá cao → thấp",
  "discount-desc": "% giảm nhiều nhất",
  name: "Tên A → Z",
};

const priceOf = (p: ProductCell) => p.salePrice ?? p.originalPrice ?? 0;

/** Sort client-side tren trang dang tai (CMS khong nhan SortBy). */
function sortProducts(items: ProductCell[], key: SortKey): ProductCell[] {
  if (key === "default") return items;
  const arr = [...items];
  switch (key) {
    case "price-asc":
      return arr.sort((a, b) => priceOf(a) - priceOf(b));
    case "price-desc":
      return arr.sort((a, b) => priceOf(b) - priceOf(a));
    case "discount-desc":
      return arr.sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0));
    case "name":
      return arr.sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }
}

/** Buoc 1+2: tim san pham tu CMS (filter) va chon vao working set — spec §3. */
export function ProductSearchPanel({
  existingIds,
  onAdd,
}: {
  existingIds: Set<string>;
  onAdd: (products: ProductCell[]) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [supplierCode, setSupplierCode] = useState("");
  const [categoryCode, setCategoryCode] = useState("");
  const [isDiscount, setIsDiscount] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [isHot, setIsHot] = useState(false);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const suppliersQuery = useQuery({
    queryKey: ["image-suppliers"],
    queryFn: () => apiGet("/images/suppliers", supplierOptionsSchema),
    staleTime: OPTIONS_STALE_MS,
  });
  const categoriesQuery = useQuery({
    queryKey: ["image-categories"],
    queryFn: () => apiGet("/images/categories", categoryOptionsSchema),
    staleTime: OPTIONS_STALE_MS,
  });

  const query = useQuery({
    queryKey: ["image-products", keyword, supplierCode, categoryCode, isDiscount, isNew, isHot, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "24" });
      if (keyword) params.set("keyword", keyword);
      if (supplierCode) params.set("supplierCode", supplierCode);
      if (categoryCode) params.set("categoryCode", categoryCode);
      if (isDiscount) params.set("isDiscount", "true");
      if (isNew) params.set("isNew", "true");
      if (isHot) params.set("isHot", "true");
      return apiGet(`/images/products?${params}`, productSearchResultSchema);
    },
  });

  const items = query.data?.items ?? [];
  const sortedItems = useMemo(() => sortProducts(items, sortKey), [items, sortKey]);

  // Map code -> ten NCC de hien thi tren tung san pham.
  const supplierNameByCode = useMemo(
    () => new Map((suppliersQuery.data ?? []).map((s) => [s.code, s.name])),
    [suppliersQuery.data],
  );
  const supplierLabel = (p: ProductCell) =>
    (p.supplierCode ? supplierNameByCode.get(p.supplierCode) : null) ?? p.supplierName ?? p.supplierCode ?? "";

  // Category phan cap: thut le theo level cho de doc trong combobox.
  const categoryOptions = (categoriesQuery.data ?? []).map((c) => ({
    value: c.code,
    label: "  ".repeat(Math.max(0, c.level - 1)) + c.name,
  }));
  const supplierOptions = (suppliersQuery.data ?? []).map((s) => ({ value: s.code, label: s.name }));

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addPicked() {
    const toAdd = items
      .filter((p) => picked.has(p.id) && !existingIds.has(p.id))
      // Gan ten NCC vao san pham de working set + preview hien duoc.
      .map((p) => ({ ...p, supplierName: supplierLabel(p) || null }));
    if (toAdd.length) onAdd(toAdd);
    setPicked(new Set());
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setPage(1);
          }}
          placeholder="Tìm sản phẩm..."
          className="flex-1"
        />
        <Button variant="primary" onClick={() => query.refetch()} loading={query.isFetching}>
          Tìm
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Combobox
          className="flex-1"
          emptyLabel="Mọi nhà cung cấp"
          value={supplierCode}
          onChange={(v) => {
            setSupplierCode(v);
            setPage(1);
          }}
          options={supplierOptions}
        />
        <Combobox
          className="flex-1"
          emptyLabel="Mọi danh mục"
          value={categoryCode}
          onChange={(v) => {
            setCategoryCode(v);
            setPage(1);
          }}
          options={categoryOptions}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Checkbox label="Giảm giá" checked={isDiscount} onChange={(e) => { setIsDiscount(e.target.checked); setPage(1); }} />
        <Checkbox label="Mới" checked={isNew} onChange={(e) => { setIsNew(e.target.checked); setPage(1); }} />
        <Checkbox label="Hot" checked={isHot} onChange={(e) => { setIsHot(e.target.checked); setPage(1); }} />
      </div>

      {query.isError && <ErrorBox error={query.error} fallback="Lỗi tải sản phẩm (API /images/products đã chạy chưa?)" />}

      <div className="flex items-center gap-2">
        <Select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="py-1 text-xs"
          aria-label="Sắp xếp"
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <option key={k} value={k}>{SORT_LABELS[k]}</option>
          ))}
        </Select>
        <span className="ml-auto text-xs text-zinc-500">{picked.size} đã chọn</span>
        <Button size="sm" variant="primary" disabled={picked.size === 0} onClick={addPicked}>
          + Thêm {picked.size}
        </Button>
      </div>

      <div className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
        {sortedItems.map((p) => {
          const already = existingIds.has(p.id);
          const active = picked.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              disabled={already}
              onClick={() => togglePick(p.id)}
              className={[
                "flex gap-2 rounded border p-2 text-left transition-colors",
                already
                  ? "cursor-not-allowed border-emerald-300 bg-emerald-50 opacity-70 dark:border-emerald-900 dark:bg-emerald-950"
                  : active
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950"
                    : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700",
              ].join(" ")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.imageUrl} alt={p.name} className="h-14 w-14 shrink-0 rounded object-cover" />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-xs">{p.name}</span>
                {supplierLabel(p) && (
                  <span className="mt-0.5 block truncate text-[10px] text-zinc-400">{supplierLabel(p)}</span>
                )}
                <span className="mt-1 block text-xs font-semibold text-rose-600">
                  {formatPriceVnd(p.salePrice ?? p.originalPrice)}
                </span>
                {already && <span className="text-[10px] text-emerald-600">đã thêm</span>}
              </span>
            </button>
          );
        })}
        {!query.isLoading && items.length === 0 && (
          <p className="col-span-2 py-6 text-center text-sm text-zinc-400">Không có sản phẩm.</p>
        )}
      </div>

      {query.data && query.data.total > query.data.limit && (
        <Pagination
          page={page}
          pageSize={query.data.limit}
          total={query.data.total}
          onPageChange={setPage}
          onPageSizeChange={() => {}}
          pageSizeOptions={[query.data.limit]}
        />
      )}
    </div>
  );
}
