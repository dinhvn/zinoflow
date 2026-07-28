"use client";

import { useState } from "react";
import {
  DESTINATION_BULK_EDIT_FIELD_KEYS,
  DESTINATION_BULK_EDIT_FIELD_LABELS,
  type DestinationBulkEditFieldKey,
} from "@zinoflow/contracts";
import { apiUrl } from "@/shared/api-client";
import { Modal, buttonClasses } from "@/shared/ui";

/** Filter dang ap dung tren trang list — export dung DUNG bo loc nay (khong gioi han phan trang). */
export interface DestinationListFilter {
  q?: string;
  provinceCode?: string;
  parentSlug?: string;
  kind?: string;
  contentState?: string;
  production?: string;
}

/**
 * Buoc 1 luong sua nhanh hang loat: chon cot (chi field lien he/tham khao,
 * khong dong field cau truc) roi tai CSV (slug + cot da chon) theo dung bo
 * loc dang xem tren trang list. Dung the <a> (khong qua fetch) de trinh duyet
 * tu tai file, giong quy uoc apiUrl() da co san.
 */
export function ExportDestinationsModal({
  open,
  onClose,
  filter,
}: {
  open: boolean;
  onClose: () => void;
  filter: DestinationListFilter;
}) {
  const [selected, setSelected] = useState<Set<DestinationBulkEditFieldKey>>(
    new Set(DESTINATION_BULK_EDIT_FIELD_KEYS),
  );

  function toggle(key: DestinationBulkEditFieldKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function buildHref(): string {
    const params = new URLSearchParams({ fields: [...selected].join(",") });
    if (filter.q) params.set("q", filter.q);
    if (filter.provinceCode) params.set("provinceCode", filter.provinceCode);
    if (filter.parentSlug) params.set("parentSlug", filter.parentSlug);
    if (filter.kind) params.set("kind", filter.kind);
    if (filter.contentState) params.set("contentState", filter.contentState);
    if (filter.production) params.set("production", filter.production);
    return apiUrl(`/destinations/export?${params}`);
  }

  return (
    <Modal open={open} onClose={onClose} title="Xuất CSV để sửa hàng loạt">
      <div className="space-y-4">
        <p className="text-sm text-zinc-500">
          Xuất <strong>đúng bộ lọc đang xem</strong> trên trang danh sách (chọn &quot;Mọi cấp&quot; ở
          bộ lọc &quot;Cấp&quot; để xuất cả tỉnh/cụm/điểm đến, không chỉ điểm đến) — không giới hạn
          phân trang. File CSV dùng <code>slug</code> làm khoá, luôn kèm cột{" "}
          <code>name</code>/<code>province</code>/<code>parent</code> để dễ nhận biết dòng (chỉ
          tham khảo — sửa các cột này trên sheet sẽ không được cập nhật lại) — dán vào Google Sheet,
          sửa xong dán lại link để nhập lại (nút &quot;Nhập từ Sheet&quot;).
        </p>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DESTINATION_BULK_EDIT_FIELD_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.has(key)}
                onChange={() => toggle(key)}
              />
              {DESTINATION_BULK_EDIT_FIELD_LABELS[key]}
            </label>
          ))}
        </div>

        {selected.size > 0 ? (
          <a
            href={buildHref()}
            className={buttonClasses({ variant: "primary" })}
            onClick={onClose}
          >
            Tải CSV ({selected.size} cột)
          </a>
        ) : (
          <span className={buttonClasses({ variant: "primary", className: "pointer-events-none opacity-50" })}>
            Chọn ít nhất 1 cột
          </span>
        )}
      </div>
    </Modal>
  );
}
