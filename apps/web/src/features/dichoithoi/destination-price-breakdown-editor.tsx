"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod/v4";
import { priceBreakdownItemSchema, type PriceBreakdownItem } from "@zinoflow/contracts";
import { apiSend, ApiError } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

interface Row {
  audience: string;
  price: string;
  note: string;
}

function toRows(items: readonly PriceBreakdownItem[]): Row[] {
  return items.map((i) => ({
    audience: i.audience,
    price: String(i.price),
    note: i.note ?? "",
  }));
}

/**
 * Sua gia ve theo doi tuong (nguoi lon/tre em/...) — nhap tay HOAN TOAN, AI
 * khong duoc tu sinh/doan so nay vi day la gia chinh thuc cua diem den
 * (content-seo-ux-plan §5.5a). Luu rieng, khong qua form metadata chung.
 */
export function DestinationPriceBreakdownEditor({
  slug,
  priceBreakdown,
  onSaved,
}: {
  slug: string;
  priceBreakdown: PriceBreakdownItem[];
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(toRows(priceBreakdown));
  const [error, setError] = useState<{ message: string; details: string[] } | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        priceBreakdown: rows
          .filter((r) => r.audience.trim() && r.price.trim())
          .map((r) => ({
            audience: r.audience.trim(),
            price: Number(r.price),
            note: r.note.trim() || null,
          })),
      };
      return z
        .array(priceBreakdownItemSchema)
        .parse(await apiSend("POST", `/destinations/${slug}/price-breakdown`, body));
    },
    onSuccess: (saved) => {
      setError(null);
      setRows(toRows(saved));
      onSaved();
    },
    onError: (e) =>
      setError(
        e instanceof ApiError
          ? { message: e.message, details: e.details }
          : { message: String(e), details: [] },
      ),
  });

  const update = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        Giá cố định chính thức do điểm đến quy định (niêm yết tại cổng) — nhập tay, KHÔNG suy diễn
        theo tỷ lệ. Để trống hoàn toàn nếu chưa có dữ liệu.
      </p>
      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <p className="font-medium">{error.message}</p>
        </div>
      )}

      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="rounded border border-zinc-300 p-2 dark:border-zinc-700">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <Input
                value={row.audience}
                onChange={(e) => update(i, { audience: e.target.value })}
                placeholder="Đối tượng (vd: Người lớn)"
              />
              <Input
                type="number"
                min={0}
                value={row.price}
                onChange={(e) => update(i, { price: e.target.value })}
                placeholder="Giá (đ)"
              />
              <Input
                value={row.note}
                onChange={(e) => update(i, { note: e.target.value })}
                placeholder="Ghi chú (tuỳ chọn)"
              />
            </div>
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                className="px-2 py-1 text-xs"
                onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
              >
                Xoá
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          className="px-2 py-1 text-xs"
          onClick={() => setRows((prev) => [...prev, { audience: "", price: "", note: "" }])}
        >
          + Thêm dòng
        </Button>
        <Button variant="primary" size="sm" loading={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Đang lưu..." : "Lưu giá vé theo đối tượng"}
        </Button>
      </div>
    </div>
  );
}
