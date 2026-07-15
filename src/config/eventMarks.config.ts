import { VISUAL_COMPONENT } from "@/design-system/mapping/visualMappings";
import type { EventMarksConfig } from "./types";

/**
 * Pattern layout for discrete event marks — chronological golden mosaic per team zone.
 */
export const eventMarksConfig: EventMarksConfig = {
  foulBackground: "#E1E1E1",
  offsideBackground: "#C4C9F6",
  desaturateMix: 0.58,
  /** Inset from outer team mark-region edges. */
  artworkEdgePaddingRatio: 0.012,
  /** Extra inset from the center gap — keeps marks in their team half. */
  centerEdgePaddingRatio: 0.05,
  /** How far the golden spiral reaches across the team zone (0–1). */
  spiralSpreadRatio: 0.78,
  /** Inset from zone edges when spreading targets (lower = more canvas used). */
  zoneSpreadInset: 0.02,
  /** Per-mark size jitter (each asset scales individually within a shared multiplier). */
  crowdedScaleMin: 0.94,
  crowdedScaleMax: 1,
  /** No mark dimension may shrink below this (design px @ 1920×1080; scales at runtime). */
  minMarkPx: 40,
  /** How strongly match minute nudges spiral angle (0 = index order only). */
  temporalFlowStrength: 0.42,
  patternComponents: [
    VISUAL_COMPONENT.Shot,
    VISUAL_COMPONENT.ShotOnTarget,
    VISUAL_COMPONENT.Goal,
    VISUAL_COMPONENT.Foul,
    VISUAL_COMPONENT.Corner,
    VISUAL_COMPONENT.Offside,
    VISUAL_COMPONENT.YellowCard,
    VISUAL_COMPONENT.RedCard,
    VISUAL_COMPONENT.PossessionGrid,
  ],
};
