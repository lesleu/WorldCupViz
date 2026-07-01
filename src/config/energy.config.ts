import type { EnergyConfig } from "./types";

export const energyConfig: EnergyConfig = {
  baseLevel: 0.52,
  pausedLevel: 0.38,
  idleLevel: 0.22,
  smoothing: 0.08,
  burstDecay: 0.88,
  shakeDecay: 0.82,
  burstInfluence: 0,
  goalShakeBoost: 0,
  motionFromLevel: 0,
  motionFromBurst: 0,
  shakeAmplitude: 0,
  eventBurstStrength: {
    shot: 0,
    shot_on_target: 0,
    goal: 0,
    foul: 0,
    corner: 0,
    offside: 0,
    yellow_card: 0,
    red_card: 0,
    penalty_scored: 0,
    penalty_missed: 0,
  },
};
