"use client";

import { Thumbnail } from "@remotion/player";
import { ASPECT_SIZES, type ImageProps } from "@zinoflow/contracts";
import { ImageComposition } from "@zinoflow/image-compositions";

/**
 * Buoc 5 (preview): GALLERY — hien tat ca anh trong batch cung luc (khong bam Next).
 * Moi anh la 1 Thumbnail Remotion dung CHUNG composition voi worker export -> parity (spec §4, §8).
 * Doi BatchConfig (toolbar) -> moi anh re-render ngay vi inputProps doi.
 */
export function PreviewGallery({ items }: { items: ImageProps[] }) {
  if (items.length === 0) {
    return <p className="py-10 text-center text-sm text-zinc-400">Chọn sản phẩm để xem preview.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
      {items.map((props, i) => {
        const size = ASPECT_SIZES[props.aspect];
        return (
          <div key={i} className="overflow-hidden rounded border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center justify-between bg-zinc-50 px-2 py-1 text-xs text-zinc-500 dark:bg-zinc-800">
              <span>Ảnh {i + 1}/{items.length}</span>
              <span>{props.products.length} SP</span>
            </div>
            <Thumbnail
              component={ImageComposition}
              inputProps={props}
              compositionWidth={size.width}
              compositionHeight={size.height}
              frameToDisplay={0}
              durationInFrames={1}
              fps={1}
              style={{ width: "100%" }}
            />
          </div>
        );
      })}
    </div>
  );
}
