import type { MatchCatalogEntry, MatchStatus, TournamentStage } from "@/data/matchCatalog";
import { STAGE_SECTIONS } from "@/data/matchCatalog";
import type { MatchData, TeamStats } from "@/data/mockMatch";
import { getTeamName } from "@/data/teams.generated";
import type { ApiFootballFixture } from "@/lib/matches/apiFootballClient";
import { formatKickoffFromIso } from "@/lib/matchScheduleFormat";
import { requireTeamCode, isTbdTeamName } from "@/lib/matches/teamCodeMap";

const kickoffStats: TeamStats = {
  possession: 50,
  shots: 0,
  shotsOnTarget: 0,
  passAccuracy: 0,
  fouls: 0,
  yellowCards: 0,
  redCards: 0,
  goals: 0,
  penaltyShootoutScored: 0,
  penaltyShootoutMissed: 0,
};

const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"]);
const COMPLETED_STATUSES = new Set(["FT", "AET", "PEN"]);

export function isLiveApiStatus(short: string): boolean {
  return LIVE_STATUSES.has(short);
}

export function isCompletedApiStatus(short: string): boolean {
  return COMPLETED_STATUSES.has(short);
}

export function mapFixtureStatus(short: string): MatchStatus {
  if (COMPLETED_STATUSES.has(short)) return "completed";
  if (LIVE_STATUSES.has(short)) return "live";
  return "scheduled";
}

export function mapRoundToStage(round: string | null): TournamentStage {
  const value = (round ?? "").toLowerCase();

  if (value.includes("3rd") || value.includes("third")) return "third_place";
  if (value.includes("quarter")) return "quarterfinals";
  if (value.includes("semi")) return "semifinals";
  if (value.includes("round of 16") || value.includes("8th finals")) {
    return "round_of_16";
  }
  if (value.includes("round of 32") || value.includes("16th finals")) {
    return "round_of_32";
  }
  if (value.includes("group")) return "group_stage";
  if (value === "final" || (value.includes("final") && !value.includes("round"))) {
    return "final";
  }

  return "group_stage";
}

export function extractGroup(round: string | null): string | undefined {
  if (!round) return undefined;
  const match = round.match(/group\s+([a-l])/i);
  return match?.[1]?.toUpperCase();
}

function formatDisplayDate(isoDate: string): {
  date: string;
  dateSort: string;
  kickoffAt: string;
  kickoffTime: string;
} {
  return formatKickoffFromIso(isoDate);
}

function buildMatchData(
  fixture: ApiFootballFixture,
  homeCode: string,
  awayCode: string,
  stageLabel: string,
  homeStats?: TeamStats,
  awayStats?: TeamStats
): MatchData {
  const { date } = formatDisplayDate(fixture.fixture.date);
  const venue = fixture.fixture.venue.name ?? undefined;

  return {
    homeTeam: getTeamName(homeCode),
    awayTeam: getTeamName(awayCode),
    homeTeamCode: homeCode,
    awayTeamCode: awayCode,
    stage: stageLabel.toUpperCase(),
    date,
    venue,
    home: homeStats ?? {
      ...kickoffStats,
      goals: fixture.goals.home ?? 0,
    },
    away: awayStats ?? {
      ...kickoffStats,
      goals: fixture.goals.away ?? 0,
    },
  };
}

export function adaptFixtureToCatalogEntry(
  fixture: ApiFootballFixture,
  options?: {
    homeStats?: TeamStats;
    awayStats?: TeamStats;
    hasReplayFeed?: boolean;
    finalMinute?: number;
  }
): MatchCatalogEntry {
  const homeTbd = isTbdTeamName(fixture.teams.home.name);
  const awayTbd = isTbdTeamName(fixture.teams.away.name);
  const isTbd = homeTbd || awayTbd;

  const homeCode = homeTbd
    ? "TBD"
    : requireTeamCode(fixture.teams.home.name);
  const awayCode = awayTbd
    ? "TBD"
    : requireTeamCode(fixture.teams.away.name);

  const homeTeam = homeTbd
    ? fixture.teams.home.name?.trim() || "TBD"
    : getTeamName(homeCode);
  const awayTeam = awayTbd
    ? fixture.teams.away.name?.trim() || "TBD"
    : getTeamName(awayCode);

  const stage = mapRoundToStage(fixture.league.round);
  const stageLabel =
    STAGE_SECTIONS.find((section) => section.stage === stage)?.label ?? stage;
  const status = isTbd ? "scheduled" : mapFixtureStatus(fixture.fixture.status.short);
  const { date, dateSort, kickoffAt, kickoffTime } = formatDisplayDate(fixture.fixture.date);
  const group = extractGroup(fixture.league.round);
  const elapsed = fixture.fixture.status.elapsed ?? undefined;
  const finalMinute =
    status === "completed"
      ? Math.max(options?.finalMinute ?? 0, elapsed ?? 0) || undefined
      : options?.finalMinute;

  return {
    id: String(fixture.fixture.id),
    providerFixtureId: fixture.fixture.id,
    tournament: "FIFA World Cup 2026",
    stage,
    stageLabel,
    status,
    isTbd,
    group,
    matchNumber: fixture.fixture.id,
    date,
    dateSort,
    kickoffAt,
    kickoffTime,
    venue: fixture.fixture.venue.name ?? undefined,
    homeTeam,
    awayTeam,
    homeTeamCode: homeCode,
    awayTeamCode: awayCode,
    finalMinute,
    hasReplayFeed: isTbd
      ? false
      : (options?.hasReplayFeed ?? (status === "live" || status === "completed")),
    matchData: buildMatchData(
      fixture,
      homeCode,
      awayCode,
      stageLabel,
      options?.homeStats,
      options?.awayStats
    ),
  };
}

export function parseFixtureId(matchId: string): number | null {
  const numeric = Number(matchId);
  if (Number.isInteger(numeric) && numeric > 0) return numeric;
  return null;
}
