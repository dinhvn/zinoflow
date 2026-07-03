import { Injectable, Logger } from "@nestjs/common";
import type { ImageProps } from "@zinoflow/contracts";
import type { ImageRenderer, RenderStillOptions } from "../../application/ports/image-renderer.port";

/** Khop IMAGE_COMPOSITION_ID trong @zinoflow/image-compositions (khong TS-import TSX vao api). */
const COMPOSITION_ID = "ProductCollage";

/**
 * Renderer Remotion (spec §8) — bundle composition 1 lan (cache), roi renderStill tung anh.
 * Dung CHUNG composition voi Player (web) qua remotion-entry -> parity preview/export.
 * Lan dau bundle/render se tai Chromium headless (~vai tram MB).
 *
 * @remotion/bundler + @remotion/renderer keo theo esbuild/webpack rat nang. Dung dynamic
 * import (lazy) de KHONG nap chung luc boot API — chi tra gia o lan render dau tien.
 * Nho vay thoi gian khoi dong server giam ~80s (require nguoi cay dep Remotion luc boot).
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
      this.bundlePromise = import("@remotion/bundler").then(({ bundle }) => bundle({ entryPoint }));
    }
    return this.bundlePromise;
  }

  async renderStill(props: ImageProps, options: RenderStillOptions): Promise<void> {
    const serveUrl = await this.getServeUrl();
    const { selectComposition, renderStill } = await import("@remotion/renderer");
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
