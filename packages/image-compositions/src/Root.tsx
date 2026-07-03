import React from "react";
import { Composition } from "remotion";
import { ASPECT_SIZES, imagePropsSchema, type ImageProps } from "@zinoflow/contracts";
import { ImageComposition, IMAGE_COMPOSITION_ID } from "./ImageComposition";

/**
 * Remotion root — dang ky composition cho worker bundle (export). Spec §8.
 * Kich thuoc set theo aspect qua calculateMetadata (1 frame, still image).
 */
const DEFAULT_PROPS: ImageProps = imagePropsSchema.parse({
  templateId: "sale-grid",
  aspect: "square",
  perImage: 4,
  products: [],
  style: {},
  visibility: {},
  logo: null,
  imageFit: {},
});

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id={IMAGE_COMPOSITION_ID}
      component={ImageComposition}
      durationInFrames={1}
      fps={1}
      width={ASPECT_SIZES.square.width}
      height={ASPECT_SIZES.square.height}
      defaultProps={DEFAULT_PROPS}
      calculateMetadata={({ props }) => {
        const size = ASPECT_SIZES[props.aspect] ?? ASPECT_SIZES.square;
        return { width: size.width, height: size.height };
      }}
    />
  );
};
