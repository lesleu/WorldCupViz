import type { ColorSlot } from "@/design-system/color/colorRules.generated";
import { COMPONENT_COLOR_RULES } from "@/design-system/color/colorRules.generated";
import { getComponentColors } from "@/design-system/color/resolveColor";
import {
  isWorldCupArtComponent,
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

/** Per-layer overrides for stat sidebar icons on dark chrome. */
export function legendIconColorOverrides(
  component: VisualComponent
): Record<string, string> {
  if (isWorldCupArtComponent(component)) {
    return getComponentColors(component, WORLD_CUP_ART_PALETTE);
  }

  const rules = COMPONENT_COLOR_RULES[component];
  if (!rules) return {};

  const overrides: Record<string, string> = {};
  for (const [role, slot] of Object.entries(rules)) {
    overrides[role] = legendColorForSlot(slot);
  }

  if (component === VISUAL_COMPONENT.Goal) {
    overrides.c4 = "#4A4A4A";
  }
  if (component === VISUAL_COMPONENT.YellowCard) {
    overrides["ink.mark"] = "#4A4A4A";
  }

  return overrides;
}

/** Possession grid cells use palette c1 in the art system. */
export function possessionLegendColor(): string {
  return legendColorForSlot("c1");
}
