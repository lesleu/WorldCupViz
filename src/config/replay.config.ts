import type { ReplayConfig } from "./types";

export const replayConfig: ReplayConfig = {
  regulationMinutes: 90,
  maxMatchMinutes: 145,
  penaltyShootoutStartMinute: 121,
  matchDurationMinutes: 90,
  minutesPerSecond: 0.9,
  speedOptions: [1, 2, 3, 4] as const,
  continuousSmoothing: 0.1,
  kickoffPresence: 0,
  kickoffPhaseMinutes: 8,
};
