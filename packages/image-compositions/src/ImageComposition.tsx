import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import type { ImageProps } from "@zinoflow/contracts";
import { Grid } from "./components/Grid";
import { LogoLayer } from "./components/LogoLayer";
import { getCellLayout } from "./templates";
import { VIETNAMESE_FONT_FAMILY } from "./fonts";

/**
 * Composition goc cho 1 anh collage — spec §8.
 * Dung CHUNG cho Player (preview) va worker (renderStill). KHONG dat logic layout o noi khac.
 */
export const ImageComposition: React.FC<ImageProps> = (props) => {
  const { width, height } = useVideoConfig();
  const cellLayout = getCellLayout(props.templateId);
  const gap = Math.round(Math.min(width, height) * 0.012);

  return (
    <AbsoluteFill style={{ backgroundColor: props.style.backgroundColor, fontFamily: VIETNAMESE_FONT_FAMILY }}>
      <Grid props={props} cellLayout={cellLayout} gap={gap} />
      <LogoLayer logo={props.logo} canvasWidth={width} canvasHeight={height} />
    </AbsoluteFill>
  );
};

export const IMAGE_COMPOSITION_ID = "ProductCollage";
