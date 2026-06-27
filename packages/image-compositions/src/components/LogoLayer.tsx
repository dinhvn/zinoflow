import React from "react";
import { Img } from "remotion";
import type { LogoOverlay } from "@zinoflow/contracts";

/**
 * Logo overlay — 1 logo thuong hieu de len ca anh (spec §7.2).
 * x/y: tam logo theo % anh (0..1). scale: be rong logo theo % canh ngan cua anh.
 * Vi tri theo % -> parity Player/worker; clamp da lam o schema.
 */
export const LogoLayer: React.FC<{ logo: LogoOverlay | null; canvasWidth: number; canvasHeight: number }> = ({
  logo,
  canvasWidth,
  canvasHeight,
}) => {
  if (!logo || !logo.visible || !logo.url) return null;

  const minSide = Math.min(canvasWidth, canvasHeight);
  const width = minSide * logo.scale;

  return (
    <Img
      src={logo.url}
      style={{
        position: "absolute",
        left: `${logo.x * 100}%`,
        top: `${logo.y * 100}%`,
        width,
        height: "auto",
        transform: "translate(-50%, -50%)",
        objectFit: "contain",
        pointerEvents: "none",
      }}
    />
  );
};
