import type {
  ApiFootballEvent,
  ApiFootballFixture,
  ApiFootballStatistic,
} from "@/lib/matches/apiFootballClient";
import {
  fetchFixtureById,
  fetchFixtureEvents,
  fetchFixtureStatistics,
} from "@/lib/matches/apiFootballClient";
import {
  adaptFixtureFeed,
  feedHasReplayContent,
} from "@/lib/matches/feedAdapter";
import { mapFixtureStatus } from "@/lib/matches/matchAdapter";
import type { MatchFeedResponse, MatchStatus } from "@/lib/matches/types";

export function buildFeedResponse(
  fixture: ApiFootballFixture,
  events: ApiFootballEvent[],
  statistics: ApiFootballStatistic[]
): MatchFeedResponse {
  const status = mapFixtureStatus(fixture.fixture.status.short);
  const bundle = adaptFixtureFeed(fixture, events, statistics);

  return {
    ...bundle,
    hasReplayFeed: feedHasReplayContent(bundle.feed),
    status,
    currentMinute: bundle.currentMinute,
  };
}

export async function buildFeedFromFixtureId(
  fixtureId: number
): Promise<{ status: MatchStatus; result: MatchFeedResponse } | null> {
  const fixture = await fetchFixtureById(fixtureId, 0);
  if (!fixture) return null;

  const status = mapFixtureStatus(fixture.fixture.status.short);

  let events: ApiFootballEvent[] = [];
  let statistics: ApiFootballStatistic[] = [];
  try {
    [events, statistics] = await Promise.all([
      fetchFixtureEvents(fixtureId, 0),
      fetchFixtureStatistics(fixtureId, 0),
    ]);
  } catch (error) {
    console.warn(`buildFeedFromFixtureId ${fixtureId} failed:`, error);
  }

  return {
    status,
    result: buildFeedResponse(fixture, events, statistics),
  };
}

/** API calls: events + statistics (fixture already in hand). */
export async function buildFeedFromFixtureRow(
  fixture: ApiFootballFixture
): Promise<MatchFeedResponse> {
  const fixtureId = fixture.fixture.id;
  let events: ApiFootballEvent[] = [];
  let statistics: ApiFootballStatistic[] = [];
  try {
    [events, statistics] = await Promise.all([
      fetchFixtureEvents(fixtureId, 0),
      fetchFixtureStatistics(fixtureId, 0),
    ]);
  } catch (error) {
    console.warn(`buildFeedFromFixtureRow ${fixtureId} failed:`, error);
  }

  return buildFeedResponse(fixture, events, statistics);
}
