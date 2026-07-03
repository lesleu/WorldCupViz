/** Pass accuracy overlay — vertical stripe columns on the team gradient. */

export const PASS_ACCURACY_STRIPE_WIDTH_PX = 15;
export const PASS_ACCURACY_STRIPE_COLORS = ["#D9D9D9", "#B8B5B5"] as const;
export const PASS_ACCURACY_STRIPE_OPACITY = 0.4;
/** Above this value stripes use straight edges; at or below, edges are jagged. */
export const PASS_ACCURACY_STRAIGHT_THRESHOLD = 80;

export interface PassAccuracyStripeOptions {
  stripeWidthPx?: number;
  /** Stable seed for jagged edge shape (e.g. side hash). */
  jaggedSeed?: number;
}

function jaggedOffset(
  colIndex: number,
  t: number,
  seed: number,
  amplitude: number
): number {
  return (
    amplitude *
    Math.sin(colIndex * 2.17 + seed * 0.31 + t * 9.4) *
    Math.sin(colIndex * 1.53 + seed * 0.19 + t * 13.7)
  );
}

/** Draw alternating vertical stripes with multiply blend at 40% opacity. */
export function drawPassAccuracyStripes(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  width: number,
  height: number,
  accuracy: number,
  options: PassAccuracyStripeOptions = {}
): void {
  if (width <= 0 || height <= 0) return;

  const stripeWidth = options.stripeWidthPx ?? PASS_ACCURACY_STRIPE_WIDTH_PX;
  const isStraight = accuracy > PASS_ACCURACY_STRAIGHT_THRESHOLD;
  const seed = options.jaggedSeed ?? 0;
  const colCount = Math.max(1, Math.ceil(width / stripeWidth));
  const jaggedAmp = Math.min(stripeWidth * 0.32, 5);

  ctx.save();
  ctx.globalAlpha = PASS_ACCURACY_STRIPE_OPACITY;
  ctx.globalCompositeOperation = "multiply";

  for (let i = 0; i < colCount; i++) {
    const x0 = left + i * stripeWidth;
    const w = Math.min(stripeWidth, left + width - x0);
    ctx.fillStyle = PASS_ACCURACY_STRIPE_COLORS[i % 2];

    if (isStraight) {
      ctx.fillRect(x0, top, w, height);
      continue;
    }

    const segments = Math.max(6, Math.floor(height / 10));
    ctx.beginPath();
    for (let s = 0; s <= segments; s++) {
      const t = s / segments;
      const y = top + t * height;
      const x = x0 + jaggedOffset(i, t, seed, jaggedAmp);
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let s = segments; s >= 0; s--) {
      const t = s / segments;
      const y = top + t * height;
      const x = x0 + w + jaggedOffset(i + 1, t, seed + 7, jaggedAmp);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}
