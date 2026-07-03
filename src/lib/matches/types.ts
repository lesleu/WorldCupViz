export type {
  MatchCatalogEntry,
  MatchStatus,
  StageSection,
  TournamentStage,
} from "@/data/matchCatalog";
export type { MatchData, TeamStats } from "@/data/mockMatch";
export type { LiveFeedUpdate, StateUpdate } from "@/data/mockLiveFeed";

export interface MatchFeedBundle {
  feed: import("@/data/mockLiveFeed").LiveFeedUpdate[];
  kickoff: import("@/data/mockLiveFeed").StateUpdate;
  currentMinute?: number;
  status?: import("@/data/matchCatalog").MatchStatus;
}

export interface MatchListResponse {
  source: "static" | "demo";
  matches: import("@/data/matchCatalog").MatchCatalogEntry[];
  /** ISO timestamp of last `npm run sync:matches` schedule write. */
  syncedAt?: string;
  /** ISO timestamp of last runtime cron poll (KV overlay). */
  runtimePollAt?: string;
}

export interface MatchFeedResponse extends MatchFeedBundle {
  hasReplayFeed: boolean;
}
