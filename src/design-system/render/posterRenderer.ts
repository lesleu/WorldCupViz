import type p5 from "p5";
import {
  capMarkDimensions,
  capMarkSize,
  denormPoint,
  denormSize,
  goalMarkSizePx,
  nonGoalMarkCap,
  type AccumulatedArtState,
  type ContinuousMatchState,
} from "@/design-system/state/artState";
import { motionIntensity } from "@/design-system/motion/energyState";
import { getComponentColor } from "@/design-system/color/resolveColor";
import { VISUAL_COMPONENT } from "@/design-system/mapping/visualMappings";
import {
  resolveComponentSize,
} from "@/design-system/layout/designScale";
import {
  buildPossessionGridSlots,
  resolvePossessionCircleDiameter,
  type PossessionCircleSlot,
} from "@/design-system/layout/possessionGridLayout";
import { MARK_DRAW_ORDER } from "@/design-system/layout/drawOrder";
import {
  markAgeOpacity,
  rankInDataset,
} from "@/design-system/layout/compositionDensity";
import { paletteForSide, type MatchData } from "@/data/mockMatch";
import { drawTeamCodeStretchedText } from "@/lib/stretchedInterText";
import {
  applyCanvasFont,
  resolveInterSemiBoldFontFamily,
  resolveKickoffCanvasFontFamily,
  waitForMatchChromeFonts,
} from "@/lib/canvasFontReady";
import {
  computeLayout,
  computeArtworkLayout,
  gridRegionForSide,
  markRegionForSide,
  type PosterLayout,
} from "@/design-system/layout/posterLayout";
import { drawSvgComponent, warnIfSvgAssetsMissing } from "@/design-system/render/svgRenderer";
import type { ReplayEngine, ReplaySnapshot } from "@/engine/replayEngine";
import { createRng, randBetween, seededNoise } from "@/utils/seededRandom";
import { cfg } from "@/config";

/**
 * Poster renderer — two-sided generative system keyed to visualMappings.ts.
 * See VISUAL_LANGUAGE.md for art-direction context.
 */

type Rgb = [number, number, number];
type TeamSide = "home" | "away";

function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  if (h.length !== 6) return [0, 0, 0];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function fillRgb(p: p5, rgb: Rgb, alpha?: number) {
  if (alpha === undefined) p.fill(rgb[0], rgb[1], rgb[2]);
  else p.fill(rgb[0], rgb[1], rgb[2], alpha);
}

function strokeRgb(p: p5, rgb: Rgb, alpha?: number) {
  if (alpha === undefined) p.stroke(rgb[0], rgb[1], rgb[2]);
  else p.stroke(rgb[0], rgb[1], rgb[2], alpha);
}

function backgroundRgb(p: p5, rgb: Rgb) {
  p.background(rgb[0], rgb[1], rgb[2]);
}

function lerpRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function drawVerticalGradientRect(
  p: p5,
  left: number,
  top: number,
  w: number,
  h: number,
  topColor: Rgb,
  bottomColor: Rgb
) {
  p.noStroke();
  const steps = Math.max(Math.ceil(h), 1);
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : i / (steps - 1);
    fillRgb(p, lerpRgb(topColor, bottomColor, t));
    p.rect(left, top + i, w, 1);
  }
}

function passAccuracy(state: ContinuousMatchState, side: TeamSide) {
  return side === "home" ? state.home.passAccuracy : state.away.passAccuracy;
}

export function createReplaySketch(
  match: MatchData,
  getSize: () => { width: number; height: number },
  getEngine: () => ReplayEngine | null,
  options: { artworkOnly?: boolean; liveAssetMotion?: boolean } = {}
) {
  const artworkOnly = options.artworkOnly ?? false;
  const liveAssetMotion = options.liveAssetMotion ?? false;

  return (p: p5) => {
    let time = 0;
    let layout!: PosterLayout;
    let grainDots: { x: number; y: number }[] = [];
    let possessionSlots: { home: PossessionCircleSlot[]; away: PossessionCircleSlot[] } = {
      home: [],
      away: [],
    };
    let possessionCircleSize: { home: number; away: number } = { home: 0, away: 0 };
    let lastFrameMs = 0;

    const chromeBoldFamily = () => resolveKickoffCanvasFontFamily();
    const chromeMetaFamily = () => resolveInterSemiBoldFontFamily();

    function fillChromeRgb(ctx: CanvasRenderingContext2D, rgb: Rgb, alpha = 255) {
      ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha / 255})`;
    }

    const chrome = hexToRgb(cfg.colors.cream);
    const ink = hexToRgb(cfg.colors.text);
    const inkMuted = hexToRgb(cfg.colors.textMuted);
    const black = hexToRgb(cfg.colors.black);

    function rebuildGrain(width: number, height: number) {
      grainDots = [];
      const rng = createRng(cfg.randomness.seed + width * 17 + height * 31);
      const count = Math.floor(width * height * cfg.texture.grainAmount);
      for (let i = 0; i < count; i++) {
        grainDots.push({
          x: randBetween(rng, 0, width),
          y: randBetween(rng, 0, height),
        });
      }
    }

    function rebuildLayout() {
      const { width, height } = getSize();
      layout = artworkOnly
        ? computeArtworkLayout(width, height)
        : computeLayout(width, height);
      const seed = cfg.randomness.seed;
      possessionSlots.home = buildPossessionGridSlots(layout, "home", seed);
      possessionSlots.away = buildPossessionGridSlots(layout, "away", seed);
      possessionCircleSize.home = resolvePossessionCircleDiameter(layout, "home");
      possessionCircleSize.away = resolvePossessionCircleDiameter(layout, "away");
      rebuildGrain(width, height);
    }

    function motion(snapshot: ReplaySnapshot) {
      if (cfg.animation.staticRender) return 0;
      return motionIntensity(snapshot.energy);
    }

    function breathe(possession: number, side: TeamSide, intensity: number) {
      if (cfg.animation.staticRender) return 1;
      const poss = possession / 100;
      const phase = side === "home" ? 0 : Math.PI;
      return (
        1 +
        Math.sin(time * cfg.animation.breathingSpeed * intensity + phase) *
          cfg.animation.breathingAmount *
          intensity *
          (cfg.animation.breathingPossessionWeight + poss)
      );
    }

    function gameArtPresence(minute: number) {
      return minute > 0 ? 1 : 0;
    }

    /** Per-component live pulse — each asset type breathes at its own pace. */
    type LiveAssetKind =
      | "possession"
      | "passAccuracy"
      | "goal"
      | "shot"
      | "shotOnTarget"
      | "foul"
      | "card"
      | "corner"
      | "offside";

    const LIVE_ASSET_RHYTHMS: Record<
      LiveAssetKind,
      { speed: number; phase: number }
    > = {
      possession: { speed: 1.05, phase: 0 },
      passAccuracy: { speed: 1.52, phase: 0.65 },
      goal: { speed: 0.78, phase: 1.45 },
      shot: { speed: 1.28, phase: 2.25 },
      shotOnTarget: { speed: 1.62, phase: 0.35 },
      foul: { speed: 1.08, phase: 2.85 },
      card: { speed: 1.42, phase: 1.75 },
      corner: { speed: 1.68, phase: 3.05 },
      offside: { speed: 0.88, phase: 4.15 },
    };

    function liveAssetScale(kind: LiveAssetKind, itemPhase = 0): number {
      if (!liveAssetMotion) return 1;

      const { speed, phase } = LIVE_ASSET_RHYTHMS[kind];
      const base = cfg.animation.liveBreathingSpeed;
      const amount = cfg.animation.liveBreathingAmount;
      const t = time * base * speed + phase + itemPhase;

      return (
        1 +
        Math.sin(t) * amount +
        Math.sin(t * 1.71 + 0.8) * amount * 0.3
      );
    }

    function advanceMotionClock() {
      time += liveAssetMotion
        ? cfg.animation.liveUpdateSpeed
        : cfg.animation.updateSpeed;
    }

    /** One-by-one reveal for continuous assets during the kickoff window (full opacity when visible). */
    function staggeredItemPresence(minute: number, index: number, total: number): number {
      if (total <= 0 || minute <= 0) return 0;
      const phase = cfg.replay.kickoffPhaseMinutes;
      if (minute >= phase) return 1;

      const step = phase / total;
      const start = index * step;
      if (minute <= start) return 0;
      return 1;
    }

    /** Inter ExtraBold — tight tracking, width-fill then vertical stretch per gradient half. */
    function drawTeamBackgroundType() {
      const white: Rgb = [255, 255, 255];
      const ctx = p.drawingContext as CanvasRenderingContext2D;

      for (const side of ["home", "away"] as const) {
        const zone = side === "home" ? layout.homeZone : layout.awayZone;
        const code = side === "home" ? match.homeTeamCode : match.awayTeamCode;
        if (code.length === 0) continue;

        drawTeamCodeStretchedText(
          ctx,
          {
            left: zone.left,
            top: zone.top,
            width: zone.width,
            height: zone.height,
          },
          code,
          `rgb(${white[0]},${white[1]},${white[2]})`
        );
      }

      p.textStyle(p.NORMAL);
    }

    function vibrate(phase: number, intensity: number, amp = 2) {
      if (cfg.animation.staticRender) return { x: 0, y: 0 };
      return {
        x: Math.sin(time * cfg.animation.driftSpeed * intensity + phase) * amp * intensity,
        y:
          Math.cos(time * cfg.animation.splatDriftSpeed * intensity + phase * 1.3) *
          amp *
          0.65 *
          intensity,
      };
    }

    /** PossessionGrid — aligned row/column grid; circles stagger in one-by-one early in the match. */
    function drawPossessionGrid(snapshot: ReplaySnapshot) {
      const { continuous, minute } = snapshot;
      if (minute <= 0) return;
      const intensity = motion(snapshot);

      for (const side of ["home", "away"] as const) {
        const possession =
          side === "home" ? continuous.home.possession : continuous.away.possession;
        const palette = paletteForSide(match, side);
        const color = getComponentColor(
          VISUAL_COMPONENT.PossessionGrid,
          palette,
          "c3",
          "c3"
        );
        const rgb = hexToRgb(color);
        const slots = possessionSlots[side];
        const g = cfg.possession;
        const total = slots.length;
        if (total === 0 || !Number.isFinite(possessionCircleSize[side])) continue;
        const filled = Math.round((possession / 100) * total);
        if (filled <= 0) continue;
        const pulse = breathe(possession, side, intensity);
        const circleSize = possessionCircleSize[side];
        const size = circleSize * (1 + (pulse - 1) * g.gridBreathingAmount);

        p.noStroke();
        for (let i = 0; i < filled; i++) {
          const itemPresence = staggeredItemPresence(minute, i, total);
          if (itemPresence <= 0.01) continue;

          const { x: cx, y: cy } = slots[i];
          const ripple =
            1 +
            Math.sin(time * cfg.animation.breathingSpeed * 2 + i * 0.15) *
              g.gridBreathingAmount *
              intensity;
          fillRgb(p, rgb, g.filledOpacity * itemPresence);
          const liveScale = liveAssetScale(
            "possession",
            i * 0.11 + (side === "away" ? 1.7 : 0)
          );
          p.circle(cx, cy, size * ripple * itemPresence * liveScale);
        }
      }
    }

    function withMarkAlpha(alpha: number, draw: () => void) {
      if (alpha >= 0.999) {
        draw();
        return;
      }
      p.push();
      try {
        (p.drawingContext as CanvasRenderingContext2D).globalAlpha = alpha;
        draw();
      } finally {
        (p.drawingContext as CanvasRenderingContext2D).globalAlpha = 1;
        p.pop();
      }
    }

    function drawZoneDebug() {
      if (!cfg.composition.showZoneDebug) return;
      p.noFill();
      strokeRgb(p, black, 80);
      p.strokeWeight(1);
      for (const side of ["home", "away"] as const) {
        const grid = gridRegionForSide(layout, side);
        const mark = markRegionForSide(layout, side);
        p.rect(grid.left, grid.top, grid.width, grid.height);
        strokeRgb(p, hexToRgb(cfg.colors.textMuted), 100);
        p.rect(mark.left, mark.top, mark.width, mark.height);
      }
      if (layout.centerGapRight > layout.centerGapLeft) {
        strokeRgb(p, hexToRgb(cfg.colors.cream), 120);
        p.rect(
          layout.centerGapLeft,
          layout.homeZone.top,
          layout.centerGapRight - layout.centerGapLeft,
          layout.homeZone.height
        );
      }
    }

    /** PassAccuracy — sparks stagger in one-by-one during the kickoff reveal window. */
    function drawPassAccuracy(snapshot: ReplaySnapshot) {
      const { continuous, minute } = snapshot;
      if (minute <= 0) return;
      const pa = cfg.passAccuracy;

      for (const side of ["home", "away"] as const) {
        const accuracy = passAccuracy(continuous, side);
        const isClean = accuracy >= pa.cleanThreshold;
        const count = isClean ? pa.cleanSparkCount : pa.brokenSparkCount;
        const region = markRegionForSide(layout, side);
        const palette = paletteForSide(match, side);

        for (let i = 0; i < count; i++) {
          const itemPresence = staggeredItemPresence(minute, i, count);
          if (itemPresence <= 0.01) continue;

          const rng = createRng(
            cfg.randomness.seed + (side === "home" ? 11 : 29) + i * 17
          );
          const nx = randBetween(rng, 0.08, 0.92);
          const ny = randBetween(rng, 0.06, 0.94);
          const x = region.left + region.width * nx;
          const y = region.top + region.height * ny;
          const v = vibrate(i * 1.1, motion(snapshot), 0.6);
          const sparkSize = capMarkSize(
            resolveComponentSize(
              VISUAL_COMPONENT.PassAccuracy,
              layout,
              rng,
              "uniform",
              side
            ),
            nonGoalMarkCap(snapshot.art, side, layout)
          );

          p.push();
          try {
            (p.drawingContext as CanvasRenderingContext2D).globalAlpha = itemPresence;
            drawSvgComponent(
              p,
              VISUAL_COMPONENT.PassAccuracy,
              palette,
              x + v.x,
              y + v.y,
              {
                scalePx:
                  sparkSize *
                  itemPresence *
                  liveAssetScale("passAccuracy", i * 0.18),
                rotation: cfg.animation.staticRender ? 0 : randBetween(rng, 0, Math.PI * 2),
              }
            );
          } finally {
            (p.drawingContext as CanvasRenderingContext2D).globalAlpha = 1;
          }
        }
      }
    }

    /** Shot — layered SVG stamps. */
    function drawShot(
      art: AccumulatedArtState,
      continuous: ContinuousMatchState,
      intensity: number,
      burstScale: number
    ) {
      for (const mark of art.shots) {
        const palette = paletteForSide(match, mark.side);
        const poss =
          mark.side === "home" ? continuous.home.possession : continuous.away.possession;
        const pulse = breathe(poss, mark.side, intensity) * burstScale;
        const shotRank = rankInDataset(art, mark.side, "shot", mark.id);
        const ageAlpha = markAgeOpacity(shotRank);
        for (const sq of mark.squares) {
          const [x, y] = denormPoint(sq.nx, sq.ny, layout);
          const v = vibrate(sq.phase, intensity, 1.1);
          const sizePx = capMarkSize(
            denormSize(sq.size, layout) *
              pulse *
              liveAssetScale("shot", sq.phase),
            nonGoalMarkCap(art, mark.side, layout)
          );
          withMarkAlpha(ageAlpha, () => {
            drawSvgComponent(p, VISUAL_COMPONENT.Shot, palette, x + v.x, y + v.y, {
              scalePx: sizePx,
              rotation: sq.angle,
            });
          });
        }
      }
    }

    /** ShotOnTarget — SVG burst. */
    function drawShotOnTarget(
      art: AccumulatedArtState,
      intensity: number,
      burstScale: number
    ) {
      for (const mark of art.shotsOnTarget) {
        const palette = paletteForSide(match, mark.side);
        const [x, y] = denormPoint(mark.nx, mark.ny, layout);
        const v = vibrate(mark.phase, intensity, 1.4);
        const expand = cfg.animation.staticRender
          ? 1
          : 1 +
            Math.sin(time * cfg.animation.rayPulseSpeed * 2 + mark.phase) * 0.08 * intensity;
        const sizePx = capMarkSize(
          denormSize(mark.outerRadius, layout) *
            2 *
            expand *
            burstScale *
            liveAssetScale("shotOnTarget", mark.phase),
          nonGoalMarkCap(art, mark.side, layout)
        );
        const ageAlpha = markAgeOpacity(
          rankInDataset(art, mark.side, "shot_on_target", mark.id)
        );
        withMarkAlpha(ageAlpha, () => {
          drawSvgComponent(p, VISUAL_COMPONENT.ShotOnTarget, palette, x + v.x, y + v.y, {
            scalePx: sizePx,
            rotation: mark.phase * 0.1,
          });
        });
      }
    }

    /** Foul — layered SVG. */
    function drawFoul(art: AccumulatedArtState, intensity: number) {
      for (const mark of art.fouls) {
        const palette = paletteForSide(match, mark.side);
        const [x, y] = denormPoint(mark.nx, mark.ny, layout);
        const v = vibrate(mark.phase, intensity, 1);
        const sizePx = capMarkSize(
          denormSize(mark.width, layout) * liveAssetScale("foul", mark.phase),
          nonGoalMarkCap(art, mark.side, layout)
        );
        const ageAlpha = markAgeOpacity(rankInDataset(art, mark.side, "foul", mark.id));
        withMarkAlpha(ageAlpha, () => {
          drawSvgComponent(p, VISUAL_COMPONENT.Foul, palette, x + v.x, y + v.y, {
            scalePx: sizePx,
          });
        });
      }
    }

    /** Goal — layered SVG panel. */
    function drawGoal(art: AccumulatedArtState, intensity: number) {
      for (const goal of art.goals) {
        const palette = paletteForSide(match, goal.side);
        const [x, y] = denormPoint(goal.nx, goal.ny, layout);
        const v = vibrate(goal.phase, intensity, 1.2);
        const pulse = cfg.animation.staticRender
          ? 1
          : 1 +
            Math.sin(time * cfg.animation.breathingSpeed * 2 + goal.phase) *
              0.08 *
              intensity;
        const { widthPx, heightPx } = goalMarkSizePx(goal, layout);
        const w = widthPx * pulse;
        const h = heightPx * pulse;
        const colorOverrides =
          goal.variant === "shootout"
            ? {
                c1: cfg.goals.shootoutBg,
                c4: cfg.goals.shootoutPattern,
              }
            : undefined;
        withMarkAlpha(markAgeOpacity(
          art.goals
            .filter((g) => g.side === goal.side)
            .sort((a, b) => a.minute - b.minute || a.id.localeCompare(b.id))
            .findIndex((g) => g.id === goal.id)
        ), () => {
          drawSvgComponent(p, VISUAL_COMPONENT.Goal, palette, x + v.x, y + v.y, {
            widthPx: w,
            heightPx: h,
            colorOverrides,
          });
        });
      }
    }

    /** YellowCard / RedCard — layered SVG. */
    function drawCard(
      art: AccumulatedArtState,
      intensity: number,
      burstScale: number
    ) {
      for (const scar of art.cards) {
        const palette = paletteForSide(match, scar.side);
        const component =
          scar.kind === "yellow" ? VISUAL_COMPONENT.YellowCard : VISUAL_COMPONENT.RedCard;
        const [x, y] = denormPoint(scar.nx, scar.ny, layout);
        const v = vibrate(scar.phase, intensity);
        const sizePx = capMarkSize(
          denormSize(scar.width, layout) *
            burstScale *
            liveAssetScale("card", scar.phase),
          nonGoalMarkCap(art, scar.side, layout)
        );
        withMarkAlpha(markAgeOpacity(rankInDataset(art, scar.side, "card", scar.id)), () => {
          drawSvgComponent(p, component, palette, x + v.x, y + v.y, { scalePx: sizePx });
        });
      }
    }

    /** Corner — SVG pinwheel. */
    function drawCorner(art: AccumulatedArtState, intensity: number) {
      for (const corner of art.corners) {
        const palette = paletteForSide(match, corner.side);
        const [x, y] = denormPoint(corner.nx, corner.ny, layout);
        const v = vibrate(corner.phase, intensity);
        const sizePx = capMarkSize(
          denormSize(corner.size, layout) * liveAssetScale("corner", corner.phase),
          nonGoalMarkCap(art, corner.side, layout)
        );
        withMarkAlpha(markAgeOpacity(rankInDataset(art, corner.side, "corner", corner.id)), () => {
          drawSvgComponent(p, VISUAL_COMPONENT.Corner, palette, x + v.x, y + v.y, {
            scalePx: sizePx,
            rotation: corner.angle,
          });
        });
      }
    }

    /** Offside — SVG wave stack. */
    function drawOffside(art: AccumulatedArtState, intensity: number) {
      for (const mark of art.offsides) {
        const palette = paletteForSide(match, mark.side);
        const [x, y] = denormPoint(mark.nx, mark.ny, layout);
        const v = vibrate(mark.phase, intensity, 0.8);
        const live = liveAssetScale("offside", mark.phase);
        const capped = capMarkDimensions(
          denormSize(mark.width, layout) * live,
          denormSize(mark.height, layout) * live,
          nonGoalMarkCap(art, mark.side, layout)
        );
        withMarkAlpha(markAgeOpacity(rankInDataset(art, mark.side, "offside", mark.id)), () => {
          drawSvgComponent(p, VISUAL_COMPONENT.Offside, palette, x + v.x, y + v.y, {
            widthPx: capped.widthPx,
            heightPx: capped.heightPx,
          });
        });
      }
    }

    /** Accumulated marks — back→front order from MARK_DRAW_ORDER. */
    function drawAccumulatedMarks(
      art: AccumulatedArtState,
      continuous: ContinuousMatchState,
      intensity: number,
      burst: number
    ) {
      const burstScale = cfg.animation.staticRender ? 1 : 1 + burst * 0.22;
      void MARK_DRAW_ORDER;
      drawGoal(art, intensity);
      drawFoul(art, intensity);
      drawShot(art, continuous, intensity, burstScale);
      drawOffside(art, intensity);
      drawCorner(art, intensity);
      drawShotOnTarget(art, intensity, burstScale);
      drawCard(art, intensity, burstScale);
    }

    /** Dark chrome bands + team halves with c1/c4 gradients. */
    function drawPosterBackground() {
      backgroundRgb(p, chrome);

      const homePalette = paletteForSide(match, "home");
      const awayPalette = paletteForSide(match, "away");
      const { homeZone, awayZone } = layout;

      drawVerticalGradientRect(
        p,
        homeZone.left,
        homeZone.top,
        homeZone.width,
        homeZone.height,
        hexToRgb(homePalette.c4),
        hexToRgb(homePalette.c1)
      );
      drawVerticalGradientRect(
        p,
        awayZone.left,
        awayZone.top,
        awayZone.width,
        awayZone.height,
        hexToRgb(awayPalette.c1),
        hexToRgb(awayPalette.c4)
      );

      if (layout.centerGapRight > layout.centerGapLeft) {
        p.noStroke();
        fillRgb(p, chrome);
        p.rect(
          layout.centerGapLeft,
          homeZone.top,
          layout.centerGapRight - layout.centerGapLeft,
          homeZone.height
        );
      }

      if (!artworkOnly) {
        p.noStroke();
        fillRgb(p, chrome);
        p.rect(0, 0, layout.width, layout.titleBandBottom);
        p.rect(0, layout.artworkBottom, layout.width, layout.height - layout.artworkBottom);
      }
    }

    /** Opaque header/footer slab — drawn last so art never shows through game info. */
    function drawPosterChromeMask() {
      p.noStroke();
      fillRgb(p, chrome);
      p.rect(0, 0, layout.width, layout.titleBandBottom);
      p.rect(0, layout.artworkBottom, layout.width, layout.height - layout.artworkBottom);
    }

    /** MatchChrome — title + centered meta on dark chrome, off-white type. */
    function drawMatchChrome(_snapshot: ReplaySnapshot) {
      const ctx = p.drawingContext as CanvasRenderingContext2D;
      const matchTitleSize = cfg.typography.teamNameSize * 0.5;
      const vsSize = cfg.typography.vsSize;
      const metaSize = cfg.typography.metaSize + 1;
      const dateSize = metaSize - 1;
      const pad = cfg.layout.posterPadding;
      const metaGap = cfg.layout.headerMetaGap;
      const titleY = pad + matchTitleSize * 0.55;
      const titleBottom = titleY + matchTitleSize * 0.45;
      const venueY = titleBottom + metaGap;
      const dateY = venueY + metaSize + 2;

      const homeLabel = match.homeTeam.toUpperCase();
      const awayLabel = match.awayTeam.toUpperCase();
      const vsLabel = "vs";
      const boldFamily = chromeBoldFamily();
      const metaFamily = chromeMetaFamily();

      applyCanvasFont(ctx, 800, matchTitleSize, boldFamily);
      const homeW = ctx.measureText(homeLabel).width;
      applyCanvasFont(ctx, 800, vsSize, boldFamily);
      const vsW = ctx.measureText(vsLabel).width;
      applyCanvasFont(ctx, 800, matchTitleSize, boldFamily);
      const awayW = ctx.measureText(awayLabel).width;

      const gap = 10;
      const totalW = homeW + gap + vsW + gap + awayW;
      let x = p.width / 2 - totalW / 2;

      ctx.textBaseline = "middle";
      ctx.textAlign = "left";

      applyCanvasFont(ctx, 800, matchTitleSize, boldFamily);
      fillChromeRgb(ctx, ink);
      ctx.fillText(homeLabel, x, titleY);
      x += homeW + gap;

      applyCanvasFont(ctx, 800, vsSize, boldFamily);
      fillChromeRgb(ctx, inkMuted);
      ctx.fillText(vsLabel, x, titleY);
      x += vsW + gap;

      applyCanvasFont(ctx, 800, matchTitleSize, boldFamily);
      fillChromeRgb(ctx, ink);
      ctx.fillText(awayLabel, x, titleY);

      const venue = match.venue ?? match.stage;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      applyCanvasFont(ctx, 600, metaSize, metaFamily);
      fillChromeRgb(ctx, ink);
      ctx.fillText(venue, p.width / 2, venueY);
      applyCanvasFont(ctx, 600, dateSize, metaFamily);
      fillChromeRgb(ctx, inkMuted);
      ctx.fillText(match.date, p.width / 2, dateY);
    }

    function drawMatchProgress(snapshot: ReplaySnapshot) {
      const axisY = layout.waveformBottom - cfg.layout.waveformAxisOffset;
      const pad = cfg.layout.posterPadding;
      const left = pad;
      const right = p.width - pad;
      const progressX =
        left +
        (right - left) * (snapshot.minute / cfg.replay.maxMatchMinutes);
      strokeRgb(p, ink, 45);
      p.strokeWeight(0.6);
      p.line(left, axisY, right, axisY);
      strokeRgb(p, ink, 180);
      p.strokeWeight(1);
      p.line(progressX, axisY - 6, progressX, axisY + 2);
    }

    function drawGrain() {
      const ctx = p.drawingContext as CanvasRenderingContext2D;
      p.push();
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, layout.artworkTop, layout.width, layout.artworkBottom - layout.artworkTop);
      ctx.clip();
      p.noStroke();
      fillRgb(p, ink, cfg.texture.paperNoiseOpacity);
      for (const dot of grainDots) p.circle(dot.x, dot.y, cfg.texture.grainDotSize);
      ctx.restore();
      p.pop();
    }

    p.setup = () => {
      const { width, height } = getSize();
      p.createCanvas(Math.max(width, 1), Math.max(height, 1));
      p.pixelDensity(1);
      rebuildLayout();
      warnIfSvgAssetsMissing();
      const titleSize = cfg.typography.teamNameSize * 0.5;
      const metaSize = cfg.typography.metaSize + 1;
      const vsSize = cfg.typography.vsSize;
      const { kickoffCodeFontFamily, kickoffCodeFontWeight } = cfg.typography;
      void document.fonts?.load(`${kickoffCodeFontWeight} 64px ${kickoffCodeFontFamily}`);
      void waitForMatchChromeFonts(titleSize, metaSize, vsSize);
      lastFrameMs = p.millis();
      p.loop();
    };

    p.draw = () => {
      const engine = getEngine();
      if (!engine || !layout) return;

      const now = p.millis();
      const deltaSeconds = Math.min((now - lastFrameMs) / 1000, 0.05);
      lastFrameMs = now;

      engine.tick(deltaSeconds, layout, match);
      const snapshot = engine.getSnapshot();

      try {
        drawPosterBackground();

        const artPresence = gameArtPresence(snapshot.minute);

        if (artPresence > 0.005 || snapshot.minute >= 0) {
          drawPossessionGrid(snapshot);
        }

        drawTeamBackgroundType();
        advanceMotionClock();

        const shake = snapshot.energy.shake * cfg.energy.shakeAmplitude;
        const intensity = motion(snapshot);
        const burst = snapshot.energy.burst;

        p.push();
        if (!cfg.animation.staticRender && shake > 0.1) {
          p.translate(
            (seededNoise(cfg.randomness.seed, time) - 0.5) * shake * 2,
            (seededNoise(cfg.randomness.seed + 1, time * 1.7) - 0.5) * shake * 2
          );
        }

        if (artPresence > 0.005 || snapshot.minute >= 0) {
          drawPassAccuracy(snapshot);
        }

        if (artPresence > 0.01) {
          p.push();
          try {
            if (artPresence < 1) {
              (p.drawingContext as CanvasRenderingContext2D).globalAlpha = artPresence;
            }
            drawZoneDebug();
            drawAccumulatedMarks(snapshot.art, snapshot.continuous, intensity, burst);
          } finally {
            (p.drawingContext as CanvasRenderingContext2D).globalAlpha = 1;
            p.pop();
          }
        }

        p.pop();

        drawGrain();
        if (!artworkOnly) {
          drawPosterChromeMask();
          drawMatchChrome(snapshot);
          drawMatchProgress(snapshot);
        }
      } catch (error) {
        console.error("Poster draw error:", error);
      }
    };

    p.windowResized = () => {
      const { width, height } = getSize();
      p.resizeCanvas(Math.max(width, 1), Math.max(height, 1));
      rebuildLayout();
    };
  };
}

/** @deprecated Use createReplaySketch */
export const createPosterSketch = createReplaySketch;
