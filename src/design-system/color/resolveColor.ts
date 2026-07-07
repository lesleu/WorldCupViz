import { foundationsGenerated } from "@/config/foundations.generated";
import {
  COMPONENT_COLOR_RULES,
  PALETTE_TINTED_COMPONENTS,
  type ColorSlot,
} from "@/design-system/color/colorRules.generated";
import type { SvgLayerDef } from "@/design-system/assets/componentPaths.generated";
import type { TeamPalette } from "@/data/teamPalettes.generated";
import type { VisualComponent } from "@/design-system/mapping/visualMappings";

const F = foundationsGenerated;

/** Resolve a semantic color slot to a hex string. */
export function resolveColorSlot(slot: ColorSlot, palette: TeamPalette): string {
  switch (slot) {
    case "c1":
      return palette.c1;
    case "c2":
      return palette.c2;
    case "c3":
      return palette.c3;
    case "c4":
      return palette.c4;
    case "c5":
      return palette.c5;
    case "paper.cream":
      return F.paper.cream;
    case "ink.text":
      return F.ink.text;
    case "ink.textMuted":
      return F.ink.textMuted;
    case "ink.mark":
      return F.ink.mark;
    case "event.foul":
      return F.event.foul;
    case "event.offside":
      return F.event.offside;
    case "event.cardYellow":
      return F.event.cardYellow;
    case "event.cardRed":
      return F.event.cardRed;
    case "world1.c1":
      return F.world1.c1;
    case "world1.c2":
      return F.world1.c2;
    case "world2.c1":
      return F.world2.c1;
    case "world2.c2":
      return F.world2.c2;
    case "world2.c3":
      return F.world2.c3;
    default:
      return F.ink.text;
  }
}

/** Resolve all color roles for a visual component and team palette. */
export function getComponentColors(
  component: VisualComponent,
  palette: TeamPalette
): Record<string, string> {
  const rules = COMPONENT_COLOR_RULES[component];
  if (!rules) return {};
  const colors: Record<string, string> = {};
  for (const [role, slot] of Object.entries(rules)) {
    colors[role] = resolveColorSlot(slot, palette);
  }
  return colors;
}

export function getComponentColor(
  component: VisualComponent,
  palette: TeamPalette,
  role: string,
  fallback: ColorSlot = "c1"
): string {
  const rules = COMPONENT_COLOR_RULES[component];
  const slot = rules?.[role] ?? fallback;
  return resolveColorSlot(slot, palette);
}

/** Resolve fill for one SVG path — palette/color-rules for geometry; literal hex only as fallback. */
export function resolveSvgPathFill(
  component: VisualComponent,
  palette: TeamPalette,
  layerName: string,
  pathIndex: number,
  layerDef: SvgLayerDef,
  colorOverrides?: Record<string, string>
): string {
  if (colorOverrides?.[layerName]) return colorOverrides[layerName];

  const paletteTinted = (PALETTE_TINTED_COMPONENTS as readonly string[]).includes(component);
  if (paletteTinted) {
    return getComponentColor(component, palette, layerName, "c1");
  }

  const rules = COMPONENT_COLOR_RULES[component];
  if (rules?.[layerName]) {
    return getComponentColor(component, palette, layerName, "c1");
  }

  const literal = layerDef.fills?.[pathIndex];
  if (literal) return literal;

  return getComponentColor(component, palette, layerName, "c1");
}
