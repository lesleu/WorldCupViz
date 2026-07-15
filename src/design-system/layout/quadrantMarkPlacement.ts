import { cfg } from "@/config";
import { eventMarksConfig } from "@/config/eventMarks.config";
import { COMPONENT_PATHS } from "@/design-system/assets/componentPaths.generated";
import {
  VISUAL_COMPONENT,
  type VisualComponent,
} from "@/design-system/mapping/visualMappings";
import type { TeamSide } from "@/data/mockMatch";
import { normSize } from "@/design-system/layout/designScale";
import type { MarkPixelDims } from "@/design-system/layout/markSizing";
import {
  markRng,
  minMosaicScaleForMinPx,
  scaleMarkDims,
} from "@/design-system/layout/markSizing";
import { diagonalCompositionMarkScale } from "@/design-system/layout/designScale";
import {
  mosaicGridCellPx,
  snapDimsToGrid,
  snapElongatedDimsToGrid,
  snapRectToGrid,
} from "@/design-system/layout/mosaicGrid";
import {
  gridRegionForSide,
  markRegionForSide,
  teamZoneForSide,
  type PosterLayout,
} from "@/design-system/layout/posterLayout";
import type { PlacementState } from "@/design-system/layout/placementEngine";
import { randBetween } from "@/utils/seededRandom";

export type { MarkPixelDims } from "@/design-system/layout/markSizing";

/** Timed event mark with normalized layout coordinates. */
export interface LayoutMark {
  id: string;
  side: TeamSide;
  minute: number;
  nx: number;
  ny: number;
  spawnScale: number;
  layoutScale: number;
  /**
   * Normalized AABB on the artwork (diagonal mosaic). When set, draw uses this
   * footprint so stretched Goal/Foul/Offside boxes aren't re-aspect-locked.
   */
  layoutNw?: number;
  layoutNh?: number;
}

/** @deprecated Use LayoutMark */
export type QuadrantMark = LayoutMark;

export interface TimedMarkEntry {
  mark: LayoutMark;
  component: VisualComponent;
  commit?: (
    nx: number,
    ny: number,
    layoutScale: number,
    layout: PosterLayout,
    footprint?: { nw: number; nh: number }
  ) => void;
}

export interface PlacedRect {
  cx: number;
  cy: number;
  w: number;
  h: number;
  layoutScale: number;
}

interface RegionBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

type WalkDir = "right" | "left" | "down" | "up";

const WALK_DIRS: WalkDir[] = ["right", "down", "left", "up"];
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
/** Slides along a neighbor edge so new marks fork mid-side instead of dead-center. */
const EDGE_SLIDES = [-0.48, -0.28, -0.1, 0.1, 0.28, 0.48] as const;

function isPossessionComponent(component: VisualComponent): boolean {
  return component === VISUAL_COMPONENT.PossessionGrid;
}

function possessionMosaicMinPx(): number {
  return cfg.composition.possessionMosaicMinPx ?? eventMarksConfig.minMarkPx;
}

function mosaicGrowthSporadicity(): number {
  if (!activePlacementLayout?.diagonalSplit) return 0;
  const v = cfg.composition.mosaicGrowthSporadicity;
  if (v === undefined) return 0.7;
  return Math.min(1, Math.max(0, v));
}

/** Floor short-side px; used so possession circles stay ≥ min after diagonal scale. */
function floorDimsToMinPx(dims: MarkPixelDims, minPx: number): MarkPixelDims {
  const short = Math.min(dims.widthPx, dims.heightPx);
  if (short <= 0 || short >= minPx) return dims;
  const s = minPx / short;
  return { widthPx: dims.widthPx * s, heightPx: dims.heightPx * s };
}

/**
 * Events shrink with mosaicScale; possession circles stay at base size (≥ min px)
 * so they never get crushed below the floor when packing gets dense.
 */
function dimsForMosaicScale(
  ordered: TimedMarkEntry[],
  baseDims: MarkPixelDims[],
  mosaicScale: number
): MarkPixelDims[] {
  const cell = mosaicGridCellPx();
  const snap = activePlacementLayout?.diagonalSplit === true;
  return baseDims.map((d, i) => {
    if (isPossessionComponent(ordered[i].component)) return d;
    const scaled = {
      widthPx: d.widthPx * mosaicScale,
      heightPx: d.heightPx * mosaicScale,
    };
    return snap ? snapDimsToGrid(scaled, cell) : scaled;
  });
}

/** Active layout/side while placing marks — avoids threading through every helper. */
let activePlacementLayout: PosterLayout | undefined;
let activePlacementSide: TeamSide | undefined;

function runWithPlacementContext<T>(
  layout: PosterLayout,
  side: TeamSide,
  fn: () => T
): T {
  const prevLayout = activePlacementLayout;
  const prevSide = activePlacementSide;
  activePlacementLayout = layout;
  activePlacementSide = side;
  try {
    return fn();
  } finally {
    activePlacementLayout = prevLayout;
    activePlacementSide = prevSide;
  }
}

function diagonalSeamGap(): number {
  return cfg.composition.diagonalSeamGap ?? 0.08;
}

function pointToNorm(
  x: number,
  y: number,
  layout: PosterLayout
): [number, number] {
  return [
    (x - layout.margin) / Math.max(layout.artworkWidth, 1),
    (y - layout.artworkTop) / Math.max(layout.artworkHeight, 1),
  ];
}

/**
 * True when the mark's full axis-aligned bbox stays entirely on this team's
 * side of the diagonal seam (home: upper-left; away: lower-right).
 */
function markClearsDiagonal(
  cx: number,
  cy: number,
  w: number,
  h: number,
  layout: PosterLayout,
  side: TeamSide
): boolean {
  const gap = diagonalSeamGap();
  const halfU = w / 2 / Math.max(layout.artworkWidth, 1);
  const halfV = h / 2 / Math.max(layout.artworkHeight, 1);
  const [nx, ny] = pointToNorm(cx, cy, layout);
  return side === "home"
    ? nx + halfU + ny + halfV <= 1 - gap
    : nx - halfU + ny - halfV >= 1 + gap;
}

/**
 * Pull a mark center toward its growth corner until the bbox clears the diagonal.
 */
function projectIntoDiagonal(
  cx: number,
  cy: number,
  w: number,
  h: number,
  layout: PosterLayout,
  side: TeamSide
): { cx: number; cy: number } {
  let x = cx;
  let y = cy;
  const gap = diagonalSeamGap();
  const halfU = w / 2 / Math.max(layout.artworkWidth, 1);
  const halfV = h / 2 / Math.max(layout.artworkHeight, 1);
  const aw = Math.max(layout.artworkWidth, 1);
  const ah = Math.max(layout.artworkHeight, 1);

  for (let i = 0; i < 32; i++) {
    const [nx, ny] = pointToNorm(x, y, layout);
    if (side === "home") {
      const s = nx + halfU + ny + halfV;
      const limit = 1 - gap;
      if (s <= limit) break;
      const move = (s - limit) * 0.55;
      x -= move * aw;
      y -= move * ah;
    } else {
      const s = nx - halfU + ny - halfV;
      const limit = 1 + gap;
      if (s >= limit) break;
      const move = (limit - s) * 0.55;
      x += move * aw;
      y += move * ah;
    }
  }

  return { cx: x, cy: y };
}

/** Pixel width/height from design width (viewBox aspect). */
export function markDimensionsFromScale(
  component: VisualComponent,
  designWidthPx: number
): { widthPx: number; heightPx: number } {
  const vb = COMPONENT_PATHS[component]?.viewBox;
  if (!vb) return { widthPx: designWidthPx, heightPx: designWidthPx };
  return { widthPx: designWidthPx, heightPx: designWidthPx * (vb.h / vb.w) };
}

/** Uniform scalePx for drawSvgComponent (preserves SVG aspect). */
export function markUniformDrawScalePx(
  component: VisualComponent,
  designWidthPx: number
): number {
  const vb = COMPONENT_PATHS[component]?.viewBox;
  if (!vb) return designWidthPx;
  return designWidthPx * (Math.max(vb.w, vb.h) / vb.w);
}

/** Team mark region — inset from outer edges and center gap. */
export function teamPlacementBounds(
  layout: PosterLayout,
  side: TeamSide
): RegionBounds {
  const region = markRegionForSide(layout, side);
  const zone = teamZoneForSide(layout, side);
  const { artworkEdgePaddingRatio, centerEdgePaddingRatio } = eventMarksConfig;
  const pad = Math.min(region.width, region.height) * artworkEdgePaddingRatio;

  // Diagonal split: both teams share the full artwork rect; triangle ownership
  // is enforced by markClearsDiagonal / projectIntoDiagonal — not by a center cut.
  if (layout.diagonalSplit) {
    return {
      left: region.left + pad,
      top: region.top + pad,
      width: Math.max(region.width - pad * 2, 1),
      height: Math.max(region.height - pad * 2, 1),
    };
  }

  const centerPad = Math.min(region.width, region.height) * centerEdgePaddingRatio;

  let left = region.left + pad;
  let right = region.left + region.width - pad;
  const top = region.top + pad;
  const bottom = region.top + region.height - pad;

  if (side === "home") {
    right = Math.min(right, zone.innerEdgeX - centerPad);
  } else {
    left = Math.max(left, zone.innerEdgeX + centerPad);
  }

  return {
    left,
    top,
    width: Math.max(right - left, 1),
    height: Math.max(bottom - top, 1),
  };
}

function zoneQuadrant(cx: number, cy: number, bounds: RegionBounds): number {
  const midX = bounds.left + bounds.width / 2;
  const midY = bounds.top + bounds.height / 2;
  const left = cx < midX ? 0 : 1;
  const top = cy < midY ? 0 : 1;
  return top * 2 + left;
}

function quadrantBalancePenalty(
  cx: number,
  cy: number,
  placed: PlacedRect[],
  bounds: RegionBounds
): number {
  if (placed.length < 3) return 0;
  const counts = [0, 0, 0, 0];
  for (const p of placed) {
    counts[zoneQuadrant(p.cx, p.cy, bounds)]++;
  }
  const q = zoneQuadrant(cx, cy, bounds);
  const avg = placed.length / 4;
  const excess = counts[q] - avg;
  if (excess <= 0) return 0;
  return excess * Math.min(bounds.width, bounds.height) * 0.14;
}

function zoneCenter(bounds: RegionBounds): { cx: number; cy: number } {
  return {
    cx: bounds.left + bounds.width / 2,
    cy: bounds.top + bounds.height / 2,
  };
}

function rectFitsInBounds(
  cx: number,
  cy: number,
  w: number,
  h: number,
  bounds: RegionBounds
): boolean {
  const inRect =
    cx - w / 2 >= bounds.left &&
    cx + w / 2 <= bounds.left + bounds.width &&
    cy - h / 2 >= bounds.top &&
    cy + h / 2 <= bounds.top + bounds.height;
  if (!inRect) return false;

  const layout = activePlacementLayout;
  const side = activePlacementSide;
  if (layout?.diagonalSplit && side) {
    return markClearsDiagonal(cx, cy, w, h, layout, side);
  }
  return true;
}

function clampCenterToBounds(
  cx: number,
  cy: number,
  w: number,
  h: number,
  bounds: RegionBounds
): { cx: number; cy: number } {
  const minX = bounds.left + w / 2;
  const maxX = bounds.left + bounds.width - w / 2;
  const minY = bounds.top + h / 2;
  const maxY = bounds.top + bounds.height - h / 2;
  let out = {
    cx: Math.min(maxX, Math.max(minX, cx)),
    cy: Math.min(maxY, Math.max(minY, cy)),
  };

  const layout = activePlacementLayout;
  const side = activePlacementSide;
  if (layout?.diagonalSplit && side) {
    out = projectIntoDiagonal(out.cx, out.cy, w, h, layout, side);
    out = {
      cx: Math.min(maxX, Math.max(minX, out.cx)),
      cy: Math.min(maxY, Math.max(minY, out.cy)),
    };
  }
  return out;
}

/** Penalize placements hugging the team's outer vertical edge (top/bottom corners). */
function outerEdgeCornerPenalty(
  cx: number,
  cy: number,
  bounds: RegionBounds,
  side: TeamSide
): number {
  // Diagonal composition wants marks near opposite corners — no outer-edge penalty.
  if (activePlacementLayout?.diagonalSplit) return 0;
  const outerX = side === "home" ? bounds.left : bounds.left + bounds.width;
  const topY = bounds.top;
  const bottomY = bounds.top + bounds.height;
  const zoneMin = Math.min(bounds.width, bounds.height);
  const threshold = zoneMin * 0.42;

  const dTop = Math.hypot(cx - outerX, cy - topY);
  const dBottom = Math.hypot(cx - outerX, cy - bottomY);
  const minD = Math.min(dTop, dBottom);

  if (minD >= threshold) return 0;
  return (threshold - minD) * 6;
}

function rectsOverlap(a: PlacedRect, b: PlacedRect, gap = 0): boolean {
  return (
    Math.abs(a.cx - b.cx) < (a.w + b.w) / 2 + gap &&
    Math.abs(a.cy - b.cy) < (a.h + b.h) / 2 + gap
  );
}

function edgesTouch(a: PlacedRect, b: PlacedRect, epsilon = 1): boolean {
  const dx = Math.abs(a.cx - b.cx);
  const dy = Math.abs(a.cy - b.cy);
  const touchX = Math.abs(dx - (a.w + b.w) / 2) < epsilon;
  const touchY = Math.abs(dy - (a.h + b.h) / 2) < epsilon;
  return (
    (touchX && dy <= (a.h + b.h) / 2 + epsilon) ||
    (touchY && dx <= (a.w + b.w) / 2 + epsilon)
  );
}

function touchesAny(rect: PlacedRect, placed: PlacedRect[]): boolean {
  return placed.some((other) => edgesTouch(rect, other));
}

function placementValid(
  rect: PlacedRect,
  placed: PlacedRect[],
  bounds: RegionBounds,
  requireEdgeTouch = false
): boolean {
  if (!rectFitsInBounds(rect.cx, rect.cy, rect.w, rect.h, bounds)) return false;
  if (placed.some((other) => rectsOverlap(rect, other, 0))) return false;
  if (requireEdgeTouch && placed.length > 0 && !touchesAny(rect, placed)) return false;
  return true;
}

function snapRectToNeighbor(
  rect: PlacedRect,
  neighbor: PlacedRect,
  allRects: PlacedRect[],
  currentIndex: number,
  teamBounds: RegionBounds
): PlacedRect | null {
  const others = allRects.filter((_, idx) => idx !== currentIndex);
  let best: PlacedRect | null = null;
  let bestDist = Infinity;
  const spor = mosaicGrowthSporadicity();

  for (const dir of WALK_DIRS) {
    const slides = spor > 0.1 ? [0, ...EDGE_SLIDES] : [0];
    for (const slide of slides) {
      const adj =
        slide === 0
          ? adjacentCenter(neighbor, rect.w, rect.h, dir)
          : adjacentCenterSlid(neighbor, rect.w, rect.h, dir, slide);
      const candidate = { ...rect, cx: adj.cx, cy: adj.cy };
      if (!placementValid(candidate, others, teamBounds, false)) continue;
      const dist = Math.hypot(candidate.cx - rect.cx, candidate.cy - rect.cy);
      if (dist < bestDist) {
        bestDist = dist;
        best = candidate;
      }
    }
  }

  if (spor > 0.15) {
    for (const sx of [-1, 1] as const) {
      for (const sy of [-1, 1] as const) {
        const corner = adjacentCorner(neighbor, rect.w, rect.h, sx, sy);
        const candidate = { ...rect, cx: corner.cx, cy: corner.cy };
        if (!placementValid(candidate, others, teamBounds, false)) continue;
        const dist = Math.hypot(candidate.cx - rect.cx, candidate.cy - rect.cy);
        if (dist < bestDist) {
          bestDist = dist;
          best = candidate;
        }
      }
    }
  }

  return best;
}

/** Nudge every mark so it shares an edge with at least one other (mosaic connectivity). */
function enforceEdgeTouches(
  rects: PlacedRect[],
  teamBounds: RegionBounds
): PlacedRect[] {
  if (rects.length <= 1) return rects;

  const fixed = rects.map((r) => ({ ...r }));

  for (let pass = 0; pass < 10; pass++) {
    let moved = false;
    for (let i = 0; i < fixed.length; i++) {
      const others = fixed.filter((_, idx) => idx !== i);
      if (others.length === 0) continue;
      if (touchesAny(fixed[i], others)) continue;

      let snapped: PlacedRect | null = null;
      let bestDist = Infinity;
      for (const neighbor of others) {
        const candidate = snapRectToNeighbor(fixed[i], neighbor, fixed, i, teamBounds);
        if (!candidate) continue;
        const dist = Math.hypot(candidate.cx - fixed[i].cx, candidate.cy - fixed[i].cy);
        if (dist < bestDist) {
          bestDist = dist;
          snapped = candidate;
        }
      }

      if (snapped) {
        fixed[i] = snapped;
        moved = true;
      }
    }
    if (!moved) break;
  }

  return repairOverlaps(fixed, teamBounds);
}

/** Last resort — glue any isolated mark to its nearest neighbor. */
function connectIsolatedMarks(
  rects: PlacedRect[],
  teamBounds: RegionBounds
): PlacedRect[] {
  let fixed = rects.map((r) => ({ ...r }));

  for (let pass = 0; pass < 8; pass++) {
    let moved = false;
    for (let i = 0; i < fixed.length; i++) {
      const others = fixed.filter((_, idx) => idx !== i);
      if (others.length === 0) continue;
      if (touchesAny(fixed[i], others)) continue;

      let nearest = others[0];
      let nearestDist = Infinity;
      for (const other of others) {
        const dist = Math.hypot(fixed[i].cx - other.cx, fixed[i].cy - other.cy);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = other;
        }
      }

      const before = fixed[i];
      const snapped =
        snapRectToNeighbor(fixed[i], nearest, fixed, i, teamBounds);

      if (snapped) {
        fixed[i] = snapped;
      } else {
        for (const dir of WALK_DIRS) {
          const adj = adjacentCenter(nearest, fixed[i].w, fixed[i].h, dir);
          const candidate = { ...fixed[i], cx: adj.cx, cy: adj.cy };
          if (placementValid(candidate, others, teamBounds, false)) {
            fixed[i] = candidate;
            break;
          }
        }
      }

      if (fixed[i].cx !== before.cx || fixed[i].cy !== before.cy) moved = true;
    }
    if (!moved) break;
  }

  return fixed;
}

function placementAnchorCenter(bounds: RegionBounds): { cx: number; cy: number } {
  const layout = activePlacementLayout;
  const side = activePlacementSide;
  if (!layout || !side) return zoneCenter(bounds);

  // realone: grow away from each other — home from top-left, away from bottom-right.
  if (layout.diagonalSplit) {
    const inset = Math.min(bounds.width, bounds.height) * 0.14;
    return side === "home"
      ? { cx: bounds.left + inset, cy: bounds.top + inset }
      : {
          cx: bounds.left + bounds.width - inset,
          cy: bounds.top + bounds.height - inset,
        };
  }

  const grid = gridRegionForSide(layout, side);
  const gap =
    Math.min(bounds.width, bounds.height) * cfg.composition.zones.gridMarkGapRatio;
  const markRight = bounds.left + bounds.width;
  const markBottom = bounds.top + bounds.height;

  if (side === "home") {
    return {
      cx: (grid.right + gap + markRight) / 2,
      cy: (grid.bottom + gap + markBottom) / 2,
    };
  }
  return {
    cx: (bounds.left + grid.left - gap) / 2,
    cy: (grid.bottom + gap + markBottom) / 2,
  };
}

function markMinDimension(base: MarkPixelDims, layoutScale: number): number {
  return Math.min(base.widthPx * layoutScale, base.heightPx * layoutScale);
}

/** layoutScale floor so rendered marks stay at least minMarkPx on screen. */
function minLayoutScaleForVisible(base: MarkPixelDims, minMarkPx: number): number {
  const baseMin = Math.min(base.widthPx, base.heightPx);
  if (baseMin <= 0) return 1;
  return minMarkPx / baseMin;
}

function clampRectToMinVisible(
  rect: PlacedRect,
  base: MarkPixelDims,
  minMarkPx: number
): PlacedRect {
  const floorScale = minLayoutScaleForVisible(base, minMarkPx);
  if (rect.layoutScale >= floorScale) return rect;
  const { w, h, layoutScale } = dimsAt(base, floorScale);
  return { ...rect, w, h, layoutScale };
}

function dimsAt(
  base: MarkPixelDims,
  layoutScale: number
): { w: number; h: number; layoutScale: number } {
  return {
    w: base.widthPx * layoutScale,
    h: base.heightPx * layoutScale,
    layoutScale,
  };
}

function randomPerMarkWeights(ordered: TimedMarkEntry[]): number[] {
  const { crowdedScaleMin, crowdedScaleMax } = eventMarksConfig;
  return ordered.map((entry) => {
    const rng = markRng(entry.mark.id.replace(/-sq\d+$/, ""), entry.mark.minute);
    return randBetween(rng, crowdedScaleMin, crowdedScaleMax);
  });
}

function layoutScalesFromWeights(_weights: number[], _globalMult: number): number[] {
  return _weights.map(() => 1);
}

function smallestMinDim(baseDims: MarkPixelDims[], layoutScales: number[]): number {
  let min = Infinity;
  for (let i = 0; i < baseDims.length; i++) {
    min = Math.min(min, markMinDimension(baseDims[i], layoutScales[i]));
  }
  return min;
}

function adjacentCenter(
  prev: PlacedRect,
  w: number,
  h: number,
  dir: WalkDir
): { cx: number; cy: number } {
  switch (dir) {
    case "right":
      return { cx: prev.cx + prev.w / 2 + w / 2, cy: prev.cy };
    case "left":
      return { cx: prev.cx - prev.w / 2 - w / 2, cy: prev.cy };
    case "down":
      return { cx: prev.cx, cy: prev.cy + prev.h / 2 + h / 2 };
    case "up":
      return { cx: prev.cx, cy: prev.cy - prev.h / 2 - h / 2 };
  }
}

/** Edge attachment with mid-side slide — forks branches off flushed centers. */
function adjacentCenterSlid(
  prev: PlacedRect,
  w: number,
  h: number,
  dir: WalkDir,
  slide: number
): { cx: number; cy: number } {
  const base = adjacentCenter(prev, w, h, dir);
  switch (dir) {
    case "right":
    case "left":
      return { cx: base.cx, cy: base.cy + slide * prev.h };
    case "down":
    case "up":
      return { cx: base.cx + slide * prev.w, cy: base.cy };
  }
}

/** Corner-to-corner attachment — diagonal forks, not just H/V limbs. */
function adjacentCorner(
  prev: PlacedRect,
  w: number,
  h: number,
  sx: -1 | 1,
  sy: -1 | 1
): { cx: number; cy: number } {
  return {
    cx: prev.cx + sx * ((prev.w + w) / 2),
    cy: prev.cy + sy * ((prev.h + h) / 2),
  };
}

/**
 * Ideal center for one mark — golden phyllotaxis from the growth corner,
 * with sporadic angular / radius noise on diagonal packs.
 */
function temporalTarget(
  entry: TimedMarkEntry,
  index: number,
  total: number,
  bounds: RegionBounds,
  side: TeamSide,
  maxMinute: number
): { cx: number; cy: number } {
  const { temporalFlowStrength, spiralSpreadRatio } = eventMarksConfig;
  const markId = entry.mark.id.replace(/-sq\d+$/, "");
  const rng = markRng(markId, entry.mark.minute);
  const timeT = Math.min(entry.mark.minute / Math.max(maxMinute, 90), 1);
  const orderT = total <= 1 ? 0 : index / (total - 1);
  const spor = mosaicGrowthSporadicity();

  const center = placementAnchorCenter(bounds);
  // Diagonal: let the spiral reach most of the triangle (kept back from the seam by
  // markClearsDiagonal). Classic split keeps the wider zone fill ratio.
  const spiralCap = activePlacementLayout?.diagonalSplit ? 0.92 : 0.82;
  const maxR = Math.min(bounds.width, bounds.height) * spiralSpreadRatio * spiralCap;

  const rank = index + 1;
  // Sporadic: each mark picks a sector bias so growth fans into many arms,
  // not just the two golden-angle limbs.
  const sectorBias =
    spor > 0 ? randBetween(rng, -Math.PI, Math.PI) * spor * 0.85 : 0;
  const angleJitter = 0.08 + spor * 0.55;
  const angle =
    rank * GOLDEN_ANGLE +
    timeT * Math.PI * 0.22 * temporalFlowStrength +
    sectorBias +
    randBetween(rng, -angleJitter, angleJitter);

  const radiusNoise = spor > 0 ? randBetween(rng, -0.22, 0.28) * spor : 0;
  // Sporadic: mix chronological radius with a per-mark random orbit so every
  // asset type (not only early circles) can sit near or far from the corner.
  const orderMix =
    spor > 0
      ? orderT * (1 - spor * 0.8) + randBetween(rng, 0, 1) * spor * 0.8
      : orderT;
  const radius =
    Math.max(0.02, Math.min(1, 0.05 + orderMix * 0.88 + radiusNoise)) * maxR;

  // Left/right side nudge only applies to the classic split.
  const sideNudge = activePlacementLayout?.diagonalSplit
    ? 0
    : (side === "home" ? -1 : 1) *
      bounds.width *
      0.04 *
      (timeT - 0.5) *
      temporalFlowStrength;

  const jitter =
    Math.min(bounds.width, bounds.height) * (0.028 + spor * 0.06);
  return {
    cx:
      center.cx +
      sideNudge +
      Math.cos(angle) * radius +
      randBetween(rng, -jitter, jitter),
    cy:
      center.cy +
      Math.sin(angle) * radius +
      randBetween(rng, -jitter, jitter),
  };
}

function placementCentroid(placed: PlacedRect[]): { cx: number; cy: number } {
  let sx = 0;
  let sy = 0;
  for (const p of placed) {
    sx += p.cx;
    sy += p.cy;
  }
  return { cx: sx / placed.length, cy: sy / placed.length };
}

function scoreCandidate(
  cx: number,
  cy: number,
  target: { cx: number; cy: number },
  w: number,
  h: number,
  placed: PlacedRect[],
  region: RegionBounds,
  side: TeamSide
): number {
  const probe: PlacedRect = { cx, cy, w, h, layoutScale: 1 };
  const diagonal = activePlacementLayout?.diagonalSplit === true;
  let score = Math.hypot(cx - target.cx, cy - target.cy) * (diagonal ? 0.28 : 0.12);

  if (placed.length > 0) {
    const spor = mosaicGrowthSporadicity();
    const unit = Math.min(region.width, region.height);
    // High spor → weaker "must cling to the same arm" bonus so forks compete.
    const touchWeight = 0.55 - spor * 0.28;
    const missWeight = 0.25 - spor * 0.12;
    const touchBonus = touchesAny(probe, placed)
      ? -unit * touchWeight
      : unit * Math.max(0.04, missWeight);
    score += touchBonus;

    const before = layoutBoundingBox(placed);
    const after = layoutBoundingBox([...placed, probe]);
    const growth = after.width * after.height - before.width * before.height;
    // Classic: keep the collage compact. Diagonal+sporadic: stop rewarding the
    // AABB "right+down" two-arm expansion so forks into gaps compete equally.
    score -= growth * (diagonal ? 0.12 * (1 - spor * 0.9) : 1.2);

    const centroid = placementCentroid(placed);
    score -=
      Math.hypot(cx - centroid.cx, cy - centroid.cy) *
      (diagonal ? 0.06 + spor * 0.08 : 0.45);

    let crowding = 0;
    for (const p of placed) {
      const dx = Math.abs(cx - p.cx);
      const dy = Math.abs(cy - p.cy);
      const minX = (w + p.w) / 2;
      const minY = (h + p.h) / 2;
      if (dx < minX && dy < minY) {
        crowding += unit * 0.45;
      }
    }
    score += crowding;
  }

  score += outerEdgeCornerPenalty(cx, cy, region, side);
  score += quadrantBalancePenalty(cx, cy, placed, region);

  // Mild pull toward the growth corner — soften when sporadic so interior forks live.
  if (diagonal) {
    const spor = mosaicGrowthSporadicity();
    const anchor = placementAnchorCenter(region);
    const dist = Math.hypot(cx - anchor.cx, cy - anchor.cy);
    const unit = Math.min(region.width, region.height);
    score += (dist / Math.max(unit, 1)) * unit * (0.1 - spor * 0.06);
  }
  return score;
}

interface Candidate {
  cx: number;
  cy: number;
  score: number;
}

function collectFirstMarkCandidates(
  _target: { cx: number; cy: number },
  w: number,
  h: number,
  region: RegionBounds,
  teamBounds: RegionBounds,
  side: TeamSide
): Candidate[] {
  const candidates: Candidate[] = [];
  const anchor = placementAnchorCenter(region);

  const push = (cx: number, cy: number) => {
    if (!rectFitsInBounds(cx, cy, w, h, teamBounds)) return;
    candidates.push({
      cx,
      cy,
      score:
        Math.hypot(cx - anchor.cx, cy - anchor.cy) +
        outerEdgeCornerPenalty(cx, cy, region, side),
    });
  };

  push(anchor.cx, anchor.cy);

  let radius = Math.max(w, h) * 0.35;
  for (let step = 0; step < 80; step++) {
    const angle = step * GOLDEN_ANGLE;
    radius += Math.max(w, h) * 0.1;
    push(anchor.cx + Math.cos(angle) * radius, anchor.cy + Math.sin(angle) * radius);
  }

  candidates.sort((a, b) => a.score - b.score);
  return candidates;
}

function collectAdjacentCandidates(
  target: { cx: number; cy: number },
  w: number,
  h: number,
  placed: PlacedRect[],
  region: RegionBounds,
  teamBounds: RegionBounds,
  side: TeamSide,
  entry?: TimedMarkEntry
): Candidate[] {
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  const spor = mosaicGrowthSporadicity();
  const rng = entry
    ? markRng(entry.mark.id.replace(/-sq\d+$/, ""), entry.mark.minute)
    : null;

  const push = (cx: number, cy: number, scoreJitter = 0) => {
    if (!rectFitsInBounds(cx, cy, w, h, teamBounds)) return;
    const key = `${Math.round(cx * 10)},${Math.round(cy * 10)}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({
      cx,
      cy,
      score:
        scoreCandidate(cx, cy, target, w, h, placed, region, side) + scoreJitter,
    });
  };

  // Prefer expanding from a random sample of already-placed marks (any asset
  // type) so shots/goals/cards fork off circles and each other — not only tip limbs.
  const parents = [...placed];
  if (rng && spor > 0.15 && parents.length > 2) {
    for (let i = parents.length - 1; i > 0; i--) {
      const j = Math.floor(randBetween(rng, 0, i + 0.999999));
      const tmp = parents[i];
      parents[i] = parents[j];
      parents[j] = tmp;
    }
  }
  const sampleFrac = spor > 0.05 ? 0.22 + spor * 0.28 : 1;
  const sampleCount = Math.max(
    1,
    Math.min(parents.length, Math.ceil(parents.length * sampleFrac))
  );
  const expandFrom = parents.slice(0, sampleCount);

  for (const p of expandFrom) {
    for (const dir of WALK_DIRS) {
      const adj = adjacentCenter(p, w, h, dir);
      push(adj.cx, adj.cy);

      if (spor > 0.05) {
        for (const slide of EDGE_SLIDES) {
          const slid = adjacentCenterSlid(p, w, h, dir, slide);
          const jitter = rng ? randBetween(rng, -spor * 8, spor * 8) : 0;
          push(slid.cx, slid.cy, jitter);
        }
      }
    }

    if (spor > 0.1) {
      for (const sx of [-1, 1] as const) {
        for (const sy of [-1, 1] as const) {
          const corner = adjacentCorner(p, w, h, sx, sy);
          const jitter = rng ? randBetween(rng, -spor * 10, spor * 10) : 0;
          push(corner.cx, corner.cy, jitter);
        }
      }

      // A few near-touch polar samples — irregular knuckles on the collage.
      const arms = 3 + Math.floor(spor * 4);
      for (let k = 0; k < arms; k++) {
        const angle =
          (rng ? randBetween(rng, 0, Math.PI * 2) : k * GOLDEN_ANGLE) +
          k * GOLDEN_ANGLE * 0.17;
        const r =
          (Math.max(p.w, p.h) + Math.max(w, h)) / 2 +
          (rng ? randBetween(rng, -4, 10) * spor : 0);
        const jitter = rng ? randBetween(rng, -spor * 12, spor * 12) : 0;
        push(p.cx + Math.cos(angle) * r, p.cy + Math.sin(angle) * r, jitter);
      }
    }
  }

  candidates.sort((a, b) => a.score - b.score);
  return candidates;
}

function spiralSearchCandidates(
  target: { cx: number; cy: number },
  w: number,
  h: number,
  placed: PlacedRect[],
  bounds: RegionBounds,
  side: TeamSide,
  requireEdgeTouch: boolean
): Candidate[] {
  const candidates: Candidate[] = [];
  const spor = mosaicGrowthSporadicity();

  let radius = Math.max(w, h) * 0.08;
  for (let step = 0; step < 240; step++) {
    const angle = step * GOLDEN_ANGLE * (1 + spor * 0.35);
    radius += Math.max(w, h) * (0.052 + spor * 0.02);
    const cx = target.cx + Math.cos(angle) * radius;
    const cy = target.cy + Math.sin(angle) * radius;
    if (!rectFitsInBounds(cx, cy, w, h, bounds)) continue;

    const probe: PlacedRect = { cx, cy, w, h, layoutScale: 1 };
    if (placed.some((other) => rectsOverlap(probe, other))) continue;
    if (requireEdgeTouch && placed.length > 0 && !touchesAny(probe, placed)) continue;

    candidates.push({
      cx,
      cy,
      score: scoreCandidate(cx, cy, target, w, h, placed, bounds, side),
    });
  }

  candidates.sort((a, b) => a.score - b.score);
  return candidates;
}

/**
 * Soft-pick among the best valid placements so growth forks randomly instead of
 * always extending the single lowest-score arm.
 */
function pickBestCandidate(
  candidates: Candidate[],
  w: number,
  h: number,
  layoutScale: number,
  placed: PlacedRect[],
  teamBounds: RegionBounds,
  requireEdgeTouch: boolean,
  entry?: TimedMarkEntry
): PlacedRect | null {
  const valid: Candidate[] = [];
  for (const c of candidates) {
    const candidate = { cx: c.cx, cy: c.cy, w, h, layoutScale };
    if (placementValid(candidate, placed, teamBounds, requireEdgeTouch)) {
      valid.push(c);
    }
  }
  if (valid.length === 0) return null;

  const spor = mosaicGrowthSporadicity();
  if (spor <= 0.05 || !entry || valid.length === 1) {
    const c = valid[0];
    return { cx: c.cx, cy: c.cy, w, h, layoutScale };
  }

  const poolSize = Math.min(
    valid.length,
    2 + Math.round(spor * 7)
  );
  const pool = valid.slice(0, poolSize);
  const rng = markRng(entry.mark.id.replace(/-sq\d+$/, ""), entry.mark.minute + 17);
  // Softmax over inverted scores — better scores more likely, weaker still viable.
  const best = pool[0].score;
  const weights = pool.map((c) => {
    const delta = c.score - best;
    const base = Math.exp(
      -delta / Math.max(8, Math.abs(best) * 0.15 + 1)
    );
    return Math.pow(base, 1.15 - spor * 0.55);
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  let pick = randBetween(rng, 0, sum);
  for (let i = 0; i < pool.length; i++) {
    pick -= weights[i];
    if (pick <= 0) {
      const c = pool[i];
      return { cx: c.cx, cy: c.cy, w, h, layoutScale };
    }
  }
  const c = pool[pool.length - 1];
  return { cx: c.cx, cy: c.cy, w, h, layoutScale };
}

function placeMarkInLayout(
  index: number,
  ordered: TimedMarkEntry[],
  baseDims: MarkPixelDims[],
  region: RegionBounds,
  teamBounds: RegionBounds,
  layoutScales: number[],
  maxMinute: number,
  side: TeamSide,
  placed: PlacedRect[],
  requireEdgeTouch: boolean
): PlacedRect | null {
  const total = ordered.length;
  const entry = ordered[index];
  const { w, h, layoutScale } = dimsAt(baseDims[index], layoutScales[index]);
  const target = temporalTarget(entry, index, total, region, side, maxMinute);

  let candidates =
    index === 0
      ? collectFirstMarkCandidates(target, w, h, region, teamBounds, side)
      : collectAdjacentCandidates(
          target,
          w,
          h,
          placed,
          region,
          teamBounds,
          side,
          entry
        );

  let found = pickBestCandidate(
    candidates,
    w,
    h,
    layoutScale,
    placed,
    teamBounds,
    index > 0 && requireEdgeTouch,
    entry
  );

  if (!found && index > 0) {
    candidates = spiralSearchCandidates(
      target,
      w,
      h,
      placed,
      teamBounds,
      side,
      false
    );
    found = pickBestCandidate(
      candidates,
      w,
      h,
      layoutScale,
      placed,
      teamBounds,
      requireEdgeTouch,
      entry
    );
  }

  return found;
}

function guidedMosaicLayout(
  ordered: TimedMarkEntry[],
  baseDims: MarkPixelDims[],
  region: RegionBounds,
  teamBounds: RegionBounds,
  layoutScales: number[],
  maxMinute: number,
  side: TeamSide,
  requireEdgeTouch: boolean
): PlacedRect[] | null {
  const placed: PlacedRect[] = [];

  for (let i = 0; i < ordered.length; i++) {
    const found = placeMarkInLayout(
      i,
      ordered,
      baseDims,
      region,
      teamBounds,
      layoutScales,
      maxMinute,
      side,
      placed,
      requireEdgeTouch
    );
    if (!found) return null;
    placed.push(found);
  }

  return placed;
}

function spiralPackNoOverlap(
  ordered: TimedMarkEntry[],
  baseDims: MarkPixelDims[],
  teamBounds: RegionBounds,
  layoutScales: number[],
  minMarkPx: number,
  maxMinute: number,
  side: TeamSide
): PlacedRect[] | null {
  const placed: PlacedRect[] = [];
  const results: PlacedRect[] = new Array(ordered.length);

  for (let i = 0; i < ordered.length; i++) {
    const target = temporalTarget(
      ordered[i],
      i,
      ordered.length,
      teamBounds,
      side,
      maxMinute
    );
    let scale = layoutScales[i];
    let found: PlacedRect | null = null;
    const stepBudget = activePlacementLayout?.diagonalSplit ? 120 : 500;
    const microBudget = activePlacementLayout?.diagonalSplit ? 160 : 800;
    const anchorBudget = activePlacementLayout?.diagonalSplit ? 120 : 600;

    // Sporadic adjacent forks first (all asset types) — spiral is fallback only.
    if (mosaicGrowthSporadicity() > 0.05) {
      let forkScale = scale;
      while (
        !found &&
        markMinDimension(baseDims[i], forkScale) >= minMarkPx * 0.8
      ) {
        const scales = layoutScales.map((s, idx) => (idx === i ? forkScale : s));
        found = placeMarkInLayout(
          i,
          ordered,
          baseDims,
          teamBounds,
          teamBounds,
          scales,
          maxMinute,
          side,
          placed,
          false
        );
        if (!found) forkScale *= 0.88;
      }
    }

    while (
      !found &&
      markMinDimension(baseDims[i], scale) >= minMarkPx * 0.8
    ) {
      const { w, h } = dimsAt(baseDims[i], scale);
      let radius = Math.max(w, h) * 0.25;
      for (let step = 0; step < stepBudget; step++) {
        const angle = (i + 1) * GOLDEN_ANGLE + step * GOLDEN_ANGLE * 0.29;
        radius += Math.max(w, h) * 0.038;
        const cx = target.cx + Math.cos(angle) * radius;
        const cy = target.cy + Math.sin(angle) * radius;
        const candidate = { cx, cy, w, h, layoutScale: scale };
        if (placementValid(candidate, placed, teamBounds, false)) {
          found = candidate;
          break;
        }
      }
      if (!found) scale *= 0.88;
    }

    if (!found) {
      let microScale = Math.max(
        minMarkPx / Math.min(baseDims[i].widthPx, baseDims[i].heightPx),
        0.025
      );
      while (!found && microScale >= 0.025) {
        const { w, h } = dimsAt(baseDims[i], microScale);
        for (let step = 0; step < microBudget; step++) {
          const angle = (i + 1) * GOLDEN_ANGLE + step * GOLDEN_ANGLE * 0.21;
          const r = Math.max(w, h) * (0.4 + step * 0.06);
          const cx = target.cx + Math.cos(angle) * r;
          const cy = target.cy + Math.sin(angle) * r;
          const candidate = { cx, cy, w, h, layoutScale: microScale };
          if (placementValid(candidate, placed, teamBounds, false)) {
            found = candidate;
            break;
          }
        }
        microScale *= 0.82;
      }
    }

    if (!found) {
      const floorScale = Math.max(
        minMarkPx / Math.min(baseDims[i].widthPx, baseDims[i].heightPx),
        0.025
      );
      const { w, h } = dimsAt(baseDims[i], floorScale);
      const anchor = placementAnchorCenter(teamBounds);
      for (let step = 0; step < anchorBudget; step++) {
        const angle = (i + 1) * GOLDEN_ANGLE + step * GOLDEN_ANGLE * 0.25;
        const r = Math.max(w, h) * (0.15 + step * 0.045);
        const cx = anchor.cx + Math.cos(angle) * r;
        const cy = anchor.cy + Math.sin(angle) * r;
        const candidate = { cx, cy, w, h, layoutScale: floorScale };
        if (placementValid(candidate, placed, teamBounds, false)) {
          found = candidate;
          break;
        }
      }
    }

    if (!found) return null;

    results[i] = found;
    placed.push(found);
  }

  return layoutHasOverlaps(results) ? null : results;
}

function tryPlaceWithScales(
  ordered: TimedMarkEntry[],
  baseDims: MarkPixelDims[],
  region: RegionBounds,
  teamBounds: RegionBounds,
  layoutScales: number[],
  maxMinute: number,
  side: TeamSide,
  requireEdgeTouch: boolean
): PlacedRect[] | null {
  return guidedMosaicLayout(
    ordered,
    baseDims,
    region,
    teamBounds,
    layoutScales,
    maxMinute,
    side,
    requireEdgeTouch
  );
}

function repairOverlaps(
  rects: PlacedRect[],
  teamBounds: RegionBounds
): PlacedRect[] {
  const fixed = rects.map((r) => ({ ...r }));
  const anchor = placementAnchorCenter(teamBounds);

  for (let iter = 0; iter < 800; iter++) {
    if (!layoutHasOverlaps(fixed)) break;

    let repaired = false;
    for (let j = 0; j < fixed.length; j++) {
      for (let i = 0; i < j; i++) {
        if (!rectsOverlap(fixed[i], fixed[j], 0)) continue;

        const dx = fixed[j].cx - fixed[i].cx || 1;
        const dy = fixed[j].cy - fixed[i].cy || 0.01;
        const dist = Math.hypot(dx, dy) || 1;
        const push = Math.max(fixed[i].w, fixed[j].w, fixed[i].h, fixed[j].h) * 0.12 + 2;

        for (const [idx, sign] of [[i, -1], [j, 1]] as const) {
          const current = fixed[idx];
          const others = fixed.filter((_, k) => k !== idx);
          const cx = current.cx + (dx / dist) * push * sign;
          const cy = current.cy + (dy / dist) * push * sign;
          const clamped = clampCenterToBounds(cx, cy, current.w, current.h, teamBounds);
          const candidate = { ...current, cx: clamped.cx, cy: clamped.cy };
          if (placementValid(candidate, others, teamBounds, false)) {
            fixed[idx] = candidate;
            repaired = true;
          }
        }
      }

      const others = fixed.filter((_, idx) => idx !== j);
      const current = fixed[j];
      if (others.every((o) => !rectsOverlap(current, o, 0))) continue;

      for (let step = 0; step < 200; step++) {
        const angle = j * GOLDEN_ANGLE + step * GOLDEN_ANGLE * 0.33;
        const r = Math.max(current.w, current.h) * (0.35 + step * 0.065);
        const cx = anchor.cx + Math.cos(angle) * r;
        const cy = anchor.cy + Math.sin(angle) * r;
        const candidate = { ...current, cx, cy };
        if (placementValid(candidate, others, teamBounds, false)) {
          fixed[j] = candidate;
          repaired = true;
          break;
        }
      }
    }

    if (!repaired) break;
  }

  return fixed;
}

function layoutHasOverlaps(rects: PlacedRect[]): boolean {
  for (let i = 0; i < rects.length; i++) {
    if (rects[i].w <= 0 || rects[i].h <= 0) continue;
    for (let j = i + 1; j < rects.length; j++) {
      if (rects[j].w <= 0 || rects[j].h <= 0) continue;
      if (rectsOverlap(rects[i], rects[j], 0)) return true;
    }
  }
  return false;
}

function allRectsFitBounds(rects: PlacedRect[], bounds: RegionBounds): boolean {
  return rects.every(
    (r) => r.w <= 0 || r.h <= 0 || rectFitsInBounds(r.cx, r.cy, r.w, r.h, bounds)
  );
}

function renderSizedRects(
  rects: PlacedRect[],
  baseDims: MarkPixelDims[],
  mosaicScale: number
): PlacedRect[] {
  return rects.map((r, i) => ({
    ...r,
    w: baseDims[i].widthPx * mosaicScale,
    h: baseDims[i].heightPx * mosaicScale,
    layoutScale: mosaicScale,
  }));
}

function mosaicHasEdgeConnectivity(rects: PlacedRect[]): boolean {
  const visible = rects.filter((r) => r.w > 0 && r.h > 0);
  if (visible.length <= 1) return true;
  for (let i = 0; i < visible.length; i++) {
    const others = visible.filter((_, idx) => idx !== i);
    if (!touchesAny(visible[i], others)) return false;
  }
  return true;
}

function mosaicLayoutValid(
  rects: PlacedRect[],
  baseDims: MarkPixelDims[],
  mosaicScale: number,
  teamBounds: RegionBounds,
  layout: PosterLayout,
  side: TeamSide
): boolean {
  if (rects.length === 0) return false;
  void baseDims;
  void mosaicScale;

  if (layoutHasOverlaps(rects)) return false;
  if (!allRectsFitBounds(rects, teamBounds)) return false;

  if (layout.diagonalSplit) {
    for (const r of rects) {
      if (r.w <= 0 || r.h <= 0) continue;
      if (!markClearsDiagonal(r.cx, r.cy, r.w, r.h, layout, side)) return false;
    }
  }

  // Edge connectivity is enforced in postProcess — don't fail the whole scale
  // search on it (that caused multi-minute freezes when packs got dense).
  return true;
}

/**
 * Keep possession circles from sharing AABB with any other mark.
 * Prefer relocating the other mark; relocate or hide the circle if needed.
 */
function enforcePossessionClearance(
  rects: PlacedRect[],
  ordered: TimedMarkEntry[],
  teamBounds: RegionBounds
): PlacedRect[] {
  const fixed = rects.map((r) => ({ ...r }));
  const anchor = placementAnchorCenter(teamBounds);

  function tryRelocate(
    moveIdx: number,
    others: PlacedRect[]
  ): PlacedRect | null {
    const moving = fixed[moveIdx];
    for (let step = 0; step < 320; step++) {
      const angle = (moveIdx + 1) * GOLDEN_ANGLE + step * GOLDEN_ANGLE * 0.31;
      const r = Math.max(moving.w, moving.h) * (0.2 + step * 0.05);
      const cx = anchor.cx + Math.cos(angle) * r;
      const cy = anchor.cy + Math.sin(angle) * r;
      const candidate = { ...moving, cx, cy };
      if (placementValid(candidate, others, teamBounds, false)) {
        return candidate;
      }
    }
    return null;
  }

  for (let iter = 0; iter < 80; iter++) {
    let hit = false;
    for (let i = 0; i < fixed.length; i++) {
      if (!isPossessionComponent(ordered[i].component)) continue;
      if (fixed[i].w <= 0 || fixed[i].h <= 0) continue;

      for (let j = 0; j < fixed.length; j++) {
        if (i === j || fixed[j].w <= 0 || fixed[j].h <= 0) continue;
        if (!rectsOverlap(fixed[i], fixed[j], 0)) continue;
        hit = true;

        const othersWithout = (skip: number) =>
          fixed.filter((_, k) => k !== skip && fixed[k].w > 0 && fixed[k].h > 0);

        // Prefer relocating a non-circle; otherwise the other circle.
        const preferMove = isPossessionComponent(ordered[j].component) ? j : j;
        const relocated = tryRelocate(preferMove, othersWithout(preferMove));
        if (relocated) {
          fixed[preferMove] = relocated;
          continue;
        }

        if (!isPossessionComponent(ordered[j].component)) {
          const circleMoved = tryRelocate(i, othersWithout(i));
          if (circleMoved) {
            fixed[i] = circleMoved;
            continue;
          }
          // Keep the event; hide the circle rather than leave an overlap.
          fixed[i] = { ...fixed[i], w: 0, h: 0, layoutScale: 0 };
        } else {
          fixed[j] = { ...fixed[j], w: 0, h: 0, layoutScale: 0 };
        }
      }
    }
    if (!hit) break;
  }

  return fixed;
}

function postProcessMosaic(
  rects: PlacedRect[],
  teamBounds: RegionBounds,
  ordered: TimedMarkEntry[] = []
): PlacedRect[] {
  let fixed = rects.map((r) => ({ ...r }));

  for (let pass = 0; pass < 6; pass++) {
    fixed = repairOverlaps(fixed, teamBounds);
    if (!layoutHasOverlaps(fixed)) break;
  }

  if (!activePlacementLayout?.diagonalSplit) return fixed;

  const possMin = possessionMosaicMinPx();

  // Cap attempts — shrink + re-snap, but never grind for seconds on fail.
  for (let attempt = 0; attempt < 8; attempt++) {
    fixed = enforceEdgeTouches(fixed, teamBounds);
    fixed = connectIsolatedMarks(fixed, teamBounds);
    fixed = repairOverlaps(fixed, teamBounds);

    const ok =
      !layoutHasOverlaps(fixed) &&
      mosaicHasEdgeConnectivity(fixed) &&
      allRectsFitBounds(fixed, teamBounds);
    if (ok) return fixed;

    fixed = fixed.map((r, i) => {
      // Possession circles stay at ≥ min diameter — shrink events only.
      if (ordered[i] && isPossessionComponent(ordered[i].component)) {
        const short = Math.min(r.w, r.h);
        if (short <= possMin * 1.02) return r;
      }
      const w = r.w * 0.94;
      const h = r.h * 0.94;
      const clamped = clampCenterToBounds(r.cx, r.cy, w, h, teamBounds);
      return {
        ...r,
        cx: clamped.cx,
        cy: clamped.cy,
        w,
        h,
        layoutScale: r.layoutScale * 0.94,
      };
    });
  }

  fixed = enforceEdgeTouches(fixed, teamBounds);
  fixed = connectIsolatedMarks(fixed, teamBounds);
  fixed = repairOverlaps(fixed, teamBounds);
  return fixed;
}

function placeAllMarks(
  ordered: TimedMarkEntry[],
  baseDims: MarkPixelDims[],
  region: RegionBounds,
  teamBounds: RegionBounds,
  side: TeamSide,
  layout: PosterLayout,
  minMarkPx: number
): PlacedRect[] {
  return runWithPlacementContext(layout, side, () => {
    const maxMinute = maxMinuteForEntries(ordered);
    let rects = layoutInRegion(ordered, baseDims, region, teamBounds, side, layout);

    if (rects.length < ordered.length) {
      rects = guaranteeAllMarksPlaced(
        ordered,
        baseDims,
        region,
        teamBounds,
        side,
        maxMinute,
        minMarkPx
      );
    }

    const placedSoFar: PlacedRect[] = [];
    const results: PlacedRect[] = [];
    for (let i = 0; i < ordered.length; i++) {
      const floorPx = isPossessionComponent(ordered[i].component)
        ? possessionMosaicMinPx()
        : minMarkPx;
      let next =
        rects[i] ??
        forcePlaceMarkAtTarget(
          ordered[i],
          i,
          ordered.length,
          baseDims[i],
          teamBounds,
          region,
          side,
          maxMinute,
          placedSoFar,
          floorPx
        );
      next = clampRectToMinVisible(next, baseDims[i], floorPx);
      if (next.w > baseDims[i].widthPx * 1.01 || next.h > baseDims[i].heightPx * 1.01) {
        next = {
          ...next,
          w: baseDims[i].widthPx,
          h: baseDims[i].heightPx,
          layoutScale: 1,
        };
      }

      // Clamp-to-min can reintroduce overlaps — relocate at the floor size.
      if (
        next.w > 0 &&
        next.h > 0 &&
        placedSoFar.some((other) => rectsOverlap(next, other, 0))
      ) {
        const anchor = placementAnchorCenter(teamBounds);
        let found: PlacedRect | null = null;
        for (let step = 0; step < 500 && !found; step++) {
          const angle = (i + 1) * GOLDEN_ANGLE + step * GOLDEN_ANGLE * 0.29;
          const r = Math.max(next.w, next.h) * (0.15 + step * 0.048);
          const cx = anchor.cx + Math.cos(angle) * r;
          const cy = anchor.cy + Math.sin(angle) * r;
          const candidate = {
            cx,
            cy,
            w: next.w,
            h: next.h,
            layoutScale: next.layoutScale,
          };
          if (placementValid(candidate, placedSoFar, teamBounds, false)) {
            found = candidate;
          }
        }
        if (found) {
          next = found;
        } else if (isPossessionComponent(ordered[i].component)) {
          next = { cx: next.cx, cy: next.cy, w: 0, h: 0, layoutScale: 0 };
        }
      }

      if (next.w > 0 && next.h > 0) placedSoFar.push(next);
      results.push(next);
    }
    return results;
  });
}

function layoutBoundingBox(rects: PlacedRect[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.cx - r.w / 2);
    minY = Math.min(minY, r.cy - r.h / 2);
    maxX = Math.max(maxX, r.cx + r.w / 2);
    maxY = Math.max(maxY, r.cy + r.h / 2);
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/** Disabled — outward position scaling pushed marks to canvas edges with large gaps. */
function expandLayoutToFillBounds(
  rects: PlacedRect[],
  _bounds: RegionBounds,
  _markCount: number
): PlacedRect[] {
  return rects;
}

function maxMinuteForEntries(ordered: TimedMarkEntry[]): number {
  let max = 90;
  for (const entry of ordered) {
    max = Math.max(max, entry.mark.minute);
  }
  return max;
}

function markLooksUnplaced(mark: LayoutMark): boolean {
  return mark.nx === 0 && mark.ny === 0 && mark.layoutScale === 1;
}

function resolvedSettledStartIndex(
  ordered: TimedMarkEntry[],
  settled: number
): number {
  let start = Math.min(Math.max(0, settled), ordered.length);
  while (start > 0 && markLooksUnplaced(ordered[start - 1].mark)) {
    start--;
  }
  return start;
}

function placementStartIndex(
  ordered: TimedMarkEntry[],
  settled: number
): number {
  let start = resolvedSettledStartIndex(ordered, settled);
  for (let i = 0; i < ordered.length; i++) {
    if (markLooksUnplaced(ordered[i].mark)) {
      start = Math.min(start, i);
      break;
    }
  }
  return start;
}

/** Guaranteed placement at the golden-angle target — never drops a mark. */
function forcePlaceMarkAtTarget(
  entry: TimedMarkEntry,
  index: number,
  total: number,
  base: MarkPixelDims,
  teamBounds: RegionBounds,
  region: RegionBounds,
  side: TeamSide,
  maxMinute: number,
  placed: PlacedRect[],
  minMarkPx: number
): PlacedRect {
  const target = temporalTarget(entry, index, total, region, side, maxMinute);
  let scale = eventMarksConfig.crowdedScaleMin;

  while (scale >= 0.025) {
    const { w, h, layoutScale } = dimsAt(base, scale);
    let radius = 0;
    for (let step = 0; step < 600; step++) {
      const angle = (index + 1) * GOLDEN_ANGLE + step * GOLDEN_ANGLE * 0.27;
      radius += Math.max(w, h) * 0.038;
      const cx = target.cx + Math.cos(angle) * radius;
      const cy = target.cy + Math.sin(angle) * radius;
      const candidate = { cx, cy, w, h, layoutScale };
      if (placementValid(candidate, placed, teamBounds, false)) {
        return candidate;
      }
    }
    scale *= 0.85;
  }

  const floorScale = Math.max(
    minMarkPx / Math.min(base.widthPx, base.heightPx),
    0.025
  );
  const { w, h, layoutScale } = dimsAt(base, floorScale);
  const anchor = placementAnchorCenter(teamBounds);
  for (let step = 0; step < 400; step++) {
    const angle = (index + 1) * GOLDEN_ANGLE + step * GOLDEN_ANGLE * 0.31;
    const r = Math.max(w, h) * (0.2 + step * 0.055);
    const cx = anchor.cx + Math.cos(angle) * r;
    const cy = anchor.cy + Math.sin(angle) * r;
    const clamped = clampCenterToBounds(cx, cy, w, h, teamBounds);
    const candidate = { cx: clamped.cx, cy: clamped.cy, w, h, layoutScale };
    if (placementValid(candidate, placed, teamBounds, false)) {
      return candidate;
    }
  }

  for (let step = 0; step < 600; step++) {
    const angle = (index + 1) * GOLDEN_ANGLE + step * GOLDEN_ANGLE * 0.27;
    const r = Math.max(w, h) * (0.08 + step * 0.042);
    const cx = anchor.cx + Math.cos(angle) * r;
    const cy = anchor.cy + Math.sin(angle) * r;
    const clamped = clampCenterToBounds(cx, cy, w, h, teamBounds);
    const candidate = { cx: clamped.cx, cy: clamped.cy, w, h, layoutScale };
    if (placementValid(candidate, placed, teamBounds, false)) {
      return candidate;
    }
  }

  const offsetY = index * h * 0.85;
  const clamped = clampCenterToBounds(anchor.cx, anchor.cy + offsetY, w, h, teamBounds);
  const layout = activePlacementLayout;
  if (layout?.diagonalSplit) {
    // Last resort under diagonal: park at the growth corner and shrink until
    // the bbox clears the seam — never drop across into the other team.
    // Possession circles refuse to shrink below possessionMosaicMinPx.
    const floorCap = isPossessionComponent(entry.component)
      ? Math.max(floorScale, possessionMosaicMinPx() / Math.min(base.widthPx, base.heightPx))
      : 0.02;
    let parkScale = floorScale;
    while (parkScale >= floorCap) {
      const parkedDims = dimsAt(base, parkScale);
      const parked = clampCenterToBounds(
        anchor.cx,
        anchor.cy,
        parkedDims.w,
        parkedDims.h,
        teamBounds
      );
      const candidate = {
        cx: parked.cx,
        cy: parked.cy,
        w: parkedDims.w,
        h: parkedDims.h,
        layoutScale: parkedDims.layoutScale,
      };
      if (
        markClearsDiagonal(candidate.cx, candidate.cy, candidate.w, candidate.h, layout, side) &&
        !placed.some((other) => rectsOverlap(candidate, other, 0))
      ) {
        return candidate;
      }
      parkScale *= 0.85;
    }

    // Dense in-triangle scan at the size floor — never return an overlapping rect.
    const scanScale = Math.max(floorScale, floorCap);
    const { w: sw, h: sh, layoutScale: sls } = dimsAt(base, scanScale);
    const cols = 28;
    const rows = 28;
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const cx = teamBounds.left + ((gx + 0.5) / cols) * teamBounds.width;
        const cy = teamBounds.top + ((gy + 0.5) / rows) * teamBounds.height;
        const candidate = { cx, cy, w: sw, h: sh, layoutScale: sls };
        if (placementValid(candidate, placed, teamBounds, false)) {
          return candidate;
        }
      }
    }

    // Possession must stay ≥ min and never overlap — hide rather than collide.
    if (isPossessionComponent(entry.component)) {
      return { cx: anchor.cx, cy: anchor.cy, w: 0, h: 0, layoutScale: 0 };
    }
  }
  // Legacy non-diagonal fallback (may overlap as absolute last resort).
  return { cx: clamped.cx, cy: clamped.cy, w, h, layoutScale };
}

/** Spiral search around a mark's temporal target — used for one new mark only. */
function placeSingleMarkSpiral(
  entry: TimedMarkEntry,
  index: number,
  total: number,
  base: MarkPixelDims,
  teamBounds: RegionBounds,
  region: RegionBounds,
  side: TeamSide,
  maxMinute: number,
  placed: PlacedRect[],
  initialScale: number,
  minMarkPx: number
): PlacedRect | null {
  const target = temporalTarget(entry, index, total, region, side, maxMinute);
  let scale = initialScale;

  while (markMinDimension(base, scale) >= minMarkPx * 0.8) {
    const { w, h, layoutScale } = dimsAt(base, scale);
    let radius = Math.max(w, h) * 0.2;
    for (let step = 0; step < 400; step++) {
      const angle = (index + 1) * GOLDEN_ANGLE + step * GOLDEN_ANGLE * 0.31;
      radius += Math.max(w, h) * 0.045;
      const cx = target.cx + Math.cos(angle) * radius;
      const cy = target.cy + Math.sin(angle) * radius;
      const candidate = { cx, cy, w, h, layoutScale };
      if (placementValid(candidate, placed, teamBounds, false)) {
        return candidate;
      }
    }
    scale *= 0.88;
  }

  return null;
}

/**
 * Grow the mosaic chronologically — settled marks keep their positions;
 * only new marks spiral outward from the golden-angle target.
 */
function incrementalGuidedLayout(
  ordered: TimedMarkEntry[],
  baseDims: MarkPixelDims[],
  region: RegionBounds,
  teamBounds: RegionBounds,
  weights: number[],
  maxMinute: number,
  side: TeamSide,
  layout: PosterLayout,
  startIndex: number
): PlacedRect[] | null {
  const { minMarkPx } = eventMarksConfig;
  const preferEdgeTouch = mosaicGrowthSporadicity() > 0.35 ? false : true;
  const placed: PlacedRect[] = [];
  const results: PlacedRect[] = new Array(ordered.length);

  for (let i = 0; i < startIndex; i++) {
    if (markLooksUnplaced(ordered[i].mark)) {
      return incrementalGuidedLayout(
        ordered,
        baseDims,
        region,
        teamBounds,
        weights,
        maxMinute,
        side,
        layout,
        i
      );
    }
    const rect = obstacleRectFromMark(ordered[i].mark, baseDims[i], layout);
    results[i] = rect;
    placed.push(rect);
  }

  for (let i = startIndex; i < ordered.length; i++) {
    let scale = weights[i];
    let found: PlacedRect | null = null;

    while (!found && markMinDimension(baseDims[i], scale) >= minMarkPx * 0.8) {
      const layoutScales = weights.map((w, idx) => {
        if (idx < i) return results[idx]!.layoutScale;
        if (idx === i) return scale;
        return w;
      });
      found = placeMarkInLayout(
        i,
        ordered,
        baseDims,
        region,
        teamBounds,
        layoutScales,
        maxMinute,
        side,
        placed,
        i > 0 && preferEdgeTouch
      );
      if (!found) scale *= 0.88;
    }

    if (!found) {
      found = placeSingleMarkSpiral(
        ordered[i],
        i,
        ordered.length,
        baseDims[i],
        teamBounds,
        region,
        side,
        maxMinute,
        placed,
        weights[i],
        minMarkPx
      );
    }

    if (!found) {
      found = forcePlaceMarkAtTarget(
        ordered[i],
        i,
        ordered.length,
        baseDims[i],
        teamBounds,
        region,
        side,
        maxMinute,
        placed,
        minMarkPx
      );
    }

    results[i] = found;
    placed.push(found);
  }

  return results;
}

/** Repair overlaps without moving marks that were already settled. */
function repairOverlapsFromIndex(
  rects: PlacedRect[],
  teamBounds: RegionBounds,
  startIndex: number
): PlacedRect[] {
  if (startIndex <= 0) return repairOverlaps(rects, teamBounds);

  const fixed = rects.map((r) => ({ ...r }));
  const anchor = placementAnchorCenter(teamBounds);

  for (let iter = 0; iter < 300; iter++) {
    if (!layoutHasOverlaps(fixed)) break;

    let repaired = false;
    for (let j = Math.max(1, startIndex); j < fixed.length; j++) {
      for (let i = 0; i < j; i++) {
        if (!rectsOverlap(fixed[i], fixed[j], 0)) continue;

        const dx = fixed[j].cx - fixed[i].cx || 1;
        const dy = fixed[j].cy - fixed[i].cy || 0.01;
        const dist = Math.hypot(dx, dy) || 1;
        const push =
          Math.max(fixed[i].w, fixed[j].w, fixed[i].h, fixed[j].h) * 0.12 + 2;

        const current = fixed[j];
        const others = fixed.filter((_, k) => k !== j);
        const cx = current.cx + (dx / dist) * push;
        const cy = current.cy + (dy / dist) * push;
        const clamped = clampCenterToBounds(cx, cy, current.w, current.h, teamBounds);
        const candidate = { ...current, cx: clamped.cx, cy: clamped.cy };
        if (placementValid(candidate, others, teamBounds, false)) {
          fixed[j] = candidate;
          repaired = true;
        }
      }

      const others = fixed.filter((_, idx) => idx !== j);
      const current = fixed[j];
      if (others.every((o) => !rectsOverlap(current, o, 0))) continue;

      for (let step = 0; step < 200; step++) {
        const angle = j * GOLDEN_ANGLE + step * GOLDEN_ANGLE * 0.33;
        const r = Math.max(current.w, current.h) * (0.35 + step * 0.065);
        const cx = anchor.cx + Math.cos(angle) * r;
        const cy = anchor.cy + Math.sin(angle) * r;
        const candidate = { ...current, cx, cy };
        if (placementValid(candidate, others, teamBounds, false)) {
          fixed[j] = candidate;
          repaired = true;
          break;
        }
      }
    }

    if (!repaired) break;
  }

  return fixed;
}

function layoutInRegion(
  ordered: TimedMarkEntry[],
  baseDims: MarkPixelDims[],
  region: RegionBounds,
  teamBounds: RegionBounds,
  side: TeamSide,
  layout: PosterLayout
): PlacedRect[] {
  const { minMarkPx } = eventMarksConfig;
  const weights = randomPerMarkWeights(ordered);
  const maxMinute = maxMinuteForEntries(ordered);

  // Diagonal packs get dense (possession + events). Cap work hard — the old
  // spiral rescue loops (80 + 40 attempts) froze match pages for minutes.
  if (layout.diagonalSplit) {
    const layoutScales = layoutScalesFromWeights(weights, 1);
    const aesthetic = tryPlaceWithScales(
      ordered,
      baseDims,
      region,
      teamBounds,
      layoutScales,
      maxMinute,
      side,
      false
    );
    if (aesthetic && !layoutHasOverlaps(aesthetic)) {
      return repairOverlaps(aesthetic, teamBounds);
    }

    let globalMult = 0.85;
    for (let attempt = 0; attempt < 5; attempt++) {
      const scales = layoutScalesFromWeights(weights, globalMult);
      const packed = spiralPackNoOverlap(
        ordered,
        baseDims,
        teamBounds,
        scales,
        minMarkPx,
        maxMinute,
        side
      );
      if (packed) return repairOverlaps(packed, teamBounds);
      globalMult *= 0.75;
    }

    return repairOverlaps(
      guaranteeAllMarksPlaced(
        ordered,
        baseDims,
        region,
        teamBounds,
        side,
        maxMinute,
        minMarkPx
      ),
      teamBounds
    );
  }

  const preferEdgeTouch = false;
  let globalMult = 1;

  for (let attempt = 0; attempt < 80; attempt++) {
    const layoutScales = layoutScalesFromWeights(weights, globalMult);
    if (smallestMinDim(baseDims, layoutScales) < minMarkPx * 0.8) break;

    const aesthetic = tryPlaceWithScales(
      ordered,
      baseDims,
      region,
      teamBounds,
      layoutScales,
      maxMinute,
      side,
      preferEdgeTouch
    );

    if (aesthetic && !layoutHasOverlaps(aesthetic)) {
      const expanded = expandLayoutToFillBounds(aesthetic, teamBounds, ordered.length);
      const candidate = layoutHasOverlaps(expanded) ? aesthetic : expanded;
      return repairOverlaps(candidate, teamBounds);
    }

    const packed = spiralPackNoOverlap(
      ordered,
      baseDims,
      teamBounds,
      layoutScales,
      minMarkPx,
      maxMinute,
      side
    );
    if (packed) {
      const expanded = expandLayoutToFillBounds(packed, teamBounds, ordered.length);
      const candidate = layoutHasOverlaps(expanded) ? packed : expanded;
      return repairOverlaps(candidate, teamBounds);
    }

    globalMult *= 0.88;
  }

  for (let rescue = 0; rescue < 40; rescue++) {
    const mult = Math.pow(0.88, 80 + rescue);
    const layoutScales = layoutScalesFromWeights(weights, mult);
    const packed = spiralPackNoOverlap(
      ordered,
      baseDims,
      teamBounds,
      layoutScales,
      minMarkPx,
      maxMinute,
      side
    );
    if (packed) {
      return repairOverlaps(packed, teamBounds);
    }
  }

  return repairOverlaps(
    spiralPackNoOverlap(
      ordered,
      baseDims,
      teamBounds,
      layoutScalesFromWeights(
        weights,
        minMarkPx / smallestMinDim(baseDims, weights)
      ),
      minMarkPx,
      maxMinute,
      side
    ) ??
      guaranteeAllMarksPlaced(
        ordered,
        baseDims,
        region,
        teamBounds,
        side,
        maxMinute,
        minMarkPx
      ),
    teamBounds
  );
}

/** Last resort — place every mark via golden spiral; never drop an asset. */
function guaranteeAllMarksPlaced(
  ordered: TimedMarkEntry[],
  baseDims: MarkPixelDims[],
  region: RegionBounds,
  teamBounds: RegionBounds,
  side: TeamSide,
  maxMinute: number,
  minMarkPx: number
): PlacedRect[] {
  const placed: PlacedRect[] = [];
  const results: PlacedRect[] = [];

  for (let i = 0; i < ordered.length; i++) {
    const floorPx = isPossessionComponent(ordered[i].component)
      ? possessionMosaicMinPx()
      : minMarkPx;
    let rect = forcePlaceMarkAtTarget(
      ordered[i],
      i,
      ordered.length,
      baseDims[i],
      teamBounds,
      region,
      side,
      maxMinute,
      placed,
      floorPx
    );
    if (rect.w > 0 && rect.h > 0) {
      rect = clampRectToMinVisible(rect, baseDims[i], floorPx);
    }
    results.push(rect);
    if (rect.w > 0 && rect.h > 0) placed.push(rect);
  }

  return results;
}

/**
 * Place all timed marks on one team side — chronological golden mosaic.
 */
export function relayoutTimedMarkEntries(
  entries: TimedMarkEntry[],
  side: TeamSide,
  layout: PosterLayout,
  placement: PlacementState,
  baseSizeForEntry: (
    component: VisualComponent,
    mark: LayoutMark
  ) => MarkPixelDims
): void {
  const ordered = [...entries].sort(
    (a, b) =>
      a.mark.minute - b.mark.minute || a.mark.id.localeCompare(b.mark.id)
  );
  if (ordered.length === 0) return;

  runWithPlacementContext(layout, side, () => {
  const region = teamPlacementBounds(layout, side);
  const teamBounds = teamPlacementBounds(layout, side);
  const rawDims = ordered.map(({ mark, component }) => baseSizeForEntry(component, mark));
  // Shrink marks under diagonal split so both teams fit in opposite triangles.
  // Must stay in sync with diagonalCompositionMarkScale() used at draw time.
  const diagonalScale = diagonalCompositionMarkScale(layout);
  const possMin = possessionMosaicMinPx();
  const { minMarkPx } = eventMarksConfig;
  const cell = mosaicGridCellPx();
  const gridOriginX = layout.margin;
  const gridOriginY = layout.artworkTop;
  // Possession raw dims are already floored for diagonal in markSizing — scale only.
  // Snap every mark to the mosaic grid so sizes are multiples of the cell.
  const baseDims = scaleMarkDims(rawDims, diagonalScale).map((d, i) => {
    const floorPx = isPossessionComponent(ordered[i].component)
      ? possMin
      : minMarkPx;
    const floored = floorDimsToMinPx(d, floorPx);
    if (!layout.diagonalSplit) return floored;
    const comp = ordered[i].component;
    if (
      comp === VISUAL_COMPONENT.Goal ||
      comp === VISUAL_COMPONENT.Foul ||
      comp === VISUAL_COMPONENT.Offside
    ) {
      return snapElongatedDimsToGrid(floored, cell);
    }
    return snapDimsToGrid(floored, cell);
  });
  // Scale floor ignores possession (they stay fixed ≥ possMin); only events shrink.
  const eventDims = baseDims.filter(
    (_, i) => !isPossessionComponent(ordered[i].component)
  );
  const scaleFloor =
    eventDims.length > 0 ? minMosaicScaleForMinPx(eventDims, minMarkPx) : 1;

  let mosaicScale = 1;
  let rects: PlacedRect[] = [];
  for (let scale = 1; scale >= scaleFloor; scale -= 0.02) {
    const scaledDims = dimsForMosaicScale(ordered, baseDims, scale);
    const placed = placeAllMarks(
      ordered,
      scaledDims,
      region,
      teamBounds,
      side,
      layout,
      minMarkPx
    );
    const processed = postProcessMosaic(placed, teamBounds, ordered);
    if (mosaicLayoutValid(processed, baseDims, scale, teamBounds, layout, side)) {
      mosaicScale = scale;
      rects = processed;
      break;
    }
    if (scale <= scaleFloor) {
      mosaicScale = scale;
      rects = postProcessMosaic(placed, teamBounds, ordered);
    }
  }

  if (!mosaicLayoutValid(rects, baseDims, mosaicScale, teamBounds, layout, side)) {
    for (let pass = 0; pass < 4; pass++) {
      mosaicScale = Math.max(scaleFloor, mosaicScale - 0.05);
      const scaledDims = dimsForMosaicScale(ordered, baseDims, mosaicScale);
      const candidate = postProcessMosaic(
        placeAllMarks(
          ordered,
          scaledDims,
          region,
          teamBounds,
          side,
          layout,
          minMarkPx
        ),
        teamBounds,
        ordered
      );
      if (mosaicLayoutValid(candidate, baseDims, mosaicScale, teamBounds, layout, side)) {
        rects = candidate;
        break;
      }
    }
  }

  // Final pass: possession circles must not share AABB with anything else.
  rects = enforcePossessionClearance(rects, ordered, teamBounds);

  if (layout.diagonalSplit) {
    rects = rects.map((r) =>
      snapRectToGrid(r, gridOriginX, gridOriginY, cell)
    );
    // Snap can collide — nudge on-grid until clear, prefer moving later marks.
    for (let pass = 0; pass < 12; pass++) {
      let moved = false;
      for (let i = 0; i < rects.length; i++) {
        if (rects[i].w <= 0 || rects[i].h <= 0) continue;
        const others = rects.filter(
          (_, k) => k !== i && rects[k].w > 0 && rects[k].h > 0
        );
        if (!others.some((o) => rectsOverlap(rects[i], o, 0))) continue;
        let found: PlacedRect | null = null;
        const steps = [
          [cell, 0],
          [-cell, 0],
          [0, cell],
          [0, -cell],
          [cell, cell],
          [cell, -cell],
          [-cell, cell],
          [-cell, -cell],
        ];
        for (let ring = 1; ring <= 8 && !found; ring++) {
          for (const [dx, dy] of steps) {
            const cx = rects[i].cx + dx * ring;
            const cy = rects[i].cy + dy * ring;
            const candidate = snapRectToGrid(
              { ...rects[i], cx, cy },
              gridOriginX,
              gridOriginY,
              cell
            );
            if (placementValid(candidate, others, teamBounds, false)) {
              found = candidate;
              break;
            }
          }
        }
        if (found) {
          rects[i] = found;
          moved = true;
        } else if (isPossessionComponent(ordered[i].component)) {
          rects[i] = { ...rects[i], w: 0, h: 0, layoutScale: 0 };
          moved = true;
        }
      }
      if (!moved) break;
    }
  }

  const maxMinute = maxMinuteForEntries(ordered);

  const sideList = side === "home" ? placement.home : placement.away;
  sideList.length = 0;

  for (let i = 0; i < ordered.length; i++) {
    const entry = ordered[i];
    let rect = rects[i];
    if (!rect) {
      const scaled = scaleMarkDims([baseDims[i]], mosaicScale)[0];
      rect = forcePlaceMarkAtTarget(
        entry,
        i,
        ordered.length,
        scaled,
        teamBounds,
        region,
        side,
        maxMinute,
        rects.slice(0, i).filter((r): r is PlacedRect => Boolean(r)),
        minMarkPx
      );
      rects[i] = rect;
    }

    const nx = (rect.cx - layout.margin) / Math.max(layout.artworkWidth, 1);
    const ny = (rect.cy - layout.artworkTop) / Math.max(layout.artworkHeight, 1);
    const nw = rect.w / Math.max(layout.artworkWidth, 1);
    const nh = rect.h / Math.max(layout.artworkHeight, 1);
    sideList.push({
      nx,
      ny,
      nw,
      nh,
    });

    // Draw size = raw * layoutScale * diagonalScale for uniform marks.
    // Footprint nw/nh preserves snapped+stretched boxes for Goal/Foul/Offside.
    const commitScale =
      rect.w <= 0 || rect.h <= 0
        ? 0
        : rect.w /
          Math.max(rawDims[i].widthPx * Math.max(diagonalScale, 1e-6), 1e-6);

    const footprint = { nw, nh };
    if (entry.commit) {
      entry.commit(nx, ny, commitScale, layout, footprint);
    } else {
      entry.mark.nx = nx;
      entry.mark.ny = ny;
      entry.mark.layoutScale = commitScale;
      entry.mark.layoutNw = nw;
      entry.mark.layoutNh = nh;
    }
  }

  placement.settledMarkCount[side] = ordered.length;

  const last = ordered[ordered.length - 1];
  const lastRect = rects[rects.length - 1];
  if (last && lastRect) {
    const tails = side === "home" ? placement.stackTails.home : placement.stackTails.away;
    tails.pattern = {
      nx: (lastRect.cx - layout.margin) / Math.max(layout.artworkWidth, 1),
      ny: (lastRect.cy - layout.artworkTop) / Math.max(layout.artworkHeight, 1),
      nw: normSize(lastRect.w, layout),
      nh: normSize(lastRect.h, layout),
    };
  }
  });
}

export function markCenterToPixel(
  nx: number,
  ny: number,
  layout: PosterLayout
): { cx: number; cy: number } {
  return {
    cx: layout.margin + nx * layout.artworkWidth,
    cy: layout.artworkTop + ny * layout.artworkHeight,
  };
}

export function obstacleRectFromMark(
  mark: LayoutMark,
  dims: MarkPixelDims,
  layout: PosterLayout
): PlacedRect {
  const { cx, cy } = markCenterToPixel(mark.nx, mark.ny, layout);
  const ls = mark.layoutScale || 1;
  return {
    cx,
    cy,
    w: dims.widthPx * ls,
    h: dims.heightPx * ls,
    layoutScale: ls,
  };
}
