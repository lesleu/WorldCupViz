/**
 * Verify completed live matches produce canvas design tokens (not just stats).
 * Run: npm run check:completed-feed-canvas
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { initialMatchState } from "../src/data/mockLiveFeed";
import type { LiveFeedUpdate } from "../src/data/mockLiveFeed";
import { computeLayout } from "../src/design-system/layout/posterLayout";
import { createReplayEngine } from "../src/engine/replayEngine";
import {
  feedHasDiscreteEvents,
  feedHasReplayContent,
  mergeMatchDataWithFeedStats,
} from "../src/lib/matches/feedAdapter";
import type { MatchData } from "../src/data/mockMatch";

function loadEnvLocal(): void {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function renderArtMarks(feed: LiveFeedUpdate[], match: MatchData) {
  const engine = createReplayEngine(feed, initialMatchState);
  const layout = computeLayout(1200, 800);
  engine.seekToMinute(90, layout, match);
  const art = engine.getSnapshot().art;
  return {
    goals: art.goals.length,
    shots: art.shots.length,
    shotsOnTarget: art.shotsOnTarget.length,
    homeGoals: engine.homeGoals,
    awayGoals: engine.awayGoals,
  };
}

async function main() {
  loadEnvLocal();

  const statsOnlyFeed: LiveFeedUpdate[] = [
    initialMatchState,
    {
      minute: 90,
      type: "state_update",
      home: { possession: 55, passAccuracy: 80, totalPasses: 400, passesAccurate: 320 },
      away: { possession: 45, passAccuracy: 75, totalPasses: 350, passesAccurate: 262 },
    },
  ];

  const matchWithApiScores: MatchData = {
    homeTeam: "Brazil",
    awayTeam: "Norway",
    homeTeamCode: "BRA",
    awayTeamCode: "NOR",
    stage: "ROUND OF 16",
    date: "July 5, 2026",
    venue: "MetLife Stadium",
    home: {
      possession: 50,
      shots: 12,
      shotsOnTarget: 5,
      passAccuracy: 80,
      fouls: 8,
      yellowCards: 1,
      redCards: 0,
      goals: 2,
      corners: 4,
      offsides: 2,
      penaltyShootoutScored: 0,
      penaltyShootoutMissed: 0,
    },
    away: {
      possession: 50,
      shots: 8,
      shotsOnTarget: 3,
      passAccuracy: 75,
      fouls: 10,
      yellowCards: 2,
      redCards: 0,
      goals: 1,
      corners: 3,
      offsides: 1,
      penaltyShootoutScored: 0,
      penaltyShootoutMissed: 0,
    },
  };

  assert(!feedHasReplayContent(statsOnlyFeed), "stats-only feed is not replay content");
  const statsOnlyArt = renderArtMarks(statsOnlyFeed, matchWithApiScores);
  assert(statsOnlyArt.goals === 0, "stats-only feed produces no goal marks on canvas");

  const mergedStats = mergeMatchDataWithFeedStats(matchWithApiScores, statsOnlyFeed);
  assert(mergedStats.home.goals === 2, "stats panel can show API goals without feed events");
  assert(statsOnlyArt.goals === 0, "canvas stays empty while stats show goals — reproduces bug");

  const eventFeed: LiveFeedUpdate[] = [
    ...statsOnlyFeed,
    { minute: 23, type: "event", team: "home", eventType: "goal" },
    { minute: 67, type: "event", team: "home", eventType: "goal" },
    { minute: 81, type: "event", team: "away", eventType: "goal" },
    { minute: 34, type: "event", team: "home", eventType: "shot" },
  ];

  assert(feedHasDiscreteEvents(eventFeed), "event feed has discrete marks");
  const eventArt = renderArtMarks(eventFeed, matchWithApiScores);
  assert(eventArt.goals === 3, "event feed renders goal tokens on canvas");
  assert(eventArt.homeGoals === 2, "engine tracks home goals from feed events");

  const fixtureId = Number(process.argv[2] ?? "1568100");
  if (process.env.MATCH_API_KEY) {
    const { fetchFixtureById, fetchFixtureEvents, fetchFixtureStatistics } = await import(
      "../src/lib/matches/apiFootballClient"
    );
    const { buildFeedResponse } = await import("../src/lib/matches/buildFeed");
    const { mapFixtureStatus } = await import("../src/lib/matches/matchAdapter");
    const { adaptFixtureToCatalogEntry } = await import("../src/lib/matches/matchAdapter");

    const fixture = await fetchFixtureById(fixtureId, 0);
    if (fixture) {
      const status = mapFixtureStatus(fixture.fixture.status.short);
      const [events, statistics] = await Promise.all([
        fetchFixtureEvents(fixtureId, 0),
        fetchFixtureStatistics(fixtureId, 0),
      ]);
      const feed = buildFeedResponse(fixture, events, statistics);
      const entry = adaptFixtureToCatalogEntry(fixture);

      console.log(
        `API ${fixtureId}: status=${status} hasReplayFeed=${feed.hasReplayFeed} events=${
          feed.feed.filter((u) => u.type === "event").length
        } goals=${entry.matchData.home.goals}-${entry.matchData.away.goals}`
      );

      if (
        status === "completed" &&
        entry.matchData.home.goals + entry.matchData.away.goals > 0
      ) {
        assert(feedHasReplayContent(feed.feed), "completed API match feed has replay content");
        const apiArt = renderArtMarks(feed.feed, entry.matchData);
        assert(
          apiArt.goals >= entry.matchData.home.goals + entry.matchData.away.goals,
          "completed API feed renders goal marks matching scoreline"
        );
      }
    }
  } else {
    console.log("MATCH_API_KEY not set — skipped live API fixture check");
  }

  console.log("Completed feed canvas checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
