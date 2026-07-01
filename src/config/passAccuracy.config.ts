import type { PassAccuracyConfig } from "./types";

export const passAccuracyConfig: PassAccuracyConfig = {
  cleanThreshold: 60,
  cleanSparkCount: 3,
  brokenSparkCount: 9,
  minFragmentation: 0,
  maxFragmentation: 1.2,
  alignmentStrength: 1,
};
