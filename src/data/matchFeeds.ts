import {
  initialMatchState,
  matchUpdates,
  type LiveFeedUpdate,
  type StateUpdate,
} from "@/data/mockLiveFeed";

export interface MatchFeedBundle {
  feed: LiveFeedUpdate[];
  kickoff: StateUpdate;
}

const FEEDS: Record<string, MatchFeedBundle> = {
  "2026-group-a-mex-kor": {
    feed: matchUpdates,
    kickoff: initialMatchState,
  },
};

export function getFeedForMatch(id: string): MatchFeedBundle | null {
  return FEEDS[id] ?? null;
}

export function matchHasReplayFeed(id: string): boolean {
  return id in FEEDS;
}
