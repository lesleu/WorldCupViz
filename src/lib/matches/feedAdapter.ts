import type { TeamSide } from "@/design-system/state/artState";
import type { MatchEventType, LiveFeedUpdate, StateUpdate } from "@/data/mockLiveFeed";
import { initialMatchState } from "@/data/mockLiveFeed";
import type { TeamStats } from "@/data/mockMatch";
import type {
  ApiFootballEvent,
  ApiFootballFixture,
  ApiFootballStatistic,
} from "@/lib/matches/apiFootballClient";
import { resolveTeamCode } from "@/lib/matches/teamCodeMap";
import type { MatchFeedBundle } from "@/lib/matches/types";
import {
  adaptPenaltyShootoutStats,
  computeCurrentMatchMinute,
  countPenaltyEventsInFeed,
  isPenaltyShootoutPhase,
  mapPenaltyAwareEventType,
  penaltyShootoutMinute,
} from "@/lib/matches/penaltyShootout";

function eventMinute(event: ApiFootballEvent): number {
  const elapsed = event.time.elapsed ?? 0;
  const extra = event.time.extra ?? 0;
  return elapsed + extra;
}

function sideForTeam(
  event: ApiFootballEvent,
  homeTeamId: number,
  awayTeamId: number,
  homeName: string
): TeamSide {
  if (event.team.id === homeTeamId) return "home";
  if (event.team.id === awayTeamId) return "away";
  const eventCode = resolveTeamCode(event.team.name);
  const homeCode = resolveTeamCode(homeName);
  return eventCode && homeCode && eventCode === homeCode ? "home" : "away";
}

function mapEventType(
  event: ApiFootballEvent,
  fixture: ApiFootballFixture
): MatchEventType | null {
  return mapPenaltyAwareEventType(event, fixture);
}

function parsePercent(value: number | string | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return Number(String(value).replace("%", "")) || 0;
}

function statValue(
  stats: ApiFootballStatistic["statistics"],
  type: string
): number | string | null {
  const row = stats.find((entry) => entry.type === type);
  return row?.value ?? null;
}

export function adaptStatisticsToTeamStats(
  stats: ApiFootballStatistic["statistics"],
  goals: number
): TeamStats {
  return {
    possession: parsePercent(statValue(stats, "Ball Possession")),
    shots: Number(statValue(stats, "Total Shots") ?? 0),
    shotsOnTarget: Number(statValue(stats, "Shots on Goal") ?? 0),
    passAccuracy: parsePercent(statValue(stats, "Passes %")),
    fouls: Number(statValue(stats, "Fouls") ?? 0),
    yellowCards: Number(statValue(stats, "Yellow Cards") ?? 0),
    redCards: Number(statValue(stats, "Red Cards") ?? 0),
    goals,
    penaltyShootoutScored: 0,
    penaltyShootoutMissed: 0,
  };
}

export function adaptStatisticsPair(
  statistics: ApiFootballStatistic[],
  fixture: ApiFootballFixture,
  events?: ApiFootballEvent[]
): { home: TeamStats; away: TeamStats } {
  const homeId = fixture.teams.home.id;
  const awayId = fixture.teams.away.id;
  const homeRow = statistics.find((row) => row.team.id === homeId);
  const awayRow = statistics.find((row) => row.team.id === awayId);

  const base = {
    home: adaptStatisticsToTeamStats(
      homeRow?.statistics ?? [],
      fixture.goals.home ?? 0
    ),
    away: adaptStatisticsToTeamStats(
      awayRow?.statistics ?? [],
      fixture.goals.away ?? 0
    ),
  };

  return adaptPenaltyShootoutStats(base, fixture, events);
}

function buildStateUpdate(
  minute: number,
  home: TeamStats,
  away: TeamStats
): StateUpdate {
  const toContinuous = (stats: TeamStats) => ({
    possession: stats.possession,
    passAccuracy: stats.passAccuracy,
    totalPasses: Math.max(Math.round(stats.passAccuracy * 2), 0),
    passesAccurate: Math.max(Math.round(stats.passAccuracy), 0),
  });

  return {
    minute,
    type: "state_update",
    home: toContinuous(home),
    away: toContinuous(away),
  };
}

type EventCounts = Record<MatchEventType, number>;

function emptyEventCounts(): EventCounts {
  return {
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
  };
}

function countFeedEvents(feed: LiveFeedUpdate[]): Record<TeamSide, EventCounts> {
  const counts: Record<TeamSide, EventCounts> = {
    home: emptyEventCounts(),
    away: emptyEventCounts(),
  };

  for (const update of feed) {
    if (update.type !== "event") continue;
    counts[update.team][update.eventType] += 1;
  }

  return counts;
}

/** Deterministic minute slots spread across the elapsed match window. */
function spreadEventMinutes(
  count: number,
  maxMinute: number,
  seed: number
): number[] {
  if (count <= 0 || maxMinute <= 0) return [];

  const minutes: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const jitter = (((seed + i * 17) * 9301 + 49297) % 233280) / 233280 - 0.5;
    const minute = Math.round(maxMinute * Math.min(0.98, Math.max(0.02, t + jitter * 0.06)));
    minutes.push(Math.max(1, minute));
  }

  return minutes.sort((a, b) => a - b);
}

function appendSyntheticEvents(
  feed: LiveFeedUpdate[],
  side: TeamSide,
  eventType: MatchEventType,
  count: number,
  maxMinute: number,
  seed: number
): void {
  if (count <= 0) return;

  const minutes = spreadEventMinutes(count, maxMinute, seed);
  minutes.forEach((minute, sequence) => {
    feed.push({
      minute,
      type: "event",
      team: side,
      eventType,
      sequence,
    });
  });
}

function extraStatCount(
  stats: ApiFootballStatistic["statistics"],
  type: string
): number {
  return Number(statValue(stats, type) ?? 0);
}

/**
 * API-Football statistics include totals that rarely appear as timeline events.
 * Synthesize missing discrete marks so art matches the stats panel.
 */
function enrichFeedFromStatistics(
  feed: LiveFeedUpdate[],
  statistics: ApiFootballStatistic[],
  fixture: ApiFootballFixture
): void {
  if (statistics.length < 2) return;

  const { home: homeStats, away: awayStats } = adaptStatisticsPair(statistics, fixture);
  const maxMinute = Math.max(
    fixture.fixture.status.elapsed ?? 0,
    fixture.goals.home != null || fixture.goals.away != null ? 1 : 0,
    1
  );
  const counts = countFeedEvents(feed);
  const homeId = fixture.teams.home.id;
  const awayId = fixture.teams.away.id;
  const homeRow = statistics.find((row) => row.team.id === homeId);
  const awayRow = statistics.find((row) => row.team.id === awayId);

  for (const [side, stats, row, seedBase] of [
    ["home", homeStats, homeRow, 101] as const,
    ["away", awayStats, awayRow, 303] as const,
  ]) {
    const existing = counts[side];
    const statList = row?.statistics ?? [];

    appendSyntheticEvents(
      feed,
      side,
      "goal",
      Math.max(0, stats.goals - existing.goal),
      maxMinute,
      seedBase + 1
    );
    appendSyntheticEvents(
      feed,
      side,
      "shot_on_target",
      Math.max(0, stats.shotsOnTarget - stats.goals - existing.shot_on_target),
      maxMinute,
      seedBase + 2
    );
    appendSyntheticEvents(
      feed,
      side,
      "shot",
      Math.max(0, stats.shots - stats.shotsOnTarget - existing.shot),
      maxMinute,
      seedBase + 3
    );
    appendSyntheticEvents(
      feed,
      side,
      "foul",
      Math.max(0, stats.fouls - existing.foul),
      maxMinute,
      seedBase + 4
    );
    appendSyntheticEvents(
      feed,
      side,
      "yellow_card",
      Math.max(0, stats.yellowCards - existing.yellow_card),
      maxMinute,
      seedBase + 5
    );
    appendSyntheticEvents(
      feed,
      side,
      "red_card",
      Math.max(0, stats.redCards - existing.red_card),
      maxMinute,
      seedBase + 6
    );
    appendSyntheticEvents(
      feed,
      side,
      "corner",
      Math.max(0, extraStatCount(statList, "Corner Kicks") - existing.corner),
      maxMinute,
      seedBase + 7
    );
    appendSyntheticEvents(
      feed,
      side,
      "offside",
      Math.max(0, extraStatCount(statList, "Offsides") - existing.offside),
      maxMinute,
      seedBase + 8
    );
  }
}

/** Synthesize missing shootout kicks when score.penalty exceeds timeline events. */
function enrichFeedFromPenaltyShootout(
  feed: LiveFeedUpdate[],
  fixture: ApiFootballFixture
): void {
  if (!isPenaltyShootoutPhase(fixture)) return;

  const counts = countPenaltyEventsInFeed(feed);
  const homeTarget = fixture.score?.penalty?.home ?? counts.home.scored;
  const awayTarget = fixture.score?.penalty?.away ?? counts.away.scored;

  let kickIndex = feed.filter(
    (update) =>
      update.type === "event" &&
      (update.eventType === "penalty_scored" || update.eventType === "penalty_missed")
  ).length;

  for (const [side, target, existing] of [
    ["home", homeTarget, counts.home.scored] as const,
    ["away", awayTarget, counts.away.scored] as const,
  ]) {
    const missing = Math.max(0, (target ?? 0) - existing);
    for (let i = 0; i < missing; i++) {
      feed.push({
        minute: penaltyShootoutMinute(kickIndex),
        type: "event",
        team: side,
        eventType: "penalty_scored",
        sequence: kickIndex,
      });
      kickIndex += 1;
    }
  }
}

const PLAYED_FIXTURE_STATUSES = new Set([
  "FT",
  "AET",
  "PEN",
  "1H",
  "HT",
  "2H",
  "ET",
  "BT",
  "P",
  "LIVE",
]);

function isPlayedFixture(fixture: ApiFootballFixture): boolean {
  return PLAYED_FIXTURE_STATUSES.has(fixture.fixture.status.short);
}

function feedHasDiscreteEvents(feed: LiveFeedUpdate[]): boolean {
  return feed.some((update) => update.type === "event");
}

/** When API events/stats are missing, build goal marks from the fixture scoreline. */
function enrichFeedFromFixtureScore(
  feed: LiveFeedUpdate[],
  fixture: ApiFootballFixture
): void {
  const homeGoals = fixture.goals.home ?? 0;
  const awayGoals = fixture.goals.away ?? 0;
  if (homeGoals === 0 && awayGoals === 0) return;

  const maxMinute = Math.max(fixture.fixture.status.elapsed ?? 90, 1);

  appendSyntheticEvents(feed, "home", "goal", homeGoals, maxMinute, 501);
  appendSyntheticEvents(feed, "away", "goal", awayGoals, maxMinute, 701);
}

export function estimateTeamStatsFromFixture(fixture: ApiFootballFixture): {
  home: TeamStats;
  away: TeamStats;
} {
  const homeGoals = fixture.goals.home ?? 0;
  const awayGoals = fixture.goals.away ?? 0;

  const estimateSide = (goals: number): TeamStats => ({
    ...adaptStatisticsToTeamStats([], goals),
    goals,
    shots: Math.max(goals * 2, goals),
    shotsOnTarget: Math.max(goals, goals > 0 ? 1 : 0),
  });

  return {
    home: estimateSide(homeGoals),
    away: estimateSide(awayGoals),
  };
}

export function feedHasReplayContent(feed: LiveFeedUpdate[]): boolean {
  return feed.length > 1;
}

export { adaptPenaltyShootoutStats } from "@/lib/matches/penaltyShootout";

export function adaptEventsToFeed(
  events: ApiFootballEvent[],
  fixture: ApiFootballFixture,
  statistics?: ApiFootballStatistic[]
): LiveFeedUpdate[] {
  const homeId = fixture.teams.home.id;
  const awayId = fixture.teams.away.id;
  const feed: LiveFeedUpdate[] = [initialMatchState];

  const sorted = [...events].sort((a, b) => eventMinute(a) - eventMinute(b));
  let shootoutKickIndex = 0;

  for (const event of sorted) {
    const mapped = mapEventType(event, fixture);
    if (!mapped) continue;

    const isShootoutKick =
      mapped === "penalty_scored" || mapped === "penalty_missed";
    const minute = isShootoutKick
      ? penaltyShootoutMinute(shootoutKickIndex)
      : eventMinute(event);

    feed.push({
      minute,
      type: "event",
      team: sideForTeam(event, homeId, awayId, fixture.teams.home.name),
      eventType: mapped,
      ...(isShootoutKick ? { sequence: shootoutKickIndex } : {}),
    });

    if (isShootoutKick) shootoutKickIndex += 1;
  }

  enrichFeedFromPenaltyShootout(feed, fixture);

  if (statistics && statistics.length >= 2) {
    enrichFeedFromStatistics(feed, statistics, fixture);
  }

  if (!feedHasDiscreteEvents(feed) && isPlayedFixture(fixture)) {
    enrichFeedFromFixtureScore(feed, fixture);
  }

  const hasFinalState = feed.some(
    (update) => update.type === "state_update" && update.minute > 0
  );

  if (!hasFinalState && isPlayedFixture(fixture)) {
    const stats =
      statistics && statistics.length >= 2
        ? adaptStatisticsPair(statistics, fixture, events)
        : isPenaltyShootoutPhase(fixture)
          ? adaptPenaltyShootoutStats(
              {
                home: adaptStatisticsToTeamStats([], fixture.goals.home ?? 0),
                away: adaptStatisticsToTeamStats([], fixture.goals.away ?? 0),
              },
              fixture,
              events,
              feed
            )
          : estimateTeamStatsFromFixture(fixture);

    const minute =
      computeCurrentMatchMinute(fixture, maxFeedMinute(feed)) ||
      fixture.fixture.status.elapsed ||
      90;
    feed.push(buildStateUpdate(minute, stats.home, stats.away));
  }

  return feed.sort((a, b) => {
    if (a.minute !== b.minute) return a.minute - b.minute;
    if (a.type === "state_update" && b.type !== "state_update") return 1;
    if (b.type === "state_update" && a.type !== "state_update") return -1;
    if (a.type === "event" && b.type === "event") {
      return (a.sequence ?? 0) - (b.sequence ?? 0);
    }
    return 0;
  });
}

export function maxFeedMinute(feed: LiveFeedUpdate[]): number {
  return feed.reduce((max, update) => Math.max(max, update.minute), 0);
}

export function adaptFixtureFeed(
  fixture: ApiFootballFixture,
  events: ApiFootballEvent[],
  statistics: ApiFootballStatistic[]
): MatchFeedBundle {
  const feed = adaptEventsToFeed(events, fixture, statistics);
  const currentMinute = computeCurrentMatchMinute(fixture, maxFeedMinute(feed));
  const short = fixture.fixture.status.short;

  return {
    feed,
    kickoff: initialMatchState,
    currentMinute,
    status:
      short === "FT" || short === "AET" || short === "PEN"
        ? "completed"
        : ["1H", "HT", "2H", "ET", "BT", "P", "LIVE"].includes(short)
          ? "live"
          : "scheduled",
  };
}

export function filterFeedSinceMinute(
  feed: LiveFeedUpdate[],
  sinceMinute: number
): LiveFeedUpdate[] {
  return feed.filter((update) => update.minute > sinceMinute);
}
