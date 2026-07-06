import "server-only";

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getFeedForMatch as getDemoFeedForMatch } from "@/data/matchFeeds";
import { initialMatchState } from "@/data/mockLiveFeed";
import type { MatchFeedResponse } from "@/lib/matches/types";

const FEEDS_DIR = path.join(process.cwd(), "src/data/feeds");

function feedFilePath(matchId: string): string {
  return path.join(FEEDS_DIR, `${matchId}.json`);
}

export function hasStaticFeed(matchId: string): boolean {
  if (getDemoFeedForMatch(matchId)) return true;
  return existsSync(feedFilePath(matchId));
}

export async function getStaticFeed(
  matchId: string,
  sinceMinute?: number
): Promise<MatchFeedResponse | null> {
  const demo = getDemoFeedForMatch(matchId);
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

  const filePath = feedFilePath(matchId);
  if (!existsSync(filePath)) return null;

  try {
    const raw = await readFile(filePath, "utf8");
    const data = JSON.parse(raw) as MatchFeedResponse;
    if (sinceMinute == null) return data;

    return {
      ...data,
      feed: data.feed.filter((update) => update.minute > sinceMinute),
    };
  } catch (error) {
    console.warn(`Failed to read static feed for ${matchId}:`, error);
    return null;
  }
}

export function emptyFeedBundle(): MatchFeedResponse {
  return {
    feed: [initialMatchState],
    kickoff: initialMatchState,
    hasReplayFeed: false,
  };
}
