/**
 * Sync API-Football data into committed static files.
 *
 * Usage:
 *   npm run sync:matches              # full schedule + completed feeds (API)
 *   npm run sync:matches -- --schedule
 *   npm run sync:matches -- --feeds
 *   npm run sync:matches -- --fixture 1489373
 *   npm run sync:matches -- --demo    # export demo catalog/feeds (no API)
 *   npm run sync:matches -- --force   # re-download feeds even if JSON exists
 *   npm run sync:matches -- --refresh-flags  # patch hasReplayFeed from feed JSON (no API)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  MATCH_CATALOG,
  TBD_PLACEHOLDER_CATALOG,
  type MatchCatalogEntry,
  type MatchStatus,
} from "../src/data/matchCatalog";
import { getFeedForMatch } from "../src/data/matchFeeds";
import {
  fetchFixtureById,
  fetchFixtureEvents,
  fetchFixtureStatistics,
  fetchLeagueFixtures,
} from "../src/lib/matches/apiFootballClient";
import type {
  ApiFootballEvent,
  ApiFootballStatistic,
} from "../src/lib/matches/apiFootballClient";
import { getMatchApiConfig } from "../src/lib/matches/config";
import { buildFeedFromFixtureId } from "../src/lib/matches/buildFeed";
import {
  adaptFixtureFeed,
  adaptStatisticsPair,
  estimateTeamStatsFromFixture,
  feedHasReplayContent,
  maxFeedMinute,
} from "../src/lib/matches/feedAdapter";
import {
  adaptFixtureToCatalogEntry,
  mapFixtureStatus,
  parseFixtureId,
} from "../src/lib/matches/matchAdapter";
import { fixturesToCatalogEntries } from "../src/lib/matches/fixtureCatalog";
import type { MatchFeedResponse } from "../src/lib/matches/types";

const ROOT = path.resolve(import.meta.dirname, "..");
const GENERATED_HEADER = "// @generated — do not edit. Run: npm run sync:matches\n\n";
const SCHEDULE_PATH = path.join(ROOT, "src/data/schedule.generated.ts");
const FEEDS_INDEX_PATH = path.join(ROOT, "src/data/feeds.index.generated.ts");
const FEEDS_DIR = path.join(ROOT, "src/data/feeds");

function loadEnvLocal(): void {
  const envPath = path.join(ROOT, ".env.local");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function parseFlags(argv: string[]) {
  const fixtureArg = argv.find((arg) => arg.startsWith("--fixture="));
  const fixtureFlagIndex = argv.indexOf("--fixture");
  const fixtureValue =
    fixtureArg?.slice("--fixture=".length) ??
    (fixtureFlagIndex >= 0 ? argv[fixtureFlagIndex + 1] : undefined);

  const demo = argv.includes("--demo");

  return {
    schedule: argv.includes("--schedule") || argv.includes("--full"),
    feeds: argv.includes("--feeds") || argv.includes("--full"),
    demo,
    force: argv.includes("--force"),
    fixtureId: fixtureValue ? Number(fixtureValue) : undefined,
    refreshFlags: argv.includes("--refresh-flags"),
    all:
      !demo &&
      !argv.includes("--refresh-flags") &&
      (argv.includes("--full") || (argv.length === 0 && !argv.includes("--demo"))),
  };
}

function fixtureIdForEntry(entry: MatchCatalogEntry): number | null {
  if (entry.providerFixtureId) return entry.providerFixtureId;
  return parseFixtureId(entry.id);
}

function fixturesToCatalogEntriesFromApi(
  fixtures: Awaited<ReturnType<typeof fetchLeagueFixtures>>
): MatchCatalogEntry[] {
  return fixturesToCatalogEntries(fixtures);
}

async function buildFeedFromFixture(
  fixtureId: number
): Promise<{ status: MatchStatus; result: MatchFeedResponse } | null> {
  return buildFeedFromFixtureId(fixtureId);
}

async function buildCatalogEntryFromFixture(
  fixtureId: number
): Promise<MatchCatalogEntry | null> {
  const fixture = await fetchFixtureById(fixtureId, 0);
  if (!fixture) return null;

  let homeStats;
  let awayStats;
  let events: ApiFootballEvent[] = [];
  let statistics: ApiFootballStatistic[] = [];

  try {
    [statistics, events] = await Promise.all([
      fetchFixtureStatistics(fixtureId, 0),
      fetchFixtureEvents(fixtureId, 0),
    ]);
  } catch (error) {
    console.warn(`  catalog ${fixtureId}: events/stats failed`, error);
  }

  if (statistics.length >= 2) {
    try {
      const pair = adaptStatisticsPair(statistics, fixture, events);
      homeStats = pair.home;
      awayStats = pair.away;
    } catch (error) {
      console.warn(`  catalog ${fixtureId}: stats adapt failed`, error);
    }
  }

  const bundle = adaptFixtureFeed(fixture, events, statistics);
  const hasReplayFeed = feedHasReplayContent(bundle.feed);
  const finalMinute = hasReplayFeed ? maxFeedMinute(bundle.feed) : undefined;

  if (!homeStats && hasReplayFeed) {
    const estimated = estimateTeamStatsFromFixture(fixture);
    homeStats = estimated.home;
    awayStats = estimated.away;
  }

  return adaptFixtureToCatalogEntry(fixture, {
    homeStats,
    awayStats,
    hasReplayFeed,
    finalMinute,
  });
}

function writeScheduleFile(matches: MatchCatalogEntry[], syncedAt: string): void {
  const body = `${GENERATED_HEADER}import type { MatchCatalogEntry } from "@/data/matchCatalog";

export const SCHEDULE_SYNCED_AT: string | null = ${JSON.stringify(syncedAt)};

export const SCHEDULE_MATCHES: MatchCatalogEntry[] = ${JSON.stringify(matches, null, 2)};
`;
  writeFileSync(SCHEDULE_PATH, body, "utf8");
  console.log(`  wrote ${SCHEDULE_PATH} (${matches.length} matches)`);
}

function writeFeedFile(matchId: string, feed: MatchFeedResponse): void {
  mkdirSync(FEEDS_DIR, { recursive: true });
  const filePath = path.join(FEEDS_DIR, `${matchId}.json`);
  writeFileSync(filePath, `${JSON.stringify(feed, null, 2)}\n`, "utf8");
}

function regenerateFeedIndex(): void {
  mkdirSync(FEEDS_DIR, { recursive: true });
  const ids = readdirSync(FEEDS_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.replace(/\.json$/, ""))
    .sort();

  const body = `${GENERATED_HEADER}/** Match ids with a committed replay feed JSON under src/data/feeds/. */
export const STATIC_FEED_IDS: string[] = ${JSON.stringify(ids, null, 2)};
`;
  writeFileSync(FEEDS_INDEX_PATH, body, "utf8");
  console.log(`  wrote ${FEEDS_INDEX_PATH} (${ids.length} feeds)`);
}

function readScheduleFromFile(): MatchCatalogEntry[] {
  if (!existsSync(SCHEDULE_PATH)) return [];
  const source = readFileSync(SCHEDULE_PATH, "utf8");
  const match = source.match(
    /export const SCHEDULE_MATCHES: MatchCatalogEntry\[\] = (\[[\s\S]*?\]);/
  );
  if (!match) return [];
  return JSON.parse(match[1]) as MatchCatalogEntry[];
}

function readScheduleSyncedAt(): string | null {
  if (!existsSync(SCHEDULE_PATH)) return null;
  const source = readFileSync(SCHEDULE_PATH, "utf8");
  const match = source.match(/export const SCHEDULE_SYNCED_AT: string \| null = (.+?);/);
  if (!match) return null;
  return JSON.parse(match[1]) as string | null;
}

function readFeedFromFile(matchId: string): MatchFeedResponse | null {
  const filePath = path.join(FEEDS_DIR, `${matchId}.json`);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as MatchFeedResponse;
  } catch {
    return null;
  }
}

function reconcileScheduleWithFeeds(schedule: MatchCatalogEntry[]): MatchCatalogEntry[] {
  let updated = 0;
  const reconciled = schedule.map((entry) => {
    const feed = readFeedFromFile(entry.id);
    if (!feed) return entry;

    const hasReplayFeed = feedHasReplayContent(feed.feed);
    const feedFinalMinute = hasReplayFeed ? maxFeedMinute(feed.feed) : 0;
    const finalMinute =
      feedFinalMinute > 0
        ? Math.max(entry.finalMinute ?? 0, feedFinalMinute)
        : entry.finalMinute;

    if (entry.hasReplayFeed === hasReplayFeed && entry.finalMinute === finalMinute) {
      return entry;
    }

    updated += 1;
    return { ...entry, hasReplayFeed, finalMinute };
  });

  if (updated > 0) {
    const syncedAt = readScheduleSyncedAt() ?? new Date().toISOString();
    writeScheduleFile(reconciled, syncedAt);
    console.log(`  reconciled ${updated} schedule entries from feed files`);
  } else {
    console.log("  schedule already aligned with feed files");
  }

  return reconciled;
}

async function syncSchedule(): Promise<MatchCatalogEntry[]> {
  console.log("\nSyncing full schedule…");
  const fixtures = await fetchLeagueFixtures(0);
  const entries = fixturesToCatalogEntriesFromApi(fixtures);
  if (entries.length === 0) {
    throw new Error("No fixtures returned from API-Football");
  }

  const syncedAt = new Date().toISOString();
  writeScheduleFile(entries, syncedAt);
  return reconcileScheduleWithFeeds(entries);
}

async function syncFeedForEntry(entry: MatchCatalogEntry): Promise<boolean> {
  const fixtureId = fixtureIdForEntry(entry);
  if (!fixtureId) {
    console.warn(`  skipped feed ${entry.id} (no API fixture id)`);
    return false;
  }

  const built = await buildFeedFromFixture(fixtureId);
  if (!built || !built.result.hasReplayFeed) {
    console.warn(`  skipped feed ${entry.id} (no replay content)`);
    return false;
  }

  writeFeedFile(entry.id, built.result);
  console.log(`  wrote feed ${entry.id} (${built.result.feed.length} updates)`);
  return true;
}

async function syncFeeds(
  schedule: MatchCatalogEntry[],
  options?: { fixtureId?: number; limit?: number; force?: boolean }
): Promise<void> {
  console.log("\nSyncing completed match feeds…");

  let targets: MatchCatalogEntry[];
  if (options?.fixtureId) {
    const id = String(options.fixtureId);
    targets = schedule.filter(
      (entry) => entry.id === id || entry.providerFixtureId === options.fixtureId
    );
    if (targets.length === 0) {
      const built = await buildCatalogEntryFromFixture(options.fixtureId);
      if (built) targets = [built];
    }
  } else {
    targets = schedule.filter((entry) => entry.status === "completed");
  }

  const limit = options?.limit ?? targets.length;
  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of targets.slice(0, limit)) {
    if (
      !options?.force &&
      options?.fixtureId == null &&
      existsSync(path.join(FEEDS_DIR, `${entry.id}.json`))
    ) {
      skipped += 1;
      continue;
    }

    try {
      const ok = await syncFeedForEntry(entry);
      if (ok) synced += 1;
      else skipped += 1;
    } catch (error) {
      failed += 1;
      console.warn(`  feed ${entry.id} failed:`, error);
    }
  }

  regenerateFeedIndex();
  console.log(`  feeds: synced ${synced}, skipped ${skipped}, failed ${failed}`);
  reconcileScheduleWithFeeds(readScheduleFromFile());
}

function exportDemoStatic(): MatchCatalogEntry[] {
  console.log("\nExporting demo schedule + feeds (no API)…");
  const schedule = [...MATCH_CATALOG, ...TBD_PLACEHOLDER_CATALOG].sort((a, b) =>
    a.dateSort.localeCompare(b.dateSort)
  );
  const syncedAt = new Date().toISOString();
  writeScheduleFile(schedule, syncedAt);

  let feedCount = 0;
  for (const entry of schedule) {
    const bundle = getFeedForMatch(entry.id);
    if (!bundle) continue;

    const response: MatchFeedResponse = {
      ...bundle,
      hasReplayFeed: true,
      status: entry.status,
      currentMinute: entry.finalMinute,
    };
    writeFeedFile(entry.id, response);
    feedCount += 1;
    console.log(`  wrote feed ${entry.id} (${bundle.feed.length} updates)`);
  }

  regenerateFeedIndex();
  console.log(`  demo export: ${schedule.length} schedule entries, ${feedCount} feeds`);
  return schedule;
}

async function main() {
  loadEnvLocal();
  const flags = parseFlags(process.argv.slice(2));

  if (flags.demo) {
    exportDemoStatic();
    reconcileScheduleWithFeeds(readScheduleFromFile());
    console.log("\nDone.");
    return;
  }

  if (flags.refreshFlags) {
    const schedule = readScheduleFromFile();
    if (schedule.length === 0) {
      console.error("\nNo schedule.generated.ts data — run sync:matches first.");
      process.exit(1);
    }
    reconcileScheduleWithFeeds(schedule);
    console.log("\nDone.");
    return;
  }

  const config = getMatchApiConfig();

  console.log("Static match data sync");
  console.log(`  API enabled: ${config.enabled}`);

  if (!config.enabled) {
    console.error("\nMATCH_API_KEY is not set. Add it to .env.local or run with --demo.");
    process.exit(1);
  }

  const runSchedule = flags.all || flags.schedule;
  const runFeeds = flags.all || flags.feeds || flags.fixtureId != null;

  let schedule = readScheduleFromFile();

  try {
    if (runSchedule) {
      schedule = await syncSchedule();
    } else if (schedule.length === 0) {
      console.warn("\nNo schedule.generated.ts data — run with --schedule first.");
    }

    if (flags.fixtureId != null) {
      await syncFeeds(schedule, { fixtureId: flags.fixtureId, force: flags.force });
    } else if (runFeeds) {
      if (schedule.length === 0) {
        console.warn("Skipping feeds — no schedule entries available.");
      } else {
        await syncFeeds(schedule, { force: flags.force });
      }
    }
  } catch (error) {
    console.error("\nAPI sync failed:", error);
    console.error("Tip: run `npm run sync:matches -- --demo` to export demo data without the API.");
    process.exit(1);
  }

  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
