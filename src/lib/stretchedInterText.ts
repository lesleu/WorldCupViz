import { cfg } from "@/config";
import { resolveKickoffCanvasFontFamily } from "@/lib/canvasFontReady";
import { REF_HEADER_COMPACT_HEIGHT } from "@/lib/homeHeaderLayout";

export interface StretchedTextBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface StretchedInterTextOptions {
  text: string;
  fontFamily?: string;
  fontWeight?: number;
  fillWidthRatio?: number;
  fillHeightRatio?: number;
  letterGapRatio?: number;
  fillStyle?: string;
}

/** Width-fill then height-stretch Inter lettering (same algorithm as kickoff team codes). */
export function drawStretchedInterText(
  ctx: CanvasRenderingContext2D,
  box: StretchedTextBox,
  options: StretchedInterTextOptions
): void {
  const type = cfg.typography;
  const text = options.text.toUpperCase();
  const letters = text.split("");
  const count = letters.length;
  if (count === 0) return;

  const fontFamily =
    options.fontFamily ??
    (typeof document !== "undefined"
      ? resolveKickoffCanvasFontFamily()
      : type.kickoffCodeFontFamily);
  const fontWeight = options.fontWeight ?? type.kickoffCodeFontWeight;
  const fillWidthRatio = options.fillWidthRatio ?? type.kickoffCodeFillWidthRatio;
  const fillHeightRatio = options.fillHeightRatio ?? type.kickoffCodeFillHeightRatio;
  const letterGapRatio = options.letterGapRatio ?? type.kickoffCodeLetterGapRatio;
  const fillStyle = options.fillStyle ?? cfg.colors.text;

  const targetWidth = box.width * fillWidthRatio;
  const targetHeight = box.height * fillHeightRatio;
  const baseSize = targetWidth / Math.max(count * 0.55, 1);
  const gap = baseSize * letterGapRatio;

  ctx.font = `${fontWeight} ${baseSize}px ${fontFamily}`;
  ctx.textBaseline = "middle";

  const widths: number[] = [];
  let maxAscent = 0;
  let maxDescent = 0;
  for (const letter of letters) {
    const metrics = ctx.measureText(letter);
    widths.push(metrics.width);
    maxAscent = Math.max(maxAscent, metrics.actualBoundingBoxAscent);
    maxDescent = Math.max(maxDescent, metrics.actualBoundingBoxDescent);
  }

  const naturalW =
    widths.reduce((sum, w) => sum + w, 0) + gap * Math.max(count - 1, 0);
  const naturalH = Math.max(maxAscent + maxDescent, baseSize * 0.7);
  const scaleX = targetWidth / Math.max(naturalW, 1);
  const scaleY = targetHeight / Math.max(naturalH, 1);

  const zoneCx = box.left + box.width * 0.5;
  const zoneCy = box.top + box.height * 0.5;

  ctx.save();
  ctx.beginPath();
  ctx.rect(box.left, box.top, box.width, box.height);
  ctx.clip();
  ctx.translate(zoneCx, zoneCy);
  ctx.scale(scaleX, scaleY);
  ctx.fillStyle = fillStyle;
  ctx.textAlign = "center";

  let x = -naturalW * 0.5;
  for (let i = 0; i < count; i++) {
    ctx.fillText(letters[i], x + widths[i] * 0.5, 0);
    x += widths[i] + gap;
  }
  ctx.restore();
}

/** Title box at 1920 reference: 1848×280 full / 180 compact. Scales with viewport width. */
export function homeTitleMetrics(viewportWidth: number): {
  titleWidth: number;
  fullHeaderHeight: number;
  compactHeaderHeight: number;
} {
  const scale = Math.min(1, viewportWidth / 1920);
  return {
    titleWidth: Math.min(viewportWidth - 24, Math.round(1848 * scale)),
    fullHeaderHeight: Math.round(280 * scale),
    compactHeaderHeight: Math.max(56, Math.round(REF_HEADER_COMPACT_HEIGHT * scale)),
  };
}
