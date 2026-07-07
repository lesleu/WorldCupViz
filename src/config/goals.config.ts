import type { GoalsConfig } from "./types";

export const goalsConfig: GoalsConfig = {
  heightJitterMin: 0.9,
  heightJitterMax: 1.12,
  multiGoalSpacing: 28,
  jaggedSegments: 7,
  accentWidthRatio: 0.56,
  accentHeightRatio: 0.75,
  markCapRatio: 0.72,
  /** Max goal height as fraction of team zone height. */
  maxZoneHeightRatio: 0.3,
  /** Max goal width as fraction of team zone width. */
  maxZoneWidthRatio: 0.34,
  shootoutBg: "#00E050",
  shootoutPattern: "#C8F542",
};
