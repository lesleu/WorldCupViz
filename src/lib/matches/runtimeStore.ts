import "server-only";

import { Redis } from "@upstash/redis";
import type { MatchCatalogEntry } from "@/data/matchCatalog";
import type { MatchFeedResponse } from "@/lib/matches/types";

const KEYS = {
  scheduleOverlay: "wcv:schedule:overlay",
  pollStatuses: "wcv:poll:statuses",
  pollMeta: "wcv:poll:meta",
  liveFeed: (matchId: string) => `wcv:live:feed:${matchId}`,
  completedFeed: (matchId: string) => `wcv:completed:feed:${matchId}`,
} as const;

export type ScheduleOverlayEntry = Pick<
  MatchCatalogEntry,
  | "status"
  | "finalMinute"
  | "hasReplayFeed"
  | "matchData"
  | "date"
  | "dateSort"
  | "kickoffAt"
  | "kickoffTime"
  | "venue"
  | "stage"
  | "stageLabel"
  | "homeTeam"
  | "awayTeam"
  | "homeTeamCode"
  | "awayTeamCode"
>;

export type ScheduleOverlay = Record<string, ScheduleOverlayEntry>;

export interface PollMeta {
  lastPollAt?: string;
  lastMorningBackfillAt?: string;
  lastPollApiCalls?: number;
  lastMorningApiCalls?: number;
}

type MemoryBucket = {
  overlay: ScheduleOverlay;
  pollStatuses: Record<string, string>;
  pollMeta: PollMeta;
  liveFeeds: Map<string, MatchFeedResponse>;
  completedFeeds: Map<string, MatchFeedResponse>;
};

const memory: MemoryBucket = {
  overlay: {},
  pollStatuses: {},
  pollMeta: {},
  liveFeeds: new Map(),
  completedFeeds: new Map(),
};

let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;

  const url =
    process.env.KV_REST_API_URL?.trim() ??
    process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token =
    process.env.KV_REST_API_TOKEN?.trim() ??
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    redisClient = null;
    return null;
  }

  redisClient = new Redis({ url, token });
  return redisClient;
}

export function runtimeStoreEnabled(): boolean {
  return getRedis() !== null;
}

export async function getScheduleOverlay(): Promise<ScheduleOverlay> {
  const redis = getRedis();
  if (!redis) return { ...memory.overlay };

  const data = await redis.get<ScheduleOverlay>(KEYS.scheduleOverlay);
  return data ?? {};
}

export async function setScheduleOverlay(overlay: ScheduleOverlay): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    memory.overlay = overlay;
    return;
  }

  await redis.set(KEYS.scheduleOverlay, overlay);
}

export async function getPollStatuses(): Promise<Record<string, string>> {
  const redis = getRedis();
  if (!redis) return { ...memory.pollStatuses };

  const data = await redis.get<Record<string, string>>(KEYS.pollStatuses);
  return data ?? {};
}

export async function setPollStatuses(statuses: Record<string, string>): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    memory.pollStatuses = statuses;
    return;
  }

  await redis.set(KEYS.pollStatuses, statuses);
}

export async function getPollMeta(): Promise<PollMeta> {
  const redis = getRedis();
  if (!redis) return { ...memory.pollMeta };

  const data = await redis.get<PollMeta>(KEYS.pollMeta);
  return data ?? {};
}

export async function patchPollMeta(patch: Partial<PollMeta>): Promise<void> {
  const meta = await getPollMeta();
  const next = { ...meta, ...patch };
  const redis = getRedis();
  if (!redis) {
    memory.pollMeta = next;
    return;
  }

  await redis.set(KEYS.pollMeta, next);
}

export async function getLiveFeed(matchId: string): Promise<MatchFeedResponse | null> {
  const redis = getRedis();
  if (!redis) return memory.liveFeeds.get(matchId) ?? null;

  return (await redis.get<MatchFeedResponse>(KEYS.liveFeed(matchId))) ?? null;
}

export async function setLiveFeed(
  matchId: string,
  feed: MatchFeedResponse
): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    memory.liveFeeds.set(matchId, feed);
    return;
  }

  await redis.set(KEYS.liveFeed(matchId), feed, { ex: 60 * 60 * 6 });
}

export async function deleteLiveFeed(matchId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    memory.liveFeeds.delete(matchId);
    return;
  }

  await redis.del(KEYS.liveFeed(matchId));
}

export async function getCompletedFeed(
  matchId: string
): Promise<MatchFeedResponse | null> {
  const redis = getRedis();
  if (!redis) return memory.completedFeeds.get(matchId) ?? null;

  return (await redis.get<MatchFeedResponse>(KEYS.completedFeed(matchId))) ?? null;
}

export async function hasCompletedFeed(matchId: string): Promise<boolean> {
  return (await getCompletedFeed(matchId)) != null;
}

export async function setCompletedFeed(
  matchId: string,
  feed: MatchFeedResponse
): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    memory.completedFeeds.set(matchId, feed);
    return;
  }

  await redis.set(KEYS.completedFeed(matchId), feed);
}

function filterFeedSince(
  feed: MatchFeedResponse,
  sinceMinute?: number
): MatchFeedResponse {
  if (sinceMinute == null) return feed;
  return {
    ...feed,
    feed: feed.feed.filter((update) => update.minute > sinceMinute),
  };
}

export async function getRuntimeFeed(
  matchId: string,
  sinceMinute?: number
): Promise<MatchFeedResponse | null> {
  const live = await getLiveFeed(matchId);
  if (live) return filterFeedSince(live, sinceMinute);

  const completed = await getCompletedFeed(matchId);
  if (completed) return filterFeedSince(completed, sinceMinute);

  return null;
}
