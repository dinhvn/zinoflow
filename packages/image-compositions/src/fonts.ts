import { loadFont } from "@remotion/google-fonts/BeVietnamPro";

/**
 * Font tieng Viet co dau — load TRUOC khi render (spec §8, P0).
 * @remotion/google-fonts dung delayRender() ben trong -> Player va worker deu doi font
 * san sang truoc khi chup, chu co dau (ô, ơ, ệ...) khong bi vo.
 * Be Vietnam Pro: font Viet day du dau, hop UI thuong mai.
 */
const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700"],
  subsets: ["vietnamese", "latin"],
});

export const VIETNAMESE_FONT_FAMILY = fontFamily;
