"use client";

import { useState } from "react";
import { formatPriceVnd, formatDiscountPercent, type ProductCell } from "@zinoflow/contracts";
import { Button } from "@/shared/ui/button";
import { Select } from "@/shared/ui/select";

/**
 * Buoc 2: working set — sap xep (keo-tha hoac ▲▼), xoa 1 hoac tat ca — spec §3.
 * Thu tu o day quyet dinh thu tu san pham trong cac anh (chia batch theo cua so k).
 */
export function WorkingSetPanel({
  products,
  onMove,
  onReorder,
  onRemove,
  onClear,
  onSort,
}: {
  products: ProductCell[];
  onMove: (index: number, dir: -1 | 1) => void;
  onReorder: (from: number, to: number) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onSort: (key: string) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function drop(to: number) {
    if (dragIndex !== null && dragIndex !== to) onReorder(dragIndex, to);
    setDragIndex(null);
    setOverIndex(null);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Đã chọn ({products.length})</span>
        <div className="flex gap-2">
          <Select
            value=""
            disabled={products.length === 0}
            onChange={(e) => {
              if (e.target.value) onSort(e.target.value);
            }}
            className="py-1 text-xs"
            aria-label="Sắp xếp toàn bộ"
          >
            <option value="">Sắp xếp…</option>
            <option value="price-asc">Giá thấp → cao</option>
            <option value="price-desc">Giá cao → thấp</option>
            <option value="discount-desc">% giảm nhiều nhất</option>
            <option value="name">Tên A → Z</option>
          </Select>
          <Button size="sm" variant="danger" disabled={products.length === 0} onClick={onClear}>
            Xóa hết
          </Button>
        </div>
      </div>

      {products.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-400">Chưa chọn sản phẩm nào.</p>
      ) : (
        <>
          <p className="text-[11px] text-zinc-400">Kéo-thả để sắp xếp (hoặc dùng ▲▼). Thứ tự quyết định vị trí trên ảnh.</p>
          <ul className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
            {products.map((p, i) => (
              <li
                key={p.id}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragEnter={() => setOverIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => drop(i)}
                onDragEnd={() => {
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                className={[
                  "flex items-center gap-2 rounded border p-1.5",
                  dragIndex === i ? "opacity-50" : "",
                  overIndex === i && dragIndex !== null && dragIndex !== i
                    ? "border-indigo-400 ring-1 ring-indigo-400"
                    : "border-zinc-200 dark:border-zinc-700",
                ].join(" ")}
              >
                <span className="cursor-grab select-none text-zinc-400" title="Kéo để sắp xếp" aria-hidden>
                  ⠿
                </span>
                <span className="w-5 text-center text-xs text-zinc-400">{i + 1}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imageUrl} alt={p.name} className="h-10 w-10 shrink-0 rounded object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 text-xs">{p.name}</span>
                  {(p.supplierName ?? p.supplierCode) && (
                    <span className="block truncate text-[10px] text-zinc-400">{p.supplierName ?? p.supplierCode}</span>
                  )}
                  <span className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="text-xs font-semibold text-rose-600">{formatPriceVnd(p.salePrice ?? p.originalPrice)}</span>
                    {p.salePrice != null && p.originalPrice != null && p.salePrice < p.originalPrice && (
                      <span className="text-[10px] text-zinc-400 line-through">{formatPriceVnd(p.originalPrice)}</span>
                    )}
                    {(p.discountPercent ?? 0) > 0 && (
                      <span className="rounded bg-rose-100 px-1 text-[10px] font-semibold text-rose-600 dark:bg-rose-950">
                        {formatDiscountPercent(p.discountPercent)}
                      </span>
                    )}
                  </span>
                </span>
                <div className="flex flex-col">
                  <button type="button" aria-label="Lên" disabled={i === 0} onClick={() => onMove(i, -1)} className="px-1 text-xs disabled:opacity-30">▲</button>
                  <button type="button" aria-label="Xuống" disabled={i === products.length - 1} onClick={() => onMove(i, 1)} className="px-1 text-xs disabled:opacity-30">▼</button>
                </div>
                <button type="button" aria-label="Xóa" onClick={() => onRemove(p.id)} className="px-1.5 text-rose-500 hover:text-rose-700">✕</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
