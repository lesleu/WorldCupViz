import type { PossessionConfig } from "./types";

export const possessionConfig: PossessionConfig = {
  gridRows: 10,
  gridCols: 10,
  circlesPerRowMin: 10,
  circlesPerRowMax: 10,
  /** Circles at 100% possession when placed as mosaic marks (0% → none). */
  placedCirclesAt100: 36,
  circleScale: 1,
  filledOpacity: 255,
  unfilledOpacity: 255,
  homeGridCornerXRatio: 0.04,
  awayGridCornerXRatio: 0.04,
  gridCornerYRatio: 0.06,
  gridBreathingAmount: 0,
  rowJitterRatio: 0,
  circleFillRatio: 0.88,
};
