import type { ColorSlot } from "@/design-system/color/colorRules.generated";
import { COMPONENT_COLOR_RULES } from "@/design-system/color/colorRules.generated";
import { stackedMarkColorOverrides } from "@/design-system/color/markColors";
import { getComponentColors } from "@/design-system/color/resolveColor";
import {
  isWorldCupArtComponent,
  WORLD1_ART_PALETTE,
  WORLD2_ART_PALETTE,
  WORLD_CUP_ART_PALETTE,
} from "@/design-system/color/worldCupArt";
import {
  VISUAL_COMPONENT,
  type VisualComponent,
} from "@/design-system/mapping/visualMappings";
import type { TeamPalette } from "@/data/teamPalettes.generated";

/** Neutral grey palette for sidebar stat icons (not team colors). */
export const LEGEND_NEUTRAL_PALETTE: TeamPalette = {
  c1: "#EAEAEA",
  c2: "#948F87",
  c3: "#6B6B6B",
  c4: "#FFFFFF",
  c5: "#7A7A7A",
};

function legendColorForSlot(slot: ColorSlot): string {
  switch (slot) {
    case "c1":
    case "ink.text":
      return LEGEND_NEUTRAL_PALETTE.c1;
    case "c2":
    case "ink.textMuted":
      return LEGEND_NEUTRAL_PALETTE.c2;
    case "c3":
      return LEGEND_NEUTRAL_PALETTE.c3;
    case "c4":
    case "paper.cream":
      return LEGEND_NEUTRAL_PALETTE.c4;
    case "c5":
      return LEGEND_NEUTRAL_PALETTE.c5;
    case "ink.mark":
      return "#B8B8B8";
    case "event.foul":
      return "#8A8A8A";
    case "event.offside":
      return "#757575";
    case "event.cardYellow":
      return "#C4C4C4";
    case "event.cardRed":
      return "#5C5C5C";
    default:
      return LEGEND_NEUTRAL_PALETTE.c1;
  }
}

function dataLegendPaletteFor(component: VisualComponent): TeamPalette {
  switch (component) {
    case VISUAL_COMPONENT.Shot:
      return WORLD1_ART_PALETTE;
    case VISUAL_COMPONENT.Goal:
    case VISUAL_COMPONENT.Corner:
    case VISUAL_COMPONENT.ShotOnTarget:
      return WORLD2_ART_PALETTE;
    default:
      return WORLD_CUP_ART_PALETTE;
  }
}

/** Per-layer overrides for the homepage data-legend modal. */
export function legendIconColorOverrides(
  component: VisualComponent
): Record<string, string> {
  if (isWorldCupArtComponent(component)) {
    return getComponentColors(component, WORLD_CUP_ART_PALETTE);
  }

  const palette = dataLegendPaletteFor(component);
  const stacked = stackedMarkColorOverrides(component, palette);
  if (stacked) return stacked;

  const colors = getComponentColors(component, palette);
  if (Object.keys(colors).length > 0) return colors;

  const rules = COMPONENT_COLOR_RULES[component];
  if (!rules) return {};

  const overrides: Record<string, string> = {};
  for (const [role, slot] of Object.entries(rules)) {
    overrides[role] = legendColorForSlot(slot);
  }
  return overrides;
}

/** PK shootout goal icon — matches canvas shootout asset colors. */
export function pkScoredLegendIconColorOverrides(): Record<string, string> {
  return {
    c1: "#66DD64",
    c4: "#D1F464",
  };
}

/** Per-team stat sidebar icons — mirrors canvas mark coloring. */
export function teamStatIconColorOverrides(
  component: VisualComponent | null,
  palette: TeamPalette
): Record<string, string> | undefined {
  if (!component) return undefined;
  if (
    component === VISUAL_COMPONENT.PossessionGrid ||
    component === VISUAL_COMPONENT.PassAccuracy
  ) {
    return undefined;
  }

  if (isWorldCupArtComponent(component)) {
    return getComponentColors(component, WORLD_CUP_ART_PALETTE);
  }

  const stacked = stackedMarkColorOverrides(component, palette);
  if (stacked) return stacked;

  const colors = getComponentColors(component, palette);
  return Object.keys(colors).length > 0 ? colors : undefined;
}

/** Possession grid cells use palette c1 in the art system. */
export function possessionLegendColor(palette?: TeamPalette): string {
  return palette?.c1 ?? WORLD1_ART_PALETTE.c1;
}
