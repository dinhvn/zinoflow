"use client";

import { useRef, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { Thumbnail } from "@remotion/player";
import { ASPECT_SIZES, type BatchConfig, type ImageFit, type ImageProps, type LogoOverlay } from "@zinoflow/contracts";
import { ImageComposition } from "@zinoflow/image-compositions";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Preview tuong tac cho 1 anh (anh dang chinh) — spec §7.1, §7.2.
 * - Keo nen: pan anh (sua imageFit.offsetX/Y, GLOBAL -> moi anh doi theo).
 * - Lan chuot: zoom (imageFit.scale).
 * - Keo logo: di chuyen (logo.x/y). Keo o goc logo: resize (logo.scale).
 * Toa do quy ve ti le 0..1 / -1..1 -> parity voi worker.
 */
export function InteractivePreview({
  props,
  config,
  onConfig,
}: {
  props: ImageProps;
  config: BatchConfig;
  onConfig: (next: BatchConfig) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const size = ASPECT_SIZES[props.aspect];

  const setFit = (patch: Partial<ImageFit>) => onConfig({ ...config, imageFit: { ...config.imageFit, ...patch } });
  const setLogo = (patch: Partial<LogoOverlay>) =>
    config.logo && onConfig({ ...config, logo: { ...config.logo, ...patch } });

  function rect() {
    return ref.current?.getBoundingClientRect() ?? null;
  }

  /** Keo nen -> pan anh. */
  function onBackgroundPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    const r = rect();
    if (!r) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const startFit = config.imageFit;

    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / r.width;
      const dy = (ev.clientY - startY) / r.height;
      // Keo anh sang phai -> lo phan trai -> offset giam (factor 2 vi range -1..1).
      setFit({
        offsetX: clamp(startFit.offsetX - dx * 2, -1, 1),
        offsetY: clamp(startFit.offsetY - dy * 2, -1, 1),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  /** Lan chuot -> zoom. */
  function onWheel(e: ReactWheelEvent<HTMLDivElement>) {
    setFit({ scale: clamp(config.imageFit.scale - e.deltaY * 0.0015, 1, 3) });
  }

  /** Keo logo -> di chuyen. */
  function onLogoPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    const r = rect();
    if (!r) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      setLogo({
        x: clamp((ev.clientX - r.left) / r.width, 0, 1),
        y: clamp((ev.clientY - r.top) / r.height, 0, 1),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  /** Keo goc logo -> resize (scale theo khoang cach toi tam, quy ve % canh ngan). */
  function onLogoResizePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    const r = rect();
    if (!r || !config.logo) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const minSide = Math.min(r.width, r.height);
    const centerX = r.left + config.logo.x * r.width;
    const centerY = r.top + config.logo.y * r.height;
    const move = (ev: PointerEvent) => {
      const dist = Math.hypot(ev.clientX - centerX, ev.clientY - centerY);
      setLogo({ scale: clamp((dist * 2) / minSide, 0.05, 0.6) });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const logo = config.logo;

  return (
    <div ref={ref} className="relative select-none overflow-hidden rounded border border-zinc-300 dark:border-zinc-600" style={{ touchAction: "none" }}>
      <Thumbnail
        component={ImageComposition}
        inputProps={props}
        compositionWidth={size.width}
        compositionHeight={size.height}
        frameToDisplay={0}
        durationInFrames={1}
        fps={1}
        style={{ width: "100%", display: "block" }}
      />

      {/* Lop bat keo nen (pan) + zoom */}
      <div
        className="absolute inset-0 cursor-move"
        onPointerDown={onBackgroundPointerDown}
        onWheel={onWheel}
        title="Kéo để di chuyển ảnh · lăn chuột để zoom"
      />

      {/* Khung logo: keo de di chuyen, keo o goc de resize */}
      {logo && logo.visible && logo.url && (
        <div
          className="absolute cursor-grab border-2 border-dashed border-indigo-400/80"
          style={{
            left: `${logo.x * 100}%`,
            top: `${logo.y * 100}%`,
            width: `${logo.scale * 100}%`,
            aspectRatio: "3 / 1",
            transform: "translate(-50%, -50%)",
          }}
          onPointerDown={onLogoPointerDown}
          title="Kéo để di chuyển logo"
        >
          <div
            className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize rounded-full bg-indigo-500"
            onPointerDown={onLogoResizePointerDown}
            title="Kéo để thay đổi kích thước logo"
          />
        </div>
      )}
    </div>
  );
}
