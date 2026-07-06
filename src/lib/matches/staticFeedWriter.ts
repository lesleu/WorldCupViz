import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { MatchCatalogEntry } from "@/data/matchCatalog";
import { feedHasReplayContent, maxFeedMinute } from "@/lib/matches/feedAdapter";
import type { MatchFeedResponse } from "@/lib/matches/types";

const GENERATED_HEADER = "// @generated — do not edit. Run: npm run sync:matches\n\n";
const SCHEDULE_PATH = path.join(process.cwd(), "src/data/schedule.generated.ts");
const FEEDS_INDEX_PATH = path.join(process.cwd(), "src/data/feeds.index.generated.ts");
const FEEDS_DIR = path.join(process.cwd(), "src/data/feeds");

function readScheduleEntries(): MatchCatalogEntry[] {
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

function writeScheduleFile(matches: MatchCatalogEntry[], syncedAt: string): void {
  const body = `${GENERATED_HEADER}import type { MatchCatalogEntry } from "@/data/matchCatalog";

export const SCHEDULE_SYNCED_AT: string | null = ${JSON.stringify(syncedAt)};

export const SCHEDULE_MATCHES: MatchCatalogEntry[] = ${JSON.stringify(matches, null, 2)};
`;
  writeFileSync(SCHEDULE_PATH, body, "utf8");
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
}

function patchScheduleEntry(
  matchId: string,
  patch: Partial<MatchCatalogEntry>
): boolean {
  const schedule = readScheduleEntries();
  if (schedule.length === 0) return false;

  const index = schedule.findIndex((entry) => entry.id === matchId);
  if (index < 0) return false;

  const feedFinalMinute = patch.finalMinute;
  schedule[index] = {
    ...schedule[index],
    ...patch,
    hasReplayFeed: patch.hasReplayFeed ?? schedule[index].hasReplayFeed,
    finalMinute: feedFinalMinute ?? schedule[index].finalMinute,
  };

  const syncedAt = readScheduleSyncedAt() ?? new Date().toISOString();
  writeScheduleFile(schedule, syncedAt);
  return true;
}

/**
 * Write a completed match feed to src/data/feeds and update the schedule index.
 * Called when a live fixture finishes (cron poll or first completed API fetch).
 */
export async function persistStaticMatchFeed(
  matchId: string,
  feed: MatchFeedResponse,
  schedulePatch?: Partial<MatchCatalogEntry>
): Promise<boolean> {
  if (!feedHasReplayContent(feed.feed)) {
    return false;
  }

  try {
    writeFeedFile(matchId, {
      ...feed,
      status: feed.status ?? "completed",
      hasReplayFeed: true,
    });
    regenerateFeedIndex();

    const finalMinute =
      schedulePatch?.finalMinute ??
      feed.currentMinute ??
      maxFeedMinute(feed.feed) ??
      undefined;

    patchScheduleEntry(matchId, {
      status: "completed",
      hasReplayFeed: true,
      finalMinute,
      ...schedulePatch,
    });

    console.log(`Persisted static feed for match ${matchId} (${feed.feed.length} updates)`);
    return true;
  } catch (error) {
    console.warn(`Failed to persist static feed for ${matchId}:`, error);
    return false;
  }
}
