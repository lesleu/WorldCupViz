/**
 * Fetch one completed fixture from API-Football and persist to src/data/feeds/.
 * Usage: npx tsx scripts/persist-fixture-feed.ts 1568100
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { buildFeedFromFixtureId } from "../src/lib/matches/buildFeed";
import { adaptFixtureToCatalogEntry } from "../src/lib/matches/matchAdapter";
import { fetchFixtureById, fetchFixtureEvents, fetchFixtureStatistics } from "../src/lib/matches/apiFootballClient";
import { adaptFixtureFeed, adaptStatisticsPair, feedHasReplayContent, maxFeedMinute } from "../src/lib/matches/feedAdapter";
import { getMatchApiConfig } from "../src/lib/matches/config";
import { persistStaticMatchFeed } from "../src/lib/matches/staticFeedWriter";

function loadEnvLocal(): void {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();
  const fixtureId = Number(process.argv[2]);
  if (!Number.isFinite(fixtureId)) {
    console.error("Usage: npx tsx scripts/persist-fixture-feed.ts <fixtureId>");
    process.exit(1);
  }

  if (!getMatchApiConfig().enabled) {
    console.error("MATCH_API_KEY is not set.");
    process.exit(1);
  }

  const built = await buildFeedFromFixtureId(fixtureId);
  if (!built?.result.hasReplayFeed) {
    console.error(`Fixture ${fixtureId} has no replay content.`);
    process.exit(1);
  }

  const fixture = await fetchFixtureById(fixtureId, 0);
  if (!fixture) {
    console.error(`Fixture ${fixtureId} not found.`);
    process.exit(1);
  }

  let homeStats;
  let awayStats;
  const [statistics, events] = await Promise.all([
    fetchFixtureStatistics(fixtureId, 0),
    fetchFixtureEvents(fixtureId, 0),
  ]);
  if (statistics.length >= 2) {
    const pair = adaptStatisticsPair(statistics, fixture, events);
    homeStats = pair.home;
    awayStats = pair.away;
  }

  const bundle = adaptFixtureFeed(fixture, events, statistics);
  const entry = adaptFixtureToCatalogEntry(fixture, {
    homeStats,
    awayStats,
    hasReplayFeed: feedHasReplayContent(bundle.feed),
    finalMinute: maxFeedMinute(bundle.feed) || undefined,
  });

  const matchId = String(fixtureId);
  const ok = await persistStaticMatchFeed(matchId, built.result, {
    status: entry.status,
    hasReplayFeed: true,
    finalMinute: entry.finalMinute,
    matchData: entry.matchData,
    homeTeam: entry.homeTeam,
    awayTeam: entry.awayTeam,
    homeTeamCode: entry.homeTeamCode,
    awayTeamCode: entry.awayTeamCode,
    venue: entry.venue,
    date: entry.date,
    dateSort: entry.dateSort,
    kickoffAt: entry.kickoffAt,
    kickoffTime: entry.kickoffTime,
    stage: entry.stage,
    stageLabel: entry.stageLabel,
  });

  if (!ok) {
    process.exit(1);
  }

  console.log(
    `Persisted ${matchId}: ${entry.homeTeam} ${entry.matchData.home.goals}-${entry.matchData.away.goals} ${entry.awayTeam} (${built.result.feed.length} updates)`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
