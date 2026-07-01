import { cfg } from "@/config";
import type { VisualComponent } from "@/design-system/mapping/visualMappings";
import type { TeamSide } from "@/data/mockMatch";
import {
  gridRegionForSide,
  markRegionForSide,
  type PosterLayout,
  teamZoneForSide,
} from "@/design-system/layout/posterLayout";
import { normSize } from "@/design-system/layout/designScale";
import { randBetween } from "@/utils/seededRandom";

/** Normalized bbox relative to artwork (nx, ny = center; nw, nh = size). */
export interface PlacedBBox {
  nx: number;
  ny: number;
  nw: number;
  nh: number;
}

export interface PlacementState {
  home: PlacedBBox[];
  away: PlacedBBox[];
}

export function createPlacementState(): PlacementState {
  return { home: [], away: [] };
}

function overlapRatio(a: PlacedBBox, b: PlacedBBox): number {
  const ax0 = a.nx - a.nw / 2;
  const ax1 = a.nx + a.nw / 2;
  const ay0 = a.ny - a.nh / 2;
  const ay1 = a.ny + a.nh / 2;
  const bx0 = b.nx - b.nw / 2;
  const bx1 = b.nx + b.nw / 2;
  const by0 = b.ny - b.nh / 2;
  const by1 = b.ny + b.nh / 2;

  const ix = Math.max(0, Math.min(ax1, bx1) - Math.max(ax0, bx0));
  const iy = Math.max(0, Math.min(ay1, by1) - Math.max(ay0, by0));
  const inter = ix * iy;
  const areaA = a.nw * a.nh;
  return areaA > 0 ? inter / areaA : 0;
}

function maxOverlapWithExisting(box: PlacedBBox, existing: PlacedBBox[]): number {
  if (existing.length === 0) return 0;
  let max = 0;
  for (const placed of existing) {
    max = Math.max(max, overlapRatio(box, placed));
  }
  return max;
}

function normFromPoint(x: number, y: number, layout: PosterLayout): [number, number] {
  return [
    (x - layout.margin) / Math.max(layout.artworkWidth, 1),
    (y - layout.artworkTop) / Math.max(layout.artworkHeight, 1),
  ];
}

function pointFromNorm(nx: number, ny: number, layout: PosterLayout): [number, number] {
  return [
    layout.margin + nx * layout.artworkWidth,
    layout.artworkTop + ny * layout.artworkHeight,
  ];
}

function clampToRegion(
  x: number,
  y: number,
  layout: PosterLayout,
  side: TeamSide,
  halfW: number,
  halfH: number
): [number, number] {
  const region = markRegionForSide(layout, side);
  const pad = region.width * 0.02;
  return [
    Math.min(region.right - pad - halfW, Math.max(region.left + pad + halfW, x)),
    Math.min(region.bottom - pad - halfH, Math.max(region.top + pad + halfH, y)),
  ];
}

function innerBiasScore(
  nx: number,
  side: TeamSide,
  layout: PosterLayout,
  innerBias: number
): number {
  const zone = teamZoneForSide(layout, side);
  const t = (nx - (zone.left - layout.margin) / layout.artworkWidth) / Math.max(
    zone.width / layout.artworkWidth,
    0.001
  );
  const edgeTarget = side === "home" ? 1 : 0;
  return 1 - Math.abs(t - edgeTarget) * innerBias;
}

function pointInRegion(x: number, y: number, region: { left: number; right: number; top: number; bottom: number }): boolean {
  return x >= region.left && x <= region.right && y >= region.top && y <= region.bottom;
}

function gridCornerPenalty(
  x: number,
  y: number,
  layout: PosterLayout,
  side: TeamSide
): number {
  const grid = gridRegionForSide(layout, side);
  if (pointInRegion(x, y, grid)) return -2.5;
  return 0;
}

function timelineRowTarget(minute: number, rows: number): number {
  const band = minute <= 30 ? 0 : minute <= 60 ? 1 : 2;
  const t = (band + 0.5) / 3;
  return t * Math.max(rows - 1, 0);
}

function rowBiasScore(row: number, rows: number, rowBias: number): number {
  if (rows <= 1 || rowBias === 0) return 0;
  const rowT = row / (rows - 1);
  const target = (rowBias + 1) * 0.5;
  return (1 - Math.abs(rowT - target)) * 0.35;
}

function timelineScore(row: number, rows: number, minute: number | undefined): number {
  const weight = cfg.composition.timelineYWeight ?? 0;
  if (weight <= 0 || minute == null || rows <= 1) return 0;
  const target = timelineRowTarget(minute, rows);
  const dist = Math.abs(row - target) / Math.max(rows - 1, 1);
  return (1 - dist) * weight;
}

function cellOccupancy(
  row: number,
  col: number,
  cols: number,
  rows: number,
  existing: PlacedBBox[],
  region: ReturnType<typeof markRegionForSide>,
  layout: PosterLayout
): number {
  const cellW = region.width / cols;
  const cellH = region.height / rows;
  const cx = region.left + col * cellW + cellW * 0.5;
  const cy = region.top + row * cellH + cellH * 0.5;
  const [nx, ny] = normFromPoint(cx, cy, layout);

  let count = 0;
  for (const box of existing) {
    const dx = Math.abs(box.nx - nx);
    const dy = Math.abs(box.ny - ny);
    if (dx < box.nw * 0.55 && dy < box.nh * 0.55) count++;
  }
  return count;
}

function overlapSteps(): number[] {
  const configured = cfg.composition.placementOverlapSteps;
  const max = cfg.composition.maxOverlapRatio;
  const steps = configured?.length ? [...configured] : [0, max * 0.25, max * 0.5, max];
  if (steps[steps.length - 1] !== max) {
    steps.push(max);
  }
  return steps;
}

function profileFor(component: VisualComponent | undefined) {
  if (!component) return undefined;
  return cfg.composition.eventPlacementProfiles[component];
}

export interface FindPlacementOptions {
  innerBias?: number;
  seed?: number;
  preferCell?: number;
  minute?: number;
  component?: VisualComponent;
}

interface PlacementCandidate {
  nx: number;
  ny: number;
  box: PlacedBBox;
  maxOverlap: number;
  score: number;
}

function scoreCandidate(
  row: number,
  rows: number,
  nx: number,
  ny: number,
  x: number,
  y: number,
  maxOverlap: number,
  side: TeamSide,
  layout: PosterLayout,
  innerBias: number,
  occupied: number,
  options: FindPlacementOptions
): number {
  const profile = profileFor(options.component);
  const rowBias = profile?.rowBias ?? 0;
  const innerMult = profile?.innerBiasMultiplier ?? 1;
  const emptyWeight = cfg.composition.emptyAreaPreference ?? 2.5;
  const emptiness = 1 - maxOverlap;

  let score = emptiness * emptyWeight;
  score += innerBiasScore(nx, side, layout, innerBias * innerMult) * 0.35;
  score += rowBiasScore(row, rows, rowBias);
  score += timelineScore(row, rows, options.minute);
  score += gridCornerPenalty(x, y, layout, side);
  score += occupied === 0 ? 0.4 : -occupied * 0.25;

  const rowT = rows > 1 ? row / (rows - 1) : 0.5;
  score += (1 - Math.abs(rowT - 0.5) * 2) * 0.1;

  return score;
}

function buildGridCandidates(
  layout: PosterLayout,
  side: TeamSide,
  markWidthPx: number,
  markHeightPx: number,
  existing: PlacedBBox[],
  nw: number,
  nh: number,
  rng: () => number,
  options: FindPlacementOptions
): PlacementCandidate[] {
  const region = markRegionForSide(layout, side);
  const innerBias = options.innerBias ?? 0.25;
  const cols = cfg.composition.placementCols;
  const rows = cfg.composition.placementRows;
  const halfW = markWidthPx / 2;
  const halfH = markHeightPx / 2;
  const candidates: PlacementCandidate[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cellIdx = row * cols + col;
      const cellW = region.width / cols;
      const cellH = region.height / rows;
      const cx = region.left + col * cellW + cellW * 0.5;
      const cy = region.top + row * cellH + cellH * 0.5;
      const jx = cfg.animation.staticRender ? 0 : randBetween(rng, -cellW * 0.38, cellW * 0.38);
      const jy = cfg.animation.staticRender ? 0 : randBetween(rng, -cellH * 0.38, cellH * 0.38);
      const [x, y] = clampToRegion(cx + jx, cy + jy, layout, side, halfW, halfH);
      const [nx, ny] = normFromPoint(x, y, layout);
      const box: PlacedBBox = { nx, ny, nw, nh };
      const maxOverlap = maxOverlapWithExisting(box, existing);
      const occupied = cellOccupancy(row, col, cols, rows, existing, region, layout);
      let score = scoreCandidate(
        row,
        rows,
        nx,
        ny,
        x,
        y,
        maxOverlap,
        side,
        layout,
        innerBias,
        occupied,
        options
      );
      if (options.preferCell !== undefined && cellIdx === options.preferCell % (cols * rows)) {
        score += 0.15;
      }
      candidates.push({ nx, ny, box, maxOverlap, score });
    }
  }

  return candidates;
}

function buildPoissonCandidates(
  layout: PosterLayout,
  side: TeamSide,
  markWidthPx: number,
  markHeightPx: number,
  existing: PlacedBBox[],
  nw: number,
  nh: number,
  rng: () => number,
  options: FindPlacementOptions
): PlacementCandidate[] {
  if (!cfg.composition.usePoissonCandidates) return [];

  const region = markRegionForSide(layout, side);
  const innerBias = options.innerBias ?? 0.25;
  const rows = cfg.composition.placementRows;
  const cols = cfg.composition.placementCols;
  const halfW = markWidthPx / 2;
  const halfH = markHeightPx / 2;
  const minDist = Math.min(markWidthPx, markHeightPx) * 0.55;
  const candidates: PlacementCandidate[] = [];
  const accepted: Array<[number, number]> = [];

  for (let attempt = 0; attempt < 36; attempt++) {
    const x = randBetween(rng, region.left + halfW, region.right - halfW);
    const y = randBetween(rng, region.top + halfH, region.bottom - halfH);
    let ok = true;
    for (const [ax, ay] of accepted) {
      const dx = x - ax;
      const dy = y - ay;
      if (dx * dx + dy * dy < minDist * minDist) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    accepted.push([x, y]);
    const [nx, ny] = normFromPoint(x, y, layout);
    const box: PlacedBBox = { nx, ny, nw, nh };
    const maxOverlap = maxOverlapWithExisting(box, existing);
    const row = Math.min(
      rows - 1,
      Math.max(0, Math.floor(((y - region.top) / region.height) * rows))
    );
    const score = scoreCandidate(
      row,
      rows,
      nx,
      ny,
      x,
      y,
      maxOverlap,
      side,
      layout,
      innerBias,
      0,
      options
    );
    candidates.push({ nx, ny, box, maxOverlap, score });
  }

  return candidates;
}

function buildCandidates(
  layout: PosterLayout,
  side: TeamSide,
  markWidthPx: number,
  markHeightPx: number,
  existing: PlacedBBox[],
  nw: number,
  nh: number,
  rng: () => number,
  options: FindPlacementOptions
): PlacementCandidate[] {
  return [
    ...buildGridCandidates(
      layout,
      side,
      markWidthPx,
      markHeightPx,
      existing,
      nw,
      nh,
      rng,
      options
    ),
    ...buildPoissonCandidates(
      layout,
      side,
      markWidthPx,
      markHeightPx,
      existing,
      nw,
      nh,
      rng,
      options
    ),
  ];
}

function pickBestUnderThreshold(
  candidates: PlacementCandidate[],
  maxAllowedOverlap: number
): PlacementCandidate | undefined {
  return candidates
    .filter((c) => c.maxOverlap <= maxAllowedOverlap)
    .sort((a, b) => {
      if (a.maxOverlap !== b.maxOverlap) return a.maxOverlap - b.maxOverlap;
      return b.score - a.score;
    })[0];
}

function overlapBoostFor(options: FindPlacementOptions): number {
  const profile = profileFor(options.component);
  return profile?.overlapBoost ?? 0;
}

/**
 * Find a placement center in the team's mark region.
 *
 * Fill-first rule: try overlap = 0, then relax through placementOverlapSteps
 * until maxOverlapRatio. Within each step, pick the emptiest valid cell.
 */
export function findPlacement(
  layout: PosterLayout,
  side: TeamSide,
  markWidthPx: number,
  markHeightPx: number,
  placement: PlacementState,
  rng: () => number,
  options: FindPlacementOptions = {}
): [number, number] {
  const existing = side === "home" ? placement.home : placement.away;
  const nw = normSize(markWidthPx, layout);
  const nh = normSize(markHeightPx, layout);
  const halfW = markWidthPx / 2;
  const halfH = markHeightPx / 2;
  const region = markRegionForSide(layout, side);
  const cols = cfg.composition.placementCols;
  const boost = overlapBoostFor(options);

  const candidates = buildCandidates(
    layout,
    side,
    markWidthPx,
    markHeightPx,
    existing,
    nw,
    nh,
    rng,
    options
  );

  for (const threshold of overlapSteps()) {
    const maxAllowed = Math.min(1, threshold + boost);
    const pick = pickBestUnderThreshold(candidates, maxAllowed);
    if (pick) {
      existing.push(pick.box);
      return [pick.nx, pick.ny];
    }
  }

  const best = candidates.sort((a, b) => {
    if (a.maxOverlap !== b.maxOverlap) return a.maxOverlap - b.maxOverlap;
    return b.score - a.score;
  })[0] ?? {
    nx: 0.5,
    ny: 0.5,
    box: { nx: 0.5, ny: 0.5, nw, nh },
    maxOverlap: 1,
    score: 0,
  };
  const [bestX, bestY] = pointFromNorm(best.nx, best.ny, layout);

  for (const threshold of overlapSteps()) {
    const maxAllowed = Math.min(1, threshold + boost);
    for (let i = 0; i < 48; i++) {
      const angle = i * 0.9;
      const radius = (Math.min(region.width, region.height) / cols) * (0.3 + i * 0.08);
      const sx = bestX + Math.cos(angle) * radius;
      const sy = bestY + Math.sin(angle) * radius;
      const [x, y] = clampToRegion(sx, sy, layout, side, halfW, halfH);
      const [nx, ny] = normFromPoint(x, y, layout);
      const box: PlacedBBox = { nx, ny, nw, nh };
      const maxOverlap = maxOverlapWithExisting(box, existing);
      if (maxOverlap <= maxAllowed) {
        existing.push(box);
        return [nx, ny];
      }
    }
  }

  existing.push(best.box);
  return [best.nx, best.ny];
}

export function registerPlacement(
  placement: PlacementState,
  side: TeamSide,
  nx: number,
  ny: number,
  markWidthPx: number,
  markHeightPx: number,
  layout: PosterLayout
): void {
  const list = side === "home" ? placement.home : placement.away;
  list.push({
    nx,
    ny,
    nw: normSize(markWidthPx, layout),
    nh: normSize(markHeightPx, layout),
  });
}

export function resetPlacementState(placement: PlacementState): void {
  placement.home.length = 0;
  placement.away.length = 0;
}
