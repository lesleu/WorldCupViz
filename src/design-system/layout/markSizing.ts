import { COMPONENT_SIZES } from "@/config/componentSizes.generated";
import { eventMarksConfig } from "@/config/eventMarks.config";
import { COMPONENT_PATHS } from "@/design-system/assets/componentPaths.generated";
import { goalsConfig } from "@/config/goals.config";
import { markSizesConfig } from "@/config/markSizes.config";
import { randomnessConfig } from "@/config/randomness.config";
import { VISUAL_COMPONENT, type VisualComponent } from "@/design-system/mapping/visualMappings";
import type { TeamSide } from "@/data/mockMatch";
import {
  getTeamZoneFillScale,
  scaleDesignPx,
} from "@/design-system/layout/designScale";
import type { PosterLayout } from "@/design-system/layout/posterLayout";
import { teamZoneForSide } from "@/design-system/layout/posterLayout";
import { createRng, randBetween } from "@/utils/seededRandom";

type SizeSpec = (typeof COMPONENT_SIZES)[keyof typeof COMPONENT_SIZES];

function specFor(component: VisualComponent): SizeSpec | undefined {
  return COMPONENT_SIZES[component as keyof typeof COMPONENT_SIZES];
}

function pickRange(
  spec: SizeSpec,
  minKey: string,
  maxKey: string,
  rng?: () => number
): number {
  const min = (spec as Record<string, number>)[minKey];
  const max = (spec as Record<string, number>)[maxKey] ?? min;
  if (min === undefined) return max ?? 0;
  if (rng) return randBetween(rng, min, max);
  return (min + max) / 2;
}

/** Figma design px for a component (1920×1080), before canvas + zone scaling. */
export function figmaDesignPx(
  component: VisualComponent,
  rng?: () => number,
  axis: "uniform" | "x" | "y" = "uniform"
): number {
  const spec = specFor(component);
  if (!spec) return 48;

  switch (component) {
    case VISUAL_COMPONENT.Goal:
      return axis === "y"
        ? pickRange(spec, "sizeYMin", "sizeYMax", rng)
        : pickRange(spec, "sizeXMin", "sizeXMax", rng);
    case VISUAL_COMPONENT.Offside:
      if (axis === "y") return (spec as { sizeMax: number }).sizeMax;
      return pickRange(spec, "sizeXMin", "sizeXMax", rng);
    case VISUAL_COMPONENT.ShotOnTarget:
      return pickRange(spec, "sizeMin", "sizeMax", rng);
    default:
      return pickRange(spec, "sizeMin", "sizeMax", rng);
  }
}

export function markSizeScale(component: VisualComponent): number {
  return markSizesConfig.markSizeScale[component] ?? 1;
}

/**
 * Size multiplier by dataset order (0 = earliest mark of that type = largest).
 * Uses rankDecay rules from markSizes.config.
 */
export function rankDecayMultiplier(component: VisualComponent, rank: number): number {
  const rule = markSizesConfig.rankDecay[component];
  if (!rule) return 1;

  const full = rule.firstFullSizeCount ?? 1;
  const decay = rule.sizeDecayRatio ?? 0.92;
  if (rank < full) return 1;

  const steps = rank - full + 1;
  const exponent =
    component === VISUAL_COMPONENT.Goal ? (rule.goalDecayExponent ?? 2) : 1;
  const raw = Math.pow(decay, steps * exponent);
  const floor = rule.minSizeMultiplier ?? 0.38;
  return Math.max(floor, raw);
}

function usesShotDesignBase(component: VisualComponent): boolean {
  return (
    component === VISUAL_COMPONENT.Shot || component === VISUAL_COMPONENT.ShotOnTarget
  );
}

/**
 * Runtime px for a uniform mark (shot, corner, card, foul, …).
 * Re-reads markSizes config each frame when called from the renderer.
 */
export function resolveMarkSizePx(
  component: VisualComponent,
  layout: PosterLayout,
  rank: number,
  side: TeamSide,
  rng: () => number,
  spawnScale = 1,
  options: { zoneFill?: boolean } = {}
): number {
  const zoneFill = options.zoneFill ?? !usesShotDesignBase(component);
  const rankScale = rankDecayMultiplier(component, rank);
  const scale = markSizeScale(component) * spawnScale * rankScale;

  const designPx = usesShotDesignBase(component)
    ? markSizesConfig.shotDesignBasePx * scale
    : figmaDesignPx(component, rng, "uniform") * scale;

  let px = scaleDesignPx(designPx, layout);
  if (zoneFill) {
    px *= getTeamZoneFillScale(layout, side);
  }
  return px;
}

/** Goal panel — largest marks; rank 0 uses Figma max tokens from config. */
export function resolveGoalMarkSizePx(
  layout: PosterLayout,
  rank: number,
  rng: () => number,
  spawnScale = 1,
  side?: TeamSide
): { widthPx: number; heightPx: number } {
  const spec = COMPONENT_SIZES.Goal;
  const sizeXMin = spec?.sizeXMin ?? 80;
  const sizeXMax = spec?.sizeXMax ?? 306;
  const sizeYMin = spec?.sizeYMin ?? 120;
  const sizeYMax = spec?.sizeYMax ?? 468;
  const rankMult = rankDecayMultiplier(VISUAL_COMPONENT.Goal, rank);
  const rankT =
    rank <= 0 ? 1 : rank === 1 ? 0.78 : Math.max(0.5, 1 - (rank - 1) * 0.14);
  const designX = sizeXMin + (sizeXMax - sizeXMin) * rankT;
  const designY = sizeYMin + (sizeYMax - sizeYMin) * rankT;
  const mult =
    markSizeScale(VISUAL_COMPONENT.Goal) * spawnScale * rankMult;
  const heightJitter = randBetween(
    rng,
    goalsConfig.heightJitterMin,
    goalsConfig.heightJitterMax
  );

  let widthPx = scaleDesignPx(designX * mult, layout);
  let heightPx = scaleDesignPx(designY * mult * heightJitter, layout);

  if (side) {
    const zone = teamZoneForSide(layout, side);
    const maxW = zone.width * goalsConfig.maxZoneWidthRatio;
    const maxH = zone.height * goalsConfig.maxZoneHeightRatio;
    const cap = Math.min(1, maxW / widthPx, maxH / heightPx);
    widthPx *= cap;
    heightPx *= cap;
  }

  return clampMarkDimsMin({ widthPx, heightPx });
}

/** Offside bar — width and height use separate Figma axes. */
export function resolveOffsideMarkSizePx(
  layout: PosterLayout,
  rank: number,
  side: TeamSide,
  rng: () => number,
  spawnScale = 1
): { widthPx: number; heightPx: number } {
  const scale =
    markSizeScale(VISUAL_COMPONENT.Offside) *
    spawnScale *
    rankDecayMultiplier(VISUAL_COMPONENT.Offside, rank);

  const heightDesign = figmaDesignPx(VISUAL_COMPONENT.Offside, undefined, "y") * scale;
  const vb = COMPONENT_PATHS.Offside?.viewBox;
  const widthDesign = vb
    ? heightDesign * (vb.w / vb.h)
    : figmaDesignPx(VISUAL_COMPONENT.Offside, rng, "x") * scale;
  const zone = getTeamZoneFillScale(layout, side);

  return clampMarkDimsMin({
    widthPx: scaleDesignPx(widthDesign, layout) * zone,
    heightPx: scaleDesignPx(heightDesign, layout) * zone,
  });
}

/** Global experiment: shrink every asset's footprint by this many px (long side). */
export const MARK_SHRINK_PX = 10;

/**
 * Shrink each mark by MARK_SHRINK_PX (aspect-preserving, off the long side), then
 * enforce minMarkPx on the shorter side (from eventMarks.config, default 20px).
 */
export function clampMarkDimsMin(
  dims: MarkPixelDims,
  minPx = eventMarksConfig.minMarkPx
): MarkPixelDims {
  let { widthPx, heightPx } = dims;

  const long = Math.max(widthPx, heightPx);
  if (long > 0 && MARK_SHRINK_PX > 0) {
    const shrink = Math.max(0, (long - MARK_SHRINK_PX) / long);
    widthPx *= shrink;
    heightPx *= shrink;
  }

  const short = Math.min(widthPx, heightPx);
  if (short >= minPx || short <= 0) return { widthPx, heightPx };
  const s = minPx / short;
  return { widthPx: widthPx * s, heightPx: heightPx * s };
}

/** Min uniform scale so every mark's short side stays ≥ minPx. */
export function minMosaicScaleForMinPx(
  dims: MarkPixelDims[],
  minPx = eventMarksConfig.minMarkPx
): number {
  if (dims.length === 0) return 1;
  let minShort = Infinity;
  for (const d of dims) {
    if (d.widthPx > 0 && d.heightPx > 0) {
      minShort = Math.min(minShort, d.widthPx, d.heightPx);
    }
  }
  if (!Number.isFinite(minShort) || minShort <= 0) return 1;
  return Math.min(1, minPx / minShort);
}

/** Pixel width/height for one mark in a time-quadrant cell. */
export interface MarkPixelDims {
  widthPx: number;
  heightPx: number;
}

/**
 * Dimensions for quadrant layout — foul uses Figma token as bar height (wide marks read larger).
 */
export function resolveQuadrantEntryDimensions(
  component: VisualComponent,
  layout: PosterLayout,
  rank: number,
  side: TeamSide,
  mark: { id: string; minute: number; spawnScale: number },
  rng: () => number
): MarkPixelDims {
  if (component === VISUAL_COMPONENT.Goal) {
    return resolveGoalMarkSizePx(layout, rank, rng, mark.spawnScale, side);
  }

  if (component === VISUAL_COMPONENT.Offside) {
    return resolveOffsideMarkSizePx(layout, rank, side, rng, mark.spawnScale);
  }

  if (component === VISUAL_COMPONENT.Foul) {
    const heightPx = resolveMarkSizePx(
      component,
      layout,
      rank,
      side,
      rng,
      mark.spawnScale
    );
    const vb = COMPONENT_PATHS.Foul?.viewBox;
    const widthPx = vb ? heightPx * (vb.w / vb.h) : heightPx * 3;
    return clampMarkDimsMin({ widthPx, heightPx });
  }

  const widthPx = resolveMarkSizePx(
    component,
    layout,
    rank,
    side,
    rng,
    mark.spawnScale
  );
  const vb = COMPONENT_PATHS[component]?.viewBox;
  if (vb) {
    return clampMarkDimsMin({ widthPx, heightPx: widthPx * (vb.h / vb.w) });
  }
  return clampMarkDimsMin({ widthPx, heightPx: widthPx });
}

export function markRng(markId: string, minute: number): () => number {
  const match = /^u(\d+)-/.exec(markId);
  const updateIndex = match ? Number(match[1]) : 0;
  return createRng(updateIndex * 9973 + minute * 131 + randomnessConfig.seed);
}

/** Max long side (px) for one mosaic cell — fixed budget, identical for every mark. */
export function mosaicTargetMaxPx(
  layout: PosterLayout,
  side: TeamSide,
  markCount: number
): number {
  const zone = teamZoneForSide(layout, side);
  const zoneMin = Math.min(zone.width, zone.height);
  const base = zoneMin * 0.24;
  const countT = Math.min(Math.max(markCount, 1) / 22, 1);
  const countScale = 1 - countT * 0.12;
  return base * countScale;
}

/** Uniform cell dims from viewBox aspect — every mark gets the same long side. */
export function resolveUniformMosaicDims(
  component: VisualComponent,
  layout: PosterLayout,
  side: TeamSide,
  markCount: number
): MarkPixelDims {
  const longSide = mosaicTargetMaxPx(layout, side, markCount);
  const vb = COMPONENT_PATHS[component]?.viewBox;
  if (!vb) return { widthPx: longSide, heightPx: longSide };
  if (vb.w >= vb.h) {
    return { widthPx: longSide, heightPx: longSide * (vb.h / vb.w) };
  }
  return { widthPx: longSide * (vb.w / vb.h), heightPx: longSide };
}

/** Fit dims so max(width, height) equals targetPx (scales up or down). */
export function fitToMosaicCell(dims: MarkPixelDims, targetPx: number): MarkPixelDims {
  const max = Math.max(dims.widthPx, dims.heightPx);
  if (max <= 0 || targetPx <= 0) return dims;
  const s = targetPx / max;
  return { widthPx: dims.widthPx * s, heightPx: dims.heightPx * s };
}

/** @deprecated Use fitToMosaicCell */
export function capToMosaicCell(dims: MarkPixelDims, maxPx: number): MarkPixelDims {
  return fitToMosaicCell(dims, maxPx);
}

/** Every mark shares the exact same long-side dimension. */
export function normalizeMosaicBaseDims(
  dims: MarkPixelDims[],
  targetMaxPx: number
): MarkPixelDims[] {
  return dims.map((d) => fitToMosaicCell(d, targetMaxPx));
}

/** Scale a batch of mark dims uniformly. */
export function scaleMarkDims(dims: MarkPixelDims[], scale: number): MarkPixelDims[] {
  return dims.map((d) => ({
    widthPx: d.widthPx * scale,
    heightPx: d.heightPx * scale,
  }));
}

export function usesUniformMosaicSizing(component: VisualComponent): boolean {
  return (eventMarksConfig.patternComponents as readonly string[]).includes(component);
}
