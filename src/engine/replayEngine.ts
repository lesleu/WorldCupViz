import {
  addEventMark,
  cloneContinuous,
  createKickoffArtState,
  removeCancelledGoalMark,
  syncPossessionCircles,
  type AccumulatedArtState,
  type ContinuousMatchState,
} from "@/design-system/state/artState";
import {
  createEnergyState,
  resetEnergy,
  tickEnergy,
  triggerEventEnergy,
  type EnergyState,
} from "@/design-system/motion/energyState";
import type { LiveFeedUpdate, StateUpdate } from "@/data/mockLiveFeed";
import { initialMatchState, matchUpdates } from "@/data/mockLiveFeed";
import { feedUpdateSignature } from "@/lib/matches/feedSignature";
import type { MatchData } from "@/data/mockMatch";
import type { PosterLayout } from "@/design-system/layout/posterLayout";
import { getMappingByEventType, VISUAL_COMPONENT } from "@/design-system/mapping/visualMappings";
import { cfg } from "@/config";

export type ReplaySpeed = (typeof cfg.replay.speedOptions)[number];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpContinuous(
  current: ContinuousMatchState,
  target: ContinuousMatchState,
  t: number
): ContinuousMatchState {
  const mix = (c: ContinuousMatchState, g: ContinuousMatchState): ContinuousMatchState => ({
    home: {
      possession: lerp(c.home.possession, g.home.possession, t),
      passAccuracy: lerp(c.home.passAccuracy, g.home.passAccuracy, t),
      totalPasses: lerp(c.home.totalPasses, g.home.totalPasses, t),
      passesAccurate: lerp(c.home.passesAccurate, g.home.passesAccurate, t),
    },
    away: {
      possession: lerp(c.away.possession, g.away.possession, t),
      passAccuracy: lerp(c.away.passAccuracy, g.away.passAccuracy, t),
      totalPasses: lerp(c.away.totalPasses, g.away.totalPasses, t),
      passesAccurate: lerp(c.away.passesAccurate, g.away.passesAccurate, t),
    },
  });
  return mix(current, target);
}

export interface ReplaySnapshot {
  minute: number;
  isPlaying: boolean;
  speed: ReplaySpeed;
  homeGoals: number;
  awayGoals: number;
  /** Smoothed continuous state used for possession layer rendering */
  continuous: ContinuousMatchState;
  /** Accumulated permanent marks + possession field target */
  art: AccumulatedArtState;
  /** Motion / tension driver */
  energy: EnergyState;
}

/**
 * Replay engine — processes feed updates in order.
 * - state_update → morph continuous possessionGrid (never clears marks)
 * - event → append permanent mark (never applied twice)
 */
export class ReplayEngine {
  minute = 0;
  isPlaying = false;
  speed: ReplaySpeed = 1;
  homeGoals = 0;
  awayGoals = 0;

  private updateIndex = 0;
  private appliedKeys = new Set<string>();
  private targetContinuous: ContinuousMatchState;
  private smoothContinuous: ContinuousMatchState;
  private art: AccumulatedArtState;
  private energy: EnergyState;
  private liveClockMode = false;

  constructor(
    private readonly feed: LiveFeedUpdate[] = matchUpdates,
    private readonly kickoff: StateUpdate = initialMatchState
  ) {
    this.targetContinuous = {
      home: { ...kickoff.home },
      away: { ...kickoff.away },
    };
    this.smoothContinuous = cloneContinuous(this.targetContinuous);
    this.art = createKickoffArtState(this.targetContinuous);
    this.energy = createEnergyState();
  }

  /** Append live feed updates (deduped, sorted by minute). */
  extendFeed(updates: LiveFeedUpdate[]): void {
    if (updates.length === 0) return;

    const existing = new Set(this.feed.map((update) => feedUpdateSignature(update)));

    for (const update of updates) {
      const key = feedUpdateSignature(update);
      if (existing.has(key)) continue;
      existing.add(key);
      this.feed.push(update);
    }

    this.feed.sort((a, b) => {
      if (a.minute !== b.minute) return a.minute - b.minute;
      if (a.type === "state_update" && b.type !== "state_update") return 1;
      if (b.type === "state_update" && a.type !== "state_update") return -1;
      if (a.type === "event" && b.type === "event") {
        return (a.sequence ?? 0) - (b.sequence ?? 0);
      }
      return 0;
    });
  }

  /** Sync replay clock to live match minute. */
  syncLiveMinute(minute: number): void {
    this.minute = Math.min(
      Math.max(minute, 0),
      cfg.replay.maxMatchMinutes
    );
  }

  /** Live mode: clock driven by API polls, not playback speed. */
  setLiveClockMode(enabled: boolean): void {
    this.liveClockMode = enabled;
  }

  /** Apply feed updates immediately (e.g. after a live poll). */
  flushUpdates(layout: PosterLayout, match: MatchData): void {
    this.applyPendingUpdates(layout, match);
    this.smoothContinuous = lerpContinuous(
      this.smoothContinuous,
      this.targetContinuous,
      cfg.replay.continuousSmoothing
    );
    this.art.possessionGrid = cloneContinuous(this.smoothContinuous);
    // Sync from target (not lerped float) so circle count stays stable.
    syncPossessionCircles(this.art, layout, this.targetContinuous);
  }

  /** Clear all accumulated marks and restart from kickoff. */
  reset(): void {
    this.minute = 0;
    this.isPlaying = false;
    this.speed = 1;
    this.updateIndex = 0;
    this.appliedKeys.clear();
    this.homeGoals = 0;
    this.awayGoals = 0;
    this.targetContinuous = {
      home: { ...this.kickoff.home },
      away: { ...this.kickoff.away },
    };
    this.smoothContinuous = cloneContinuous(this.targetContinuous);
    this.art = createKickoffArtState(this.targetContinuous);
    resetEnergy(this.energy);
  }

  play(): void {
    this.isPlaying = true;
  }

  pause(): void {
    this.isPlaying = false;
  }

  setSpeed(speed: ReplaySpeed): void {
    this.speed = speed;
  }

  /** Jump to a fixed minute and apply all feed updates (for static cover thumbnails). */
  seekToMinute(minute: number, layout: PosterLayout, match: MatchData): void {
    this.reset();
    this.minute = Math.min(Math.max(minute, 0), cfg.replay.maxMatchMinutes);
    this.applyPendingUpdates(layout, match);
    this.smoothContinuous = cloneContinuous(this.targetContinuous);
    this.art.possessionGrid = cloneContinuous(this.targetContinuous);
    syncPossessionCircles(this.art, layout, this.targetContinuous);
    this.pause();
  }

  /** Advance replay clock and apply feed updates up to current minute. */
  tick(deltaSeconds: number, layout: PosterLayout, match: MatchData): void {
    if (this.isPlaying && !this.liveClockMode) {
      this.minute = Math.min(
        cfg.replay.maxMatchMinutes,
        this.minute + deltaSeconds * cfg.replay.minutesPerSecond * this.speed
      );
      if (this.minute >= cfg.replay.maxMatchMinutes) {
        this.isPlaying = false;
      }
    }

    this.applyPendingUpdates(layout, match);
    this.smoothContinuous = lerpContinuous(
      this.smoothContinuous,
      this.targetContinuous,
      cfg.replay.continuousSmoothing
    );
    this.art.possessionGrid = cloneContinuous(this.smoothContinuous);
    syncPossessionCircles(this.art, layout, this.targetContinuous);
    tickEnergy(this.energy, deltaSeconds, this.isPlaying, true);
  }

  getSnapshot(): ReplaySnapshot {
    return {
      minute: this.minute,
      isPlaying: this.isPlaying,
      speed: this.speed,
      homeGoals: this.homeGoals,
      awayGoals: this.awayGoals,
      continuous: cloneContinuous(this.smoothContinuous),
      art: this.art,
      energy: this.energy,
    };
  }

  private applyPendingUpdates(layout: PosterLayout, match: MatchData): void {
    for (let index = 0; index < this.feed.length; index++) {
      const update = this.feed[index];
      if (update.minute > this.minute) continue;

      const key = feedUpdateSignature(update);
      if (this.appliedKeys.has(key)) continue;

      this.applyUpdate(update, index, layout, match);
      this.appliedKeys.add(key);
    }

    while (
      this.updateIndex < this.feed.length &&
      this.feed[this.updateIndex].minute <= this.minute
    ) {
      this.updateIndex++;
    }
  }

  private applyUpdate(
    update: LiveFeedUpdate,
    index: number,
    layout: PosterLayout,
    match: MatchData
  ): void {
    if (update.type === "state_update") {
      // Continuous mappings: possession → PossessionGrid, passAccuracy → PassAccuracy
      this.targetContinuous = {
        home: { ...update.home },
        away: { ...update.away },
      };
      return;
    }

    if (update.eventType === "goal_cancelled") {
      if (
        removeCancelledGoalMark(this.art, update.team, { variant: "regulation" })
      ) {
        if (update.team === "home") {
          this.homeGoals = Math.max(0, this.homeGoals - 1);
        } else {
          this.awayGoals = Math.max(0, this.awayGoals - 1);
        }
      }
      return;
    }

    if (update.eventType === "penalty_cancelled") {
      removeCancelledGoalMark(this.art, update.team, { variant: "shootout" });
      return;
    }

    // Discrete event → primary visual component on that team's side (+ EventBurst)
    const { visualComponent } = getMappingByEventType(update.eventType);
    addEventMark(this.art, update, index, layout, match);
    triggerEventEnergy(this.energy, update.eventType);
    if (visualComponent === VISUAL_COMPONENT.Goal && update.eventType === "goal") {
      if (update.team === "home") this.homeGoals++;
      else this.awayGoals++;
    }
  }
}

export function createReplayEngine(
  feed: LiveFeedUpdate[] = matchUpdates,
  kickoff: StateUpdate = initialMatchState
): ReplayEngine {
  return new ReplayEngine(feed, kickoff);
}

export type { MatchData };
