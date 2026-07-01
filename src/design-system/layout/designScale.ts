import { cfg } from "@/config";
import { designConfig } from "@/config/design.config";
import { COMPONENT_SIZES } from "@/config/componentSizes.generated";
import type { VisualComponent } from "@/design-system/mapping/visualMappings";
import { teamZoneForSide, type PosterLayout } from "@/design-system/layout/posterLayout";
import type { TeamSide } from "@/data/mockMatch";
import { randBetween } from "@/utils/seededRandom";

/** Scale Figma design px → runtime artwork px (clamped by width and height). */
export function getDesignScale(layout: PosterLayout): number {
  const wScale = layout.artworkWidth / designConfig.artboardWidth;
  const hScale = layout.artworkHeight / designConfig.artboardHeight;
  return Math.min(wScale, hScale);
}

export function scaleDesignPx(px: number, layout: PosterLayout): number {
  return px * getDesignScale(layout);
}

/** Normalize a runtime px value to artwork width (for resize-safe marks). */
export function normSize(px: number, layout: PosterLayout): number {
  return px / Math.max(layout.artworkWidth, 1);
}

/** Denormalize a mark size stored relative to artwork width. */
export function denormSize(norm: number, layout: PosterLayout): number {
  return norm * layout.artworkWidth;
}

type SizeSpec = (typeof COMPONENT_SIZES)[keyof typeof COMPONENT_SIZES];

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

function specFor(component: VisualComponent): SizeSpec | undefined {
  return COMPONENT_SIZES[component as keyof typeof COMPONENT_SIZES];
}

/**
 * Scale event marks up from the old corner-grid footprint to the full team zone.
 * Reference: Figma gridSize token (604px) occupied ~one corner; grid now fills the zone.
 */
export function getTeamZoneFillScale(layout: PosterLayout, side: TeamSide): number {
  const zone = teamZoneForSide(layout, side);
  const spec = specFor("PossessionGrid");
  const designGrid = (spec as { gridSize?: number })?.gridSize ?? 604;
  const refGridPx = scaleDesignPx(designGrid, layout);
  return Math.min(zone.width / refGridPx, zone.height / refGridPx);
}

/** Random or midpoint size from Figma min/max tokens, scaled to layout + zone fill. */
export function resolveComponentSize(
  component: VisualComponent,
  layout: PosterLayout,
  rng?: () => number,
  axis: "uniform" | "x" | "y" = "uniform",
  side?: TeamSide,
  options: { zoneFill?: boolean } = {}
): number {
  const zoneFill = options.zoneFill ?? true;
  const spec = specFor(component);
  if (!spec) return scaleDesignPx(48, layout);

  let designPx: number;
  switch (component) {
    case "Goal":
      designPx =
        axis === "y"
          ? pickRange(spec, "sizeYMin", "sizeYMax", rng)
          : pickRange(spec, "sizeXMin", "sizeXMax", rng);
      break;
    case "Offside":
      if (axis === "y") {
        designPx = (spec as { sizeMax: number }).sizeMax;
      } else {
        designPx = pickRange(spec, "sizeXMin", "sizeXMax", rng);
      }
      break;
    case "PossessionGrid":
      designPx =
        axis === "y"
          ? (spec as { gridSize: number }).gridSize
          : (spec as { circleSize: number }).circleSize;
      break;
    case "ShotOnTarget":
      designPx = pickRange(spec, "sizeMin", "sizeMax", rng);
      break;
    default:
      designPx = pickRange(spec, "sizeMin", "sizeMax", rng);
  }

  let px = scaleDesignPx(designPx, layout);
  if (side && zoneFill) {
    px *= getTeamZoneFillScale(layout, side);
  }
  return px;
}

/** Resolve size and store as normalized artwork width fraction. */
export function resolveNormSize(
  component: VisualComponent,
  layout: PosterLayout,
  rng?: () => number,
  axis: "uniform" | "x" | "y" = "uniform",
  side?: TeamSide
): number {
  return normSize(resolveComponentSize(component, layout, rng, axis, side), layout);
}

export function getComponentSizeSpec(component: VisualComponent) {
  return specFor(component);
}

export interface PossessionGridMetrics {
  gridWidthPx: number;
  gridHeightPx: number;
  cellWidthPx: number;
  cellHeightPx: number;
  circleDiameterPx: number;
}

/** Possession grid fills the team zone; circle size derived from Figma circle/grid ratio. */
export function resolvePossessionGridMetrics(
  layout: PosterLayout,
  side: TeamSide,
  cols: number,
  rows: number
): PossessionGridMetrics {
  const zone = teamZoneForSide(layout, side);
  const gridWidthPx = zone.width;
  const gridHeightPx = zone.height;
  const cellWidthPx = gridWidthPx / Math.max(cols, 1);
  const cellHeightPx = gridHeightPx / Math.max(rows, 1);

  const spec = specFor("PossessionGrid");
  const designGrid = (spec as { gridSize?: number })?.gridSize ?? 604;
  const designCircle = (spec as { circleSize?: number })?.circleSize ?? 60;
  const designCell = designGrid / cfg.possession.gridCols;
  const cellRef = Math.max(cellWidthPx, cellHeightPx);
  const scale = cfg.possession.circleScale ?? cfg.possession.circleFillRatio;
  const circleDiameterPx = cellRef * (designCircle / designCell) * scale;

  return {
    gridWidthPx,
    gridHeightPx,
    cellWidthPx,
    cellHeightPx,
    circleDiameterPx,
  };
}
