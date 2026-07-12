import {
  TBD_PLACEHOLDER_CATALOG,
  getMatchById as getDemoMatchById,
  type MatchCatalogEntry,
  type MatchStatus,
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
import {
  feedRevalidateSeconds,
  getMatchApiConfig,
  scheduleRevalidateSeconds,
} from "@/lib/matches/config";
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
  getRuntimeFeed,
  getScheduleOverlay,
  setCompletedFeed,
  setScheduleOverlay,
  type ScheduleOverlayEntry,
} from "@/lib/matches/runtimeStore";
import { persistStaticMatchFeed } from "@/lib/matches/staticFeedPersistence";
import { isWithinLiveWindow } from "@/lib/matches/liveWindow";
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
  // Schedule status is updated by cron into the Redis overlay — avoid API on every page load.
  return entries;
}

/**
 * Probe API-Football for a fresh status when a match's kickoff clock is live but
 * the committed schedule / overlay hasn't caught up (no cron/Redis). Returns null
 * when the API is disabled, out of window, or the call fails.
 */
async function fetchLiveAwareStatus(
  id: string,
  entry: { status: MatchStatus; kickoffAt?: string }
): Promise<MatchStatus | null> {
  if (entry.status === "live" || entry.status === "completed") return entry.status;
  if (!isWithinLiveWindow(entry)) return null;
  if (!getMatchApiConfig().enabled) return null;

  const fixtureId = parseFixtureId(id);
  if (!fixtureId) return null;

  try {
    const fixture = await fetchFixtureById(fixtureId, 0);
    if (!fixture) return null;
    return mapFixtureStatus(fixture.fixture.status.short);
  } catch (error) {
    console.warn(`Live-window status check failed for ${id}:`, error);
    return null;
  }
}

async function resolveCatalogStatus(id: string): Promise<MatchStatus | undefined> {
  const base = getStaticMatchById(id);
  if (base) {
    const merged = (await getMergedMatchById(base)) ?? base;
    const live = await fetchLiveAwareStatus(id, merged);
    return live ?? merged.status;
  }

  const fromOverlay = await getOverlayDiscoveredMatchById(id);
  if (!fromOverlay) return undefined;
  const live = await fetchLiveAwareStatus(id, fromOverlay);
  return live ?? fromOverlay.status;
}

async function resolveCatalogEntry(id: string): Promise<MatchCatalogEntry | null> {
  const base = getStaticMatchById(id);
  if (base) {
    const merged = await getMergedMatchById(base);
    if (!merged) return null;
    if (merged.status === "live" || isWithinLiveWindow(merged)) {
      return refreshEntryFromApi(merged);
    }
    return merged;
  }

  const fromOverlay = await getOverlayDiscoveredMatchById(id);
  if (fromOverlay) return fromOverlay;

  if (hasStaticSchedule()) return null;

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

  // Overlay live/completed status + stats written by the cron poll so the home
  // grid reflects in-progress and just-finished matches without a redeploy.
  const withOverlay = await mergeScheduleWithOverlay([...byId.values()]);
  const merged = enrichCatalogKickoff(filterByStage(withOverlay, stage));

  return {
    source: "static",
    matches: merged.sort((a, b) => {
      const byKickoff =
        (a.kickoffAt ?? "").localeCompare(b.kickoffAt ?? "") ||
        a.dateSort.localeCompare(b.dateSort);
      return byKickoff || a.id.localeCompare(b.id);
    }),
    syncedAt: getStaticScheduleSyncedAt() ?? undefined,
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
  const feed = await resolveMatchFeedBundle(entry.id, undefined, entry.status);
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

/**
 * Fetch a fixture feed (live or completed) from the API. Completed feeds are
 * cached to Redis + committed JSON so later loads render from storage without
 * hitting the API again.
 */
async function loadAndCacheApiFeed(
  id: string,
  fixtureId: number,
  sinceMinute?: number
): Promise<MatchFeedResponse | null> {
  const full = await loadFixtureFeedFromApi(fixtureId);
  if (!full || !feedHasReplayContent(full.feed)) return null;

  if (full.status === "completed") {
    await cacheCompletedFeed(id, full);
  }

  if (sinceMinute == null) return full;
  return {
    ...full,
    feed: full.feed.filter((update) => update.minute > sinceMinute),
  };
}

/**
 * Persist a just-finished match so it renders without hitting the API again:
 *   - Redis completed-feed cache (durable in prod)
 *   - Redis schedule overlay with final status + real team stats
 *   - committed JSON + schedule patch (durable in local/dev where FS is writable)
 * The Vercel filesystem is read-only, so the JSON write is best-effort; the
 * overlay + feed cache are what make production self-heal between GitHub syncs.
 */
async function cacheCompletedFeed(
  id: string,
  feed: MatchFeedResponse
): Promise<void> {
  try {
    const base = getStaticMatchById(id);
    const matchData = base
      ? mergeMatchDataWithFeedStats(base.matchData, feed.feed)
      : undefined;
    const finalMinute =
      feed.currentMinute ?? maxFeedMinute(feed.feed) ?? base?.finalMinute;

    await setCompletedFeed(id, feed);

    if (base) {
      const overlay = await getScheduleOverlay();
      const completedEntry: ScheduleOverlayEntry = {
        status: "completed",
        finalMinute,
        hasReplayFeed: true,
        matchData: matchData ?? base.matchData,
        date: base.date,
        dateSort: base.dateSort,
        kickoffAt: base.kickoffAt,
        kickoffTime: base.kickoffTime,
        venue: base.venue,
        stage: base.stage,
        stageLabel: base.stageLabel,
        homeTeam: base.homeTeam,
        awayTeam: base.awayTeam,
        homeTeamCode: base.homeTeamCode,
        awayTeamCode: base.awayTeamCode,
      };
      overlay[id] = { ...overlay[id], ...completedEntry };
      await setScheduleOverlay(overlay);
    }

    await persistStaticMatchFeed(id, feed, {
      status: "completed",
      hasReplayFeed: true,
      finalMinute,
      matchData,
    });
  } catch (error) {
    console.warn(`Failed to cache completed feed ${id}:`, error);
  }
}

function runtimeFeedHasContent(feed: MatchFeedResponse | null): boolean {
  if (!feed) return false;
  if (feed.status === "live") {
    return feed.feed.length > 0;
  }
  return feedHasReplayContent(feed.feed);
}

/** Resolve the best feed for canvas replay (static → runtime → live API). */
async function resolveMatchFeedBundle(
  id: string,
  sinceMinute?: number,
  catalogStatus?: MatchStatus
): Promise<MatchFeedResponse | null> {
  if (isDemoMatchId(id)) {
    const bundle = getDemoFeedForMatch(id);
    if (!bundle) return null;
    return {
      ...bundle,
      hasReplayFeed: demoHasReplayFeed(id),
    };
  }

  const staticFeed = await getStaticFeed(id, sinceMinute);
  if (staticFeed && feedHasReplayContent(staticFeed.feed)) {
    return staticFeed;
  }

  const runtimeFeed = await getRuntimeFeed(id, sinceMinute);
  if (runtimeFeed && runtimeFeedHasContent(runtimeFeed)) {
    return runtimeFeed;
  }

  // No committed/runtime feed yet. Pull from the API for both live AND
  // completed matches — a game that just finished (like a fresh knockout
  // result) often has no JSON committed yet, and must still render.
  const fixtureId = parseFixtureId(id);
  if (
    fixtureId != null &&
    getMatchApiConfig().enabled &&
    (catalogStatus === "live" || catalogStatus === "completed")
  ) {
    const apiFeed = await loadAndCacheApiFeed(id, fixtureId, sinceMinute);
    if (apiFeed) return apiFeed;
  }

  return staticFeed;
}

async function refreshEntryFromApi(
  entry: MatchCatalogEntry
): Promise<MatchCatalogEntry> {
  if (!getMatchApiConfig().enabled) return entry;
  if (entry.status !== "live" && !isWithinLiveWindow(entry)) return entry;

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

  const catalogStatus = await resolveCatalogStatus(id);
  const resolved = await resolveMatchFeedBundle(id, sinceMinute, catalogStatus);
  if (resolved) return resolved;

  return emptyFeedBundle();
}
