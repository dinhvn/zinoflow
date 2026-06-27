"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  buildImageProps,
  createImageJobResponseSchema,
  DEFAULT_IMAGE_FIT,
  type BatchConfig,
  type ImageAspect,
  type ImageTemplate,
  type ProductCell,
} from "@zinoflow/contracts";
import { BUILT_IN_TEMPLATES, getTemplate } from "@zinoflow/image-compositions";
import { apiSend } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { Drawer } from "@/shared/ui/drawer";
import { ConfigPanel } from "./config-panel";
import { ExportResult } from "./export-result";
import { InteractivePreview } from "./interactive-preview";
import { PreviewGallery } from "./preview-gallery";
import { ProductSearchPanel } from "./product-search-panel";
import { WorkingSetPanel } from "./working-set-panel";

/** Seed BatchConfig tu defaults cua template — spec §5.1, §7. Toolbar se ghi de len sau. */
function configFromTemplate(template: ImageTemplate): BatchConfig {
  const logo = template.defaultLogo;
  return {
    style: template.defaultStyle,
    visibility: template.defaultVisibility,
    logo: logo.url ? { url: logo.url, visible: logo.visible, x: logo.x, y: logo.y, scale: logo.scale } : null,
    imageFit: DEFAULT_IMAGE_FIT,
  };
}

const FIRST_TEMPLATE = BUILT_IN_TEMPLATES[0]!;

/** Man Image Studio — tao anh collage san pham dang Facebook (spec image-tool). */
export function ImageStudio() {
  const [products, setProducts] = useState<ProductCell[]>([]);
  const [aspect, setAspect] = useState<ImageAspect>("square");
  const [templateId, setTemplateId] = useState(FIRST_TEMPLATE.id);
  const [perImage, setPerImage] = useState(4);
  const [config, setConfig] = useState<BatchConfig>(() => configFromTemplate(FIRST_TEMPLATE));
  const [searchOpen, setSearchOpen] = useState(false);

  const existingIds = useMemo(() => new Set(products.map((p) => p.id)), [products]);

  const items = useMemo(
    () => buildImageProps({ products, templateId, aspect, perImage, config }),
    [products, templateId, aspect, perImage, config],
  );

  function handleTemplate(id: string) {
    setTemplateId(id);
    const tpl = getTemplate(id);
    if (tpl) setConfig(configFromTemplate(tpl)); // chon template -> seed lai config (spec §5.1)
  }

  function addProducts(toAdd: ProductCell[]) {
    setProducts((prev) => [...prev, ...toAdd]);
  }
  function moveProduct(index: number, dir: -1 | 1) {
    setProducts((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }
  function removeProduct(id: string) {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }
  function sortByDiscount() {
    setProducts((prev) => [...prev].sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0)));
  }

  const exportMutation = useMutation({
    mutationFn: async () => {
      const body = { templateId, items, exportOptions: { format: "jpeg", quality: 85, scale: 1 } };
      return createImageJobResponseSchema.parse(await apiSend("POST", "/images/jobs", body));
    },
  });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
      {/* Cot 1: working set + cau hinh (tim san pham mo o drawer ben phai) */}
      <section className="space-y-4">
        <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">1. Đã chọn</h3>
            <Button size="sm" variant="primary" onClick={() => setSearchOpen(true)}>
              + Tìm sản phẩm
            </Button>
          </div>
          <WorkingSetPanel
            products={products}
            onMove={moveProduct}
            onRemove={removeProduct}
            onClear={() => setProducts([])}
            onSortByDiscount={sortByDiscount}
          />
        </div>
        <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <h3 className="mb-2 text-sm font-semibold">2+3. Loại ảnh & cấu hình</h3>
          <ConfigPanel
            aspect={aspect}
            templateId={templateId}
            perImage={perImage}
            config={config}
            onAspect={setAspect}
            onTemplate={handleTemplate}
            onPerImage={setPerImage}
            onConfig={setConfig}
          />
        </div>
      </section>

      {/* Cot 3: preview gallery + export */}
      <section className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">4. Preview ({items.length} ảnh) & xuất</h3>
          <Button
            variant="primary"
            disabled={items.length === 0}
            loading={exportMutation.isPending}
            onClick={() => exportMutation.mutate()}
          >
            Xuất {items.length} ảnh
          </Button>
        </div>

        {exportMutation.isSuccess && (
          <div className="mb-2">
            <ExportResult jobId={exportMutation.data.jobId} />
          </div>
        )}
        {exportMutation.isError && (
          <p className="mb-2 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
            {exportMutation.error instanceof Error ? exportMutation.error.message : "Xuất thất bại"}
          </p>
        )}

        {items[0] && (
          <div className="mb-4">
            <p className="mb-1 text-xs text-zinc-500">
              Ảnh chỉnh (kéo để di chuyển ảnh · lăn chuột zoom · kéo logo/góc logo) — áp cho cả batch:
            </p>
            <div className="max-w-xl">
              <InteractivePreview props={items[0]} config={config} onConfig={setConfig} />
            </div>
          </div>
        )}

        {items.length > 1 && <p className="mb-2 text-xs text-zinc-500">Tất cả {items.length} ảnh:</p>}
        <PreviewGallery items={items} />
      </section>

      {/* Drawer tim san pham — truot tu phai, khong chiem cho preview */}
      <Drawer open={searchOpen} onClose={() => setSearchOpen(false)} title="Tìm & thêm sản phẩm" width="w-[720px]">
        <ProductSearchPanel existingIds={existingIds} onAdd={addProducts} />
      </Drawer>
    </div>
  );
}
