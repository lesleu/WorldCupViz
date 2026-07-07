// @generated — do not edit. Run: npm run sync:tokens

import type { VisualComponent } from "@/design-system/mapping/visualMappings";

export type ColorSlot =
  | "c1"
  | "c2"
  | "c3"
  | "c4"
  | "c5"
  | "paper.cream"
  | "ink.text"
  | "ink.textMuted"
  | "ink.mark"
  | "event.foul"
  | "event.offside"
  | "event.cardYellow"
  | "event.cardRed"
  | "world1.c1"
  | "world1.c2"
  | "world2.c1"
  | "world2.c2"
  | "world2.c3";

export type ComponentColorRules = Partial<Record<VisualComponent, Record<string, ColorSlot>>>;

export const COMPONENT_COLOR_RULES: ComponentColorRules = {
  "PossessionGrid": {
    "c1": "c1",
    "paper.cream": "paper.cream"
  },
  "PassAccuracy": {
    "ink.mark": "ink.mark"
  },
  "Shot": {
    "c1": "c2",
    "c2": "c1"
  },
  "ShotOnTarget": {
    "c1": "c4",
    "c2": "c4"
  },
  "Goal": {
    "c1": "c1",
    "c4": "c3"
  },
  "Foul": {
    "c1": "paper.cream",
    "ink.mark": "ink.mark"
  },
  "Corner": {
    "c1": "c5",
    "c5": "c5"
  },
  "Offside": {
    "c1": "event.offside",
    "c2": "event.offside"
  },
  "YellowCard": {
    "event.cardYellow": "event.cardYellow",
    "ink.mark": "ink.mark"
  },
  "RedCard": {
    "event.cardRed": "event.cardRed",
    "ink.mark": "ink.mark"
  },
  "EventBurst": {
    "c4": "c4"
  },
  "MatchChrome": {
    "c1": "c1",
    "ink.text": "ink.text",
    "ink.textMuted": "ink.textMuted"
  }
};

/** Components whose SVG fills are swapped for team palette slots at render time. */
export const PALETTE_TINTED_COMPONENTS = ["Shot","Goal"] as const;
