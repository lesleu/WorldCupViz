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
import { buildFeedResponse } from "@/lib/matches/buildFeed";
import { feedRevalidateSeconds, getMatchApiConfig } from "@/lib/matches/config";
import {
  feedHasReplayContent,
  maxFeedMinute,
} from "@/lib/matches/feedAdapter";
import { getPollMeta, getRuntimeFeed } from "@/lib/matches/runtimeStore";
import {
  getDemoCatalog,
  getStaticMatchById,
  getStaticSchedule,
  getStaticScheduleSyncedAt,
  hasStaticSchedule,
} from "@/lib/matches/scheduleLoader";
import {
  getMergedMatchById,
  mergeScheduleWithOverlay,
} from "@/lib/matches/scheduleOverlay";
import {
  emptyFeedBundle,
  getStaticFeed,
} from "@/lib/matches/feedLoader";
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

async function staticCatalog(stage?: TournamentStage): Promise<MatchListResponse> {
  const scheduleMatches = getStaticSchedule(stage);
  const tbd = stage
    ? TBD_PLACEHOLDER_CATALOG.filter((entry) => entry.stage === stage)
    : TBD_PLACEHOLDER_CATALOG;

  const byId = new Map<string, MatchCatalogEntry>();
  for (const entry of scheduleMatches) byId.set(entry.id, entry);
  for (const entry of tbd) {
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
  }

  const merged = await mergeScheduleWithOverlay([...byId.values()]);
  const pollMeta = await getPollMeta();

  return {
    source: "static",
    matches: merged.sort((a, b) => a.dateSort.localeCompare(b.dateSort)),
    syncedAt: getStaticScheduleSyncedAt() ?? undefined,
    runtimePollAt: pollMeta.lastPollAt,
  };
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
  const base = getStaticMatchById(id);
  if (!base) return null;
  return getMergedMatchById(base);
}

async function loadLiveFeedFromApi(
  fixtureId: number,
  sinceMinute?: number
): Promise<MatchFeedResponse | null> {
  if (!getMatchApiConfig().enabled) return null;

  const fixture = await fetchFixtureById(fixtureId, 0);
  if (!fixture) return null;

  const status = mapFixtureStatus(fixture.fixture.status.short);
  if (status !== "live") return null;

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

  const built = buildFeedResponse(fixture, events, statistics);
  const feed =
    sinceMinute != null
      ? built.feed.filter((update) => update.minute > sinceMinute)
      : built.feed;

  return {
    ...built,
    feed,
    hasReplayFeed: feedHasReplayContent(feed),
    status: "live",
    currentMinute: maxFeedMinute(built.feed) || undefined,
  };
}

function runtimeFeedHasContent(feed: MatchFeedResponse | null): boolean {
  if (!feed) return false;
  return feed.hasReplayFeed || feed.feed.length > 1;
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

  const runtimeFeed = await getRuntimeFeed(id, sinceMinute);
  if (runtimeFeedHasContent(runtimeFeed)) return runtimeFeed!;

  const entry = await getMatch(id);
  if (entry?.status === "live") {
    const fixtureId = parseFixtureId(id);
    if (fixtureId) {
      const liveFeed = await loadLiveFeedFromApi(fixtureId, sinceMinute);
      if (runtimeFeedHasContent(liveFeed)) return liveFeed!;
    }
  }

  const staticFeed = await getStaticFeed(id, sinceMinute);
  if (staticFeed) return staticFeed;

  return emptyFeedBundle();
}
