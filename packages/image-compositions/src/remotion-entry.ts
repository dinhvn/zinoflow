import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

/**
 * Entry point cho Remotion bundler (worker export — spec §8).
 * Worker bundle file nay; Player (web) import truc tiep ImageComposition tu index.
 */
registerRoot(RemotionRoot);
