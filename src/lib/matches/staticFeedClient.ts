import { STATIC_FEED_IDS } from "@/data/feeds.index.generated";
import { getFeedForMatch } from "@/data/matchFeeds";
import { initialMatchState } from "@/data/mockLiveFeed";
import type { MatchFeedResponse } from "@/lib/matches/types";

/** Load a committed replay feed from bundled JSON (no network). */
export async function loadStaticMatchFeed(
  matchId: string,
  sinceMinute?: number
): Promise<MatchFeedResponse | null> {
  const demo = getFeedForMatch(matchId);
  if (demo) {
    const feed =
      sinceMinute != null
        ? demo.feed.filter((update) => update.minute > sinceMinute)
        : demo.feed;
    return {
      ...demo,
      feed,
      hasReplayFeed: true,
    };
  }

  if (!STATIC_FEED_IDS.includes(matchId)) return null;

  try {
    const mod = await import(`@/data/feeds/${matchId}.json`);
    const data = mod.default as MatchFeedResponse;
    if (sinceMinute == null) return data;
    return {
      ...data,
      feed: data.feed.filter((update) => update.minute > sinceMinute),
    };
  } catch (error) {
    console.warn(`Failed to load static feed ${matchId}:`, error);
    return null;
  }
}

export function emptyClientFeedBundle(): MatchFeedResponse {
  return {
    feed: [initialMatchState],
    kickoff: initialMatchState,
    hasReplayFeed: false,
  };
}
