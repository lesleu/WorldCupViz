import { cfg } from "@/config";
import { resolveKickoffCanvasFontFamily } from "@/lib/canvasFontReady";
import type { TeamPalette } from "@/data/teamPalettes.generated";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  if (h.length !== 6) return [0, 0, 0];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function lerpRgb(a: [number, number, number], b: [number, number, number], t: number) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ] as [number, number, number];
}

function drawVerticalGradient(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  w: number,
  h: number,
  topColor: [number, number, number],
  bottomColor: [number, number, number]
) {
  const steps = Math.max(Math.ceil(h), 1);
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : i / (steps - 1);
    const [r, g, b] = lerpRgb(topColor, bottomColor, t);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(left, top + i, w, 1);
  }
}

/** Kickoff art zone — team gradients + width-fill / height-stretch team codes (matches posterRenderer). */
export function drawKickoffCover(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  homeCode: string,
  awayCode: string,
  homePalette: TeamPalette,
  awayPalette: TeamPalette
) {
  const chrome = hexToRgb(cfg.colors.cream);
  ctx.fillStyle = `rgb(${chrome[0]},${chrome[1]},${chrome[2]})`;
  ctx.fillRect(0, 0, width, height);

  const midX = width * 0.5;
  const topInset = Math.round(cfg.layout.kickoffTypeTopInset * (height / 1080));
  const artTop = topInset;
  const artHeight = Math.max(height - artTop, 1);

  drawVerticalGradient(
    ctx,
    0,
    artTop,
    midX,
    artHeight,
    hexToRgb(homePalette.c4),
    hexToRgb(homePalette.c1)
  );
  drawVerticalGradient(
    ctx,
    midX,
    artTop,
    midX,
    artHeight,
    hexToRgb(awayPalette.c1),
    hexToRgb(awayPalette.c4)
  );

  const type = cfg.typography;
  const drawTeamCodes = (code: string, zoneLeft: number, zoneWidth: number) => {
    const letters = code.split("");
    const count = letters.length;
    if (count === 0) return;

    const targetWidth = zoneWidth * type.kickoffCodeFillWidthRatio;
    const targetHeight = artHeight * type.kickoffCodeFillHeightRatio;
    const baseSize = targetWidth / Math.max(count * 0.55, 1);
    const gap = baseSize * type.kickoffCodeLetterGapRatio;
    const font = `${type.kickoffCodeFontWeight} ${baseSize}px ${resolveKickoffCanvasFontFamily()}`;

    ctx.font = font;
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

    const zoneCx = zoneLeft + zoneWidth * 0.5;
    const zoneCy = artTop + artHeight * 0.5;

    ctx.save();
    ctx.beginPath();
    ctx.rect(zoneLeft, artTop, zoneWidth, artHeight);
    ctx.clip();
    ctx.translate(zoneCx, zoneCy);
    ctx.scale(scaleX, scaleY);
    ctx.fillStyle = cfg.colors.text;
    ctx.textAlign = "center";

    let x = -naturalW * 0.5;
    for (let i = 0; i < count; i++) {
      ctx.fillText(letters[i], x + widths[i] * 0.5, 0);
      x += widths[i] + gap;
    }
    ctx.restore();
  };

  drawTeamCodes(homeCode, 0, midX);
  drawTeamCodes(awayCode, midX, midX);
}
