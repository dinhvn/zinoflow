import { Injectable, Logger } from "@nestjs/common";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import type { ImageProps } from "@zinoflow/contracts";
import type { ImageRenderer, RenderStillOptions } from "../../application/ports/image-renderer.port";

/** Khop IMAGE_COMPOSITION_ID trong @zinoflow/image-compositions (khong TS-import TSX vao api). */
const COMPOSITION_ID = "ProductCollage";

/**
 * Renderer Remotion (spec §8) — bundle composition 1 lan (cache), roi renderStill tung anh.
 * Dung CHUNG composition voi Player (web) qua remotion-entry -> parity preview/export.
 * Lan dau bundle/render se tai Chromium headless (~vai tram MB).
 */
@Injectable()
export class RemotionImageRenderer implements ImageRenderer {
  private readonly logger = new Logger(RemotionImageRenderer.name);
  private bundlePromise: Promise<string> | null = null;

  private getServeUrl(): Promise<string> {
    if (!this.bundlePromise) {
      // require.resolve tra path file .ts cua entry (exports map) — bundler tu compile TSX.
      const entryPoint = require.resolve("@zinoflow/image-compositions/remotion-entry");
      this.logger.log(`Bundling Remotion composition tu ${entryPoint}`);
      this.bundlePromise = bundle({ entryPoint });
    }
    return this.bundlePromise;
  }

  async renderStill(props: ImageProps, options: RenderStillOptions): Promise<void> {
    const serveUrl = await this.getServeUrl();
    const composition = await selectComposition({
      serveUrl,
      id: COMPOSITION_ID,
      inputProps: props,
    });

    await renderStill({
      composition,
      serveUrl,
      output: options.outputFile,
      inputProps: props,
      imageFormat: options.format,
      jpegQuality: options.format === "jpeg" ? options.quality : undefined,
      scale: options.scale,
    });
  }
}
