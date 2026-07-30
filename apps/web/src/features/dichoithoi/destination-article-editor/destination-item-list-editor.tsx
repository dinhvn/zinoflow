"use client";

import type { StructuredListItem } from "@zinoflow/contracts";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

/**
 * Editor danh sach co cau truc {ten, moTa} — dung cho khoi "Ăn gì đặc trưng" va
 * "Quà mang về". Muc B cho phep rong khi khong co du lieu xac minh.
 */
export function DestinationItemListEditor({
  items,
  onChange,
}: {
  items: StructuredListItem[];
  onChange: (items: StructuredListItem[]) => void;
}) {
  const update = (i: number, patch: Partial<StructuredListItem>) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="text-xs text-zinc-500">
          Chưa có mục đã xác minh. Có thể để trống thay vì thêm nội dung chung
          chung.
        </p>
      )}
      {items.map((item, i) => (
        <div
          key={i}
          className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_2fr_auto]"
        >
          <Input
            value={item.ten}
            onChange={(e) => update(i, { ten: e.target.value })}
            placeholder="Tên món/đặc sản"
          />
          <Input
            value={item.moTa}
            onChange={(e) => update(i, { moTa: e.target.value })}
            placeholder="Mô tả ngắn (nơi mua/đặc điểm nổi bật)"
          />
          <Button
            size="sm"
            variant="ghost"
            className="px-2 py-1 text-xs"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
          >
            Xoá
          </Button>
        </div>
      ))}
      <Button
        size="sm"
        variant="secondary"
        className="px-2 py-1 text-xs"
        onClick={() => onChange([...items, { ten: "", moTa: "" }])}
      >
        + Thêm mục
      </Button>
    </div>
  );
}
