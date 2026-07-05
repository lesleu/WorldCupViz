import type { TeamSide } from "@/design-system/state/artState";
import type { LiveFeedUpdate, MatchEventType } from "@/data/mockLiveFeed";
import type { TeamStats } from "@/data/mockMatch";
import type {
  ApiFootballEvent,
  ApiFootballFixture,
} from "@/lib/matches/apiFootballClient";
import { resolveTeamCode } from "@/lib/matches/teamCodeMap";
import { cfg } from "@/config";

export function isPenaltyShootoutPhase(fixture: ApiFootballFixture): boolean {
  const short = fixture.fixture.status.short;
  return short === "P" || short === "PEN" || Boolean(fixture.score?.penalty);
}

export function isShootoutPenaltyEvent(
  event: ApiFootballEvent,
  fixture: ApiFootballFixture
): boolean {
  const detail = event.detail.toLowerCase();
  if (!detail.includes("penalty")) return false;

  const elapsed = event.time.elapsed ?? 0;
  const extra = event.time.extra ?? 0;
  const short = fixture.fixture.status.short;

  if (short === "P" || short === "PEN") return true;
  if (elapsed + extra >= cfg.replay.regulationMinutes && isPenaltyShootoutPhase(fixture)) {
    return true;
  }
  if (elapsed >= 120) return true;

  return false;
}

export function mapPenaltyAwareEventType(
  event: ApiFootballEvent,
  fixture: ApiFootballFixture
): MatchEventType | null {
  const type = event.type.toLowerCase();
  const detail = event.detail.toLowerCase();
  const shootout = isShootoutPenaltyEvent(event, fixture);

  if (type === "var") {
    if (detail.includes("goal cancelled") || detail.includes("goal disallowed")) {
      return "goal_cancelled";
    }
    if (detail.includes("penalty cancelled")) {
      return "penalty_cancelled";
    }
    return null;
  }

  if (type === "goal" && (detail.includes("cancelled") || detail.includes("disallowed"))) {
    return "goal_cancelled";
  }

  if (detail.includes("missed penalty")) {
    return shootout ? "penalty_missed" : null;
  }

  if (type === "goal" && detail.includes("penalty")) {
    return shootout ? "penalty_scored" : "goal";
  }

  if (type === "goal") return "goal";
  if (type === "card") {
    if (detail.includes("red")) return "red_card";
    return "yellow_card";
  }
  if (type === "corner") return "corner";
  if (type === "offside") return "offside";
  if (type === "foul") return "foul";
  if (type === "shot") {
    if (detail.includes("on target")) return "shot_on_target";
    return "shot";
  }
  if (detail.includes("on target")) return "shot_on_target";
  if (detail.includes("off target") || detail.includes("missed")) return "shot";

  return null;
}

export function resolveEventSide(
  event: ApiFootballEvent,
  fixture: ApiFootballFixture
): TeamSide {
  if (event.team.id === fixture.teams.home.id) return "home";
  if (event.team.id === fixture.teams.away.id) return "away";
  const eventCode = resolveTeamCode(event.team.name);
  const homeCode = resolveTeamCode(fixture.teams.home.name);
  return eventCode && homeCode && eventCode === homeCode ? "home" : "away";
}

export function countPenaltyEventsInFeed(feed: LiveFeedUpdate[]): PenaltyShootoutCounts {
  const counts = emptyPenaltyCounts();
  for (const update of feed) {
    if (update.type !== "event") continue;
    if (update.eventType === "penalty_scored") {
      counts[update.team].scored += 1;
    } else if (update.eventType === "penalty_missed") {
      counts[update.team].missed += 1;
    }
  }
  return counts;
}

export function computePenaltyCountsFromEvents(
  events: ApiFootballEvent[],
  fixture: ApiFootballFixture
): PenaltyShootoutCounts {
  const counts = emptyPenaltyCounts();
  for (const event of events) {
    const mapped = mapPenaltyAwareEventType(event, fixture);
    if (mapped !== "penalty_scored" && mapped !== "penalty_missed") continue;
    const side = resolveEventSide(event, fixture);
    if (mapped === "penalty_scored") counts[side].scored += 1;
    else counts[side].missed += 1;
  }
  return counts;
}

export function mergePenaltyCountsWithScore(
  counts: PenaltyShootoutCounts,
  fixture: ApiFootballFixture
): PenaltyShootoutCounts {
  const merged: PenaltyShootoutCounts = {
    home: { ...counts.home },
    away: { ...counts.away },
  };
  const penalty = fixture.score?.penalty;
  if (!penalty) return merged;

  merged.home.scored = Math.max(merged.home.scored, penalty.home ?? 0);
  merged.away.scored = Math.max(merged.away.scored, penalty.away ?? 0);
  return merged;
}

export function adaptPenaltyShootoutStats(
  base: { home: TeamStats; away: TeamStats },
  fixture: ApiFootballFixture,
  events?: ApiFootballEvent[],
  feed?: LiveFeedUpdate[]
): { home: TeamStats; away: TeamStats } {
  if (!isPenaltyShootoutPhase(fixture)) return base;

  const fromEvents = events
    ? computePenaltyCountsFromEvents(events, fixture)
    : feed
      ? countPenaltyEventsInFeed(feed)
      : emptyPenaltyCounts();
  const counts = mergePenaltyCountsWithScore(fromEvents, fixture);

  return {
    home: mergePenaltyStatsIntoTeamStats(base.home, "home", counts),
    away: mergePenaltyStatsIntoTeamStats(base.away, "away", counts),
  };
}

export function penaltyShootoutMinute(kickIndex: number): number {
  return cfg.replay.penaltyShootoutStartMinute + kickIndex;
}

export interface PenaltyShootoutCounts {
  home: { scored: number; missed: number };
  away: { scored: number; missed: number };
}

export function emptyPenaltyCounts(): PenaltyShootoutCounts {
  return {
    home: { scored: 0, missed: 0 },
    away: { scored: 0, missed: 0 },
  };
}

export function mergePenaltyStatsIntoTeamStats(
  stats: TeamStats,
  side: "home" | "away",
  counts: PenaltyShootoutCounts
): TeamStats {
  const row = counts[side];
  return {
    ...stats,
    penaltyShootoutScored: row.scored,
    penaltyShootoutMissed: row.missed,
  };
}

export function computeCurrentMatchMinute(
  fixture: ApiFootballFixture,
  maxFeedMinute: number
): number {
  const short = fixture.fixture.status.short;
  const elapsed = fixture.fixture.status.elapsed ?? 0;

  if (short === "P") {
    return Math.max(maxFeedMinute, cfg.replay.penaltyShootoutStartMinute);
  }

  if (short === "PEN" && fixture.score?.penalty) {
    return Math.max(maxFeedMinute, elapsed, cfg.replay.penaltyShootoutStartMinute);
  }

  return elapsed;
}
