import type { AccumulatedArtState, TeamSide } from "@/design-system/state/artState";
import { cfg } from "@/config";

/** Discrete mark families — each tracks its own count per team side. */
export type MarkDataset =
  | "goal"
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
    case "goal":
      return art.goals
        .filter((mark) => mark.side === side)
        .map((mark) => ({ id: mark.id, minute: mark.minute }));
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

/** @deprecated Prefer mark sizing at draw time. Kept for pass-accuracy sparks. */
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
