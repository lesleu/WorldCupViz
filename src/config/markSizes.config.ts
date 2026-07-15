import { VISUAL_COMPONENT } from "@/design-system/mapping/visualMappings";
import type { MarkSizesConfig } from "./types";

/**
 * Event mark sizing — tune here.
 * Save this file (Cmd+S) for changes to reach the canvas.
 *
 * markSizeScale: 1.0 = Figma baseline at 1920×1080 (after rank decay + canvas scale).
 */
export const markSizesConfig: MarkSizesConfig = {
  /** Design px base for Shot + ShotOnTarget (not Figma 72–84 tokens). */
  shotDesignBasePx: 225,
  markSizeScale: {
    [VISUAL_COMPONENT.Goal]: 0.70,
    [VISUAL_COMPONENT.Shot]: 0.60,
    [VISUAL_COMPONENT.ShotOnTarget]: 0.5,
    [VISUAL_COMPONENT.Corner]: 0.5,
    [VISUAL_COMPONENT.Offside]: 0.7,
    [VISUAL_COMPONENT.Foul]: 0.5,
    [VISUAL_COMPONENT.YellowCard]: 0.7,
    [VISUAL_COMPONENT.RedCard]: 0.7,
    [VISUAL_COMPONENT.PossessionGrid]: 0.7,
  },
  rankDecay: {
    [VISUAL_COMPONENT.Goal]: {
      firstFullSizeCount: 1,
      sizeDecayRatio: 0.9,
      goalDecayExponent: 1.6,
    },
    [VISUAL_COMPONENT.Shot]: {
      firstFullSizeCount: 2,
      sizeDecayRatio: 0.94,
      minSizeMultiplier: 0.55,
    },
    [VISUAL_COMPONENT.ShotOnTarget]: {
      firstFullSizeCount: 2,
      sizeDecayRatio: 0.94,
      minSizeMultiplier: 0.55,
    },
    [VISUAL_COMPONENT.Corner]: {
      firstFullSizeCount: 2,
      sizeDecayRatio: 0.92,
    },
    [VISUAL_COMPONENT.Offside]: {
      firstFullSizeCount: 2,
      sizeDecayRatio: 0.92,
    },
    [VISUAL_COMPONENT.Foul]: {
      firstFullSizeCount: 3,
      sizeDecayRatio: 0.93,
    },
    [VISUAL_COMPONENT.YellowCard]: {
      firstFullSizeCount: 4,
      sizeDecayRatio: 0.95,
    },
    [VISUAL_COMPONENT.RedCard]: {
      firstFullSizeCount: 4,
      sizeDecayRatio: 0.95,
    },
    [VISUAL_COMPONENT.PossessionGrid]: {
      firstFullSizeCount: 36,
      sizeDecayRatio: 1,
      minSizeMultiplier: 1,
    },
  },
};
