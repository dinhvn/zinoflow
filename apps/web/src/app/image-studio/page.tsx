"use client";

import { ImageStudio } from "@/features/image-studio/image-studio";

export default function ImageStudioPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Tạo ảnh sản phẩm</h1>
        <p className="text-sm text-zinc-500">
          Ghép nhiều sản phẩm thành ảnh đăng Facebook — chọn sản phẩm, loại ảnh, cấu hình rồi xuất hàng loạt.
        </p>
      </div>
      <ImageStudio />
    </div>
  );
}
