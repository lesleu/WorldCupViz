import { mockMatch, type MatchData, type TeamStats } from "@/data/mockMatch";
import { getTeamName } from "@/data/teams.generated";

/**
 * FIFA World Cup 2026 tournament context (for future full schedule):
 * - Hosts: USA, Canada, Mexico
 * - Dates: ~June 11 – July 19, 2026
 * - 48 teams, 12 groups (A–L), 104 total matches
 * - Knockout: Group Stage → Round of 32 → R16 → QF → SF → Final
 */

export type TournamentStage =
  | "group_stage"
  | "round_of_32"
  | "round_of_16"
  | "quarterfinals"
  | "semifinals"
  | "third_place"
  | "final";

export interface StageSection {
  stage: TournamentStage;
  label: string;
}

export const STAGE_SECTIONS: StageSection[] = [
  { stage: "group_stage", label: "Group Stage" },
  { stage: "round_of_32", label: "Round of 32" },
  { stage: "round_of_16", label: "Round of 16" },
  { stage: "quarterfinals", label: "Quarterfinals" },
  { stage: "semifinals", label: "Semifinals" },
  { stage: "third_place", label: "Third Place" },
  { stage: "final", label: "Final" },
];

export type MatchStatus = "scheduled" | "live" | "completed";

export interface MatchCatalogEntry {
  id: string;
  /** API-Football fixture id when sourced from provider. */
  providerFixtureId?: number;
  /** True when one or both teams are not yet determined. */
  isTbd?: boolean;
  tournament: "FIFA World Cup 2026";
  stage: TournamentStage;
  stageLabel: string;
  status: MatchStatus;
  group?: string;
  matchNumber?: number;
  date: string;
  dateSort: string;
  /** ISO kickoff from API-Football (`fixture.date`). */
  kickoffAt?: string;
  /** Localized kickoff time label for cards (e.g. "7:00 PM"). */
  kickoffTime?: string;
  venue?: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamCode: string;
  awayTeamCode: string;
  coverUrl?: string;
  fulltimeCoverUrl?: string;
  hasReplayFeed: boolean;
  /** Final elapsed minute for completed covers (includes stoppage/ET). */
  finalMinute?: number;
  matchData: MatchData;
}

const kickoffStats: TeamStats = {
  possession: 50,
  shots: 0,
  shotsOnTarget: 0,
  passAccuracy: 0,
  fouls: 0,
  yellowCards: 0,
  redCards: 0,
  goals: 0,
  corners: 0,
  offsides: 0,
  penaltyShootoutScored: 0,
  penaltyShootoutMissed: 0,
};

function buildEntry(
  partial: Omit<
    MatchCatalogEntry,
    "tournament" | "matchData" | "hasReplayFeed" | "stageLabel" | "status"
  > & {
    matchData?: MatchData;
    hasReplayFeed?: boolean;
    stageLabel?: string;
    status?: MatchStatus;
  }
): MatchCatalogEntry {
  const stageLabel =
    partial.stageLabel ??
    STAGE_SECTIONS.find((s) => s.stage === partial.stage)?.label ??
    partial.stage;

  const { matchData: partialMatchData, hasReplayFeed, status, ...rest } = partial;

  return {
    tournament: "FIFA World Cup 2026",
    stageLabel,
    status: status ?? "scheduled",
    hasReplayFeed: hasReplayFeed ?? false,
    matchData:
      partialMatchData ??
      ({
        homeTeam: getTeamName(partial.homeTeamCode),
        awayTeam: getTeamName(partial.awayTeamCode),
        homeTeamCode: partial.homeTeamCode,
        awayTeamCode: partial.awayTeamCode,
        stage: stageLabel.toUpperCase(),
        date: partial.date,
        venue: partial.venue,
        home: { ...kickoffStats },
        away: { ...kickoffStats },
      } satisfies MatchData),
    ...rest,
  };
}

export const MATCH_CATALOG: MatchCatalogEntry[] = [
  buildEntry({
    id: "2026-group-a-mex-kor",
    stage: "group_stage",
    group: "A",
    matchNumber: 12,
    date: "June 18, 2026",
    dateSort: "2026-06-18",
    venue: "Estadio Guadalajara",
    homeTeam: getTeamName("MEX"),
    awayTeam: getTeamName("KOR"),
    homeTeamCode: "MEX",
    awayTeamCode: "KOR",
    status: "completed",
    hasReplayFeed: true,
    finalMinute: 90,
    matchData: mockMatch,
  }),
  buildEntry({
    id: "2026-group-b-usa-ecu",
    stage: "group_stage",
    group: "B",
    matchNumber: 8,
    date: "June 13, 2026",
    dateSort: "2026-06-13",
    venue: "SoFi Stadium",
    homeTeam: getTeamName("USA"),
    awayTeam: getTeamName("ECU"),
    homeTeamCode: "USA",
    awayTeamCode: "ECU",
  }),
  buildEntry({
    id: "2026-r32-fra-sen",
    stage: "round_of_32",
    matchNumber: 49,
    date: "July 2, 2026",
    dateSort: "2026-07-02",
    venue: "MetLife Stadium",
    homeTeam: getTeamName("FRA"),
    awayTeam: getTeamName("SEN"),
    homeTeamCode: "FRA",
    awayTeamCode: "SEN",
  }),
  buildEntry({
    id: "2026-qf-eng-ger",
    stage: "quarterfinals",
    matchNumber: 89,
    date: "July 11, 2026",
    dateSort: "2026-07-11",
    venue: "Gillette Stadium",
    homeTeam: getTeamName("ENG"),
    awayTeam: getTeamName("GER"),
    homeTeamCode: "ENG",
    awayTeamCode: "GER",
  }),
  buildEntry({
    id: "2026-sf-arg-bra",
    stage: "semifinals",
    matchNumber: 98,
    date: "July 16, 2026",
    dateSort: "2026-07-16",
    venue: "AT&T Stadium",
    homeTeam: getTeamName("ARG"),
    awayTeam: getTeamName("BRA"),
    homeTeamCode: "ARG",
    awayTeamCode: "BRA",
  }),
];

export function getMatchById(id: string): MatchCatalogEntry | undefined {
  return MATCH_CATALOG.find((entry) => entry.id === id);
}

export function getMatchesByStage(stage: TournamentStage): MatchCatalogEntry[] {
  return MATCH_CATALOG.filter((entry) => entry.stage === stage).sort((a, b) =>
    a.dateSort.localeCompare(b.dateSort)
  );
}

function buildTbdEntry(
  partial: Pick<MatchCatalogEntry, "id" | "stage" | "dateSort"> & {
    date?: string;
    stageLabel?: string;
    matchNumber?: number;
    venue?: string;
  }
): MatchCatalogEntry {
  const stageLabel =
    partial.stageLabel ??
    STAGE_SECTIONS.find((s) => s.stage === partial.stage)?.label ??
    partial.stage;

  return {
    id: partial.id,
    tournament: "FIFA World Cup 2026",
    stage: partial.stage,
    stageLabel,
    status: "scheduled",
    isTbd: true,
    matchNumber: partial.matchNumber,
    date: partial.date ?? "Date TBD",
    dateSort: partial.dateSort,
    venue: partial.venue ?? "",
    homeTeam: "TBD",
    awayTeam: "TBD",
    homeTeamCode: "TBD",
    awayTeamCode: "TBD",
    hasReplayFeed: false,
    matchData: {
      homeTeam: "TBD",
      awayTeam: "TBD",
      homeTeamCode: "TBD",
      awayTeamCode: "TBD",
      stage: stageLabel.toUpperCase(),
      date: partial.date ?? "Date TBD",
      venue: partial.venue,
      home: { ...kickoffStats },
      away: { ...kickoffStats },
    },
  };
}

/** Placeholder slots for knockout stages not yet in the demo/API schedule. */
export const TBD_PLACEHOLDER_CATALOG: MatchCatalogEntry[] = [
  buildTbdEntry({
    id: "2026-third-place-tbd",
    stage: "third_place",
    matchNumber: 103,
    dateSort: "2026-07-18",
  }),
  buildTbdEntry({
    id: "2026-final-tbd",
    stage: "final",
    matchNumber: 104,
    dateSort: "2026-07-19",
  }),
];

/**
 * TBD placeholders that still need a slot — skip any stage that already has a
 * real (non-TBD) fixture so Saturday/Sunday don't show duplicate TBD cards.
 */
export function unresolvedTbdPlaceholders(
  schedule: MatchCatalogEntry[],
  stage?: TournamentStage
): MatchCatalogEntry[] {
  const coveredStages = new Set(
    schedule.filter((entry) => !entry.isTbd).map((entry) => entry.stage)
  );
  return TBD_PLACEHOLDER_CATALOG.filter(
    (entry) =>
      !coveredStages.has(entry.stage) &&
      (stage == null || entry.stage === stage)
  );
}
