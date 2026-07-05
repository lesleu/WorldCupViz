import type { MatchEventType } from "@/data/mockLiveFeed";
import { cfg } from "@/config";

/**
 * Internal energy drives motion intensity across the artwork.
 * Rises on discrete events (shots, goals) and decays smoothly over time.
 */
export interface EnergyState {
  /** Smoothed baseline tension (0–1) */
  level: number;
  /** Short-lived spike when an event fires (0–1) */
  burst: number;
  /** Goal shake amplitude (0–1, decays quickly) */
  shake: number;
}

export function createEnergyState(): EnergyState {
  return { level: cfg.energy.idleLevel, burst: 0, shake: 0 };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function resetEnergy(state: EnergyState): void {
  state.level = cfg.energy.idleLevel;
  state.burst = 0;
  state.shake = 0;
}

/** Advance energy decay and baseline tension each frame. */
export function tickEnergy(
  state: EnergyState,
  deltaSeconds: number,
  isPlaying: boolean,
  matchActive = true
): void {
  const frameScale = deltaSeconds * 60;
  state.burst *= Math.pow(cfg.energy.burstDecay, frameScale);
  state.shake *= Math.pow(cfg.energy.shakeDecay, frameScale);

  let baseTarget = cfg.energy.idleLevel;
  if (matchActive) {
    baseTarget = isPlaying ? cfg.energy.baseLevel : cfg.energy.pausedLevel;
  }
  const target = Math.min(1, baseTarget + state.burst * cfg.energy.burstInfluence);
  state.level = lerp(state.level, target, cfg.energy.smoothing * frameScale);
}

/** Spike energy when a discrete match event is applied. */
export function triggerEventEnergy(state: EnergyState, eventType: MatchEventType): void {
  const strength =
    eventType in cfg.energy.eventBurstStrength
      ? cfg.energy.eventBurstStrength[
          eventType as keyof typeof cfg.energy.eventBurstStrength
        ]
      : 0.12;
  state.burst = Math.min(1, state.burst + strength);
  state.level = Math.min(1, state.level + strength * 0.35);
  if (eventType === "goal") {
    state.shake = 1;
    state.burst = Math.min(1, state.burst + cfg.energy.goalShakeBoost);
  }
}

/** Combined motion multiplier for renderer (1 = calm, >1 = energetic). */
export function motionIntensity(state: EnergyState): number {
  return (
    1 +
    state.level * cfg.energy.motionFromLevel +
    state.burst * cfg.energy.motionFromBurst
  );
}
