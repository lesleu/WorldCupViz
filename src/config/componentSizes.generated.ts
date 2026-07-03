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
    "circleSize": 60,
    "gridSize": 604
  },
  "PassAccuracy": {
    "sizeMin": 68,
    "sizeMax": 140
  },
  "Shot": {
    "sizeMin": 72,
    "sizeMax": 84
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
    "sizeMin": 88,
    "sizeMax": 128
  },
  "Offside": {
    "sizeMax": 140,
    "sizeXMin": 60,
    "sizeXMax": 92,
    "sizeYMin": 80
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
