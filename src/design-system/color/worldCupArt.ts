import { foundationsGenerated } from "@/config/foundations.generated";
import type { TeamPalette } from "@/data/teamPalettes.generated";
import { VISUAL_COMPONENT, type VisualComponent } from "@/design-system/mapping/visualMappings";

const W1 = foundationsGenerated.world1;
const W2 = foundationsGenerated.world2;

/**
 * World1 foundation colors as team slots for header art.
 * Used with standard color-rules (e.g. Shot c1→c2, c2→c1) via getComponentColor().
 */
export const WORLD1_ART_PALETTE: TeamPalette = {
  c1: W1.c1,
  c2: W1.c2,
  c3: W1.c1,
  c4: W1.c2,
  c5: W1.c1,
};

/**
 * World2 foundation colors as team slots for header art.
 * Used with standard color-rules (e.g. Goal c1→c1, c4→c3; Corner c4→c5).
 */
export const WORLD2_ART_PALETTE: TeamPalette = {
  c1: W2.c1,
  c2: W2.c2,
  c3: W2.c3,
  c4: W2.c2,
  c5: W2.c3,
};

/** Stub — team slots unused; layers resolve via world/event slots in color-rules. */
export const WORLD_CUP_ART_PALETTE: TeamPalette = {
  c1: "#000000",
  c2: "#000000",
  c3: "#000000",
  c4: "#000000",
  c5: "#000000",
};

const WORLD_CUP_RULE_COMPONENTS = new Set<VisualComponent>([
  VISUAL_COMPONENT.Foul,
  VISUAL_COMPONENT.Offside,
  VISUAL_COMPONENT.YellowCard,
  VISUAL_COMPONENT.RedCard,
]);

export function isWorldCupArtComponent(component: VisualComponent): boolean {
  return WORLD_CUP_RULE_COMPONENTS.has(component);
}

export type WorldArtPaletteKey = "world1" | "world2";

export function worldArtPalette(key: WorldArtPaletteKey): TeamPalette {
  return key === "world2" ? WORLD2_ART_PALETTE : WORLD1_ART_PALETTE;
}

/** Default palette for a header decoration — world1 or world2 via color-rules. */
export function headerArtPaletteFor(component: VisualComponent): TeamPalette {
  switch (component) {
    case VISUAL_COMPONENT.Shot:
      return WORLD1_ART_PALETTE;
    case VISUAL_COMPONENT.Goal:
    case VISUAL_COMPONENT.Corner:
      return WORLD2_ART_PALETTE;
    default:
      return WORLD_CUP_ART_PALETTE;
  }
}

export function resolveHeaderArtPalette(
  component: VisualComponent,
  artPalette?: WorldArtPaletteKey
): TeamPalette {
  if (artPalette) return worldArtPalette(artPalette);
  return headerArtPaletteFor(component);
}
