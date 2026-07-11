import type { MatchStatus } from "@/data/matchCatalog";

/**
 * On-demand live detection window.
 *
 * The committed schedule (`schedule.generated.ts`) freezes each match status at
 * build time, and the Redis overlay is only populated when cron runs. To make
 * live art work even without cron/Redis, the server probes the live API for any
 * match whose kickoff clock is currently inside this window.
 */
export const LIVE_WINDOW_BEFORE_MS = 15 * 60_000; // allow a slightly early kickoff
export const LIVE_WINDOW_AFTER_MS = 3.5 * 60 * 60_000; // covers ET + penalties + stoppage

export interface LiveWindowEntry {
  status: MatchStatus;
  kickoffAt?: string;
}

/** True when a match should be probed for a fresh live status from the API. */
export function isWithinLiveWindow(
  entry: LiveWindowEntry,
  now: number = Date.now()
): boolean {
  if (entry.status === "live") return true;
  if (entry.status === "completed") return false;
  if (!entry.kickoffAt) return false;

  const kickoff = Date.parse(entry.kickoffAt);
  if (Number.isNaN(kickoff)) return false;

  return now >= kickoff - LIVE_WINDOW_BEFORE_MS && now <= kickoff + LIVE_WINDOW_AFTER_MS;
}
