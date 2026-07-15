import type { LiveFeedUpdate, MatchEvent, MatchEventType, StateUpdate } from "@/data/mockLiveFeed";
import { paletteForSide, type MatchData, type TeamSide } from "@/data/mockMatch";
import {
  type PosterLayout,
  teamZoneForSide,
} from "@/design-system/layout/posterLayout";
import {
  createPlacementState,
  resetPlacementState,
  type PlacementState,
} from "@/design-system/layout/placementEngine";
import {
  relayoutTimedMarkEntries,
  type LayoutMark,
  type TimedMarkEntry,
} from "@/design-system/layout/quadrantMarkPlacement";
import { usesQuadrantMarkLayout } from "@/design-system/color/markColors";
import { createRng, randBetween } from "@/utils/seededRandom";
import { getComponentColor } from "@/design-system/color/resolveColor";
import { getEventVisualComponent, VISUAL_COMPONENT, type VisualComponent } from "@/design-system/mapping/visualMappings";
import {
  markRng,
  resolveGoalMarkSizePx,
  resolveQuadrantEntryDimensions,
} from "@/design-system/layout/markSizing";
import { rankInDataset } from "@/design-system/layout/compositionDensity";
import { COMPONENT_SIZES } from "@/config/componentSizes.generated";
import { cfg } from "@/config";

/** Accumulated art state — mark arrays keyed to visualMappings.ts components. */

export type { TeamSide } from "@/data/mockMatch";

/** Continuous values that morph every frame — NOT cleared during replay. */
export interface ContinuousTeamState {
  possession: number;
  passAccuracy: number;
  totalPasses: number;
  passesAccurate: number;
}

export interface ContinuousMatchState {
  home: ContinuousTeamState;
  away: ContinuousTeamState;
}

export interface BlockSpec {
  nx: number;
  ny: number;
  /** Spawn-time scale multiplier (see markSizing.ts). */
  scale: number;
  /** Uniform shrink when the time cell is crowded. */
  layoutScale: number;
  angle: number;
  bgColor: string;
  fgColor: string;
  phase: number;
}

/** Shot — patterned square stamp (reference: pixel diamond cross). */
export interface ShotMark {
  id: string;
  side: TeamSide;
  minute: number;
  squares: BlockSpec[];
}

/** ShotOnTarget — starburst mark from shot on target. */
export interface ShotOnTargetMark {
  id: string;
  side: TeamSide;
  minute: number;
  nx: number;
  ny: number;
  spawnScale: number;
  layoutScale: number;
  innerRatio: number;
  points: number;
  color: string;
  phase: number;
}

/** Goal — tall jagged spike. */
export interface GoalMark {
  id: string;
  side: TeamSide;
  minute: number;
  nx: number;
  ny: number;
  spawnScale: number;
  layoutScale: number;
  color: string;
  phase: number;
  variant?: "regulation" | "shootout";
}

/** Foul — three slanted ink fractures (no card body). */
export interface FoulMark {
  id: string;
  side: TeamSide;
  minute: number;
  nx: number;
  ny: number;
  spawnScale: number;
  layoutScale: number;
  phase: number;
}

/** YellowCard / RedCard — colored rectangle with black ovals. */
export interface CardMark {
  id: string;
  side: TeamSide;
  minute: number;
  nx: number;
  ny: number;
  spawnScale: number;
  layoutScale: number;
  kind: "yellow" | "red";
  phase: number;
}

/** Corner — pinwheel / hourglass mark. */
export interface Corner {
  id: string;
  side: TeamSide;
  minute: number;
  nx: number;
  ny: number;
  spawnScale: number;
  layoutScale: number;
  color: string;
  phase: number;
}

/** Offside — stacked rounded boundary segments. */
export interface Offside {
  id: string;
  side: TeamSide;
  minute: number;
  nx: number;
  ny: number;
  spawnScale: number;
  layoutScale: number;
  color: string;
  phase: number;
}

/** Possession mosaic circle — count tracks possession % on diagonal layouts. */
export interface PossessionCircleMark {
  id: string;
  side: TeamSide;
  minute: number;
  nx: number;
  ny: number;
  spawnScale: number;
  layoutScale: number;
  phase: number;
}

/**
 * Accumulated art state — each team builds its own side artifact.
 * possessionGrid morphs continuously; event marks are append-only until reset.
 * possessionCircles are mosaic marks (diagonal composition only).
 */
export interface AccumulatedArtState {
  possessionGrid: ContinuousMatchState;
  possessionCircles: PossessionCircleMark[];
  shots: ShotMark[];
  goals: GoalMark[];
  fouls: FoulMark[];
  shotsOnTarget: ShotOnTargetMark[];
  cards: CardMark[];
  corners: Corner[];
  offsides: Offside[];
  placement: PlacementState;
}

export function createKickoffArtState(initial: ContinuousMatchState): AccumulatedArtState {
  return {
    possessionGrid: cloneContinuous(initial),
    possessionCircles: [],
    shots: [],
    goals: [],
    fouls: [],
    shotsOnTarget: [],
    cards: [],
    corners: [],
    offsides: [],
    placement: createPlacementState(),
  };
}

export function cloneContinuous(state: ContinuousMatchState): ContinuousMatchState {
  return {
    home: { ...state.home },
    away: { ...state.away },
  };
}

function rand(rng: () => number, min: number, max: number) {
  return randBetween(rng, min, max);
}

function normX(x: number, layout: PosterLayout) {
  return (x - layout.margin) / Math.max(layout.artworkWidth, 1);
}

function normY(y: number, layout: PosterLayout) {
  return (y - layout.artworkTop) / Math.max(layout.artworkHeight, 1);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function zonePadding(layout: PosterLayout) {
  return layout.artworkWidth * cfg.composition.zones.homeZonePaddingRatio * 0.5;
}

/** Clamp a point so it never crosses into center gap or the other team's zone. */
export function clampToTeamZone(
  x: number,
  y: number,
  layout: PosterLayout,
  side: TeamSide
): [number, number] {
  const zone = teamZoneForSide(layout, side);
  const pad = zonePadding(layout);
  return [
    clamp(x, zone.left + pad, zone.right - pad),
    clamp(y, zone.top + pad, zone.bottom - pad),
  ];
}

/**
 * Reset placement tracking when art state is rebuilt (e.g. replay reset).
 */
export function resetArtPlacement(art: AccumulatedArtState): void {
  resetPlacementState(art.placement);
}

/** Total timed mosaic marks on one team side (for uniform sizing). */
export function timedMarkCountOnSide(art: AccumulatedArtState, side: TeamSide): number {
  let count = 0;
  for (const shot of art.shots) {
    if (shot.side === side) count += shot.squares.length;
  }
  count += art.fouls.filter((m) => m.side === side).length;
  count += art.corners.filter((m) => m.side === side).length;
  count += art.offsides.filter((m) => m.side === side).length;
  count += art.shotsOnTarget.filter((m) => m.side === side).length;
  count += art.goals.filter((m) => m.side === side).length;
  count += art.cards.filter((m) => m.side === side).length;
  count += art.possessionCircles.filter((m) => m.side === side).length;
  return count;
}

export function possessionMosaicCircleCount(possessionPct: number): number {
  const at100 = cfg.composition.possessionMosaicCirclesAt100 ?? 36;
  const pct = Math.min(100, Math.max(0, possessionPct));
  return Math.max(0, Math.round((pct / 100) * at100));
}

/**
 * Chronological appear-minutes for possession circles on one side, walking feed
 * state_updates up to `upToMinute`. Circle i becomes visible at appear[i].
 * Batches that jump the count are staggered so circles grow in with events.
 */
export function buildPossessionCircleAppearMinutes(
  feed: LiveFeedUpdate[],
  kickoff: StateUpdate,
  side: TeamSide,
  upToMinute: number
): number[] {
  let pct = side === "home" ? kickoff.home.possession : kickoff.away.possession;
  const appear: number[] = [];
  let target = possessionMosaicCircleCount(pct);
  // Stagger kickoff circles through the opening minutes so they don't all pop at 0'.
  for (let i = 0; i < target; i++) {
    appear.push((i / Math.max(target, 1)) * 6);
  }

  const updates = feed
    .filter((u): u is Extract<LiveFeedUpdate, { type: "state_update" }> => {
      return u.type === "state_update" && u.minute <= upToMinute;
    })
    .slice()
    .sort((a, b) => a.minute - b.minute);

  for (const update of updates) {
    pct = side === "home" ? update.home.possession : update.away.possession;
    target = possessionMosaicCircleCount(pct);
    const before = appear.length;
    while (appear.length < target) {
      const k = appear.length - before;
      appear.push(update.minute + k * 0.35);
    }
    if (appear.length > target) appear.length = target;
  }

  // Drop circles that haven't reached the clock yet (kickoff stagger can run past now).
  return appear.filter((m) => m <= upToMinute + 1e-9);
}

/**
 * Rebuild possession circle marks from discrete possession % (diagonal only).
 * Circles join the event mosaic: edge-touch, no overlap, shrink-to-fit.
 *
 * Important: pass the *target* / feed possession, not the smoothed/lerped value —
 * rounding a float each animation frame can flicker the count and infinitely
 * re-layout the mosaic (browser freeze / endless "loading").
 *
 * `appearMinutes` (per side) sets when each circle becomes visible in replay.
 */
export function syncPossessionMosaic(
  art: AccumulatedArtState,
  layout: PosterLayout,
  possessionSource?: ContinuousMatchState,
  appearMinutes?: { home: number[]; away: number[] }
): void {
  if (!layout.diagonalSplit) {
    if (art.possessionCircles.length > 0) {
      art.possessionCircles = [];
      requestBothTeamsLayout(art, layout);
    }
    return;
  }

  const source = possessionSource ?? art.possessionGrid;
  let changed = false;
  for (const side of ["home", "away"] as const) {
    const pct = side === "home" ? source.home.possession : source.away.possession;
    const sideAppear = appearMinutes?.[side];
    // Prefer feed timeline length when provided; otherwise possession %.
    const target = sideAppear
      ? sideAppear.length
      : possessionMosaicCircleCount(pct);
    const existing = art.possessionCircles.filter((c) => c.side === side);
    if (existing.length === target) {
      if (sideAppear) {
        for (let i = 0; i < existing.length; i++) {
          const appear = sideAppear[i];
          if (appear !== undefined && existing[i].minute !== appear) {
            existing[i].minute = appear;
          }
        }
      }
      continue;
    }

    changed = true;
    const kept = existing.slice(0, target);
    while (kept.length < target) {
      const i = kept.length;
      const rng = createRng(
        (side === "home" ? 17 : 41) * 1009 + i * 131 + cfg.randomness.seed
      );
      kept.push({
        id: `poss-${side}-${i}`,
        side,
        minute: sideAppear?.[i] ?? 0,
        nx: 0,
        ny: 0,
        spawnScale: 1,
        layoutScale: 1,
        phase: randBetween(rng, 0, Math.PI * 2),
      });
    }
    for (let i = 0; i < kept.length; i++) {
      const appear = sideAppear?.[i];
      if (appear !== undefined) {
        kept[i] = { ...kept[i], minute: appear };
      }
    }
    art.possessionCircles = [
      ...art.possessionCircles.filter((c) => c.side !== side),
      ...kept,
    ];
  }

  if (changed) {
    requestBothTeamsLayout(art, layout);
  }
}

function quadrantBaseScale(component: VisualComponent): number {
  return usesQuadrantMarkLayout(component) ? cfg.composition.markScale : 0;
}

function collectTimedMarks(
  art: AccumulatedArtState,
  side: TeamSide
): TimedMarkEntry[] {
  const entries: TimedMarkEntry[] = [];

  for (const circle of art.possessionCircles) {
    if (circle.side !== side) continue;
    entries.push({
      mark: circle as LayoutMark,
      component: VISUAL_COMPONENT.PossessionGrid,
    });
  }

  for (const shot of art.shots) {
    if (shot.side !== side) continue;

    shot.squares.forEach((sq, squareIndex) => {
      const proxy: LayoutMark = {
        id: `${shot.id}-sq${squareIndex}`,
        side: shot.side,
        minute: shot.minute,
        nx: sq.nx,
        ny: sq.ny,
        spawnScale: sq.scale,
        layoutScale: sq.layoutScale,
      };
      entries.push({
        mark: proxy,
        component: VISUAL_COMPONENT.Shot,
        commit: (nx, ny, layoutScale, _layout, footprint) => {
          sq.nx = nx;
          sq.ny = ny;
          sq.layoutScale = layoutScale;
          if (footprint) {
            (sq as { layoutNw?: number; layoutNh?: number }).layoutNw =
              footprint.nw;
            (sq as { layoutNw?: number; layoutNh?: number }).layoutNh =
              footprint.nh;
          }
        },
      });
    });
  }

  for (const mark of art.fouls) {
    if (mark.side === side) entries.push({ mark, component: VISUAL_COMPONENT.Foul });
  }
  for (const mark of art.corners) {
    if (mark.side === side) entries.push({ mark, component: VISUAL_COMPONENT.Corner });
  }
  for (const mark of art.offsides) {
    if (mark.side === side) entries.push({ mark, component: VISUAL_COMPONENT.Offside });
  }
  for (const mark of art.shotsOnTarget) {
    if (mark.side === side) {
      entries.push({ mark, component: VISUAL_COMPONENT.ShotOnTarget });
    }
  }
  for (const goal of art.goals) {
    if (goal.side === side) {
      entries.push({ mark: goal as LayoutMark, component: VISUAL_COMPONENT.Goal });
    }
  }
  for (const card of art.cards) {
    if (card.side !== side) continue;
    const component =
      card.kind === "yellow" ? VISUAL_COMPONENT.YellowCard : VISUAL_COMPONENT.RedCard;
    entries.push({ mark: card as LayoutMark, component });
  }
  return entries;
}

function rankForLayoutEntry(
  art: AccumulatedArtState,
  side: TeamSide,
  component: VisualComponent,
  mark: LayoutMark
): number {
  const shotParentId = mark.id.replace(/-sq\d+$/, "");
  switch (component) {
    case VISUAL_COMPONENT.Shot:
      return rankInDataset(art, side, "shot", shotParentId);
    case VISUAL_COMPONENT.ShotOnTarget:
      return rankInDataset(art, side, "shot_on_target", mark.id);
    case VISUAL_COMPONENT.Foul:
      return rankInDataset(art, side, "foul", mark.id);
    case VISUAL_COMPONENT.Corner:
      return rankInDataset(art, side, "corner", mark.id);
    case VISUAL_COMPONENT.Offside:
      return rankInDataset(art, side, "offside", mark.id);
    case VISUAL_COMPONENT.Goal:
      return rankInDataset(art, side, "goal", mark.id);
    case VISUAL_COMPONENT.YellowCard:
    case VISUAL_COMPONENT.RedCard:
      return rankInDataset(art, side, "card", mark.id);
    case VISUAL_COMPONENT.PossessionGrid:
      return Math.max(
        0,
        art.possessionCircles
          .filter((c) => c.side === side)
          .findIndex((c) => c.id === mark.id)
      );
    default:
      return 0;
  }
}

function layoutSizeForEntry(
  art: AccumulatedArtState,
  side: TeamSide,
  component: VisualComponent,
  mark: LayoutMark,
  layout: PosterLayout
) {
  const rank = rankForLayoutEntry(art, side, component, mark);
  const parentId = mark.id.replace(/-sq\d+$/, "");
  return resolveQuadrantEntryDimensions(
    component,
    layout,
    rank,
    side,
    { id: parentId, minute: mark.minute, spawnScale: mark.spawnScale },
    markRng(parentId, mark.minute)
  );
}

function relayoutTeamTimedMarks(
  art: AccumulatedArtState,
  side: TeamSide,
  layout: PosterLayout
): void {
  relayoutTimedMarkEntries(
    collectTimedMarks(art, side),
    side,
    layout,
    art.placement,
    (component, mark) => layoutSizeForEntry(art, side, component, mark, layout)
  );
}

const markScale = () => cfg.composition.markScale;
const density = () => cfg.composition.densityMultiplier;

/**
 * Seek/flush apply dozens of events; relayouting the mosaic after each one
 * freezes phones (quadratic pack per mark). Batch to one pack at end.
 */
let deferredTeamLayoutDepth = 0;
let deferredTeamLayoutDirty = false;

export function beginDeferredTeamLayout(): void {
  deferredTeamLayoutDepth++;
}

export function endDeferredTeamLayout(
  art: AccumulatedArtState,
  layout: PosterLayout
): void {
  deferredTeamLayoutDepth = Math.max(0, deferredTeamLayoutDepth - 1);
  if (deferredTeamLayoutDepth > 0 || !deferredTeamLayoutDirty) return;
  deferredTeamLayoutDirty = false;
  relayoutTeamTimedMarks(art, "home", layout);
  relayoutTeamTimedMarks(art, "away", layout);
}

function requestTeamLayout(
  art: AccumulatedArtState,
  side: TeamSide,
  layout: PosterLayout
): void {
  if (deferredTeamLayoutDepth > 0) {
    deferredTeamLayoutDirty = true;
    return;
  }
  relayoutTeamTimedMarks(art, side, layout);
}

function requestBothTeamsLayout(
  art: AccumulatedArtState,
  layout: PosterLayout
): void {
  if (deferredTeamLayoutDepth > 0) {
    deferredTeamLayoutDirty = true;
    return;
  }
  relayoutTeamTimedMarks(art, "home", layout);
  relayoutTeamTimedMarks(art, "away", layout);
}

function eventScale(rng: () => number) {
  return markScale() * rand(rng, cfg.composition.markScaleMin, cfg.composition.markScaleMax);
}

function fragmentAngle(rng: () => number, base: number, accuracy: number) {
  if (cfg.animation.staticRender) {
    const ortho = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
    return ortho[Math.floor(rand(rng, 0, ortho.length)) % ortho.length];
  }
  const spread =
    (1 - accuracy / 100) *
    cfg.passAccuracy.maxFragmentation *
    cfg.passAccuracy.alignmentStrength;
  return base + rand(rng, -spread, spread);
}

/** Goal size from markSizes config — recomputed each draw frame. */
export function goalMarkSizePx(
  goal: GoalMark,
  layout: PosterLayout,
  rank = 0
): { widthPx: number; heightPx: number } {
  const rng = markRng(goal.id, goal.minute);
  return resolveGoalMarkSizePx(layout, rank, rng, goal.spawnScale);
}

/** Max width/height of the first goal on a side — ceiling for all other marks. */
export function firstGoalMaxExtent(
  art: AccumulatedArtState,
  side: TeamSide,
  layout: PosterLayout
): number | null {
  const first = art.goals
    .filter((goal) => goal.side === side)
    .sort((a, b) => a.minute - b.minute || a.id.localeCompare(b.id))[0];
  if (!first) return null;

  const { widthPx, heightPx } = goalMarkSizePx(first, layout);
  return Math.max(widthPx, heightPx);
}

/** Upper bound for non-goal mark scale on a side (null until a goal exists). */
export function nonGoalMarkCap(
  art: AccumulatedArtState,
  side: TeamSide,
  layout: PosterLayout
): number | null {
  const extent = firstGoalMaxExtent(art, side, layout);
  if (extent == null) return null;
  return extent * cfg.goals.markCapRatio;
}

export function capMarkSize(sizePx: number, cap: number | null): number {
  if (cap == null || cap <= 0) return sizePx;
  return Math.min(sizePx, cap);
}

export function capMarkDimensions(
  widthPx: number,
  heightPx: number,
  cap: number | null
): { widthPx: number; heightPx: number } {
  if (cap == null || cap <= 0) return { widthPx, heightPx };
  const max = Math.max(widthPx, heightPx);
  if (max <= cap) return { widthPx, heightPx };
  const scale = cap / max;
  return { widthPx: widthPx * scale, heightPx: heightPx * scale };
}

/** Append permanent marks for a discrete feed event — routed by visualMappings. */
export function addEventMark(
  art: AccumulatedArtState,
  event: MatchEvent,
  updateIndex: number,
  layout: PosterLayout,
  match: MatchData
): void {
  const id = `u${updateIndex}-${event.minute}-${event.team}-${event.eventType}`;
  const rng = createRng(updateIndex * 9973 + event.minute * 131 + cfg.randomness.seed);
  const side = event.team;
  const palette = paletteForSide(match, side);
  const accuracy = side === "home"
    ? art.possessionGrid.home.passAccuracy
    : art.possessionGrid.away.passAccuracy;
  const phase = rand(rng, 0, Math.PI * 2);
  const component = getEventVisualComponent(event.eventType);
  const baseScale = usesQuadrantMarkLayout(component)
    ? quadrantBaseScale(component)
    : eventScale(rng);

  switch (component) {
    case VISUAL_COMPONENT.Shot: {
      const squares: BlockSpec[] = [];
      const squareCount = Math.max(1, Math.round(cfg.shots.squaresPerShot * density()));
      const bg = getComponentColor(VISUAL_COMPONENT.Shot, palette, "c1", "c1");
      const fg = getComponentColor(VISUAL_COMPONENT.Shot, palette, "c2", "c2");

      for (let i = 0; i < squareCount; i++) {
        const sqScale = baseScale * rand(rng, 0.85, 1.2);
        squares.push({
          nx: 0,
          ny: 0,
          scale: sqScale,
          layoutScale: 1,
          angle: fragmentAngle(rng, rand(rng, -0.25, 0.25), accuracy),
          bgColor: bg,
          fgColor: fg,
          phase: phase + i * 0.6,
        });
      }
      art.shots.push({ id, side, minute: event.minute, squares });
      requestTeamLayout(art, side, layout);
      break;
    }
    case VISUAL_COMPONENT.ShotOnTarget: {
      const impactColor = getComponentColor(
        VISUAL_COMPONENT.ShotOnTarget,
        palette,
        "c2",
        "c2"
      );
      art.shotsOnTarget.push({
        id,
        side,
        minute: event.minute,
        nx: 0,
        ny: 0,
        spawnScale: baseScale,
        layoutScale: 1,
        innerRatio: cfg.shotsOnTarget.starInnerRatio,
        points: COMPONENT_SIZES.ShotOnTarget?.starpoint ?? 8,
        color: impactColor,
        phase,
      });
      requestTeamLayout(art, side, layout);
      break;
    }
    case VISUAL_COMPONENT.Goal: {
      const goalColor = getComponentColor(VISUAL_COMPONENT.Goal, palette, "c1", "c1");
      const isShootout = event.eventType === "penalty_scored";
      art.goals.push({
        id,
        side,
        minute: event.minute,
        nx: 0,
        ny: 0,
        spawnScale: baseScale,
        layoutScale: 1,
        color: isShootout ? cfg.goals.shootoutBg : goalColor,
        phase,
        ...(isShootout ? { variant: "shootout" as const } : {}),
      });
      requestTeamLayout(art, side, layout);
      break;
    }
    case VISUAL_COMPONENT.Foul: {
      art.fouls.push({
        id,
        side,
        minute: event.minute,
        nx: 0,
        ny: 0,
        spawnScale: baseScale,
        layoutScale: 1,
        phase,
      });
      requestTeamLayout(art, side, layout);
      break;
    }
    case VISUAL_COMPONENT.Corner: {
      art.corners.push({
        id,
        side,
        minute: event.minute,
        nx: 0,
        ny: 0,
        spawnScale: baseScale,
        layoutScale: 1,
        color: palette.c5,
        phase,
      });
      requestTeamLayout(art, side, layout);
      break;
    }
    case VISUAL_COMPONENT.Offside: {
      art.offsides.push({
        id,
        side,
        minute: event.minute,
        nx: 0,
        ny: 0,
        spawnScale: baseScale,
        layoutScale: 1,
        color: getComponentColor(VISUAL_COMPONENT.Offside, palette, "c2", "event.offside"),
        phase,
      });
      requestTeamLayout(art, side, layout);
      break;
    }
    case VISUAL_COMPONENT.YellowCard:
    case VISUAL_COMPONENT.RedCard: {
      const isYellow = event.eventType === "yellow_card";
      art.cards.push({
        id,
        side,
        minute: event.minute,
        nx: 0,
        ny: 0,
        spawnScale: baseScale,
        layoutScale: 1,
        kind: isYellow ? "yellow" : "red",
        phase,
      });
      requestTeamLayout(art, side, layout);
      break;
    }
  }
}

/** Remove the latest goal mark for a team (VAR / offside reversal). */
export function removeCancelledGoalMark(
  art: AccumulatedArtState,
  side: TeamSide,
  options?: { variant?: "regulation" | "shootout" }
): boolean {
  for (let i = art.goals.length - 1; i >= 0; i--) {
    const mark = art.goals[i];
    if (mark.side !== side) continue;
    if (options?.variant === "shootout" && mark.variant !== "shootout") continue;
    if (options?.variant === "regulation" && mark.variant === "shootout") continue;
    art.goals.splice(i, 1);
    art.placement.settledMarkCount[side] = Math.max(
      0,
      art.placement.settledMarkCount[side] - 1
    );
    return true;
  }
  return false;
}

export function denormPoint(nx: number, ny: number, layout: PosterLayout): [number, number] {
  return [
    layout.margin + nx * layout.artworkWidth,
    layout.artworkTop + ny * layout.artworkHeight,
  ];
}

/** Denormalize a mark dimension stored relative to artwork width. */
export { denormSize } from "@/design-system/layout/designScale";

export type { MatchEventType };
