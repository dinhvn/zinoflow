"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod/v4";
import {
  practicalNoteItemSchema,
  suggestPracticalNotesResponseSchema,
  type PracticalNoteItem,
} from "@zinoflow/contracts";
import { apiGet, apiSend, ApiError } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

interface Row {
  icon: string;
  label: string;
  note: string;
}

function toRows(items: readonly PracticalNoteItem[]): Row[] {
  return items.map((i) => ({ icon: i.icon ?? "", label: i.label, note: i.note }));
}

/**
 * Sua khoi "Luu y thuc te" (bai xe, nha ve sinh, phu hop tre em/nguoi gia, quy
 * dinh tai cho, an toan) — content-seo-ux-plan §5.7. AI chi goi y ban nhap qua
 * nut "Gợi ý", KHONG bao gio tu luu — nguoi dung BAT BUOC xem/sua/xoa tung
 * dong roi bam Luu vi day la thong tin anh huong an toan thuc te.
 */
export function DestinationPracticalNotesEditor({
  slug,
  practicalNotes,
  onSaved,
}: {
  slug: string;
  practicalNotes: PracticalNoteItem[];
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(toRows(practicalNotes));
  const [error, setError] = useState<{ message: string; details: string[] } | null>(null);

  const suggest = useMutation({
    mutationFn: async () =>
      apiGet(`/destinations/${slug}/practical-notes/suggest`, suggestPracticalNotesResponseSchema),
    onSuccess: (result) => {
      setError(null);
      // Them vao CUOI danh sach hien co — nguoi dung tu xoa dong khong phu hop, khong ghi de
      setRows((prev) => [...prev, ...toRows(result.suggestions)]);
    },
    onError: (e) =>
      setError(
        e instanceof ApiError
          ? { message: e.message, details: e.details }
          : { message: String(e), details: [] },
      ),
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        practicalNotes: rows
          .filter((r) => r.label.trim() && r.note.trim())
          .map((r) => ({
            icon: r.icon.trim() || null,
            label: r.label.trim(),
            note: r.note.trim(),
          })),
      };
      return z
        .array(practicalNoteItemSchema)
        .parse(await apiSend("POST", `/destinations/${slug}/practical-notes`, body));
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
        Nút &quot;Gợi ý&quot; chỉ thêm bản nháp theo tên/mô tả điểm đến (quy tắc cố định, không tự
        bịa số liệu) — bắt buộc bạn xem/sửa/xoá từng dòng trước khi bấm Lưu, vì đây là thông tin
        ảnh hưởng an toàn thực tế của khách.
      </p>
      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <p className="font-medium">{error.message}</p>
        </div>
      )}

      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="rounded border border-zinc-300 p-2 dark:border-zinc-700">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[64px_1fr_2fr]">
              <Input
                value={row.icon}
                onChange={(e) => update(i, { icon: e.target.value })}
                placeholder="🅿️"
              />
              <Input
                value={row.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="Nhãn (vd: Bãi đỗ xe)"
              />
              <Input
                value={row.note}
                onChange={(e) => update(i, { note: e.target.value })}
                placeholder="Nội dung lưu ý"
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

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="px-2 py-1 text-xs"
          onClick={() => setRows((prev) => [...prev, { icon: "", label: "", note: "" }])}
        >
          + Thêm dòng
        </Button>
        <Button size="sm" loading={suggest.isPending} onClick={() => suggest.mutate()}>
          {suggest.isPending ? "Đang gợi ý..." : "Gợi ý (chưa lưu)"}
        </Button>
        <Button variant="primary" size="sm" loading={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Đang lưu..." : "Lưu danh sách lưu ý"}
        </Button>
      </div>
    </div>
  );
}
