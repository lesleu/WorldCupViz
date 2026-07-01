import { cfg } from "@/config";
import { gridRegionForSide, type PosterLayout } from "@/design-system/layout/posterLayout";
import type { TeamSide } from "@/data/mockMatch";

export interface PossessionCircleSlot {
  x: number;
  y: number;
}

/** Circle diameter sized to fit one grid cell without overlap. */
export function resolvePossessionCircleDiameter(
  layout: PosterLayout,
  side: TeamSide
): number {
  const g = cfg.possession;
  const region = gridRegionForSide(layout, side);
  const cols = Math.max(g.gridCols ?? 10, 1);
  const rows = Math.max(g.gridRows ?? 10, 1);
  const cellW = region.width / cols;
  const cellH = region.height / rows;
  const fill = g.circleFillRatio ?? 0.88;
  return Math.min(cellW, cellH) * fill;
}

/** Aligned row/column possession grid — one circle per cell. */
export function buildPossessionGridSlots(
  layout: PosterLayout,
  side: TeamSide,
  _seed: number
): PossessionCircleSlot[] {
  const g = cfg.possession;
  const region = gridRegionForSide(layout, side);
  const rows = Math.max(g.gridRows ?? 14, 1);
  const cols = Math.max(g.gridCols ?? 10, 1);
  const cellW = region.width / cols;
  const cellH = region.height / rows;
  const slots: PossessionCircleSlot[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      slots.push({
        x: region.left + cellW * (col + 0.5),
        y: region.top + cellH * (row + 0.5),
      });
    }
  }

  return slots;
}
