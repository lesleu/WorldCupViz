export const HEADER_TOP_PADDING = 28;
export const HEADER_TRANSITION = "300ms linear";
export const HEADER_ART_EDGE_INSET = 12;
export const HEADER_INTRO_MAX_WIDTH = 670;
export const HEADER_HORIZONTAL_PADDING = 24;

export const REF_HEADER_CANVAS_HEIGHT = 252;
export const REF_HEADER_INTRO_BLOCK_HEIGHT = 200;
export const REF_HEADER_FULL_HEIGHT =
  HEADER_TOP_PADDING + REF_HEADER_CANVAS_HEIGHT + REF_HEADER_INTRO_BLOCK_HEIGHT;
export const REF_HEADER_COMPACT_HEIGHT = 180;
export const REF_HEADER_ART_HEIGHT = REF_HEADER_CANVAS_HEIGHT;
export const REF_HEADER_COMPACT_ART_HEIGHT =
  REF_HEADER_COMPACT_HEIGHT - HEADER_TOP_PADDING;
/** Art height compact assets were sized against (100px header − padding). */
export const REF_HEADER_COMPACT_ASSET_SIZING_HEIGHT = 72;

/** Scale layout metrics from the 1920px reference width. */
export function headerLayoutScale(viewportWidth: number): number {
  return Math.max(viewportWidth, 1) / 1920;
}
