import type p5 from "p5";
import {
  capMarkDimensions,
  capMarkSize,
  denormPoint,
  nonGoalMarkCap,
  timedMarkCountOnSide,
  type AccumulatedArtState,
  type ContinuousMatchState,
} from "@/design-system/state/artState";
import { motionIntensity } from "@/design-system/motion/energyState";
import { getComponentColor } from "@/design-system/color/resolveColor";
import { VISUAL_COMPONENT, type VisualComponent } from "@/design-system/mapping/visualMappings";
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
  gridRegionForSide,
  markRegionForSide,
  resolveRendererLayout,
  type PosterLayout,
} from "@/design-system/layout/posterLayout";
import { stackedMarkColorOverrides } from "@/design-system/color/markColors";
import { drawSvgComponent, warnIfSvgAssetsMissing } from "@/design-system/render/svgRenderer";
import type { ReplayEngine, ReplaySnapshot } from "@/engine/replayEngine";
import { seededNoise } from "@/utils/seededRandom";
import {
  markRng,
  resolveQuadrantEntryDimensions,
  type MarkPixelDims,
} from "@/design-system/layout/markSizing";
import { cfg } from "@/config";
import { HOME_THUMBNAIL_FIT } from "@/config/home.config";

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

export function createReplaySketch(
  getMatch: () => MatchData,
  getSize: () => { width: number; height: number },
  getEngine: () => ReplayEngine | null,
  options: {
    artworkOnly?: boolean;
    liveAssetMotion?: boolean;
    teamSide?: TeamSide;
    frozenSnapshot?: boolean;
    posterArtworkCrop?: boolean;
    /** Slight zoom-out for card thumbnails — keeps both team halves visible. */
    fitBothTeams?: boolean;
    /** Override zoom for fitBothTeams (default from home.config). */
    thumbnailFit?: number;
  } = {}
) {
  const artworkOnly = options.artworkOnly ?? false;
  const liveAssetMotion = options.liveAssetMotion ?? false;
  const teamSide = options.teamSide;
  const frozenSnapshot = options.frozenSnapshot ?? false;
  const posterArtworkCrop = options.posterArtworkCrop ?? false;
  const fitBothTeams = options.fitBothTeams ?? false;
  const thumbnailFit = options.thumbnailFit ?? HOME_THUMBNAIL_FIT;
  const drawSides = (): TeamSide[] =>
    teamSide ? [teamSide] : ["home", "away"];
  const markSideVisible = (side: TeamSide) => !teamSide || teamSide === side;

  return (p: p5) => {
    let time = 0;
    let layout!: PosterLayout;
    let lastFrameMs = 0;

    const chromeBoldFamily = () => resolveKickoffCanvasFontFamily();
    const chromeMetaFamily = () => resolveInterSemiBoldFontFamily();

    function fillChromeRgb(ctx: CanvasRenderingContext2D, rgb: Rgb, alpha = 255) {
      ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha / 255})`;
    }

    const chrome = hexToRgb(cfg.colors.cream);
    const posterBg = hexToRgb(cfg.colors.background);
    const ink = hexToRgb(cfg.colors.text);
    const inkMuted = hexToRgb(cfg.colors.textMuted);
    const black = hexToRgb(cfg.colors.black);
    const teamLetterBg: Rgb = [0, 0, 0];

    function rebuildLayout() {
      const { width, height } = getSize();
      layout = resolveRendererLayout(width, height, {
        artworkOnly,
        teamSide,
        posterArtworkCrop,
      });
    }

    function motion(snapshot: ReplaySnapshot) {
      if (cfg.animation.staticRender) return 0;
      return motionIntensity(snapshot.energy);
    }

    function gameArtPresence(minute: number) {
      return minute > 0 ? 1 : 0;
    }

    function advanceMotionClock() {
      time += liveAssetMotion
        ? cfg.animation.liveUpdateSpeed
        : cfg.animation.updateSpeed;
    }

    /** Inter ExtraBold — tight tracking, width-fill then vertical stretch per zone half. */
    function drawTeamBackgroundType() {
      const ctx = p.drawingContext as CanvasRenderingContext2D;

      for (const side of drawSides()) {
        const zone = side === "home" ? layout.homeZone : layout.awayZone;
        if (zone.width <= 0 || zone.height <= 0) continue;
        const code = side === "home" ? getMatch().homeTeamCode : getMatch().awayTeamCode;
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
          // Drawn under possession / marks — faint watermark.
          "rgba(255, 255, 255, 0.2)"
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

    /** Pure black under team letter codes — spans the full artwork canvas (both halves). */
    function drawTeamLetterBackdrop() {
      p.noStroke();
      fillRgb(p, teamLetterBg);
      const top = posterArtworkCrop ? 0 : layout.artworkTop;
      p.rect(0, top, layout.width, layout.artworkHeight);
    }

    /** Possession circles — mosaic-placed with other assets (nx/ny from layout). */
    function drawPossessionCircles(snapshot: ReplaySnapshot) {
      const { art, minute } = snapshot;
      if (minute <= 0) return;

      p.noStroke();
      for (const mark of art.possessionCircles) {
        if (!markSideVisible(mark.side)) continue;
        const palette = paletteForSide(getMatch(), mark.side);
        const color = getComponentColor(
          VISUAL_COMPONENT.PossessionGrid,
          palette,
          "c1",
          "c1"
        );
        const rgb = hexToRgb(color);
        const proxy = {
          id: mark.id,
          minute: mark.minute,
          side: mark.side,
          spawnScale: mark.spawnScale,
          layoutScale: mark.layoutScale,
        };
        // quadrantEntryDims already applies layoutScale — don't multiply again.
        const dims = quadrantEntryDims(VISUAL_COMPONENT.PossessionGrid, art, proxy);
        const minPx = cfg.possession.minCirclePx ?? cfg.eventMarks.minMarkPx ?? 20;
        const diameter = Math.max(minPx, Math.min(dims.widthPx, dims.heightPx));
        if (diameter <= 0.5) continue;
        const [x, y] = denormPoint(mark.nx, mark.ny, layout);
        fillRgb(p, rgb, cfg.possession.filledOpacity);
        p.circle(x, y, diameter);
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

    /** Quadrant marks — layout-sized SVG, no breathe/vibrate (prevents overlap). */
    function drawQuadrantEntry(
      component: VisualComponent,
      palette: ReturnType<typeof paletteForSide>,
      x: number,
      y: number,
      dims: MarkPixelDims,
      colorOverrides?: Record<string, string>
    ) {
      drawSvgComponent(p, component, palette, x, y, {
        widthPx: dims.widthPx,
        heightPx: dims.heightPx,
        colorOverrides,
      });
    }

    function rankForDraw(
      art: AccumulatedArtState,
      side: TeamSide,
      component: VisualComponent,
      markId: string
    ): number {
      const parentId = markId.replace(/-sq\d+$/, "");
      switch (component) {
        case VISUAL_COMPONENT.Shot:
          return rankInDataset(art, side, "shot", parentId);
        case VISUAL_COMPONENT.ShotOnTarget:
          return rankInDataset(art, side, "shot_on_target", parentId);
        case VISUAL_COMPONENT.Goal:
          return rankInDataset(art, side, "goal", parentId);
        case VISUAL_COMPONENT.Foul:
          return rankInDataset(art, side, "foul", parentId);
        case VISUAL_COMPONENT.Corner:
          return rankInDataset(art, side, "corner", parentId);
        case VISUAL_COMPONENT.Offside:
          return rankInDataset(art, side, "offside", parentId);
        case VISUAL_COMPONENT.YellowCard:
        case VISUAL_COMPONENT.RedCard:
          return rankInDataset(art, side, "card", markId);
        default:
          return 0;
      }
    }

    function quadrantEntryDims(
      component: VisualComponent,
      art: AccumulatedArtState,
      mark: {
        id: string;
        minute: number;
        side: TeamSide;
        spawnScale: number;
        layoutScale: number;
      }
    ): MarkPixelDims {
      const parentId = mark.id.replace(/-sq\d+$/, "");
      const rank = rankForDraw(art, mark.side, component, mark.id);
      const base = resolveQuadrantEntryDimensions(
        component,
        layout,
        rank,
        mark.side,
        { id: parentId, minute: mark.minute, spawnScale: mark.spawnScale },
        markRng(parentId, mark.minute)
      );
      const ls = mark.layoutScale > 0 ? mark.layoutScale : 1;
      return {
        widthPx: base.widthPx * ls,
        heightPx: base.heightPx * ls,
      };
    }

    function drawZoneDebug() {
      if (!cfg.composition.showZoneDebug) return;
      p.noFill();
      strokeRgb(p, black, 80);
      p.strokeWeight(1);
      for (const side of drawSides()) {
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

    /** Shot — layered SVG stamps (time-quadrant layout). */
    function drawShot(
      art: AccumulatedArtState,
      continuous: ContinuousMatchState,
      intensity: number,
      burstScale: number
    ) {
      void continuous;
      void intensity;
      void burstScale;
      for (const mark of art.shots) {
        if (!markSideVisible(mark.side)) continue;
        const palette = paletteForSide(getMatch(), mark.side);
        const shotRank = rankInDataset(art, mark.side, "shot", mark.id);
        const ageAlpha = markAgeOpacity(shotRank);
        for (const [sqIndex, sq] of mark.squares.entries()) {
          const [x, y] = denormPoint(sq.nx, sq.ny, layout);
          const proxy = {
            id: `${mark.id}-sq${sqIndex}`,
            minute: mark.minute,
            side: mark.side,
            spawnScale: sq.scale,
            layoutScale: sq.layoutScale,
          };
          const dims = quadrantEntryDims(VISUAL_COMPONENT.Shot, art, proxy);
          withMarkAlpha(ageAlpha, () => {
            drawSvgComponent(p, VISUAL_COMPONENT.Shot, palette, x, y, {
              widthPx: dims.widthPx,
              heightPx: dims.heightPx,
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
      void burstScale;
      void intensity;
      for (const mark of art.shotsOnTarget) {
        if (!markSideVisible(mark.side)) continue;
        const palette = paletteForSide(getMatch(), mark.side);
        const [x, y] = denormPoint(mark.nx, mark.ny, layout);
        const sotRank = rankInDataset(art, mark.side, "shot_on_target", mark.id);
        withMarkAlpha(markAgeOpacity(sotRank), () => {
          drawQuadrantEntry(
            VISUAL_COMPONENT.ShotOnTarget,
            palette,
            x,
            y,
            quadrantEntryDims(VISUAL_COMPONENT.ShotOnTarget, art, mark),
            stackedMarkColorOverrides(VISUAL_COMPONENT.ShotOnTarget, palette)
          );
        });
      }
    }

    /** Foul — layered SVG. */
    function drawFoul(art: AccumulatedArtState, intensity: number) {
      void intensity;
      for (const mark of art.fouls) {
        if (!markSideVisible(mark.side)) continue;
        const palette = paletteForSide(getMatch(), mark.side);
        const [x, y] = denormPoint(mark.nx, mark.ny, layout);
        const foulRank = rankInDataset(art, mark.side, "foul", mark.id);
        withMarkAlpha(markAgeOpacity(foulRank), () => {
          drawQuadrantEntry(
            VISUAL_COMPONENT.Foul,
            palette,
            x,
            y,
            quadrantEntryDims(VISUAL_COMPONENT.Foul, art, mark),
            stackedMarkColorOverrides(VISUAL_COMPONENT.Foul, palette)
          );
        });
      }
    }

    /** Goal — layered SVG panel (time-quadrant layout). */
    function drawGoal(art: AccumulatedArtState, intensity: number) {
      void intensity;
      for (const goal of art.goals) {
        if (!markSideVisible(goal.side)) continue;
        const palette = paletteForSide(getMatch(), goal.side);
        const [x, y] = denormPoint(goal.nx, goal.ny, layout);
        const goalRank = rankInDataset(art, goal.side, "goal", goal.id);
        const colorOverrides =
          goal.variant === "shootout"
            ? {
                c1: cfg.goals.shootoutBg,
                c4: cfg.goals.shootoutPattern,
              }
            : undefined;
        withMarkAlpha(markAgeOpacity(goalRank), () => {
          drawQuadrantEntry(
            VISUAL_COMPONENT.Goal,
            palette,
            x,
            y,
            quadrantEntryDims(VISUAL_COMPONENT.Goal, art, goal),
            colorOverrides
          );
        });
      }
    }

    /** YellowCard / RedCard — pattern layout (same rhythm as other marks). */
    function drawCard(art: AccumulatedArtState) {
      for (const scar of art.cards) {
        if (!markSideVisible(scar.side)) continue;
        const palette = paletteForSide(getMatch(), scar.side);
        const component =
          scar.kind === "yellow" ? VISUAL_COMPONENT.YellowCard : VISUAL_COMPONENT.RedCard;
        const [x, y] = denormPoint(scar.nx, scar.ny, layout);
        const cardRank = rankInDataset(art, scar.side, "card", scar.id);
        withMarkAlpha(markAgeOpacity(cardRank), () => {
          drawQuadrantEntry(
            component,
            palette,
            x,
            y,
            quadrantEntryDims(component, art, scar)
          );
        });
      }
    }

    /** Corner — SVG pinwheel. */
    function drawCorner(art: AccumulatedArtState, intensity: number) {
      void intensity;
      for (const corner of art.corners) {
        if (!markSideVisible(corner.side)) continue;
        const palette = paletteForSide(getMatch(), corner.side);
        const [x, y] = denormPoint(corner.nx, corner.ny, layout);
        const cornerRank = rankInDataset(art, corner.side, "corner", corner.id);
        withMarkAlpha(markAgeOpacity(cornerRank), () => {
          drawQuadrantEntry(
            VISUAL_COMPONENT.Corner,
            palette,
            x,
            y,
            quadrantEntryDims(VISUAL_COMPONENT.Corner, art, corner),
            stackedMarkColorOverrides(VISUAL_COMPONENT.Corner, palette)
          );
        });
      }
    }

    /** Offside — SVG wave stack. */
    function drawOffside(art: AccumulatedArtState, intensity: number) {
      void intensity;
      for (const mark of art.offsides) {
        if (!markSideVisible(mark.side)) continue;
        const palette = paletteForSide(getMatch(), mark.side);
        const [x, y] = denormPoint(mark.nx, mark.ny, layout);
        const offRank = rankInDataset(art, mark.side, "offside", mark.id);
        withMarkAlpha(markAgeOpacity(offRank), () => {
          drawQuadrantEntry(
            VISUAL_COMPONENT.Offside,
            palette,
            x,
            y,
            quadrantEntryDims(VISUAL_COMPONENT.Offside, art, mark),
            stackedMarkColorOverrides(VISUAL_COMPONENT.Offside, palette)
          );
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
      drawCard(art);
    }

    /** Poster chrome bands — artwork fill is handled by drawTeamLetterBackdrop. */
    function drawPosterBackground() {
      backgroundRgb(p, posterBg);

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

      const homeLabel = getMatch().homeTeam.toUpperCase();
      const awayLabel = getMatch().awayTeam.toUpperCase();
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

      const venue = getMatch().venue ?? getMatch().stage;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      applyCanvasFont(ctx, 600, metaSize, metaFamily);
      fillChromeRgb(ctx, ink);
      ctx.fillText(venue, p.width / 2, venueY);
      applyCanvasFont(ctx, 600, dateSize, metaFamily);
      fillChromeRgb(ctx, inkMuted);
      ctx.fillText(getMatch().date, p.width / 2, dateY);
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

    p.setup = () => {
      const { width, height } = getSize();
      rebuildLayout();
      const canvasH = posterArtworkCrop
        ? layout.artworkBottom - layout.artworkTop
        : height;
      p.createCanvas(Math.max(width, 1), Math.max(canvasH, 1));
      p.pixelDensity(1);
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

      const match = getMatch();
      if (!frozenSnapshot) {
        engine.tick(deltaSeconds, layout, match);
      }
      const snapshot = engine.getSnapshot();

      try {
        if (fitBothTeams && artworkOnly) {
          p.push();
          p.translate(layout.width / 2, layout.height / 2);
          p.scale(thumbnailFit);
          p.translate(-layout.width / 2, -layout.height / 2);
        }

        if (posterArtworkCrop) p.translate(0, -layout.artworkTop);

        drawPosterBackground();

        drawTeamLetterBackdrop();
        drawTeamBackgroundType();

        const artPresence = gameArtPresence(snapshot.minute);

        if (artPresence > 0.005 || snapshot.minute >= 0) {
          drawPossessionCircles(snapshot);
        }

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

        if (!artworkOnly) {
          drawPosterChromeMask();
          drawMatchChrome(snapshot);
          drawMatchProgress(snapshot);
        }
        if (frozenSnapshot) {
          p.noLoop();
        }
        if (fitBothTeams && artworkOnly) {
          p.pop();
        }
      } catch (error) {
        console.error("Poster draw error:", error);
      }
    };

    p.windowResized = () => {
      const { width, height } = getSize();
      rebuildLayout();
      const canvasH = posterArtworkCrop
        ? layout.artworkBottom - layout.artworkTop
        : height;
      p.resizeCanvas(Math.max(width, 1), Math.max(canvasH, 1));
      rebuildLayout();
    };
  };
}

/** @deprecated Use createReplaySketch */
export const createPosterSketch = createReplaySketch;
