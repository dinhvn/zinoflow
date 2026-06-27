"use client";

import { formatPriceVnd, type ProductCell } from "@zinoflow/contracts";
import { Button } from "@/shared/ui/button";

/**
 * Buoc 2: working set — sort (len/xuong), xoa 1 hoac tat ca — spec §3.
 * Thu tu o day quyet dinh thu tu san pham trong cac anh (chia batch theo cua so k).
 */
export function WorkingSetPanel({
  products,
  onMove,
  onRemove,
  onClear,
  onSortByDiscount,
}: {
  products: ProductCell[];
  onMove: (index: number, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onSortByDiscount: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Đã chọn ({products.length})</span>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" disabled={products.length === 0} onClick={onSortByDiscount}>
            Sắp theo % giảm
          </Button>
          <Button size="sm" variant="danger" disabled={products.length === 0} onClick={onClear}>
            Xóa hết
          </Button>
        </div>
      </div>

      {products.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-400">Chưa chọn sản phẩm nào.</p>
      ) : (
        <ul className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
          {products.map((p, i) => (
            <li key={p.id} className="flex items-center gap-2 rounded border border-zinc-200 p-1.5 dark:border-zinc-700">
              <span className="w-5 text-center text-xs text-zinc-400">{i + 1}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.imageUrl} alt={p.name} className="h-10 w-10 shrink-0 rounded object-cover" />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1 text-xs">{p.name}</span>
                {(p.supplierName ?? p.supplierCode) && (
                  <span className="block truncate text-[10px] text-zinc-400">{p.supplierName ?? p.supplierCode}</span>
                )}
                <span className="text-xs font-semibold text-rose-600">{formatPriceVnd(p.salePrice ?? p.originalPrice)}</span>
              </span>
              <div className="flex flex-col">
                <button type="button" aria-label="Lên" disabled={i === 0} onClick={() => onMove(i, -1)} className="px-1 text-xs disabled:opacity-30">▲</button>
                <button type="button" aria-label="Xuống" disabled={i === products.length - 1} onClick={() => onMove(i, 1)} className="px-1 text-xs disabled:opacity-30">▼</button>
              </div>
              <button type="button" aria-label="Xóa" onClick={() => onRemove(p.id)} className="px-1.5 text-rose-500 hover:text-rose-700">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
