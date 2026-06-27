import type { ImageProps } from "@zinoflow/contracts";

/**
 * Port render 1 anh ra file (spec §8). Application khong biet Remotion.
 * Implementation: RemotionImageRenderer (bundle + renderStill).
 */
export const IMAGE_RENDERER = Symbol("IMAGE_RENDERER");

export interface RenderStillOptions {
  outputFile: string;
  format: "png" | "jpeg";
  /** 1..100, chi dung cho jpeg. */
  quality: number;
  scale: number;
}

export interface ImageRenderer {
  renderStill(props: ImageProps, options: RenderStillOptions): Promise<void>;
}
