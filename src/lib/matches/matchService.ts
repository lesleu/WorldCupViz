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
  fetchLeagueFixtures,
} from "@/lib/matches/apiFootballClient";
import { buildFeedResponse } from "@/lib/matches/buildFeed";
import {
  feedRevalidateSeconds,
  getMatchApiConfig,
  scheduleRevalidateSeconds,
} from "@/lib/matches/config";
import {
  fixturesToCatalogEntries,
  mergeCatalogEntries,
} from "@/lib/matches/fixtureCatalog";
import {
  mapFixtureStatus,
  parseFixtureId,
} from "@/lib/matches/matchAdapter";
import {
  feedHasReplayContent,
  maxFeedMinute,
  mergeMatchDataWithFeedStats,
} from "@/lib/matches/feedAdapter";
import {
  deleteLiveFeed,
  getPollMeta,
  getRuntimeFeed,
  getScheduleOverlay,
  setCompletedFeed,
} from "@/lib/matches/runtimeStore";
import {
  getDemoCatalog,
  getStaticMatchById,
  getStaticSchedule,
  getStaticScheduleSyncedAt,
  hasStaticSchedule,
} from "@/lib/matches/scheduleLoader";
import {
  getMergedMatchById,
  getOverlayDiscoveredMatchById,
  mergeEntryWithOverlay,
  mergeScheduleWithOverlay,
  overlayEntryFromFixture,
} from "@/lib/matches/scheduleOverlay";
import {
  emptyFeedBundle,
  getStaticFeed,
} from "@/lib/matches/feedLoader";
import { enrichCatalogKickoff } from "@/lib/matches/enrichKickoff";
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

function filterByStage(
  entries: MatchCatalogEntry[],
  stage?: TournamentStage
): MatchCatalogEntry[] {
  return stage ? entries.filter((entry) => entry.stage === stage) : entries;
}

async function supplementCatalogFromApi(
  entries: MatchCatalogEntry[]
): Promise<MatchCatalogEntry[]> {
  if (!getMatchApiConfig().enabled) return entries;

  try {
    const fixtures = await fetchLeagueFixtures(scheduleRevalidateSeconds());
    const apiEntries = fixturesToCatalogEntries(fixtures);
    const overlay = await getScheduleOverlay();

    const merged = mergeCatalogEntries(entries, apiEntries).map((entry) =>
      mergeEntryWithOverlay(entry, overlay[entry.id])
    );

    return merged;
  } catch (error) {
    console.warn("Failed to supplement match catalog from API:", error);
    return entries;
  }
}

async function resolveCatalogEntry(id: string): Promise<MatchCatalogEntry | null> {
  const base = getStaticMatchById(id);
  if (base) {
    const merged = await getMergedMatchById(base);
    if (!merged) return null;
    return refreshEntryFromApi(merged);
  }

  const fromOverlay = await getOverlayDiscoveredMatchById(id);
  if (fromOverlay) return fromOverlay;

  if (!getMatchApiConfig().enabled) return null;

  const fixtureId = parseFixtureId(id);
  if (!fixtureId) return null;

  try {
    const fixture = await fetchFixtureById(fixtureId, scheduleRevalidateSeconds());
    if (!fixture) return null;
    const entry = overlayEntryFromFixture(fixture);
    if (!entry) return null;

    return {
      id,
      providerFixtureId: fixtureId,
      tournament: "FIFA World Cup 2026",
      stage: entry.stage ?? "round_of_32",
      stageLabel: entry.stageLabel ?? "Round of 32",
      status: entry.status ?? "scheduled",
      isTbd: false,
      matchNumber: fixtureId,
      date: entry.date ?? entry.matchData!.date,
      dateSort: entry.dateSort ?? "",
      kickoffAt: entry.kickoffAt,
      kickoffTime: entry.kickoffTime,
      venue: entry.venue ?? entry.matchData!.venue,
      homeTeam: entry.homeTeam ?? entry.matchData!.homeTeam,
      awayTeam: entry.awayTeam ?? entry.matchData!.awayTeam,
      homeTeamCode: entry.homeTeamCode ?? entry.matchData!.homeTeamCode,
      awayTeamCode: entry.awayTeamCode ?? entry.matchData!.awayTeamCode,
      finalMinute: entry.finalMinute,
      hasReplayFeed: entry.hasReplayFeed ?? false,
      matchData: entry.matchData!,
    };
  } catch (error) {
    console.warn(`Failed to resolve match ${id} from API:`, error);
    return null;
  }
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

  const supplemented = await supplementCatalogFromApi([...byId.values()]);
  const merged = enrichCatalogKickoff(
    filterByStage(await mergeScheduleWithOverlay(supplemented), stage)
  );
  const pollMeta = await getPollMeta();

  return {
    source: "static",
    matches: merged.sort((a, b) => {
      const byKickoff =
        (a.kickoffAt ?? "").localeCompare(b.kickoffAt ?? "") ||
        a.dateSort.localeCompare(b.dateSort);
      return byKickoff || a.id.localeCompare(b.id);
    }),
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
  const merged = await resolveCatalogEntry(id);
  if (!merged) return null;
  return enrichMatchEntryWithFeedStats(merged);
}

async function enrichMatchEntryWithFeedStats(
  entry: MatchCatalogEntry
): Promise<MatchCatalogEntry> {
  const feed = await resolveMatchFeedBundle(entry.id);
  if (!feed || !feedHasReplayContent(feed.feed)) {
    return entry;
  }

  return {
    ...entry,
    hasReplayFeed: true,
    matchData: mergeMatchDataWithFeedStats(entry.matchData, feed.feed),
  };
}

async function loadFixtureFeedFromApi(
  fixtureId: number,
  sinceMinute?: number
): Promise<MatchFeedResponse | null> {
  if (!getMatchApiConfig().enabled) return null;

  const fixture = await fetchFixtureById(fixtureId, 0);
  if (!fixture) return null;

  const status = mapFixtureStatus(fixture.fixture.status.short);
  if (status !== "live" && status !== "completed") return null;

  const revalidate = feedRevalidateSeconds(status);
  let events: Awaited<ReturnType<typeof fetchFixtureEvents>> = [];
  let statistics: Awaited<ReturnType<typeof fetchFixtureStatistics>> = [];
  try {
    [events, statistics] = await Promise.all([
      fetchFixtureEvents(fixtureId, revalidate),
      fetchFixtureStatistics(fixtureId, revalidate),
    ]);
  } catch (error) {
    console.warn(`Fixture feed ${fixtureId} fetch failed:`, error);
  }

  const built = buildFeedResponse(fixture, events, statistics);
  const feed =
    sinceMinute != null
      ? built.feed.filter((update) => update.minute > sinceMinute)
      : built.feed;

  return {
    ...built,
    feed,
    hasReplayFeed: feedHasReplayContent(built.feed),
    status,
    currentMinute: built.currentMinute ?? (maxFeedMinute(built.feed) || undefined),
  };
}

async function loadLiveFeedFromApi(
  fixtureId: number,
  sinceMinute?: number
): Promise<MatchFeedResponse | null> {
  const bundle = await loadFixtureFeedFromApi(fixtureId, sinceMinute);
  if (!bundle || bundle.status !== "live") return null;
  return bundle;
}

async function loadCompletedFeedFromApi(
  fixtureId: number,
  sinceMinute?: number
): Promise<MatchFeedResponse | null> {
  const bundle = await loadFixtureFeedFromApi(fixtureId, sinceMinute);
  if (!bundle || bundle.status !== "completed") return null;
  return bundle;
}

function runtimeFeedHasContent(feed: MatchFeedResponse | null): boolean {
  if (!feed) return false;
  if (feed.status === "live") {
    return feed.feed.length > 0;
  }
  return feedHasReplayContent(feed.feed);
}

async function cacheCompletedFeed(matchId: string, feed: MatchFeedResponse): Promise<void> {
  if (!feedHasReplayContent(feed.feed)) return;
  await setCompletedFeed(matchId, feed);
  await deleteLiveFeed(matchId);
}

/** Resolve the best feed for canvas replay (runtime → API → static). */
async function resolveMatchFeedBundle(
  id: string,
  sinceMinute?: number
): Promise<MatchFeedResponse | null> {
  if (isDemoMatchId(id)) {
    const bundle = getDemoFeedForMatch(id);
    if (!bundle) return null;
    return {
      ...bundle,
      hasReplayFeed: demoHasReplayFeed(id),
    };
  }

  const runtimeFeed = await getRuntimeFeed(id, sinceMinute);
  if (runtimeFeed && runtimeFeedHasContent(runtimeFeed)) {
    return runtimeFeed;
  }

  const fixtureId = parseFixtureId(id);
  if (fixtureId && getMatchApiConfig().enabled) {
    const liveFeed = await loadLiveFeedFromApi(fixtureId, sinceMinute);
    if (liveFeed) return liveFeed;

    const completedFeed = await loadCompletedFeedFromApi(fixtureId, sinceMinute);
    if (completedFeed) {
      if (sinceMinute == null) {
        await cacheCompletedFeed(id, completedFeed);
      }
      return completedFeed;
    }
  }

  const staticFeed = await getStaticFeed(id, sinceMinute);
  if (staticFeed && feedHasReplayContent(staticFeed.feed)) {
    return staticFeed;
  }

  return null;
}

async function refreshEntryFromApi(
  entry: MatchCatalogEntry
): Promise<MatchCatalogEntry> {
  if (!getMatchApiConfig().enabled) return entry;

  const fixtureId = parseFixtureId(entry.id);
  if (!fixtureId) return entry;

  try {
    const fixture = await fetchFixtureById(fixtureId, 0);
    if (!fixture) return entry;
    const patch = overlayEntryFromFixture(fixture);
    if (!patch) return entry;
    return mergeEntryWithOverlay(entry, patch);
  } catch (error) {
    console.warn(`Failed to refresh match ${entry.id} from API:`, error);
    return entry;
  }
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

  const resolved = await resolveMatchFeedBundle(id, sinceMinute);
  if (resolved) return resolved;

  return emptyFeedBundle();
}
