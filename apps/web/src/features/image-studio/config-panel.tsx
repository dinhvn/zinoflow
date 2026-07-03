"use client";

import {
  SUPPORTED_PER_IMAGE,
  imageAspectSchema,
  type BatchConfig,
  type ImageAspect,
  type ImageStyle,
  type VisibilityFlags,
} from "@zinoflow/contracts";
import { BUILT_IN_TEMPLATES } from "@zinoflow/image-compositions";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Slider } from "@/shared/ui/slider";

const ASPECT_LABELS: Record<ImageAspect, string> = {
  square: "Vuông (1080×1080)",
  landscape: "Ngang (1200×630)",
  portrait: "Dọc (1080×1350)",
};

const VISIBILITY_LABELS: Record<keyof VisibilityFlags, string> = {
  showName: "Tên sản phẩm",
  showOriginalPrice: "Giá gốc (gạch)",
  showSalePrice: "Giá bán",
  showDiscountPercent: "% giảm",
  showBadge: "Badge",
  showCellBorder: "Viền ô",
};

/**
 * Buoc 3+4: chon ratio + template + so SP/anh, va 2 toolbar (mau + an/hien) + imageFit + logo.
 * Tat ca sua BatchConfig GLOBAL -> ap dong loat moi anh (spec §4, §7).
 */
export function ConfigPanel({
  aspect,
  templateId,
  perImage,
  config,
  onAspect,
  onTemplate,
  onPerImage,
  onConfig,
}: {
  aspect: ImageAspect;
  templateId: string;
  perImage: number;
  config: BatchConfig;
  onAspect: (a: ImageAspect) => void;
  onTemplate: (id: string) => void;
  onPerImage: (k: number) => void;
  onConfig: (next: BatchConfig) => void;
}) {
  const setStyle = (patch: Partial<ImageStyle>) => onConfig({ ...config, style: { ...config.style, ...patch } });
  const setVis = (patch: Partial<VisibilityFlags>) => onConfig({ ...config, visibility: { ...config.visibility, ...patch } });
  const setFit = (patch: Partial<BatchConfig["imageFit"]>) => onConfig({ ...config, imageFit: { ...config.imageFit, ...patch } });

  return (
    <div className="space-y-4 text-sm">
      {/* Loai anh + template + so SP/anh */}
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-500">Loại ảnh</span>
          <Select value={aspect} onChange={(e) => onAspect(imageAspectSchema.parse(e.target.value))} className="w-full">
            {imageAspectSchema.options.map((a) => (
              <option key={a} value={a}>{ASPECT_LABELS[a]}</option>
            ))}
          </Select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-500">Template</span>
          <Select value={templateId} onChange={(e) => onTemplate(e.target.value)} className="w-full">
            {BUILT_IN_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>{t.code}</option>
            ))}
          </Select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-500">SP / ảnh</span>
          <Select value={perImage} onChange={(e) => onPerImage(Number(e.target.value))} className="w-full">
            {SUPPORTED_PER_IMAGE.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </Select>
        </label>
      </div>

      {/* Toolbar ngang: mau sac */}
      <fieldset className="rounded border border-zinc-200 p-3 dark:border-zinc-700">
        <legend className="px-1 text-xs font-medium text-zinc-500">Màu sắc (áp cả batch)</legend>
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Nền" value={config.style.backgroundColor} onChange={(v) => setStyle({ backgroundColor: v })} />
          <ColorField label="Nhấn / badge" value={config.style.accentColor} onChange={(v) => setStyle({ accentColor: v })} />
          <ColorField label="Giá" value={config.style.priceColor} onChange={(v) => setStyle({ priceColor: v })} />
          <ColorField label="Viền ô" value={config.style.borderColor} onChange={(v) => setStyle({ borderColor: v })} />
        </div>
        <div className="mt-2">
          <Slider
            label="Độ dày viền ô" value={config.style.borderWidth} min={0} max={16} step={1}
            display={`${config.style.borderWidth}px`}
            onChange={(e) => setStyle({ borderWidth: Number(e.target.value) })}
          />
        </div>
      </fieldset>

      {/* Toolbar doc: an/hien thong tin */}
      <fieldset className="rounded border border-zinc-200 p-3 dark:border-zinc-700">
        <legend className="px-1 text-xs font-medium text-zinc-500">Ẩn / hiện (áp cả batch)</legend>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(VISIBILITY_LABELS) as (keyof VisibilityFlags)[]).map((k) => (
            <Checkbox key={k} label={VISIBILITY_LABELS[k]} checked={config.visibility[k]} onChange={(e) => setVis({ [k]: e.target.checked })} />
          ))}
        </div>
      </fieldset>

      {/* Canh anh trong o: zoom + keo (global) */}
      <fieldset className="rounded border border-zinc-200 p-3 dark:border-zinc-700">
        <legend className="px-1 text-xs font-medium text-zinc-500">Canh ảnh trong ô — zoom/kéo (áp cả batch)</legend>
        <div className="space-y-2">
          <Slider label="Zoom" value={config.imageFit.scale} min={1} max={3} step={0.05} display={`${config.imageFit.scale.toFixed(2)}×`} onChange={(e) => setFit({ scale: Number(e.target.value) })} />
          <Slider label="Kéo ngang" value={config.imageFit.offsetX} min={-1} max={1} step={0.05} display={config.imageFit.offsetX.toFixed(2)} onChange={(e) => setFit({ offsetX: Number(e.target.value) })} />
          <Slider label="Kéo dọc (ảnh dài)" value={config.imageFit.offsetY} min={-1} max={1} step={0.05} display={config.imageFit.offsetY.toFixed(2)} onChange={(e) => setFit({ offsetY: Number(e.target.value) })} />
        </div>
      </fieldset>

      {/* Logo overlay */}
      <fieldset className="rounded border border-zinc-200 p-3 dark:border-zinc-700">
        <legend className="px-1 text-xs font-medium text-zinc-500">Logo overlay</legend>
        <Input
          value={config.logo?.url ?? ""}
          placeholder="URL logo (để trống = tắt)"
          className="w-full"
          onChange={(e) => {
            const url = e.target.value.trim();
            if (!url) return onConfig({ ...config, logo: null });
            onConfig({ ...config, logo: { url, visible: config.logo?.visible ?? true, x: config.logo?.x ?? 0.5, y: config.logo?.y ?? 0.07, scale: config.logo?.scale ?? 0.18 } });
          }}
        />
        {config.logo && (
          <div className="mt-2 space-y-2">
            <Checkbox label="Hiện logo" checked={config.logo.visible} onChange={(e) => onConfig({ ...config, logo: { ...config.logo!, visible: e.target.checked } })} />
            <Slider label="Vị trí ngang" value={config.logo.x} min={0} max={1} step={0.01} display={config.logo.x.toFixed(2)} onChange={(e) => onConfig({ ...config, logo: { ...config.logo!, x: Number(e.target.value) } })} />
            <Slider label="Vị trí dọc" value={config.logo.y} min={0} max={1} step={0.01} display={config.logo.y.toFixed(2)} onChange={(e) => onConfig({ ...config, logo: { ...config.logo!, y: Number(e.target.value) } })} />
            <Slider label="Kích thước" value={config.logo.scale} min={0.05} max={0.6} step={0.01} display={`${Math.round(config.logo.scale * 100)}%`} onChange={(e) => onConfig({ ...config, logo: { ...config.logo!, scale: Number(e.target.value) } })} />
          </div>
        )}
      </fieldset>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="text-zinc-500">{label}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-10 cursor-pointer rounded border border-zinc-300 dark:border-zinc-700" />
    </label>
  );
}
