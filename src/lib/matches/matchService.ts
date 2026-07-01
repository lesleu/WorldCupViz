import {
  TBD_PLACEHOLDER_CATALOG,
  getMatchById as getDemoMatchById,
  type MatchCatalogEntry,
  type TournamentStage,
} from "@/data/matchCatalog";
import {
  getFeedForMatch as getDemoFeedForMatch,
  matchHasReplayFeed as demoHasReplayFeed,
} from "@/data/matchFeeds";
import {
  fetchFixtureById,
  fetchFixtureEvents,
  fetchFixtureStatistics,
} from "@/lib/matches/apiFootballClient";
import { feedRevalidateSeconds, getMatchApiConfig } from "@/lib/matches/config";
import {
  emptyFeedBundle,
  getStaticFeed,
} from "@/lib/matches/feedLoader";
import {
  adaptFixtureFeed,
  feedHasReplayContent,
} from "@/lib/matches/feedAdapter";
import {
  mapFixtureStatus,
  parseFixtureId,
} from "@/lib/matches/matchAdapter";
import {
  getDemoCatalog,
  getStaticMatchById,
  getStaticSchedule,
  getStaticScheduleSyncedAt,
  hasStaticSchedule,
} from "@/lib/matches/scheduleLoader";
import type { MatchFeedResponse, MatchListResponse } from "@/lib/matches/types";

function isDemoMatchId(id: string): boolean {
  return getDemoMatchById(id) !== undefined;
}

function demoCatalog(stage?: TournamentStage): MatchListResponse {
  return {
    source: "demo",
    matches: getDemoCatalog(stage),
  };
}

function staticCatalog(stage?: TournamentStage): MatchListResponse {
  const scheduleMatches = getStaticSchedule(stage);
  const tbd = stage
    ? TBD_PLACEHOLDER_CATALOG.filter((entry) => entry.stage === stage)
    : TBD_PLACEHOLDER_CATALOG;

  const byId = new Map<string, MatchCatalogEntry>();
  for (const entry of scheduleMatches) byId.set(entry.id, entry);
  for (const entry of tbd) {
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
  }

  return {
    source: "static",
    matches: [...byId.values()].sort((a, b) => a.dateSort.localeCompare(b.dateSort)),
    syncedAt: getStaticScheduleSyncedAt() ?? undefined,
  };
}

interface LiveFeedCacheEntry {
  expires: number;
  data: MatchFeedResponse;
}

const liveFeedCache = new Map<string, LiveFeedCacheEntry>();
const liveFeedInFlight = new Map<string, Promise<MatchFeedResponse>>();

function liveFeedCacheKey(fixtureId: number, sinceMinute?: number): string {
  return `${fixtureId}:${sinceMinute ?? "full"}`;
}

async function loadLiveMatchFeed(
  fixtureId: number,
  sinceMinute?: number
): Promise<MatchFeedResponse> {
  const cacheKey = liveFeedCacheKey(fixtureId, sinceMinute);
  const now = Date.now();
  const cached = liveFeedCache.get(cacheKey);
  if (cached && cached.expires > now) {
    return cached.data;
  }

  const pending = liveFeedInFlight.get(cacheKey);
  if (pending) return pending;

  const promise = (async () => {
    const fixture = await fetchFixtureById(fixtureId, 0);
    if (!fixture) return emptyFeedBundle();

    const status = mapFixtureStatus(fixture.fixture.status.short);
    if (status !== "live") {
      const staticFeed = await getStaticFeed(String(fixtureId), sinceMinute);
      if (staticFeed) return staticFeed;
      return emptyFeedBundle();
    }

    const revalidate = feedRevalidateSeconds("live");
    let events: Awaited<ReturnType<typeof fetchFixtureEvents>> = [];
    let statistics: Awaited<ReturnType<typeof fetchFixtureStatistics>> = [];
    try {
      [events, statistics] = await Promise.all([
        fetchFixtureEvents(fixtureId, revalidate),
        fetchFixtureStatistics(fixtureId, revalidate),
      ]);
    } catch (error) {
      console.warn(`Live feed ${fixtureId} fetch failed:`, error);
    }

    const bundle = adaptFixtureFeed(fixture, events, statistics);
    const feed =
      sinceMinute != null
        ? bundle.feed.filter((update) => update.minute > sinceMinute)
        : bundle.feed;

    const result: MatchFeedResponse = {
      ...bundle,
      feed,
      hasReplayFeed: feedHasReplayContent(feed),
    };

    liveFeedCache.set(cacheKey, {
      data: result,
      expires: Date.now() + 15_000,
    });
    return result;
  })().finally(() => {
    liveFeedInFlight.delete(cacheKey);
  });

  liveFeedInFlight.set(cacheKey, promise);
  return promise;
}

export async function listMatches(
  stage?: TournamentStage
): Promise<MatchListResponse> {
  if (hasStaticSchedule()) {
    return staticCatalog(stage);
  }

  return demoCatalog(stage);
}

export async function getMatch(id: string): Promise<MatchCatalogEntry | null> {
  const match = getStaticMatchById(id);
  return match ?? null;
}

export async function getMatchFeed(
  id: string,
  sinceMinute?: number
): Promise<MatchFeedResponse> {
  if (isDemoMatchId(id)) {
    const bundle = getDemoFeedForMatch(id);
    if (!bundle) return emptyFeedBundle();

    const feed =
      sinceMinute != null
        ? bundle.feed.filter((update) => update.minute > sinceMinute)
        : bundle.feed;

    return {
      ...bundle,
      feed,
      hasReplayFeed: demoHasReplayFeed(id),
    };
  }

  const entry = getStaticMatchById(id);
  const matchStatus = entry?.status ?? "scheduled";

  if (matchStatus === "live" && getMatchApiConfig().enabled) {
    const fixtureId = parseFixtureId(id);
    if (fixtureId) {
      return loadLiveMatchFeed(fixtureId, sinceMinute);
    }
  }

  const staticFeed = await getStaticFeed(id, sinceMinute);
  if (staticFeed) return staticFeed;

  return emptyFeedBundle();
}
