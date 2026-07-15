import { cfg } from "@/config";
import { mosaicGridCellRuntimePx } from "@/design-system/layout/designScale";
import type { MarkPixelDims } from "@/design-system/layout/markSizing";
import type { PosterLayout } from "@/design-system/layout/posterLayout";

/** Design-px cell at 1920×1080 (composition token). Prefer layout-aware runtime helper. */
export function mosaicGridCellDesignPx(): number {
  return cfg.composition.mosaicGridCellPx ?? 40;
}

/**
 * Mosaic grid cell in runtime px.
 * Pass `layout` so the cell scales with artwork (mobile ~8px, full HD ~40px).
 */
export function mosaicGridCellPx(layout?: PosterLayout): number {
  if (layout) return mosaicGridCellRuntimePx(layout);
  return mosaicGridCellDesignPx();
}

export function snapDimToGrid(px: number, cell: number): number {
  if (!(px > 0) || !(cell > 0)) return 0;
  return Math.max(cell, Math.round(px / cell) * cell);
}

export function snapDimsToGrid(
  dims: MarkPixelDims,
  cell: number
): MarkPixelDims {
  return {
    widthPx: snapDimToGrid(dims.widthPx, cell),
    heightPx: snapDimToGrid(dims.heightPx, cell),
  };
}

/**
 * Goal / Foul / Offside — snap each axis to the grid. Prefer a clearly
 * non-square slab so stretch-to-box is visible vs the SVG's native aspect.
 */
export function snapElongatedDimsToGrid(
  dims: MarkPixelDims,
  cell: number
): MarkPixelDims {
  let widthPx = snapDimToGrid(dims.widthPx, cell);
  let heightPx = snapDimToGrid(dims.heightPx, cell);

  // At least 2 cells on the long axis.
  if (widthPx >= heightPx && widthPx < cell * 2) widthPx = cell * 2;
  if (heightPx > widthPx && heightPx < cell * 2) heightPx = cell * 2;

  // If still roughly square after snap, force a vertical or horizontal stretch.
  const ratio = widthPx / Math.max(heightPx, 1);
  if (ratio > 0.7 && ratio < 1.35) {
    if (dims.heightPx >= dims.widthPx) {
      heightPx = Math.max(heightPx, cell * 3);
      widthPx = Math.max(cell, Math.min(widthPx, cell * 2));
    } else {
      widthPx = Math.max(widthPx, cell * 3);
      heightPx = Math.max(cell, Math.min(heightPx, cell * 2));
    }
  }

  return { widthPx, heightPx };
}

/** Snap AABB so left/top edges sit on grid lines (centers fall on cell middles / edges). */
export function snapCenterToGrid(
  cx: number,
  cy: number,
  w: number,
  h: number,
  originX: number,
  originY: number,
  cell: number
): { cx: number; cy: number } {
  if (!(cell > 0)) return { cx, cy };
  const left = cx - w / 2;
  const top = cy - h / 2;
  const snappedLeft = originX + Math.round((left - originX) / cell) * cell;
  const snappedTop = originY + Math.round((top - originY) / cell) * cell;
  return { cx: snappedLeft + w / 2, cy: snappedTop + h / 2 };
}

export interface GridSnappableRect {
  cx: number;
  cy: number;
  w: number;
  h: number;
  layoutScale: number;
}

export function snapRectToGrid<T extends GridSnappableRect>(
  rect: T,
  originX: number,
  originY: number,
  cell: number
): T {
  if (rect.w <= 0 || rect.h <= 0 || !(cell > 0)) return rect;
  const w = snapDimToGrid(rect.w, cell);
  const h = snapDimToGrid(rect.h, cell);
  const { cx, cy } = snapCenterToGrid(
    rect.cx,
    rect.cy,
    w,
    h,
    originX,
    originY,
    cell
  );
  const scaleRatio = w / Math.max(rect.w, 1e-6);
  return {
    ...rect,
    cx,
    cy,
    w,
    h,
    layoutScale: rect.layoutScale * scaleRatio,
  };
}
