/**
 * One-off: rebuild England–Argentina (1586077) replay feed from published
 * Opta/FotMob final stats + known timeline (goals + yellow cards).
 *
 * Usage: npx tsx scripts/rebuild-eng-arg-feed.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  feedHasReplayContent,
  maxFeedMinute,
  mergeMatchDataWithFeedStats,
} from "../src/lib/matches/feedAdapter";
import { buildFeedResponse } from "../src/lib/matches/buildFeed";
import type {
  ApiFootballEvent,
  ApiFootballFixture,
  ApiFootballStatistic,
} from "../src/lib/matches/apiFootballClient";
import type { MatchCatalogEntry } from "../src/data/matchCatalog";
import type { MatchData } from "../src/data/mockMatch";

const HOME_ID = 10;
const AWAY_ID = 20;

const fixture: ApiFootballFixture = {
  fixture: {
    id: 1586077,
    date: "2026-07-15T19:00:00+00:00",
    status: { short: "FT", long: "Match Finished", elapsed: 90 },
    venue: { name: "Mercedes-Benz Stadium", city: "Atlanta" },
  },
  league: {
    id: 1,
    season: 2026,
    round: "Semi-finals",
    name: "World Cup",
  },
  teams: {
    home: { id: HOME_ID, name: "England", winner: false },
    away: { id: AWAY_ID, name: "Argentina", winner: true },
  },
  goals: { home: 1, away: 2 },
  score: {
    fulltime: { home: 1, away: 2 },
    extratime: { home: null, away: null },
    penalty: { home: null, away: null },
  },
};

/** FotMob timeline — goals + yellow cards. */
const events: ApiFootballEvent[] = [
  {
    time: { elapsed: 37, extra: null },
    team: { id: HOME_ID, name: "England" },
    type: "Card",
    detail: "Yellow Card",
  },
  {
    time: { elapsed: 42, extra: null },
    team: { id: AWAY_ID, name: "Argentina" },
    type: "Card",
    detail: "Yellow Card",
  },
  {
    time: { elapsed: 51, extra: null },
    team: { id: AWAY_ID, name: "Argentina" },
    type: "Card",
    detail: "Yellow Card",
  },
  {
    time: { elapsed: 55, extra: null },
    team: { id: HOME_ID, name: "England" },
    type: "Goal",
    detail: "Normal Goal",
  },
  {
    time: { elapsed: 85, extra: null },
    team: { id: AWAY_ID, name: "Argentina" },
    type: "Goal",
    detail: "Normal Goal",
  },
  {
    time: { elapsed: 90, extra: 2 },
    team: { id: AWAY_ID, name: "Argentina" },
    type: "Goal",
    detail: "Normal Goal",
  },
  {
    time: { elapsed: 90, extra: 4 },
    team: { id: AWAY_ID, name: "Argentina" },
    type: "Card",
    detail: "Yellow Card",
  },
];

function statsFor(
  id: number,
  name: string,
  row: Record<string, number | string>
): ApiFootballStatistic {
  return {
    team: { id, name },
    statistics: Object.entries(row).map(([type, value]) => ({ type, value })),
  };
}

/** Opta/FotMob match statistics. */
const statistics: ApiFootballStatistic[] = [
  statsFor(HOME_ID, "England", {
    "Ball Possession": "36%",
    "Total Shots": 5,
    "Shots on Goal": 2,
    Fouls: 11,
    "Corner Kicks": 1,
    Offsides: 1,
    "Yellow Cards": 1,
    "Red Cards": 0,
    "Passes %": "84%",
    "Total passes": 325,
    "Passes accurate": 273,
  }),
  statsFor(AWAY_ID, "Argentina", {
    "Ball Possession": "64%",
    "Total Shots": 15,
    "Shots on Goal": 5,
    Fouls: 15,
    "Corner Kicks": 6,
    Offsides: 3,
    "Yellow Cards": 3,
    "Red Cards": 0,
    "Passes %": "91%",
    "Total passes": 590,
    "Passes accurate": 537,
  }),
];

const built = buildFeedResponse(fixture, events, statistics);

const progressive = [
  { minute: 10, home: 48, away: 52 },
  { minute: 20, home: 44, away: 56 },
  { minute: 30, home: 42, away: 58 },
  { minute: 45, home: 40, away: 60 },
  { minute: 60, home: 39, away: 61 },
  { minute: 75, home: 38, away: 62 },
  { minute: 85, home: 37, away: 63 },
];

const kickoff = built.kickoff;
const eventsOnly = built.feed.filter((u) => u.type === "event");
const finalState = built.feed
  .filter((u) => u.type === "state_update" && u.minute > 0)
  .sort((a, b) => b.minute - a.minute)[0];

const feed = [
  kickoff,
  ...progressive.map((p) => ({
    minute: p.minute,
    type: "state_update" as const,
    home: {
      possession: p.home,
      passAccuracy: 84,
      totalPasses: 0,
      passesAccurate: 0,
    },
    away: {
      possession: p.away,
      passAccuracy: 91,
      totalPasses: 0,
      passesAccurate: 0,
    },
  })),
  ...eventsOnly,
  finalState ?? {
    minute: 92,
    type: "state_update" as const,
    home: {
      possession: 36,
      passAccuracy: 84,
      totalPasses: 168,
      passesAccurate: 84,
    },
    away: {
      possession: 64,
      passAccuracy: 91,
      totalPasses: 182,
      passesAccurate: 91,
    },
  },
].sort((a, b) => {
  if (a.minute !== b.minute) return a.minute - b.minute;
  if (a.type === "state_update" && b.type !== "state_update") return 1;
  if (b.type === "state_update" && a.type !== "state_update") return -1;
  if (a.type === "event" && b.type === "event") {
    return (a.sequence ?? 0) - (b.sequence ?? 0);
  }
  return 0;
});

const bundle = {
  feed,
  kickoff,
  currentMinute: Math.max(92, maxFeedMinute(feed)),
  status: "completed" as const,
  hasReplayFeed: true,
};

writeFileSync(
  "src/data/feeds/1586077.json",
  `${JSON.stringify(bundle, null, 2)}\n`,
  "utf8"
);

const matchData: MatchData = {
  homeTeam: "England",
  awayTeam: "Argentina",
  homeTeamCode: "ENG",
  awayTeamCode: "ARG",
  stage: "SEMIFINALS",
  date: "July 15, 2026",
  venue: "Mercedes-Benz Stadium",
  home: {
    possession: 36,
    shots: 5,
    shotsOnTarget: 2,
    passAccuracy: 84,
    fouls: 11,
    yellowCards: 1,
    redCards: 0,
    goals: 1,
    corners: 1,
    offsides: 1,
    penaltyShootoutScored: 0,
    penaltyShootoutMissed: 0,
  },
  away: {
    possession: 64,
    shots: 15,
    shotsOnTarget: 5,
    passAccuracy: 91,
    fouls: 15,
    yellowCards: 3,
    redCards: 0,
    goals: 2,
    corners: 6,
    offsides: 3,
    penaltyShootoutScored: 0,
    penaltyShootoutMissed: 0,
  },
};

const merged = mergeMatchDataWithFeedStats(matchData, feed);
console.log("board home", merged.home);
console.log("board away", merged.away);

const counts: Record<string, number> = {};
for (const u of feed) {
  if (u.type !== "event") continue;
  const key = `${u.team}:${u.eventType}`;
  counts[key] = (counts[key] ?? 0) + 1;
}
console.log("event counts", counts);
console.log("feed length", feed.length, "hasReplay", feedHasReplayContent(feed));
console.log(
  "goals",
  feed.filter((u) => u.type === "event" && u.eventType === "goal")
);

const schedulePath = "src/data/schedule.generated.ts";
const src = readFileSync(schedulePath, "utf8");
const match = src.match(
  /export const SCHEDULE_MATCHES: MatchCatalogEntry\[\] = (\[[\s\S]*?\]);/
);
if (!match) throw new Error("schedule not found");
const matches = JSON.parse(match[1]) as MatchCatalogEntry[];
const entry = matches.find((m) => m.id === "1586077");
if (!entry) throw new Error("ENG-ARG missing");
entry.status = "completed";
entry.hasReplayFeed = true;
entry.finalMinute = bundle.currentMinute;
entry.matchData = matchData;
const synced = src.match(
  /export const SCHEDULE_SYNCED_AT: string \| null = (.+?);/
)?.[1];
const body = `// @generated — do not edit. Run: npm run sync:matches

import type { MatchCatalogEntry } from "@/data/matchCatalog";

export const SCHEDULE_SYNCED_AT: string | null = ${synced};

export const SCHEDULE_MATCHES: MatchCatalogEntry[] = ${JSON.stringify(matches, null, 2)};
`;
writeFileSync(schedulePath, body, "utf8");
console.log("wrote src/data/feeds/1586077.json + schedule");
