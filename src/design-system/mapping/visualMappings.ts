import type { MatchEventType } from "@/data/mockLiveFeed";

/**
 * Data-to-visual mapping layer.
 *
 * VISUALIZER_CONFIG controls sizes, colors, and numeric parameters.
 * Visual component names align with football/API terms (see VISUAL_LANGUAGE.md).
 *
 * Composition rule: home stays left, away stays right, center is neutral gap.
 * Team systems never collide, overlap, or merge.
 */

export type DataType = "continuous_state" | "event";

/** Named visual components — align with API fields and Figma spec frame labels. */
export const VISUAL_COMPONENT = {
  PossessionGrid: "PossessionGrid",
  PassAccuracy: "PassAccuracy",
  Shot: "Shot",
  ShotOnTarget: "ShotOnTarget",
  Goal: "Goal",
  Foul: "Foul",
  Corner: "Corner",
  Offside: "Offside",
  YellowCard: "YellowCard",
  RedCard: "RedCard",
  /** Short-lived ripple on discrete events (driven by energy system). */
  EventBurst: "EventBurst",
  /** Poster header, score, meta, and footer progress. */
  MatchChrome: "MatchChrome",
} as const;

export type VisualComponent = (typeof VISUAL_COMPONENT)[keyof typeof VISUAL_COMPONENT];

export type ContinuousDataKey = "possession" | "passAccuracy";

export type EventDataKey =
  | "shots"
  | "shotsOnTarget"
  | "goal"
  | "foul"
  | "corner"
  | "offside"
  | "yellowCard"
  | "redCard"
  | "penaltyShootoutScored"
  | "penaltyShootoutMissed";

export type DataKey = ContinuousDataKey | EventDataKey;

export interface VisualMapping {
  dataKey: DataKey;
  dataType: DataType;
  meaning: string;
  visualComponent: VisualComponent;
  visualBehavior: string;
  affectedConfigSections: readonly string[];
  notesForDesign: string;
  feedEventType?: MatchEventType;
  secondaryComponents?: readonly VisualComponent[];
}

export const DATA_VISUAL_MAPPINGS: readonly VisualMapping[] = [
  {
    dataKey: "possession",
    dataType: "continuous_state",
    meaning: "Control, territory, dominance",
    visualComponent: VISUAL_COMPONENT.PossessionGrid,
    visualBehavior:
      "10×10 circle grid on each team side — filled circles = possession %. 100 circles = 100%. Morphs continuously as possession changes.",
    affectedConfigSections: ["possession", "composition.zones", "animation"],
    notesForDesign:
      "Each team has its own grid in its zone. Tune circle size, gap, filled/unfilled opacity, and breathing. Grids never cross the center gap.",
  },
  {
    dataKey: "passAccuracy",
    dataType: "continuous_state",
    meaning: "Precision, technical quality",
    visualComponent: VISUAL_COMPONENT.PassAccuracy,
    visualBehavior:
      "Above 60% → clean symmetrical 8-ray symbol. Below 60% → broken asymmetrical 5-ray symbol. Modifies fragmentation of event marks.",
    affectedConfigSections: ["passAccuracy", "randomness"],
    notesForDesign:
      "Drawn beside each possession grid. High accuracy = structured, aligned. Low accuracy = fragmented, unstable geometry on marks.",
  },
  {
    dataKey: "shots",
    dataType: "event",
    feedEventType: "shot",
    meaning: "Attacking attempt",
    visualComponent: VISUAL_COMPONENT.Shot,
    visualBehavior:
      "Adds permanent pixel/block burst cluster on that team's side. More shots = more bursts accumulated in the team zone.",
    affectedConfigSections: ["shots", "composition.zones", "energy"],
    secondaryComponents: [VISUAL_COMPONENT.EventBurst],
    notesForDesign:
      "Use block/pixel burst reference. Cluster near team anchor — never scatter across canvas or into center gap.",
  },
  {
    dataKey: "shotsOnTarget",
    dataType: "event",
    feedEventType: "shot_on_target",
    meaning: "Threat, danger",
    visualComponent: VISUAL_COMPONENT.ShotOnTarget,
    visualBehavior:
      "Adds sharp starburst/impact mark on team side, slightly closer to inner edge but never crossing into center gap.",
    affectedConfigSections: ["shotsOnTarget", "composition.zones", "energy"],
    secondaryComponents: [VISUAL_COMPONENT.EventBurst],
    notesForDesign:
      "More visually intense than Shot. Heavier stroke, larger starburst, placed toward center-facing edge of team zone.",
  },
  {
    dataKey: "goal",
    dataType: "event",
    feedEventType: "goal",
    meaning: "Decisive moment, permanent memory",
    visualComponent: VISUAL_COMPONENT.Goal,
    visualBehavior:
      "Adds tall jagged spike/mark on scoring team's side. Large, permanent, visually dominant. Never in center.",
    affectedConfigSections: ["goals", "energy"],
    secondaryComponents: [VISUAL_COMPONENT.EventBurst],
    notesForDesign:
      "Most important permanent mark on that side. Should dominate the team's accumulated artifact for the rest of the match.",
  },
  {
    dataKey: "foul",
    dataType: "event",
    feedEventType: "foul",
    meaning: "Disruption, collision",
    visualComponent: VISUAL_COMPONENT.Foul,
    visualBehavior:
      "Adds three slanted ink fracture strokes (`ink.mark` only — no colored card body). Overlaps other marks.",
    affectedConfigSections: ["fouls", "passAccuracy", "energy"],
    secondaryComponents: [VISUAL_COMPONENT.EventBurst],
    notesForDesign:
      "Reference: Foul.png / Foul.svg — three dark parallelogram slashes only. Not a card; not orange fill.",
  },
  {
    dataKey: "corner",
    dataType: "event",
    feedEventType: "corner",
    meaning: "Attacking pressure, set piece",
    visualComponent: VISUAL_COMPONENT.Corner,
    visualBehavior:
      "Adds pinwheel/hourglass mark (four triangles) as set-piece pressure on that team's side.",
    affectedConfigSections: ["corners", "composition.zones"],
    secondaryComponents: [VISUAL_COMPONENT.EventBurst],
    notesForDesign:
      "Four-arm pinwheel geometry. Set-piece pressure without literal corner-flag iconography.",
  },
  {
    dataKey: "offside",
    dataType: "event",
    feedEventType: "offside",
    meaning: "Broken timing, failed attack",
    visualComponent: VISUAL_COMPONENT.Offside,
    visualBehavior:
      "Adds stacked rounded boundary segments — broken timing mark on that team's side.",
    affectedConfigSections: ["offsides", "composition.zones"],
    secondaryComponents: [VISUAL_COMPONENT.EventBurst],
    notesForDesign:
      "Three stacked rounded bars. Should feel like broken rhythm, not a pitch line.",
  },
  {
    dataKey: "yellowCard",
    dataType: "event",
    feedEventType: "yellow_card",
    meaning: "Warning, tension",
    visualComponent: VISUAL_COMPONENT.YellowCard,
    visualBehavior:
      "Adds yellow square (`event.cardYellow`) with four vertical ink bars (`ink.mark`) on that team's side.",
    affectedConfigSections: ["cards", "energy"],
    secondaryComponents: [VISUAL_COMPONENT.EventBurst],
    notesForDesign:
      "Reference: YellowCard.png — yellow body + four slanted vertical ink bars. Distinct from Foul (no body, three slashes).",
  },
  {
    dataKey: "redCard",
    dataType: "event",
    feedEventType: "red_card",
    meaning: "Rupture, major disruption",
    visualComponent: VISUAL_COMPONENT.RedCard,
    visualBehavior:
      "Adds red square (`event.cardRed`) with four wavy vertical ink ovals (`ink.mark`) on that team's side.",
    affectedConfigSections: ["cards", "energy"],
    secondaryComponents: [VISUAL_COMPONENT.EventBurst],
    notesForDesign:
      "Reference: RedCard.png — red body + wavy ink ovals. Distinct from Foul (ink-only fractures, no card body).",
  },
  {
    dataKey: "penaltyShootoutScored",
    dataType: "event",
    feedEventType: "penalty_scored",
    meaning: "Penalty shootout kick converted",
    visualComponent: VISUAL_COMPONENT.Goal,
    visualBehavior:
      "Adds the same tall jagged goal mark as regulation goals, with bright green panel and yellow-green pattern.",
    affectedConfigSections: ["goals", "energy"],
    secondaryComponents: [VISUAL_COMPONENT.EventBurst],
    notesForDesign:
      "Same Goal geometry as regulation; fixed shootout palette (bright green c1, yellow-green c4 pattern) at 121'+.",
  },
  {
    dataKey: "penaltyShootoutMissed",
    dataType: "event",
    feedEventType: "penalty_missed",
    meaning: "Penalty shootout kick missed",
    visualComponent: VISUAL_COMPONENT.Shot,
    visualBehavior:
      "Adds an off-target block burst for a missed shootout kick — same language as off-target shots.",
    affectedConfigSections: ["shots", "composition.zones", "energy"],
    secondaryComponents: [VISUAL_COMPONENT.EventBurst],
    notesForDesign:
      "Missed shootout kicks use Shot clusters; never use Goal geometry for penalties.",
  },
] as const;

const byDataKey = new Map<DataKey, VisualMapping>(
  DATA_VISUAL_MAPPINGS.map((m) => [m.dataKey, m])
);

const byFeedEvent = new Map<MatchEventType, VisualMapping>(
  DATA_VISUAL_MAPPINGS.filter((m): m is VisualMapping & { feedEventType: MatchEventType } =>
    Boolean(m.feedEventType)
  ).map((m) => [m.feedEventType, m])
);

export function getMappingByDataKey(key: DataKey): VisualMapping | undefined {
  return byDataKey.get(key);
}

export function getMappingByEventType(eventType: MatchEventType): VisualMapping {
  const mapping = byFeedEvent.get(eventType);
  if (!mapping) {
    throw new Error(`No visual mapping for event type: ${eventType}`);
  }
  return mapping;
}

export function getEventVisualComponent(eventType: MatchEventType): VisualComponent {
  return getMappingByEventType(eventType).visualComponent;
}

export function getContinuousMappings(): VisualMapping[] {
  return DATA_VISUAL_MAPPINGS.filter((m) => m.dataType === "continuous_state");
}

export function getEventMappings(): VisualMapping[] {
  return DATA_VISUAL_MAPPINGS.filter((m) => m.dataType === "event");
}
