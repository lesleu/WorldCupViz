import type { ApiFootballFixture } from "@/lib/matches/apiFootballClient";
import { fetchLeagueFixtures } from "@/lib/matches/apiFootballClient";
import { getMatchApiConfig } from "@/lib/matches/config";
import { buildFeedFromFixtureId, buildFeedFromFixtureRow } from "@/lib/matches/buildFeed";
import { hasStaticFeed } from "@/lib/matches/feedLoader";
import {
  isCompletedApiStatus,
  isLiveApiStatus,
} from "@/lib/matches/matchAdapter";
import {
  overlayEntryFromFixture,
} from "@/lib/matches/scheduleOverlay";
import {
  deleteLiveFeed,
  getPollStatuses,
  getScheduleOverlay,
  hasCompletedFeed,
  patchPollMeta,
  setCompletedFeed,
  setLiveFeed,
  setPollStatuses,
  setScheduleOverlay,
  type ScheduleOverlay,
} from "@/lib/matches/runtimeStore";
import type { MatchFeedResponse } from "@/lib/matches/types";

export interface PollTickResult {
  at: string;
  apiCalls: number;
  fixtures: number;
  overlayUpdated: number;
  livePolled: number;
  completedSaved: number;
  skipped: boolean;
  message?: string;
}

async function feedAlreadyPersisted(matchId: string): Promise<boolean> {
  if (hasStaticFeed(matchId)) return true;
  return hasCompletedFeed(matchId);
}

async function persistCompletedFeed(
  matchId: string,
  feed: MatchFeedResponse,
  overlay: ScheduleOverlay
): Promise<void> {
  await setCompletedFeed(matchId, feed);
  await deleteLiveFeed(matchId);

  const patch = overlay[matchId] ?? {};
  overlay[matchId] = {
    ...patch,
    status: "completed",
    hasReplayFeed: feed.hasReplayFeed,
    finalMinute: feed.currentMinute ?? patch.finalMinute,
    matchData: patch.matchData,
  };
}

export async function runPollTick(): Promise<PollTickResult> {
  const config = getMatchApiConfig();
  if (!config.enabled) {
    return {
      at: new Date().toISOString(),
      apiCalls: 0,
      fixtures: 0,
      overlayUpdated: 0,
      livePolled: 0,
      completedSaved: 0,
      skipped: true,
      message: "MATCH_API_KEY is not configured",
    };
  }

  let apiCalls = 0;
  const fixtures = await fetchLeagueFixtures(0);
  apiCalls += 1;

  const prevStatuses = await getPollStatuses();
  const overlay = await getScheduleOverlay();
  const nextStatuses: Record<string, string> = { ...prevStatuses };

  let overlayUpdated = 0;
  let livePolled = 0;
  let completedSaved = 0;

  for (const fixture of fixtures) {
    await processFixture(fixture, {
      prevStatuses,
      nextStatuses,
      overlay,
      counters: {
        addApiCalls(n: number) {
          apiCalls += n;
        },
        bumpOverlay() {
          overlayUpdated += 1;
        },
        bumpLive() {
          livePolled += 1;
        },
        bumpCompleted() {
          completedSaved += 1;
        },
      },
    });
  }

  await setPollStatuses(nextStatuses);
  await setScheduleOverlay(overlay);
  await patchPollMeta({
    lastPollAt: new Date().toISOString(),
    lastPollApiCalls: apiCalls,
  });

  return {
    at: new Date().toISOString(),
    apiCalls,
    fixtures: fixtures.length,
    overlayUpdated,
    livePolled,
    completedSaved,
    skipped: false,
  };
}

interface ProcessContext {
  prevStatuses: Record<string, string>;
  nextStatuses: Record<string, string>;
  overlay: ScheduleOverlay;
  counters: {
    addApiCalls(n: number): void;
    bumpOverlay(): void;
    bumpLive(): void;
    bumpCompleted(): void;
  };
}

async function processFixture(
  fixture: ApiFootballFixture,
  ctx: ProcessContext
): Promise<void> {
  const matchId = String(fixture.fixture.id);
  const apiShort = fixture.fixture.status.short;
  const prevShort = ctx.prevStatuses[matchId];
  ctx.nextStatuses[matchId] = apiShort;

  const patch = overlayEntryFromFixture(fixture);
  if (patch) {
    ctx.overlay[matchId] = { ...ctx.overlay[matchId], ...patch };
    ctx.counters.bumpOverlay();
  }

  const live = isLiveApiStatus(apiShort);
  const completed = isCompletedApiStatus(apiShort);
  const justCompleted =
    completed && prevShort != null && !isCompletedApiStatus(prevShort);

  let liveFeed: MatchFeedResponse | null = null;

  if (live) {
    liveFeed = await buildFeedFromFixtureRow(fixture);
    ctx.counters.addApiCalls(2);
    await setLiveFeed(matchId, liveFeed);
    ctx.counters.bumpLive();

    if (patch) {
      ctx.overlay[matchId] = {
        ...ctx.overlay[matchId],
        status: "live",
        hasReplayFeed: liveFeed.hasReplayFeed,
        finalMinute: liveFeed.currentMinute ?? ctx.overlay[matchId]?.finalMinute,
      };
    }
  }

  if (!completed) return;

  const alreadyHaveFeed = await feedAlreadyPersisted(matchId);
  if (alreadyHaveFeed && !justCompleted) return;

  let completedFeed = liveFeed;
  if (!completedFeed?.hasReplayFeed) {
    if (liveFeed?.hasReplayFeed) {
      completedFeed = liveFeed;
    } else {
      const built = await buildFeedFromFixtureId(fixture.fixture.id);
      ctx.counters.addApiCalls(3);
      completedFeed = built?.result ?? null;
    }
  }

  if (!completedFeed?.hasReplayFeed) return;

  await persistCompletedFeed(matchId, completedFeed, ctx.overlay);
  ctx.counters.bumpCompleted();
}

export interface MorningBackfillResult {
  at: string;
  apiCalls: number;
  fixtures: number;
  overlayUpdated: number;
  backfilled: number;
  skipped: number;
  skippedReason?: string;
}

export async function runMorningBackfill(): Promise<MorningBackfillResult> {
  const config = getMatchApiConfig();
  if (!config.enabled) {
    return {
      at: new Date().toISOString(),
      apiCalls: 0,
      fixtures: 0,
      overlayUpdated: 0,
      backfilled: 0,
      skipped: 0,
      skippedReason: "MATCH_API_KEY is not configured",
    };
  }

  let apiCalls = 0;
  const fixtures = await fetchLeagueFixtures(0);
  apiCalls += 1;

  const overlay = await getScheduleOverlay();
  const nextStatuses = await getPollStatuses();
  let overlayUpdated = 0;
  let backfilled = 0;
  let skipped = 0;

  for (const fixture of fixtures) {
    const matchId = String(fixture.fixture.id);
    const apiShort = fixture.fixture.status.short;
    nextStatuses[matchId] = apiShort;

    const patch = overlayEntryFromFixture(fixture);
    if (patch) {
      overlay[matchId] = { ...overlay[matchId], ...patch };
      overlayUpdated += 1;
    }

    if (!isCompletedApiStatus(apiShort)) continue;

    if (await feedAlreadyPersisted(matchId)) {
      skipped += 1;
      continue;
    }

    const built = await buildFeedFromFixtureId(fixture.fixture.id);
    apiCalls += 3;

    if (!built?.result.hasReplayFeed) {
      skipped += 1;
      continue;
    }

    await persistCompletedFeed(matchId, built.result, overlay);
    backfilled += 1;
  }

  await setPollStatuses(nextStatuses);
  await setScheduleOverlay(overlay);
  await patchPollMeta({
    lastMorningBackfillAt: new Date().toISOString(),
    lastMorningApiCalls: apiCalls,
  });

  return {
    at: new Date().toISOString(),
    apiCalls,
    fixtures: fixtures.length,
    overlayUpdated,
    backfilled,
    skipped,
  };
}
