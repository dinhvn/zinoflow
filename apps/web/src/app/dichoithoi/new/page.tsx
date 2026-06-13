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
        <div className="mt-2 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
          <p className="font-medium">Quy trình 2 bước:</p>
          <ol className="mt-1 list-inside list-decimal space-y-0.5">
            <li>
              <strong>Bước 1 (trang này):</strong> nhập thông tin cơ bản của điểm đến rồi bấm
              &quot;Tạo điểm đến&quot;.
            </li>
            <li>
              <strong>Bước 2 (tự chuyển sang trang chi tiết):</strong> ở mục
              &quot;✍️ Viết bài bằng AI&quot; bạn nhập thông tin bổ sung + website nguồn để AI viết
              bài, rồi duyệt và publish lên website.
            </li>
          </ol>
        </div>
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
