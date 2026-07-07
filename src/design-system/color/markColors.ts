import { eventMarksConfig } from "@/config/eventMarks.config";
import { getComponentColor } from "@/design-system/color/resolveColor";
import { VISUAL_COMPONENT, type VisualComponent } from "@/design-system/mapping/visualMappings";
import type { TeamPalette } from "@/data/teamPalettes.generated";

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return [0, 0, 0];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex([r, g, b]: Rgb): string {
  const clamp = (v: number) => Math.round(Math.min(255, Math.max(0, v)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/** Lighten + desaturate a palette hex toward white. */
export function desaturatePaletteHex(hex: string, mix = eventMarksConfig.desaturateMix): string {
  return rgbToHex(mixRgb(hexToRgb(hex), [255, 255, 255], mix));
}

/** Canvas color overrides for stacked event mark layers. */
export function stackedMarkColorOverrides(
  component: VisualComponent,
  palette: TeamPalette
): Record<string, string> | undefined {
  switch (component) {
    case VISUAL_COMPONENT.ShotOnTarget:
      return {
        c1: desaturatePaletteHex(palette.c4),
        c2: getComponentColor(VISUAL_COMPONENT.ShotOnTarget, palette, "c2", "c4"),
      };
    case VISUAL_COMPONENT.Foul:
      return {
        c1: eventMarksConfig.foulBackground,
        "ink.mark": getComponentColor(VISUAL_COMPONENT.Foul, palette, "ink.mark", "ink.mark"),
      };
    case VISUAL_COMPONENT.Corner:
      return {
        c1: desaturatePaletteHex(palette.c5),
        c5: getComponentColor(VISUAL_COMPONENT.Corner, palette, "c5", "c5"),
      };
    case VISUAL_COMPONENT.Offside:
      return {
        c1: eventMarksConfig.offsideBackground,
        c2: getComponentColor(VISUAL_COMPONENT.Offside, palette, "c2", "event.offside"),
      };
    default:
      return undefined;
  }
}

export function usesQuadrantMarkLayout(component: VisualComponent): boolean {
  return (eventMarksConfig.patternComponents as readonly string[]).includes(component);
}

/** @deprecated Use usesQuadrantMarkLayout */
export const usesStackedMarkLayout = usesQuadrantMarkLayout;
