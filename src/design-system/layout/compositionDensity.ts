import type { VisualComponent } from "@/design-system/mapping/visualMappings";
import { VISUAL_COMPONENT } from "@/design-system/mapping/visualMappings";
import type { AccumulatedArtState, TeamSide } from "@/design-system/state/artState";
import type { PosterLayout } from "@/design-system/layout/posterLayout";
import { resolveComponentSize, scaleDesignPx } from "@/design-system/layout/designScale";
import { cfg } from "@/config";

/** Discrete mark families — each tracks its own count per team side. */
export type MarkDataset =
  | "shot"
  | "shot_on_target"
  | "foul"
  | "corner"
  | "offside"
  | "card";

interface DatasetMark {
  id: string;
  minute: number;
}

function datasetMarks(
  art: AccumulatedArtState,
  side: TeamSide,
  dataset: MarkDataset
): DatasetMark[] {
  switch (dataset) {
    case "shot":
      return art.shots
        .filter((mark) => mark.side === side)
        .map((mark) => ({ id: mark.id, minute: mark.minute }));
    case "shot_on_target":
      return art.shotsOnTarget
        .filter((mark) => mark.side === side)
        .map((mark) => ({ id: mark.id, minute: mark.minute }));
    case "foul":
      return art.fouls
        .filter((mark) => mark.side === side)
        .map((mark) => ({ id: mark.id, minute: mark.minute }));
    case "corner":
      return art.corners
        .filter((mark) => mark.side === side)
        .map((mark) => ({ id: mark.id, minute: mark.minute }));
    case "offside":
      return art.offsides
        .filter((mark) => mark.side === side)
        .map((mark) => ({ id: mark.id, minute: mark.minute }));
    case "card":
      return art.cards
        .filter((mark) => mark.side === side)
        .map((mark) => ({ id: mark.id, minute: mark.minute }));
  }
}

/** 0-based order of a mark within its dataset on one side (by minute, then id). */
export function rankInDataset(
  art: AccumulatedArtState,
  side: TeamSide,
  dataset: MarkDataset,
  markId: string
): number {
  const ordered = datasetMarks(art, side, dataset).sort(
    (a, b) => a.minute - b.minute || a.id.localeCompare(b.id)
  );
  return ordered.findIndex((mark) => mark.id === markId);
}

/** Opacity multiplier by age rank within a dataset (0 = newest). */
export function markAgeOpacity(rank: number): number {
  const decay = cfg.composition.markAgeOpacityDecay ?? 1;
  if (decay >= 1 || rank <= 0) return 1;
  return Math.pow(decay, rank);
}

function crowdingFromRank(markIndex: number): number {
  const free = cfg.composition.crowdingFreeMarkCount;
  if (markIndex < free) return 1;

  const pastFree = markIndex - free + 1;
  const ref = cfg.composition.comfortableMarkCount;
  const min = cfg.composition.minCrowdingScale;
  const exponent = cfg.composition.crowdingExponent;

  return Math.max(
    min,
    Math.min(1, Math.pow(ref / (ref + pastFree - 1), exponent))
  );
}

/** @deprecated Prefer salience size at mark creation. Kept for pass-accuracy sparks. */
export function crowdingForMark(
  art: AccumulatedArtState,
  side: TeamSide,
  dataset: MarkDataset,
  markId: string
): number {
  const rank = rankInDataset(art, side, dataset, markId);
  if (rank < 0) return 1;
  return crowdingFromRank(rank);
}

/** Rank-based design px side length from composition salience table. */
export function salienceDesignSize(component: VisualComponent, rank: number): number {
  const rule = cfg.composition.salienceSizes[component];
  const shots = cfg.shots;
  const base = rule?.baseSizePx ?? shots.baseSizePx;
  const full = rule?.firstFullSizeCount ?? shots.firstFullSizeCount;
  const decay = rule?.sizeDecayRatio ?? shots.sizeDecayRatio;
  if (rank < full) return base;
  const steps = rank - full + 1;
  return base * Math.pow(decay, steps);
}

/** Shot mark side length in design px — first N full size, then exponential decay. */
export function shotMarkDesignSize(rank: number): number {
  return salienceDesignSize(VISUAL_COMPONENT.Shot, rank);
}

/** Resolve pixel size for a mark at creation time (salience table + optional Figma tokens). */
export function resolveSalienceMarkSizePx(
  component: VisualComponent,
  rank: number,
  layout: PosterLayout,
  rng: () => number,
  side: TeamSide,
  baseScale: number
): number {
  const rule = cfg.composition.salienceSizes[component];
  if (rule?.useComponentTokens) {
    const tokenPx = resolveComponentSize(component, layout, rng, "uniform", side);
    const full = rule.firstFullSizeCount ?? 3;
    const decay = rule.sizeDecayRatio ?? 0.9;
    let mult = 1;
    if (rank >= full) {
      mult = Math.pow(decay, rank - full + 1);
    }
    return tokenPx * baseScale * mult;
  }
  const designPx = salienceDesignSize(component, rank) * baseScale;
  return scaleDesignPx(designPx, layout);
}
