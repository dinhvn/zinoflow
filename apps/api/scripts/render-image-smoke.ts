/**
 * Smoke test render: bundle composition + renderStill 1 anh ra file.
 * Verify ca pipeline Remotion (compositions + fonts Viet + contracts) chay that.
 * Lan dau se tai Chromium headless. Chay: pnpm --filter @zinoflow/api exec ts-node scripts/render-image-smoke.ts
 */
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { imagePropsSchema, type ImageProps } from "@zinoflow/contracts";
import { resolve } from "node:path";
import { statSync } from "node:fs";

async function main() {
  const products = Array.from({ length: 4 }, (_, i) => ({
    id: `p${i}`,
    name: `Sản phẩm thử ${i + 1} — tên dài để kiểm tra xuống dòng có dấu`,
    imageUrl: `https://picsum.photos/seed/${i + 1}/400/600`,
    originalPrice: 500000,
    salePrice: 350000,
    discountPercent: 30,
    badges: ["sale"],
    imageFitOverride: null,
  }));

  const props: ImageProps = imagePropsSchema.parse({
    templateId: "sale-grid",
    aspect: "square",
    perImage: 4,
    products,
    style: { accentColor: "#e11d48", priceColor: "#e11d48" },
    visibility: {},
    logo: null,
    imageFit: { scale: 1, offsetX: 0, offsetY: 0.2 },
  });

  const entryPoint = require.resolve("@zinoflow/image-compositions/remotion-entry");
  console.log("Bundling tu", entryPoint);
  const serveUrl = await bundle({ entryPoint });

  const composition = await selectComposition({ serveUrl, id: "ProductCollage", inputProps: props });
  console.log(`Composition ${composition.id}: ${composition.width}x${composition.height}`);

  const output = resolve(__dirname, "../../../tmp-render-smoke.jpg");
  await renderStill({
    composition,
    serveUrl,
    output,
    inputProps: props,
    imageFormat: "jpeg",
    jpegQuality: 85,
  });

  const size = statSync(output).size;
  console.log(`OK -> ${output} (${(size / 1024).toFixed(1)} KB)`);
  process.exit(0);
}

main().catch((err) => {
  console.error("RENDER SMOKE FAILED:", err);
  process.exit(1);
});
