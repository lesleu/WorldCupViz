import type { PossessionConfig } from "./types";

export const possessionConfig: PossessionConfig = {
  gridRows: 10,
  gridCols: 10,
  circlesPerRowMin: 10,
  circlesPerRowMax: 10,
  /** Circles at 100% possession when placed as mosaic marks (0% → none). */
  placedCirclesAt100: 36,
  /** Floor diameter for mosaic-placed possession circles (runtime px). */
  minCirclePx: 20,
  circleScale: 1,
  filledOpacity: 255,
  unfilledOpacity: 255,
  homeGridCornerXRatio: 0.04,
  awayGridCornerXRatio: 0.04,
  gridCornerYRatio: 0.06,
  /** Light live pulse (liveAssetMotion also drives this). */
  gridBreathingAmount: 0.35,
  /** ~0.55s pop-in so new circles grow onto the canvas. */
  spawnGrowMs: 550,
  /**
   * Collision-pad fraction — keep 0 so circles can edge-touch via the mosaic
   * algorithm (they must share an edge with at least one neighbor).
   */
  separationGapRatio: 0,
  rowJitterRatio: 0,
  circleFillRatio: 0.88,
};
