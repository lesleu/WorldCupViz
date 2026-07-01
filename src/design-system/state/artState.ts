import type { MatchEvent, MatchEventType } from "@/data/mockLiveFeed";
import { paletteForSide, type MatchData, type TeamSide } from "@/data/mockMatch";
import {
  computeCompositionAnchors,
  type CompositionAnchors,
  type PosterLayout,
  teamZoneForSide,
} from "@/design-system/layout/posterLayout";
import {
  createPlacementState,
  findPlacement,
  resetPlacementState,
  type PlacementState,
} from "@/design-system/layout/placementEngine";
import { createRng, randBetween } from "@/utils/seededRandom";
import { getComponentColor } from "@/design-system/color/resolveColor";
import { getEventVisualComponent, VISUAL_COMPONENT, type VisualComponent } from "@/design-system/mapping/visualMappings";
import {
  normSize,
  resolveComponentSize,
  scaleDesignPx,
} from "@/design-system/layout/designScale";
import {
  resolveSalienceMarkSizePx,
  shotMarkDesignSize,
} from "@/design-system/layout/compositionDensity";
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
  size: number;
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
  outerRadius: number;
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
  height: number;
  width: number;
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
  width: number;
  height: number;
  phase: number;
}

/** YellowCard / RedCard — colored rectangle with black ovals. */
export interface CardMark {
  id: string;
  side: TeamSide;
  minute: number;
  nx: number;
  ny: number;
  width: number;
  height: number;
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
  size: number;
  angle: number;
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
  width: number;
  height: number;
  color: string;
  phase: number;
}

/**
 * Accumulated art state — each team builds its own side artifact.
 * possessionGrid morphs continuously; event marks are append-only until reset.
 */
export interface AccumulatedArtState {
  possessionGrid: ContinuousMatchState;
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

function placeMark(
  layout: PosterLayout,
  side: TeamSide,
  widthPx: number,
  heightPx: number,
  placement: PlacementState,
  rng: () => number,
  innerBias: number,
  preferCell: number,
  component: VisualComponent,
  minute: number
): [number, number] {
  const [nx, ny] = findPlacement(
    layout,
    side,
    widthPx,
    heightPx,
    placement,
    rng,
    { innerBias, preferCell, component, minute }
  );
  return [
    layout.margin + nx * layout.artworkWidth,
    layout.artworkTop + ny * layout.artworkHeight,
  ];
}

const markScale = () => cfg.composition.markScale;
const density = () => cfg.composition.densityMultiplier;

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

function goalUpdateIndex(markId: string): number {
  const match = /^u(\d+)-/.exec(markId);
  return match ? Number(match[1]) : 0;
}

/** Figma-token goal size — no zone-fill or mark-scale jitter. */
export function goalMarkSizePx(
  goal: GoalMark,
  layout: PosterLayout
): { widthPx: number; heightPx: number } {
  const updateIndex = goalUpdateIndex(goal.id);
  const rng = createRng(updateIndex * 9973 + goal.minute * 131 + cfg.randomness.seed);
  const heightJitter = rand(rng, cfg.goals.heightJitterMin, cfg.goals.heightJitterMax);
  const widthPx = resolveComponentSize(
    VISUAL_COMPONENT.Goal,
    layout,
    rng,
    "x",
    goal.side,
    { zoneFill: false }
  );
  const heightPx =
    resolveComponentSize(
      VISUAL_COMPONENT.Goal,
      layout,
      rng,
      "y",
      goal.side,
      { zoneFill: false }
    ) * heightJitter;

  return {
    widthPx: widthPx * cfg.goals.displayScale,
    heightPx: heightPx * cfg.goals.displayScale,
  };
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
  const anchors = computeCompositionAnchors(layout);
  const accuracy = side === "home"
    ? art.possessionGrid.home.passAccuracy
    : art.possessionGrid.away.passAccuracy;
  const phase = rand(rng, 0, Math.PI * 2);
  const baseScale = eventScale(rng);
  const component = getEventVisualComponent(event.eventType);
  const placement = art.placement;
  const innerBias =
    side === "home" ? anchors.homeInnerBias : anchors.awayInnerBias;
  let slotCounter = art.shots.length + art.goals.length + art.fouls.length;

  switch (component) {
    case VISUAL_COMPONENT.Shot: {
      const squares: BlockSpec[] = [];
      const squareCount = Math.ceil(cfg.shots.squaresPerShot * density());
      const bg = getComponentColor(VISUAL_COMPONENT.Shot, palette, "c1", "c1");
      const fg = getComponentColor(VISUAL_COMPONENT.Shot, palette, "c2", "c2");
      const shotRank = art.shots.filter((mark) => mark.side === side).length;

      for (let i = 0; i < squareCount; i++) {
        const sqScale = baseScale * rand(rng, 0.85, 1.2);
        const designPx = shotMarkDesignSize(shotRank) * sqScale;
        const sizePx = scaleDesignPx(designPx, layout);
        const [x, y] = placeMark(
          layout,
          side,
          sizePx,
          sizePx,
          placement,
          rng,
          innerBias * 0.9,
          slotCounter + i,
          VISUAL_COMPONENT.Shot,
          event.minute
        );
        squares.push({
          nx: normX(x, layout),
          ny: normY(y, layout),
          size: normSize(sizePx, layout),
          angle: fragmentAngle(rng, rand(rng, -0.25, 0.25), accuracy),
          bgColor: bg,
          fgColor: fg,
          phase: phase + i * 0.6,
        });
      }
      art.shots.push({ id, side, minute: event.minute, squares });
      break;
    }
    case VISUAL_COMPONENT.ShotOnTarget: {
      slotCounter += 1;
      const sotRank = art.shotsOnTarget.filter((mark) => mark.side === side).length;
      const sqScale = baseScale * rand(rng, 0.85, 1.2);
      const designPx = shotMarkDesignSize(sotRank) * sqScale;
      const diameterPx = scaleDesignPx(designPx, layout);
      const outerPx = diameterPx / 2;
      const [x, y] = placeMark(
        layout,
        side,
        diameterPx,
        diameterPx,
        placement,
        rng,
        innerBias * 0.45,
        slotCounter,
        VISUAL_COMPONENT.ShotOnTarget,
        event.minute
      );
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
        nx: normX(x, layout),
        ny: normY(y, layout),
        outerRadius: normSize(outerPx, layout),
        innerRatio: cfg.shotsOnTarget.starInnerRatio,
        points: COMPONENT_SIZES.ShotOnTarget?.starpoint ?? 8,
        color: impactColor,
        phase,
      });
      break;
    }
    case VISUAL_COMPONENT.Goal: {
      slotCounter += 2;
      const heightJitter = rand(rng, cfg.goals.heightJitterMin, cfg.goals.heightJitterMax);
      const widthPx = resolveComponentSize(
        VISUAL_COMPONENT.Goal,
        layout,
        rng,
        "x",
        side,
        { zoneFill: false }
      );
      const heightPx =
        resolveComponentSize(
          VISUAL_COMPONENT.Goal,
          layout,
          rng,
          "y",
          side,
          { zoneFill: false }
        ) * heightJitter;
      const [x, y] = placeMark(
        layout,
        side,
        widthPx,
        heightPx,
        placement,
        rng,
        innerBias * 0.35,
        slotCounter,
        VISUAL_COMPONENT.Goal,
        event.minute
      );
      const goalColor = getComponentColor(VISUAL_COMPONENT.Goal, palette, "c1", "c1");
      const isShootout = event.eventType === "penalty_scored";
      art.goals.push({
        id,
        side,
        minute: event.minute,
        nx: normX(x, layout),
        ny: normY(y, layout),
        height: normSize(heightPx, layout),
        width: normSize(widthPx, layout),
        color: isShootout ? cfg.goals.shootoutBg : goalColor,
        phase,
        ...(isShootout ? { variant: "shootout" as const } : {}),
      });
      break;
    }
    case VISUAL_COMPONENT.Foul: {
      slotCounter += 1;
      const foulRank = art.fouls.filter((mark) => mark.side === side).length;
      const sizePx = resolveSalienceMarkSizePx(
        VISUAL_COMPONENT.Foul,
        foulRank,
        layout,
        rng,
        side,
        baseScale
      );
      const [x, y] = placeMark(
        layout,
        side,
        sizePx,
        sizePx,
        placement,
        rng,
        innerBias * 0.3,
        slotCounter,
        VISUAL_COMPONENT.Foul,
        event.minute
      );
      art.fouls.push({
        id,
        side,
        minute: event.minute,
        nx: normX(x, layout),
        ny: normY(y, layout),
        width: normSize(sizePx, layout),
        height: normSize(sizePx, layout),
        phase,
      });
      break;
    }
    case VISUAL_COMPONENT.Corner: {
      slotCounter += 1;
      const cornerRank = art.corners.filter((mark) => mark.side === side).length;
      const cornerPx = resolveSalienceMarkSizePx(
        VISUAL_COMPONENT.Corner,
        cornerRank,
        layout,
        rng,
        side,
        baseScale * rand(rng, 0.9, 1.1)
      );
      const [x, y] = placeMark(
        layout,
        side,
        cornerPx,
        cornerPx,
        placement,
        rng,
        innerBias * 0.28,
        slotCounter,
        VISUAL_COMPONENT.Corner,
        event.minute
      );
      art.corners.push({
        id,
        side,
        minute: event.minute,
        nx: normX(x, layout),
        ny: normY(y, layout),
        size: normSize(cornerPx, layout),
        angle: fragmentAngle(rng, rand(rng, 0, Math.PI * 0.5), accuracy),
        color: getComponentColor(VISUAL_COMPONENT.Corner, palette, "c4", "c4"),
        phase,
      });
      break;
    }
    case VISUAL_COMPONENT.Offside: {
      slotCounter += 1;
      const offRank = art.offsides.filter((mark) => mark.side === side).length;
      const widthPx =
        resolveSalienceMarkSizePx(
          VISUAL_COMPONENT.Offside,
          offRank,
          layout,
          rng,
          side,
          baseScale
        ) * 1.05;
      const heightPx =
        resolveComponentSize(VISUAL_COMPONENT.Offside, layout, undefined, "y", side) *
        baseScale *
        (offRank >= (cfg.composition.salienceSizes[VISUAL_COMPONENT.Offside]?.firstFullSizeCount ?? 3)
          ? Math.pow(
              cfg.composition.salienceSizes[VISUAL_COMPONENT.Offside]?.sizeDecayRatio ?? 0.9,
              offRank -
                (cfg.composition.salienceSizes[VISUAL_COMPONENT.Offside]?.firstFullSizeCount ?? 3) +
                1
            )
          : 1);
      const [x, y] = placeMark(
        layout,
        side,
        widthPx,
        heightPx,
        placement,
        rng,
        innerBias * 0.4,
        slotCounter,
        VISUAL_COMPONENT.Offside,
        event.minute
      );
      art.offsides.push({
        id,
        side,
        minute: event.minute,
        nx: normX(x, layout),
        ny: normY(y, layout),
        width: normSize(widthPx, layout),
        height: normSize(heightPx, layout),
        color: getComponentColor(VISUAL_COMPONENT.Offside, palette, "c3", "event.offside"),
        phase,
      });
      break;
    }
    case VISUAL_COMPONENT.YellowCard:
    case VISUAL_COMPONENT.RedCard: {
      slotCounter += 1;
      const isYellow = event.eventType === "yellow_card";
      const cardComponent = isYellow
        ? VISUAL_COMPONENT.YellowCard
        : VISUAL_COMPONENT.RedCard;
      const cardRank = art.cards.filter((mark) => mark.side === side).length;
      const cardPx = resolveSalienceMarkSizePx(
        cardComponent,
        cardRank,
        layout,
        rng,
        side,
        baseScale
      );
      const [x, y] = placeMark(
        layout,
        side,
        cardPx,
        cardPx,
        placement,
        rng,
        innerBias * 0.32,
        slotCounter,
        cardComponent,
        event.minute
      );
      art.cards.push({
        id,
        side,
        minute: event.minute,
        nx: normX(x, layout),
        ny: normY(y, layout),
        width: normSize(cardPx, layout),
        height: normSize(cardPx, layout),
        kind: isYellow ? "yellow" : "red",
        phase,
      });
      break;
    }
  }
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
