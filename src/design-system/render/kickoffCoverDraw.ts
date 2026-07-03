import { cfg } from "@/config";
import type { TeamPalette } from "@/data/teamPalettes.generated";
import {
  drawTeamCodeStretchedText,
  type StretchedTextBox,
} from "@/lib/stretchedInterText";

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

/** Kickoff art zone — full-height team gradients + centered width-fill / height-stretch team codes. */
export function drawKickoffCover(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  homeCode: string,
  awayCode: string,
  homePalette: TeamPalette,
  awayPalette: TeamPalette
) {
  const midX = width * 0.5;

  drawVerticalGradient(
    ctx,
    0,
    0,
    midX,
    height,
    hexToRgb(homePalette.c4),
    hexToRgb(homePalette.c1)
  );
  drawVerticalGradient(
    ctx,
    midX,
    0,
    midX,
    height,
    hexToRgb(awayPalette.c1),
    hexToRgb(awayPalette.c4)
  );

  const drawTeamCodes = (code: string, zone: StretchedTextBox) => {
    drawTeamCodeStretchedText(ctx, zone, code, cfg.colors.text);
  };

  drawTeamCodes(homeCode, { left: 0, top: 0, width: midX, height });
  drawTeamCodes(awayCode, { left: midX, top: 0, width: midX, height });
}
