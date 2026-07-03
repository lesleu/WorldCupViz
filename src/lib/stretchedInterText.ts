import { cfg } from "@/config";
import { resolveKickoffCanvasFontFamily } from "@/lib/canvasFontReady";
import {
  HEADER_HORIZONTAL_PADDING,
  HEADER_INTRO_MAX_WIDTH,
  REF_HEADER_CANVAS_HEIGHT,
  REF_HEADER_COMPACT_HEIGHT,
  headerLayoutScale,
} from "@/lib/homeHeaderLayout";

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
  /** Scales measured glyph height before vertical stretch (< 1 = taller fill). */
  naturalHeightScale?: number;
  /** Extra pixels above/below the layout box for the clip rect. */
  verticalClipPadding?: number;
  /** Clip to this outer box instead of the stretch box (e.g. full gradient zone). */
  clipBounds?: StretchedTextBox;
  /** Vertical breathing room inside the stretch box (0–0.5). */
  verticalMarginRatio?: number;
  /** Use width-fill + height-stretch with middle-baseline centering (team codes). */
  teamCodeStretch?: boolean;
}

/** Shared layout tuning for header title + team code initials. */
export const STRETCHED_INTER_FILL_WIDTH_RATIO = 0.98;
export const STRETCHED_INTER_FILL_HEIGHT_RATIO = 0.97;
/** Inner text box height relative to the gradient zone. */
export const STRETCHED_INTER_ZONE_HEIGHT_RATIO = 0.95;
export const STRETCHED_INTER_TEAM_ZONE_HEIGHT_RATIO = 0.98;
/** Bias inner box slightly below geometric center (accounts for cap overshoot). */
export const STRETCHED_INTER_ZONE_VERTICAL_BIAS = 0.5;
export const STRETCHED_INTER_TEAM_FILL_HEIGHT_RATIO = 0.75;
export const STRETCHED_INTER_TEAM_VERTICAL_MARGIN = 0.03;
/** Lower measured height → stronger vertical scaleY. */
export const STRETCHED_INTER_TEAM_NATURAL_HEIGHT_SCALE = 0.72;
/** Extra clip headroom above the gradient zone for cap overshoot. */
export const STRETCHED_INTER_TEAM_CLIP_TOP_MUL = 2.5;
export const STRETCHED_INTER_CLIP_PADDING_REF = 16;
export const STRETCHED_INTER_REFERENCE_HEIGHT = 252;

export function stretchedInterCenteredBox(
  zone: StretchedTextBox,
  heightRatio = STRETCHED_INTER_ZONE_HEIGHT_RATIO,
  widthRatio = STRETCHED_INTER_FILL_WIDTH_RATIO,
  verticalBias = STRETCHED_INTER_ZONE_VERTICAL_BIAS
): StretchedTextBox {
  const boxHeight = zone.height * heightRatio;
  const boxWidth = zone.width * widthRatio;
  const freeY = Math.max(zone.height - boxHeight, 0);
  return {
    left: zone.left + (zone.width - boxWidth) * 0.5,
    top: zone.top + freeY * verticalBias,
    width: boxWidth,
    height: boxHeight,
  };
}

export function stretchedInterClipPadding(zoneHeight: number): number {
  return Math.max(
    4,
    Math.round(
      STRETCHED_INTER_CLIP_PADDING_REF *
        (zoneHeight / STRETCHED_INTER_REFERENCE_HEIGHT)
    )
  );
}

export function stretchedInterLayoutOptions(zoneHeight: number): Pick<
  StretchedInterTextOptions,
  "fillWidthRatio" | "fillHeightRatio" | "verticalClipPadding"
> {
  return {
    fillWidthRatio: 1,
    fillHeightRatio: STRETCHED_INTER_FILL_HEIGHT_RATIO,
    verticalClipPadding: stretchedInterClipPadding(zoneHeight),
  };
}

/** Team code initials — centered box inside the gradient zone, stretch fills the inner box. */
export function drawTeamCodeStretchedText(
  ctx: CanvasRenderingContext2D,
  zone: StretchedTextBox,
  text: string,
  fillStyle: string
): void {
  const textBox = stretchedInterCenteredBox(
    zone,
    STRETCHED_INTER_TEAM_ZONE_HEIGHT_RATIO
  );
  drawStretchedInterText(ctx, textBox, {
    text,
    fillStyle,
    fillWidthRatio: 1,
    fillHeightRatio: STRETCHED_INTER_TEAM_FILL_HEIGHT_RATIO,
    verticalClipPadding: stretchedInterClipPadding(zone.height),
    clipBounds: zone,
    verticalMarginRatio: STRETCHED_INTER_TEAM_VERTICAL_MARGIN,
    naturalHeightScale: STRETCHED_INTER_TEAM_NATURAL_HEIGHT_SCALE,
    teamCodeStretch: true,
  });
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
  const marginRatio = options.verticalMarginRatio ?? 0;
  const innerHeight = box.height * (1 - marginRatio * 2);
  const targetHeight = innerHeight * fillHeightRatio;
  const baseSize = targetWidth / Math.max(count * 0.55, 1);
  const gap = baseSize * letterGapRatio;
  const teamCodeStretch = options.teamCodeStretch ?? false;

  ctx.font = `${fontWeight} ${baseSize}px ${fontFamily}`;

  const widths: number[] = [];
  let maxAscent = 0;
  let maxDescent = 0;
  for (const letter of letters) {
    ctx.textBaseline = "alphabetic";
    const metrics = ctx.measureText(letter);
    widths.push(metrics.width);
    maxAscent = Math.max(maxAscent, metrics.actualBoundingBoxAscent);
    maxDescent = Math.max(maxDescent, metrics.actualBoundingBoxDescent);
  }

  const naturalW =
    widths.reduce((sum, w) => sum + w, 0) + gap * Math.max(count - 1, 0);
  const naturalH =
    Math.max(maxAscent + maxDescent, baseSize * (teamCodeStretch ? 0.5 : 0.75)) *
    (options.naturalHeightScale ?? 1);
  const scaleX = targetWidth / Math.max(naturalW, 1);
  let scaleY = targetHeight / Math.max(naturalH, 1);

  const zoneCx = box.left + box.width * 0.5;
  const topInset = box.height * marginRatio;
  let baselineY = 0;

  const clip = options.clipBounds ?? box;
  const clipPad = options.verticalClipPadding ?? 0;
  const clipTopPad = teamCodeStretch ? clipPad * STRETCHED_INTER_TEAM_CLIP_TOP_MUL : clipPad;
  const clipBottomPad = clipPad;
  const clipTop = clip.top - clipTopPad;
  const clipBottom = clip.top + clip.height + clipBottomPad;

  if (teamCodeStretch) {
    ctx.textBaseline = "alphabetic";
    const edgePad = Math.max(innerHeight * 0.025, 2);
    let scaledH = (maxAscent + maxDescent) * scaleY;
    const availableH = clipBottom - clipTop;

    if (scaledH > availableH - edgePad * 2) {
      scaleY *= (availableH - edgePad * 2) / Math.max(scaledH, 1);
      scaledH = (maxAscent + maxDescent) * scaleY;
    }

    const scaledAscent = maxAscent * scaleY;
    const scaledDescent = maxDescent * scaleY;
    baselineY =
      box.top + topInset + (innerHeight - scaledH) * 0.5 + scaledAscent;

    const visualTop = baselineY - scaledAscent;
    const minTop = clipTop + edgePad;
    if (visualTop < minTop) baselineY += minTop - visualTop;

    const visualBottom = baselineY + scaledDescent;
    const maxBottom = clipBottom - edgePad;
    if (visualBottom > maxBottom) baselineY -= visualBottom - maxBottom;
  } else {
    ctx.textBaseline = "alphabetic";
    baselineY =
      box.top +
      topInset +
      (innerHeight - (maxAscent + maxDescent) * scaleY) * 0.5 +
      maxAscent * scaleY;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(
    clip.left,
    clipTop,
    clip.width,
    clipBottom - clipTop
  );
  ctx.clip();
  ctx.translate(zoneCx, baselineY);
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

/** Responsive header metrics — scales below 1920px for mobile. */
export function homeTitleMetrics(viewportWidth: number): {
  titleWidth: number;
  canvasHeight: number;
  introWidth: number;
  compactHeaderHeight: number;
} {
  const scale = headerLayoutScale(viewportWidth);
  const contentWidth = Math.max(1, viewportWidth - HEADER_HORIZONTAL_PADDING);
  const canvasHeight = Math.max(72, Math.round(REF_HEADER_CANVAS_HEIGHT * scale));

  return {
    titleWidth: contentWidth,
    canvasHeight,
    introWidth: Math.min(HEADER_INTRO_MAX_WIDTH, contentWidth),
    compactHeaderHeight: Math.max(64, Math.round(REF_HEADER_COMPACT_HEIGHT * scale)),
  };
}
