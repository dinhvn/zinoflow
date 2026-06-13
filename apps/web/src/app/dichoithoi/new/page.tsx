"use client";

import {
  DestinationMetadataForm,
  EMPTY_META,
} from "@/features/dichoithoi/destination-metadata-form";

/** Tao diem den moi — form metadata trong, luu xong nhay sang trang chi tiet. */
export default function NewDestinationPage() {
  return (
    <div className="max-w-4xl space-y-5">
      <a href="/dichoithoi" className="text-sm text-zinc-500 hover:underline">
        ← Quay lại danh sách
      </a>
      <div>
        <h2 className="text-xl font-semibold">Thêm điểm đến mới</h2>
        <p className="text-sm text-zinc-500">
          Nhập thông tin điểm đến. Sau khi lưu, vào trang chi tiết để tạo bài AI và publish lên
          website (điểm chỉ xuất hiện trên dichoithoi.com sau khi publish bài).
        </p>
      </div>
      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <DestinationMetadataForm
          initial={EMPTY_META}
          isNew
          onSaved={(slug) => {
            window.location.href = `/dichoithoi/${slug}`;
          }}
        />
      </div>
    </div>
  );
}
