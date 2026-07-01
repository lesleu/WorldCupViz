// @generated — do not edit. Run: npm run sync:tokens

import type { VisualComponent } from "@/design-system/mapping/visualMappings";

/** Flat Figma px values at 1920×1080 artboard — scaled at runtime via designScale.ts. */
export const COMPONENT_SIZES: Partial<
  Record<
    VisualComponent,
    {
      circleSize?: number;
      gridSize?: number;
      sizeMin?: number;
      sizeMax?: number;
      sizeXMin?: number;
      sizeXMax?: number;
      sizeYMin?: number;
      sizeYMax?: number;
      starpoint?: number;
    }
  >
> = {
  "PossessionGrid": {
    "circleSize": 72,
    "gridSize": 604
  },
  "PassAccuracy": {
    "sizeMin": 68,
    "sizeMax": 140
  },
  "Shot": {
    "sizeMin": 72,
    "sizeMax": 100
  },
  "ShotOnTarget": {
    "sizeMin": 116,
    "sizeMax": 180,
    "starpoint": 8
  },
  "Goal": {
    "sizeXMin": 80,
    "sizeXMax": 316,
    "sizeYMin": 120,
    "sizeYMax": 468
  },
  "Foul": {
    "sizeMin": 68,
    "sizeMax": 100
  },
  "Corner": {
    "sizeMin": 78,
    "sizeMax": 108
  },
  "Offside": {
    "sizeMax": 152,
    "sizeXMin": 72,
    "sizeXMax": 104,
    "sizeYMin": 92
  },
  "YellowCard": {
    "sizeMin": 74,
    "sizeMax": 100
  },
  "RedCard": {
    "sizeMin": 74,
    "sizeMax": 100
  }
};
