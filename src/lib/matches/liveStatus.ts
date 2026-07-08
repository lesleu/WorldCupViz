import type { MatchStatus } from "@/data/matchCatalog";
import { fetchLeagueFixtures } from "@/lib/matches/apiFootballClient";
import { getMatchApiConfig } from "@/lib/matches/config";
import {
  isCompletedApiStatus,
  isLiveApiStatus,
  mapFixtureStatus,
} from "@/lib/matches/matchAdapter";

export interface LiveStatusPatch {
  id: string;
  status: MatchStatus;
  hasReplayFeed?: boolean;
  finalMinute?: number;
}

export interface LiveStatusResponse {
  at: string;
  patches: LiveStatusPatch[];
  skipped?: boolean;
  message?: string;
}

/** One API-Football fixtures-list call — status/scores only, no events or stats. */
export async function fetchLiveStatusPatches(): Promise<LiveStatusResponse> {
  const config = getMatchApiConfig();
  if (!config.enabled) {
    return {
      at: new Date().toISOString(),
      patches: [],
      skipped: true,
      message: "MATCH_API_KEY is not configured",
    };
  }

  const fixtures = await fetchLeagueFixtures(0);
  const patches: LiveStatusPatch[] = [];

  for (const fixture of fixtures) {
    const short = fixture.fixture.status.short;
    if (!isLiveApiStatus(short) && !isCompletedApiStatus(short)) continue;

    const status = mapFixtureStatus(short);
    patches.push({
      id: String(fixture.fixture.id),
      status,
      hasReplayFeed: status === "live" || status === "completed",
      finalMinute: fixture.fixture.status.elapsed ?? undefined,
    });
  }

  return {
    at: new Date().toISOString(),
    patches,
  };
}
