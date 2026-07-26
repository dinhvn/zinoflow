"use client";

import {
  DestinationMetadataForm,
  EMPTY_META,
} from "@/features/dichoithoi/destination-metadata-form";
import { FeatureIntro } from "@/shared/ui";

/** Tao diem den moi — form metadata trong, luu xong nhay sang trang chi tiet. */
export default function NewDestinationPage() {
  return (
    <div className="max-w-4xl space-y-5">
      <a href="/dichoithoi" className="text-sm text-zinc-500 hover:underline">
        ← Quay lại danh sách
      </a>
      <div>
        <h2 className="text-xl font-semibold">Thêm điểm đến mới</h2>
      </div>

      <FeatureIntro
        summary={
          <>
            Quy trình 2 bước — trang này chỉ là <strong>Bước 1</strong>, chưa lên website ngay
            (điểm mới tạo vẫn thao tác được tag/loại hình/quan hệ dù chưa publish).
          </>
        }
        details={
          <>
            <strong>Bước 1 (trang này):</strong> nhập thông tin cơ bản của điểm đến rồi bấm
            &quot;Tạo điểm đến&quot;.
            <br />
            <strong>Bước 2 (tự chuyển sang trang chi tiết):</strong> ở mục &quot;✍️ Viết bài bằng
            AI&quot; bạn nhập thông tin bổ sung + website nguồn để AI viết bài, rồi duyệt và
            publish lên website.
          </>
        }
      />
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
