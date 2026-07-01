import { VISUAL_COMPONENT, type VisualComponent } from "@/design-system/mapping/visualMappings";

/** Back → front draw order for accumulated event marks (reference collage stack). */
export const MARK_DRAW_ORDER: VisualComponent[] = [
  VISUAL_COMPONENT.Goal,
  VISUAL_COMPONENT.Foul,
  VISUAL_COMPONENT.Shot,
  VISUAL_COMPONENT.Offside,
  VISUAL_COMPONENT.Corner,
  VISUAL_COMPONENT.ShotOnTarget,
  VISUAL_COMPONENT.YellowCard,
  VISUAL_COMPONENT.RedCard,
];

/** Continuous layers relative to team type and marks. */
export const LAYER_ORDER = {
  background: 0,
  possessionGrid: 1,
  teamType: 2,
  accumulatedMarks: 3,
  passAccuracy: 4,
  grain: 5,
  chrome: 6,
} as const;
